/**
 * Per-workspace usage report fold over session event logs: attribute each loop
 * response to the request header that preceded it and each compaction summary
 * to the route it recorded, price tokens with the built-in DeepSeek table
 * (peak and off-peak by UTC), and bucket the series by local hour in the
 * caller's IANA zone. Stored sessions are read through the handle-based
 * persistence seam and live ones from their in-memory log, so both paths fold
 * the same validated `SessionEvent` rows. I/O (registry lookup, persistence
 * reads) lives in the service; the fold and pricing helpers are pure so the
 * report logic is unit-testable.
 *
 * @module dsh-usage-report/usage
 */

import type { Context } from '@deepseek-ai/cordis'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { SessionPersistenceNotFoundError } from '@deepseek-ai/dsh-session-persistence'
// Type-only: pull the Context merges this service reads (registry, sessions).
import type {} from '@deepseek-ai/dsh-workspace'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {
  UsageLogEvent,
  UsageModelPrice,
  UsageReportRequest,
  UsageReportValue,
  UsageSessionLogRequest,
  UsageSessionLogValue,
  UsageSessionRow,
} from './types.ts'

/** One model response recorded from a session log: a loop response or a compaction summary. */
export interface UsageCall {
  /** Event append time, Unix epoch milliseconds. */
  readonly time: number
  /** Provider route the request header attributed, or the summary's own route; `unknown` when neither recorded one. */
  readonly provider: string
  /** Model id the request header attributed, or the summary's own model; `unknown` when neither recorded one. */
  readonly model: string
  /** Adapter-reported token accounting; absent when the adapter reported none. */
  readonly usage?: TokenUsage
}

/** One session's folded event log plus its header metadata. */
export interface FoldedSessionLog {
  readonly meta: SessionHeader
  /** Model responses in log order. */
  readonly calls: readonly UsageCall[]
  /** `tool/call` events. */
  readonly toolCalls: number
  /** `turn/start` events. */
  readonly turns: number
  /** Unix epoch milliseconds of the first folded event, 0 for an empty log. */
  readonly firstEventAt: number
  /** Unix epoch milliseconds of the last folded event, 0 for an empty log. */
  readonly lastEventAt: number
}

/** Aggregation counters shared by the totals, model, session, and hour folds. */
interface UsageAccumulator {
  apiCalls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  unpricedCalls: number
}

function emptyAccumulator(): UsageAccumulator {
  return {
    apiCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    unpricedCalls: 0,
  }
}

/** The official DeepSeek API pricing basis, checked against api-docs.deepseek.com on 2026-08-30. */
export const DEEPSEEK_PRICING: Readonly<Record<string, UsageModelPrice>> = {
  'deepseek-v4-flash': {
    cacheHitInputPerM: 0.007,
    cacheMissInputPerM: 0.22,
    outputPerM: 0.66,
    peak: { cacheHitInputPerM: 0.014, cacheMissInputPerM: 0.44, outputPerM: 1.32 },
  },
  'deepseek-v4-pro': {
    cacheHitInputPerM: 0.022,
    cacheMissInputPerM: 0.66,
    outputPerM: 1.98,
    peak: { cacheHitInputPerM: 0.044, cacheMissInputPerM: 1.32, outputPerM: 3.96 },
  },
  // Legacy aliases billed at flat rates, retained for logs recorded before
  // the V4 rename; they are absent from the current official model table.
  'deepseek-chat': { cacheHitInputPerM: 0.07, cacheMissInputPerM: 0.27, outputPerM: 1.1 },
  'deepseek-reasoner': { cacheHitInputPerM: 0.14, cacheMissInputPerM: 0.55, outputPerM: 2.19 },
}

/**
 * Resolve the USD price basis for one model id.
 * @param model - model id recorded in a session log.
 * @returns the price basis, or `undefined` when the model is not priced.
 */
export function modelPrice(model: string): UsageModelPrice | undefined {
  return DEEPSEEK_PRICING[model]
}

/**
 * Whether a UTC instant falls in the DeepSeek peak window (Monday–Friday,
 * 01:00–04:00 and 06:00–10:00 UTC; all other hours are off-peak).
 * @param epochMs - Unix epoch milliseconds.
 * @returns true during the peak window.
 */
export function isPeakUtc(epochMs: number): boolean {
  const date = new Date(epochMs)
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  const hour = date.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

/**
 * Price one model response. `TokenUsage` counts are disjoint: `inputTokens`
 * is uncached input, billed at the cache-miss rate, and `cacheReadTokens` is
 * the cache-hit input, billed at the hit rate; output tokens bill at the
 * output rate and cache-write tokens are not billed. Peak rates apply inside
 * the DeepSeek peak window.
 * @param price - the model's price basis.
 * @param usage - the response's token accounting.
 * @param epochMs - response time, decides the peak window.
 * @returns the estimated USD cost.
 */
export function priceCall(price: UsageModelPrice, usage: TokenUsage, epochMs: number): number {
  const basis = isPeakUtc(epochMs) && price.peak !== undefined ? price.peak : price
  const miss = Math.max(0, usage.inputTokens)
  const hit = Math.max(0, usage.cacheReadTokens ?? 0)
  const output = Math.max(0, usage.outputTokens)
  return (
    miss * basis.cacheMissInputPerM
    + hit * basis.cacheHitInputPerM
    + output * basis.outputPerM
  ) / 1_000_000
}

/**
 * Wall-clock hour parts of one instant in a zone.
 * @param formatter - one reusable formatter built by {@link buildHourFormatter}.
 * @param epochMs - instant to bucket.
 * @returns the local hour key and the Unix epoch milliseconds at that hour's start.
 */
export function hourBucketOf(
  formatter: Intl.DateTimeFormat,
  epochMs: number,
): { readonly key: string; readonly start: number } {
  const parts = formatter.formatToParts(epochMs)
  const field = (type: string): number => {
    const part = parts.find(entry => entry.type === type)
    // A formatter missing one of the parts buildHourFormatter requests would
    // silently misdate every bucket, so reject it instead of defaulting.
    if (part === undefined) throw new Error(`hour formatter has no "${type}" part`)
    return Number(part.value)
  }
  const year = field('year')
  const month = field('month')
  const day = field('day')
  const hour = field('hour')
  const key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`
  // The zone offset is the full wall clock interpreted as UTC minus the true
  // instant; the local hour start is that wall-clock hour shifted back by it.
  const offset = Date.UTC(year, month - 1, day, hour, field('minute'), field('second')) - epochMs
  const localHourStart = epochMs + offset - ((epochMs + offset) % 3_600_000)
  return { key, start: localHourStart - offset }
}

/**
 * Build one reusable local-hour formatter for a zone.
 * @param timeZone - IANA time-zone name.
 * @returns a formatter yielding year/month/day/hour/minute/second parts in that zone.
 */
export function buildHourFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
}

/** One event row consumed by the usage fold, from a stored read or live memory. */
interface EventRow {
  readonly time: number
  readonly type: string
  readonly data: unknown
}

/** An optional inclusive/exclusive window restricting which events a report folds. */
export interface ReportRange {
  /** Inclusive window start, Unix epoch milliseconds. */
  readonly start: number
  /** Exclusive window end, Unix epoch milliseconds. */
  readonly end: number
}

/** Whether an event instant falls inside a report window. */
function inRange(time: number, range: ReportRange | undefined): boolean {
  return range === undefined || (time >= range.start && time < range.end)
}

/** Fold event rows into model responses and counters. */
function foldEventRows(rows: readonly EventRow[], range?: ReportRange): {
  readonly calls: readonly UsageCall[]
  readonly toolCalls: number
  readonly turns: number
  readonly firstEventAt: number
  readonly lastEventAt: number
} {
  const calls: UsageCall[] = []
  let toolCalls = 0
  let turns = 0
  let firstEventAt = 0
  let lastEventAt = 0
  let provider: string | undefined
  let model: string | undefined

  for (const event of rows) {
    if (!inRange(event.time, range)) continue
    if (firstEventAt === 0 || event.time < firstEventAt) firstEventAt = event.time
    if (event.time > lastEventAt) lastEventAt = event.time
    const data = event.data as Record<string, unknown> | undefined
    switch (event.type) {
      case 'request/header': {
        const config = data?.header as { config?: { provider?: unknown; model?: unknown } } | undefined
        const headerConfig = config?.config
        if (typeof headerConfig?.provider === 'string') provider = headerConfig.provider
        if (typeof headerConfig?.model === 'string') model = headerConfig.model
        break
      }
      case 'assistant/message': {
        const usage = data?.usage
        calls.push({
          time: event.time,
          provider: provider ?? 'unknown',
          model: model ?? 'unknown',
          ...isTokenUsage(usage) ? { usage } : {},
        })
        break
      }
      case 'compaction/summary': {
        // A summarization call bills like any other model response but runs
        // outside the loop, so it carries its own route instead of billing
        // under the conversation's request header. An unmarked summary with
        // no usage is a template or foreign-backend summary: no call through
        // this context's LLM seam, nothing to account.
        const usage = data?.usage
        const accounted = isTokenUsage(usage)
        if (!accounted && data?.llmStreamCall !== true) break
        calls.push({
          time: event.time,
          provider: typeof data?.provider === 'string' ? data.provider : 'unknown',
          model: typeof data?.model === 'string' ? data.model : 'unknown',
          ...accounted ? { usage } : {},
        })
        break
      }
      case 'tool/call':
        toolCalls += 1
        break
      case 'turn/start':
        turns += 1
        break
    }
  }

  return { calls, toolCalls, turns, firstEventAt, lastEventAt }
}

/**
 * Fold one session's canonical events into model responses and counters.
 * Stored logs arrive from the persistence handle seam and live ones from the
 * running session's in-memory log; both are already validated `SessionEvent`
 * rows, so the fold is the only step either path needs.
 * @param meta - the session's storage header.
 * @param events - the session's canonical events, in log order.
 * @param range - optional window restricting which events are folded.
 * @returns the log fold.
 */
export function foldSessionLog(
  meta: SessionHeader,
  events: readonly EventRow[],
  range?: ReportRange,
): FoldedSessionLog {
  return { meta, ...foldEventRows(events, range) }
}

/** Structural guard over adapter-reported token accounting. */
function isTokenUsage(value: unknown): value is TokenUsage {
  return (
    typeof value === 'object' && value !== null
    && typeof (value as { inputTokens?: unknown }).inputTokens === 'number'
    && typeof (value as { outputTokens?: unknown }).outputTokens === 'number'
  )
}

/** Fold one call into an accumulator. */
function accumulate(acc: UsageAccumulator, call: UsageCall): void {
  acc.apiCalls += 1
  const usage = call.usage
  if (usage === undefined) return
  acc.inputTokens += usage.inputTokens
  acc.outputTokens += usage.outputTokens
  acc.cacheReadTokens += usage.cacheReadTokens ?? 0
  acc.cacheWriteTokens += usage.cacheWriteTokens ?? 0
  acc.totalTokens += usage.totalTokens ?? usage.inputTokens + usage.outputTokens
  const price = modelPrice(call.model)
  if (price === undefined) {
    acc.unpricedCalls += 1
    return
  }
  acc.costUsd += priceCall(price, usage, call.time)
}

/** The per-call cost delta and pricing status for one model response. */
function contribution(call: UsageCall): { readonly costUsd: number; readonly unpriced: boolean } {
  if (call.usage === undefined) return { costUsd: 0, unpriced: false }
  const price = modelPrice(call.model)
  if (price === undefined) return { costUsd: 0, unpriced: true }
  return { costUsd: priceCall(price, call.usage, call.time), unpriced: false }
}

/** Token totals contributed by one model response. */
function tokensOf(call: UsageCall): {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly totalTokens: number
} {
  const usage = call.usage
  if (usage === undefined) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
    }
  }
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
  }
}

/** Mutable per-model fold row, materialized as {@link UsageModelRow} at the end. */
interface MutableModelRow {
  provider: string
  model: string
  apiCalls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  unpriced: boolean
}

/** Mutable per-hour fold row, materialized as {@link UsageHourBucket} at the end. */
interface MutableHourBucket {
  hour: string
  hourStart: number
  apiCalls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
}

/** Mutable totals fold row, materialized as {@link UsageReportTotals} at the end. */
interface MutableTotals {
  sessions: number
  apiCalls: number
  toolCalls: number
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  unpricedCalls: number
  firstEventAt: number
  lastEventAt: number
}

/**
 * The optional inclusive/exclusive window a request asks for.
 * @param request - the report request carrying the optional bounds.
 * @returns the window, or undefined when the request set neither bound.
 */
export function rangeOf(request: UsageReportRequest): ReportRange | undefined {
  return request.rangeStart !== undefined || request.rangeEnd !== undefined
    ? {
      start: request.rangeStart ?? Number.NEGATIVE_INFINITY,
      end: request.rangeEnd ?? Number.POSITIVE_INFINITY,
    }
    : undefined
}

/**
 * Fold folded session logs into the complete report value.
 * @param request - the originating request, for the echoed window and zone.
 * @param path - canonical Workspace directory path.
 * @param title - Workspace display title.
 * @param generatedAt - Unix epoch milliseconds stamped on the report.
 * @param logs - one fold per accounted Session.
 * @returns totals, the hourly series, and the per-model and per-session aggregates.
 */
export function buildUsageReport(
  request: UsageReportRequest,
  path: string,
  title: string,
  generatedAt: number,
  logs: readonly FoldedSessionLog[],
): UsageReportValue {
  const range = rangeOf(request)
  const totals: MutableTotals = {
    sessions: 0,
    apiCalls: 0,
    toolCalls: 0,
    turns: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    unpricedCalls: 0,
    firstEventAt: 0,
    lastEventAt: 0,
  }
  const byModel = new Map<string, MutableModelRow>()
  const bySession = new Map<SessionId, UsageSessionRow>()
  const byHour = new Map<string, MutableHourBucket>()
  const unknownModels = new Set<string>()
  const formatter = buildHourFormatter(request.timeZone)

  for (const log of logs) {
    const sessionAcc: UsageAccumulator = emptyAccumulator()
    if (totals.firstEventAt === 0 || log.firstEventAt < totals.firstEventAt) {
      totals.firstEventAt = log.firstEventAt
    }
    if (log.lastEventAt > totals.lastEventAt) totals.lastEventAt = log.lastEventAt
    for (const call of log.calls) {
      const { costUsd, unpriced } = contribution(call)
      const tokens = tokensOf(call)
      accumulate(sessionAcc, call)
      accumulate(totals, call)
      if (unpriced) unknownModels.add(call.model)

      const modelKey = `${call.provider}/${call.model}`
      const modelRow = byModel.get(modelKey)
      if (modelRow === undefined) {
        byModel.set(modelKey, {
          provider: call.provider,
          model: call.model,
          apiCalls: 1,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          cacheReadTokens: tokens.cacheReadTokens,
          cacheWriteTokens: tokens.cacheWriteTokens,
          totalTokens: tokens.totalTokens,
          costUsd,
          unpriced,
        })
      } else {
        modelRow.apiCalls += 1
        modelRow.inputTokens += tokens.inputTokens
        modelRow.outputTokens += tokens.outputTokens
        modelRow.cacheReadTokens += tokens.cacheReadTokens
        modelRow.cacheWriteTokens += tokens.cacheWriteTokens
        modelRow.totalTokens += tokens.totalTokens
        modelRow.costUsd += costUsd
      }

      const bucket = hourBucketOf(formatter, call.time)
      const hourRow = byHour.get(bucket.key)
      if (hourRow === undefined) {
        byHour.set(bucket.key, {
          hour: bucket.key,
          hourStart: bucket.start,
          apiCalls: 1,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          cacheReadTokens: tokens.cacheReadTokens,
          cacheWriteTokens: tokens.cacheWriteTokens,
          totalTokens: tokens.totalTokens,
          costUsd,
        })
      } else {
        hourRow.apiCalls += 1
        hourRow.inputTokens += tokens.inputTokens
        hourRow.outputTokens += tokens.outputTokens
        hourRow.cacheReadTokens += tokens.cacheReadTokens
        hourRow.cacheWriteTokens += tokens.cacheWriteTokens
        hourRow.totalTokens += tokens.totalTokens
        hourRow.costUsd += costUsd
      }
    }

    totals.toolCalls += log.toolCalls
    totals.turns += log.turns
    // With a window, sessions whose events all fell outside it are not part
    // of the period and drop out of the per-session view and the session count.
    if (range !== undefined && sessionAcc.apiCalls === 0 && log.toolCalls === 0 && log.turns === 0) continue
    totals.sessions += 1
    bySession.set(log.meta.id, {
      sessionId: log.meta.id,
      createdAt: new Date(log.meta.createdAt).toISOString(),
      ...log.meta.parentSession !== undefined ? { parentSession: log.meta.parentSession } : {},
      apiCalls: sessionAcc.apiCalls,
      inputTokens: sessionAcc.inputTokens,
      outputTokens: sessionAcc.outputTokens,
      cacheReadTokens: sessionAcc.cacheReadTokens,
      cacheWriteTokens: sessionAcc.cacheWriteTokens,
      totalTokens: sessionAcc.totalTokens,
      costUsd: sessionAcc.costUsd,
      firstEventAt: log.firstEventAt,
      lastEventAt: log.lastEventAt,
    })
  }

  return {
    workspaceId: request.workspaceId,
    path,
    title,
    generatedAt,
    timeZone: request.timeZone,
    ...request.rangeStart !== undefined ? { rangeStart: request.rangeStart } : {},
    ...request.rangeEnd !== undefined ? { rangeEnd: request.rangeEnd } : {},
    totals: { ...totals },
    byHour: [...byHour.values()]
      .sort((a, b) => a.hourStart - b.hourStart)
      .map(row => ({ ...row })),
    byModel: [...byModel.values()]
      .sort((a, b) => b.costUsd - a.costUsd || b.apiCalls - a.apiCalls)
      .map(row => ({ ...row })),
    bySession: [...bySession.values()].sort((a, b) => b.lastEventAt - a.lastEventAt),
    unknownModels: [...unknownModels].sort(),
    pricing: DEEPSEEK_PRICING,
  }
}

/**
 * Project one canonical event onto the raw row the session-log view renders.
 * @param event - the stored event.
 * @returns its identity, instant, type, and lossless payload.
 */
function logEventOf(event: SessionEvent): UsageLogEvent {
  return {
    seq: event.seq,
    time: event.time,
    type: event.type,
    data: event.data as JsonValue,
  }
}

/** Newest event rows kept in one session-log response; older rows are dropped. */
export const MAX_USAGE_LOG_EVENTS = 500

/** Concurrent stored-log reads while folding a report; bounds memory while parallelizing I/O. */
const REPORT_READ_CONCURRENCY = 8

/** One stored session log read back through the persistence seam. */
interface StoredSessionLog {
  readonly header: SessionHeader
  readonly events: readonly SessionEvent[]
}

/** Compute the usage report for one Workspace from its persisted session logs. */
export class WorkspaceUsage {
  /** @param ctx - Host context carrying the Workspace registry and session persistence. */
  constructor(private readonly ctx: Context) {}

  /**
   * Fold every accounted Session log of a Workspace into a usage report.
   * Stored reads run concurrently (bounded) so a large Workspace does not
   * serialize every log read.
   * @param request - target Workspace and caller-local time zone.
   * @param signal - cancellation for persistence reads.
   * @returns the computed report.
   * @throws RemoteError `usage/workspace-not-found` when the Workspace is unknown.
   */
  async report(request: UsageReportRequest, signal: AbortSignal): Promise<UsageReportValue> {
    const workspace = this.ctx.workspaceRegistry.get(request.workspaceId)
    if (workspace === undefined) {
      throw new RemoteError(
        'usage/workspace-not-found',
        `cannot build a usage report: unknown workspace "${request.workspaceId}"`,
        { workspaceId: request.workspaceId },
      )
    }
    const range = rangeOf(request)
    const logs: FoldedSessionLog[] = []
    const ids = workspace.sessionIds
    const pending = ids[Symbol.iterator]()
    const worker = async (): Promise<void> => {
      for (;;) {
        signal.throwIfAborted()
        const next = pending.next()
        if (next.done === true) return
        const sessionId = next.value
        // Live sessions fold from the in-memory canonical log: their stored log
        // is being appended by the running loop, and the in-memory rows are the
        // same canonical events without the read.
        const live = this.ctx.sessions.get(sessionId)
        if (live !== undefined) {
          logs.push(foldSessionLog(live.header, live.snapshotEvents(), range))
          continue
        }
        const cold = await this.readStoredLog(sessionId, signal)
        if (cold === undefined) continue
        logs.push(foldSessionLog(cold.header, cold.events, range))
      }
    }
    await Promise.all(Array.from({ length: Math.min(REPORT_READ_CONCURRENCY, ids.length) }, worker))
    return buildUsageReport(request, workspace.path, workspace.title, Date.now(), logs)
  }

  /**
   * Read the raw event log of one Session accounted to a Workspace.
   * @param request - Workspace and Session identities.
   * @param signal - cancellation for persistence reads.
   * @returns the Session's creation instant and its newest event rows.
   * @throws RemoteError `usage/workspace-not-found` for an unknown Workspace,
   *   `usage/session-not-in-workspace` for a Session the Workspace does not
   *   account, and `usage/session-log-unavailable` when no stored log exists
   *   for the Session.
   */
  async sessionLog(
    request: UsageSessionLogRequest,
    signal: AbortSignal,
  ): Promise<UsageSessionLogValue> {
    const workspace = this.ctx.workspaceRegistry.get(request.workspaceId)
    if (workspace === undefined) {
      throw new RemoteError(
        'usage/workspace-not-found',
        `cannot read a session log: unknown workspace "${request.workspaceId}"`,
        { workspaceId: request.workspaceId },
      )
    }
    if (!workspace.sessionIds.includes(request.sessionId)) {
      throw new RemoteError(
        'usage/session-not-in-workspace',
        `session "${request.sessionId}" is not accounted to workspace "${request.workspaceId}"`,
        { workspaceId: request.workspaceId, sessionId: request.sessionId },
      )
    }
    const cold = await this.readStoredLog(request.sessionId, signal)
    if (cold === undefined) {
      throw new RemoteError(
        'usage/session-log-unavailable',
        `no persisted log exists for session "${request.sessionId}"`,
        { sessionId: request.sessionId },
      )
    }
    const truncated = cold.events.length > MAX_USAGE_LOG_EVENTS
    const kept = truncated ? cold.events.slice(-MAX_USAGE_LOG_EVENTS) : cold.events
    return {
      sessionId: request.sessionId,
      createdAt: new Date(cold.header.createdAt).toISOString(),
      truncated,
      events: kept.map(logEventOf),
    }
  }

  /**
   * Read one stored session log through a read handle, which never takes
   * ownership and so works while the session's writer holds it. Absence is a
   * value, not a failure: a Workspace keeps accounting a Session whose log has
   * been deleted, and both callers treat that as no data. The stored events
   * are returned as recorded — an interrupted tail is not repaired, because
   * neither an accounting fold nor a raw log view may show a response that was
   * never recorded.
   * @param sessionId - the stored Session to read.
   * @param signal - cancellation for the open and read.
   * @returns the stored header and events, or undefined when no log exists.
   */
  private async readStoredLog(
    sessionId: SessionId,
    signal: AbortSignal,
  ): Promise<StoredSessionLog | undefined> {
    const handle = await this.ctx.sessionPersistence.open(sessionId, 'read', { signal })
      .catch((error: unknown) => {
        if (error instanceof SessionPersistenceNotFoundError) return undefined
        throw error
      })
    if (handle === undefined) return undefined
    try {
      return { header: handle.header, events: await handle.read(undefined, undefined, { signal }) }
    } finally {
      await handle.close()
    }
  }
}
