/** Pure usage-report fold and pricing tests plus service error paths. */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import { SessionPersistenceNotFoundError } from '@deepseek-ai/dsh-session-persistence'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import {
  buildHourFormatter,
  buildUsageReport,
  rangeOf,
  DEEPSEEK_PRICING,
  foldSessionLog,
  hourBucketOf,
  isPeakUtc,
  MAX_USAGE_LOG_EVENTS,
  modelPrice,
  priceCall,
  WorkspaceUsage,
  type ReportRange,
} from '../src/usage.ts'
import type { UsageReportRequest } from '../src/types.ts'

const SID = SessionId('session-fixture')
const WID = WorkspaceId('workspace-fixture')

/** One canonical event row as the persistence seam hands it back. */
interface TestEvent {
  readonly seq: number
  readonly time: number
  readonly type: string
  readonly data: unknown
}

function header(id = SID, createdAt = 1_700_000_000_000, parentSession?: SessionId): SessionHeader {
  return {
    version: SESSION_FORMAT_VERSION,
    id,
    createdAt,
    isSeeded: false,
    ...parentSession !== undefined ? { parentSession } : {},
  }
}

function event(type: string, seq: number, time: number, data: unknown): TestEvent {
  return { type, seq, time, data }
}

/** A small fixture log: one turn, two steps, one tool call, two responses. */
function fixtureEvents(time = 1_700_000_000_000): readonly TestEvent[] {
  return [
    event('turn/start', 1, time, { turn: 1 }),
    event('request/header', 2, time, {
      header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } },
      reason: 'initial',
    }),
    event('step/start', 3, time, { turn: 1, step: 1 }),
    event('assistant/message', 4, time, {
      turn: 1,
      step: 1,
      message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120, cacheReadTokens: 40 },
    }),
    event('tool/call', 5, time, { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' }),
    event('tool/result', 6, time, { turn: 1, step: 1, message: { role: 'tool', content: 'ok' } }),
    event('request/header', 7, time + 1000, {
      header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } },
      reason: 'series',
    }),
    event('assistant/message', 8, time + 1000, {
      turn: 1,
      step: 2,
      message: { role: 'assistant', content: [{ type: 'text', text: 'world' }] },
      usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
    }),
  ]
}

describe('pricing', () => {
  it('carries the official DeepSeek V4 price basis', () => {
    expect(DEEPSEEK_PRICING['deepseek-v4-flash']).toEqual({
      cacheHitInputPerM: 0.007,
      cacheMissInputPerM: 0.22,
      outputPerM: 0.66,
      peak: { cacheHitInputPerM: 0.014, cacheMissInputPerM: 0.44, outputPerM: 1.32 },
    })
    expect(modelPrice('deepseek-v4-flash')).toBeDefined()
    expect(modelPrice('some-unknown-model')).toBeUndefined()
  })

  it('marks the DeepSeek peak window in UTC', () => {
    const monday = new Date('2026-09-07T02:00:00Z').getTime() // Monday
    const saturday = new Date('2026-09-05T02:00:00Z').getTime()
    const midday = new Date('2026-09-07T12:00:00Z').getTime()
    expect(isPeakUtc(monday)).toBe(true)
    expect(isPeakUtc(saturday)).toBe(false)
    expect(isPeakUtc(midday)).toBe(false)
  })

  it('prices off-peak and peak calls from the same basis', () => {
    const offPeak = new Date('2026-09-07T12:00:00Z').getTime()
    const peak = new Date('2026-09-07T02:00:00Z').getTime()
    const price = modelPrice('deepseek-v4-flash')!
    const usage = { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 250_000 }
    // 1M miss * 0.22 + 250K hit * 0.007 + 500K out * 0.66
    expect(priceCall(price, usage, offPeak)).toBeCloseTo(0.22 + 0.00175 + 0.33, 10)
    // 1M miss * 0.44 + 250K hit * 0.014 + 500K out * 1.32
    expect(priceCall(price, usage, peak)).toBeCloseTo(0.44 + 0.0035 + 0.66, 10)
  })

  it('bills cache reads on top of uncached input', () => {
    const price = modelPrice('deepseek-v4-flash')!
    // Counts are disjoint: cache reads are never a subset of `inputTokens`.
    const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 50 }
    expect(priceCall(price, usage, 0)).toBeCloseTo((10 * 0.22 + 50 * 0.007 + 5 * 0.66) / 1_000_000, 12)
  })

  it('never bills negative token counts', () => {
    const price = modelPrice('deepseek-v4-flash')!
    expect(priceCall(price, { inputTokens: -10, outputTokens: -5, cacheReadTokens: -50 }, 0)).toBe(0)
  })
})

describe('hour bucketing', () => {
  it('buckets an instant into the requested local hour', () => {
    // 2026-09-01T10:00:00Z is 12:00 in Europe/Paris (UTC+2 in summer).
    const instant = new Date('2026-09-01T10:30:00Z').getTime()
    const formatter = buildHourFormatter('Europe/Paris')
    const bucket = hourBucketOf(formatter, instant)
    expect(bucket.key).toBe('2026-09-01T12:00:00')
    expect(bucket.start).toBe(new Date('2026-09-01T10:00:00Z').getTime())
  })

  it('rejects a formatter that omits a part the bucket key needs', () => {
    const partial = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric' })
    expect(() => hourBucketOf(partial, 0)).toThrow('hour formatter has no "month" part')
  })

  it('buckets by UTC when requested', () => {
    const instant = new Date('2026-09-01T10:30:00Z').getTime()
    const bucket = hourBucketOf(buildHourFormatter('UTC'), instant)
    expect(bucket.key).toBe('2026-09-01T10:00:00')
    expect(bucket.start).toBe(new Date('2026-09-01T10:00:00Z').getTime())
  })
})

describe('foldSessionLog', () => {
  it('folds calls, tool calls, and turns', () => {
    const folded = foldSessionLog(header(), fixtureEvents())
    expect(folded.calls).toHaveLength(2)
    expect(folded.calls[0]).toMatchObject({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120, cacheReadTokens: 40 },
    })
    expect(folded.calls[1]).toMatchObject({ usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } })
    expect(folded.toolCalls).toBe(1)
    expect(folded.turns).toBe(1)
    expect(folded.firstEventAt).toBe(1_700_000_000_000)
    expect(folded.lastEventAt).toBe(1_700_000_001_000)
  })

  it('folds an empty log to zeroed instants', () => {
    const folded = foldSessionLog(header(), [])
    expect(folded).toMatchObject({ calls: [], toolCalls: 0, turns: 0, firstEventAt: 0, lastEventAt: 0 })
  })

  it('attributes calls to unknown before any request header', () => {
    const folded = foldSessionLog(header(), [
      event('assistant/message', 1, 1_700_000_000_000, {
        turn: 1,
        step: 1,
        message: { role: 'assistant', content: [] },
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    ])
    expect(folded.calls[0]).toMatchObject({ provider: 'unknown', model: 'unknown' })
  })

  it('keeps the attributed route when a header records no config', () => {
    const time = 1_700_000_000_000
    const folded = foldSessionLog(header(), [
      event('request/header', 1, time, {
        header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } },
        reason: 'initial',
      }),
      event('request/header', 2, time, { reason: 'series' }),
      event('assistant/message', 3, time, {
        turn: 1,
        step: 1,
        message: { role: 'assistant', content: [] },
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    ])
    expect(folded.calls[0]).toMatchObject({ provider: 'deepseek-official', model: 'deepseek-v4-flash' })
  })

  it('counts a response whose adapter reported no usage', () => {
    const time = 1_700_000_000_000
    const folded = foldSessionLog(header(), [
      event('assistant/message', 1, time, { turn: 1, step: 1, message: { role: 'assistant', content: [] } }),
    ])
    expect(folded.calls).toEqual([{ time, provider: 'unknown', model: 'unknown' }])
  })

  it('accounts compaction summaries under the route they recorded', () => {
    const time = 1_700_000_000_000
    const folded = foldSessionLog(header(), [
      event('request/header', 1, time, {
        header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-pro' } },
        reason: 'initial',
      }),
      event('compaction/summary', 2, time, {
        compactionId: 'c1',
        summary: [],
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        usage: { inputTokens: 900, outputTokens: 100 },
        llmStreamCall: true,
      }),
      event('assistant/message', 3, time, {
        turn: 1,
        step: 1,
        message: { role: 'assistant', content: [] },
        usage: { inputTokens: 10, outputTokens: 2 },
      }),
    ])
    expect(folded.calls).toHaveLength(2)
    expect(folded.calls[0]).toMatchObject({
      model: 'deepseek-v4-flash',
      usage: { inputTokens: 900, outputTokens: 100 },
    })
    // The summarization route is its own; it never displaces the header the
    // conversation's next response bills under.
    expect(folded.calls[1]).toMatchObject({ model: 'deepseek-v4-pro' })
  })

  it('skips an unmarked compaction summary that reports no usage', () => {
    const folded = foldSessionLog(header(), [
      event('compaction/summary', 1, 1_700_000_000_000, {
        compactionId: 'c1',
        summary: [],
        provider: 'template',
        model: 'none',
      }),
    ])
    expect(folded.calls).toEqual([])
  })

  it('counts a seam-marked summary whose adapter reported no usage', () => {
    const time = 1_700_000_000_000
    // A summary whose recorded route did not survive the log still counts as
    // one call, attributed to `unknown` like a headerless response.
    const folded = foldSessionLog(header(), [
      event('compaction/summary', 1, time, { compactionId: 'c1', summary: [], llmStreamCall: true }),
    ])
    expect(folded.calls).toEqual([{ time, provider: 'unknown', model: 'unknown' }])
  })
})

describe('buildUsageReport', () => {
  const request: UsageReportRequest = { workspaceId: WID, timeZone: 'UTC' }

  it('aggregates totals, hours, models, and sessions across logs', () => {
    const log = foldSessionLog(header(), fixtureEvents())
    const report = buildUsageReport(request, '/workspace', 'Workspace', 1_700_000_000_500, [log])

    expect(report.totals).toMatchObject({
      sessions: 1,
      apiCalls: 2,
      toolCalls: 1,
      turns: 1,
      inputTokens: 150,
      outputTokens: 30,
      cacheReadTokens: 40,
      totalTokens: 180,
    })
    expect(report.totals.costUsd).toBeGreaterThan(0)
    expect(report.totals.unpricedCalls).toBe(0)
    expect(report.byHour).toHaveLength(1)
    expect(report.byHour[0]).toMatchObject({ hour: '2023-11-14T22:00:00', apiCalls: 2 })
    expect(report.byModel).toHaveLength(1)
    expect(report.byModel[0]).toMatchObject({ model: 'deepseek-v4-flash', apiCalls: 2, unpriced: false })
    expect(report.bySession).toHaveLength(1)
    expect(report.bySession[0]).toMatchObject({ sessionId: SID, apiCalls: 2 })
    expect(report.unknownModels).toEqual([])
  })

  it('orders hours chronologically, models by cost, and sessions by recency', () => {
    const time = 1_700_000_000_000
    const later = time + 3_600_000
    const other = SessionId('session-fixture-2')
    const unpriced: readonly TestEvent[] = [
      event('request/header', 1, later, {
        header: { config: { provider: 'p', model: 'mystery-a' } },
        reason: 'initial',
      }),
      event('assistant/message', 2, later, {
        turn: 1,
        step: 1,
        message: { role: 'assistant', content: [] },
        usage: { inputTokens: 5, outputTokens: 1 },
      }),
      event('request/header', 3, later, {
        header: { config: { provider: 'p', model: 'mystery-b' } },
        reason: 'series',
      }),
      event('assistant/message', 4, later, {
        turn: 1,
        step: 2,
        message: { role: 'assistant', content: [] },
        usage: { inputTokens: 2, outputTokens: 1 },
      }),
      // No usage reported: the call is counted, its tokens and cost are not.
      event('assistant/message', 5, later, { turn: 1, step: 3, message: { role: 'assistant', content: [] } }),
    ]
    const report = buildUsageReport(request, '/workspace', 'Workspace', later + 500, [
      foldSessionLog(header(SID, time), fixtureEvents()),
      foldSessionLog(header(other, time), unpriced),
    ])

    expect(report.byHour.map(bucket => bucket.hour))
      .toEqual(['2023-11-14T22:00:00', '2023-11-14T23:00:00'])
    // Priced first; the two unpriced routes tie at zero and split on call count.
    expect(report.byModel.map(row => row.model))
      .toEqual(['deepseek-v4-flash', 'mystery-b', 'mystery-a'])
    expect(report.bySession.map(row => row.sessionId)).toEqual([other, SID])
    expect(report.bySession[0]).toMatchObject({ apiCalls: 3, inputTokens: 7, totalTokens: 9 })
    expect(report.totals.unpricedCalls).toBe(2)
    expect(report.unknownModels).toEqual(['mystery-a', 'mystery-b'])
  })

  it('carries the parent session of a subagent child row', () => {
    const child = SessionId('session-child')
    const parent = SessionId('session-parent')
    const report = buildUsageReport(request, '/workspace', 'Workspace', 1_700_000_000_500, [
      foldSessionLog(header(child, 1_700_000_000_000, parent), fixtureEvents()),
    ])
    expect(report.bySession[0]).toMatchObject({ sessionId: child, parentSession: parent })
  })

  it('folds only responses inside the requested window', () => {
    const range: ReportRange = { start: 1_700_000_000_000, end: 1_700_000_001_000 }
    const report = buildUsageReport(
      { workspaceId: WID, timeZone: 'UTC', rangeStart: range.start, rangeEnd: range.end },
      '/workspace',
      'Workspace',
      1_700_000_000_500,
      [foldSessionLog(header(), fixtureEvents(), range)],
    )
    // Fixture calls sit at t and t+1000: only the first falls inside the window.
    expect(report.totals.apiCalls).toBe(1)
    expect(report.totals.inputTokens).toBe(100)
    expect(report.byHour[0]).toMatchObject({ apiCalls: 1 })
    expect(report.bySession[0]).toMatchObject({ sessionId: SID, apiCalls: 1 })
  })

  it('drops sessions whose activity all fell outside the window', () => {
    const range: ReportRange = { start: 1_700_000_100_000, end: 1_700_000_200_000 }
    const report = buildUsageReport(
      { workspaceId: WID, timeZone: 'UTC', rangeStart: range.start, rangeEnd: range.end },
      '/workspace',
      'Workspace',
      1_700_000_100_000,
      [foldSessionLog(header(), fixtureEvents(), range)],
    )
    expect(report.totals.sessions).toBe(0)
    expect(report.bySession).toHaveLength(0)
    expect(report.byHour).toHaveLength(0)
  })

  it('keeps every session when no window is requested', () => {
    const report = buildUsageReport(
      { workspaceId: WID, timeZone: 'UTC' },
      '/workspace',
      'Workspace',
      1_700_000_000_500,
      [foldSessionLog(header(), fixtureEvents())],
    )
    expect(report.totals.sessions).toBe(1)
    expect(report.totals.apiCalls).toBe(2)
  })

  it('derives a window from one-sided requests', () => {
    expect(rangeOf({ workspaceId: WID, timeZone: 'UTC' })).toBeUndefined()
    expect(rangeOf({ workspaceId: WID, timeZone: 'UTC', rangeStart: 5 }))
      .toEqual({ start: 5, end: Number.POSITIVE_INFINITY })
    expect(rangeOf({ workspaceId: WID, timeZone: 'UTC', rangeEnd: 9 }))
      .toEqual({ start: Number.NEGATIVE_INFINITY, end: 9 })
  })

  it('flags unknown models as unpriced', () => {
    const report = buildUsageReport(
      request,
      '/workspace',
      'Workspace',
      1_700_000_000_500,
      [foldSessionLog(header(), [
        event('request/header', 1, 1_700_000_000_000, {
          header: { config: { provider: 'p', model: 'mystery-model' } },
          reason: 'initial',
        }),
        event('assistant/message', 2, 1_700_000_000_000, {
          turn: 1,
          step: 1,
          message: { role: 'assistant', content: [] },
          usage: { inputTokens: 10, outputTokens: 5 },
        }),
      ])],
    )
    expect(report.unknownModels).toEqual(['mystery-model'])
    expect(report.totals.costUsd).toBe(0)
    expect(report.totals.unpricedCalls).toBe(1)
    expect(report.byModel[0]).toMatchObject({ unpriced: true, costUsd: 0 })
  })
})

describe('WorkspaceUsage service', () => {
  /** Track every read handle the service opened, to assert it closes them. */
  const closed: SessionId[] = []

  function harness(
    stored: Map<string, readonly TestEvent[]>,
    live: Map<string, readonly TestEvent[]> = new Map(),
    openFailure?: Error,
  ) {
    const ctx = new Context()
    const workspace = {
      id: WID,
      path: '/workspace',
      title: 'Workspace',
      sessionIds: [SID],
    }
    ctx.provide('workspaceRegistry', {
      get: vi.fn((id: WorkspaceId) => (id === WID ? workspace : undefined)),
    } as never)
    ctx.provide('sessionPersistence', {
      open: vi.fn(async (id: SessionId) => {
        if (openFailure !== undefined) throw openFailure
        const events = stored.get(id)
        if (events === undefined) throw new SessionPersistenceNotFoundError(id)
        return {
          header: header(id, 1),
          read: async () => events,
          close: async () => {
            closed.push(id)
          },
        }
      }),
    } as never)
    ctx.provide('sessions', {
      get: vi.fn((id: SessionId) => {
        const events = live.get(id)
        return events === undefined ? undefined : { header: header(id, 1), snapshotEvents: () => events }
      }),
    } as never)
    return new WorkspaceUsage(ctx)
  }

  it('reports over stored session logs and closes every read handle', async () => {
    closed.length = 0
    const usage = harness(new Map([[SID, fixtureEvents()]]))
    const report = await usage.report({ workspaceId: WID, timeZone: 'UTC' }, new AbortController().signal)
    expect(report.totals.apiCalls).toBe(2)
    expect(report.path).toBe('/workspace')
    expect(closed).toEqual([SID])
  })

  it('folds live in-memory sessions without a stored read', async () => {
    const usage = harness(new Map(), new Map([[SID, [
      event('request/header', 1, 1_700_000_000_000, { header: { config: { provider: 'p', model: 'm' } } }),
      event('assistant/message', 2, 1_700_000_000_000, { usage: { inputTokens: 5, outputTokens: 3 } }),
    ]]]))
    const report = await usage.report({ workspaceId: WID, timeZone: 'UTC' }, new AbortController().signal)
    expect(report.totals.apiCalls).toBe(1)
    expect(report.totals.inputTokens).toBe(5)
    expect(report.byModel[0]).toMatchObject({ provider: 'p', model: 'm' })
  })

  it('skips an accounted session with no stored log and no live log', async () => {
    const usage = harness(new Map())
    const report = await usage.report({ workspaceId: WID, timeZone: 'UTC' }, new AbortController().signal)
    expect(report.totals.sessions).toBe(0)
    expect(report.bySession).toEqual([])
  })

  it('propagates an open failure that is not an absent log', async () => {
    const usage = harness(new Map(), new Map(), new Error('disk gone'))
    await expect(usage.report(
      { workspaceId: WID, timeZone: 'UTC' },
      new AbortController().signal,
    )).rejects.toThrow('disk gone')
  })

  it('observes cancellation before reading the next session', async () => {
    const usage = harness(new Map([[SID, fixtureEvents()]]))
    const controller = new AbortController()
    controller.abort()
    await expect(usage.report(
      { workspaceId: WID, timeZone: 'UTC' },
      controller.signal,
    )).rejects.toThrow()
  })

  it('rejects an unknown workspace', async () => {
    const usage = harness(new Map())
    await expect(usage.report(
      { workspaceId: WorkspaceId('missing'), timeZone: 'UTC' },
      new AbortController().signal,
    )).rejects.toMatchObject({ code: 'usage/workspace-not-found' })
  })

  it('reads a session log and truncates to the newest events', async () => {
    const events: TestEvent[] = []
    for (let seq = 1; seq <= MAX_USAGE_LOG_EVENTS + 10; seq++) {
      events.push(event('turn/start', seq, 1_700_000_000_000 + seq, { turn: seq }))
    }
    const usage = harness(new Map([[SID, events]]))
    const log = await usage.sessionLog({ workspaceId: WID, sessionId: SID }, new AbortController().signal)
    expect(log.truncated).toBe(true)
    expect(log.events).toHaveLength(MAX_USAGE_LOG_EVENTS)
    expect(log.events[0]).toMatchObject({ seq: 11 })
    expect(log.events.at(-1)).toMatchObject({ seq: MAX_USAGE_LOG_EVENTS + 10 })
  })

  it('returns a short log untruncated, with the stored payload verbatim', async () => {
    const usage = harness(new Map([[SID, fixtureEvents()]]))
    const log = await usage.sessionLog({ workspaceId: WID, sessionId: SID }, new AbortController().signal)
    expect(log.truncated).toBe(false)
    expect(log.events).toHaveLength(8)
    expect(log.events[0]).toEqual({ seq: 1, time: 1_700_000_000_000, type: 'turn/start', data: { turn: 1 } })
    expect(log.createdAt).toBe(new Date(1).toISOString())
  })

  it('rejects a session not accounted to the workspace and a missing log', async () => {
    const usage = harness(new Map())
    const foreign = SessionId('foreign')
    await expect(usage.sessionLog(
      { workspaceId: WID, sessionId: foreign },
      new AbortController().signal,
    )).rejects.toMatchObject({ code: 'usage/session-not-in-workspace' })
    await expect(usage.sessionLog(
      { workspaceId: WID, sessionId: SID },
      new AbortController().signal,
    )).rejects.toMatchObject({ code: 'usage/session-log-unavailable' })
  })

  it('maps unknown workspaces to RemoteError', async () => {
    const usage = harness(new Map())
    const error = await usage.sessionLog(
      { workspaceId: WorkspaceId('missing'), sessionId: SID },
      new AbortController().signal,
    ).then(() => null, (reason: unknown) => reason)
    expect(error).toBeInstanceOf(RemoteError)
  })
})
