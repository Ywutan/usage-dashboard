// @vitest-environment jsdom
/** ui-usage browser half: trigger registration, loader wiring, and disposal. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the `sidebar.footer.action` SlotMap merge. A test compiles against
// ui-usage's emitted declarations, which erase the source's own side-effect
// import, so the merge this file depends on is declared here.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-usage-dashboard/types'
import type { UsageReportValue } from '@deepseek-ai/dsh-usage-dashboard/types'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { UsageTrigger } from '../src/client/UsageTrigger.tsx'
import type { UsageInjected } from '../src/client/UsagePanel.tsx'
import { apply, inject } from '../src/client/index.ts'

const WID = 'workspace-a' as WorkspaceId
const SID = SessionId('session-1')

function okReport(): UsageReportValue {
  return {
    workspaceId: WID,
    path: '/workspace-a',
    title: 'Alpha',
    generatedAt: 1_700_000_000_000,
    timeZone: 'UTC',
    totals: {
      sessions: 1, apiCalls: 2, toolCalls: 1, turns: 1,
      inputTokens: 150, outputTokens: 30, cacheReadTokens: 40, cacheWriteTokens: 0,
      totalTokens: 180, costUsd: 0.0123, unpricedCalls: 0,
      firstEventAt: 1_700_000_000_000, lastEventAt: 1_700_000_001_000,
    },
    byHour: [], byModel: [], bySession: [], unknownModels: [], pricing: {},
  }
}

interface BenchRemote {
  report?: (request: unknown) => Promise<unknown>
  sessionLog?: (request: unknown) => Promise<unknown>
}

async function bench(remote: BenchRemote) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  slots.register(
    { name: 'root', children: { 'sidebar.footer.action': { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  // The plugin mounts the generated `usage` Remote contribution itself; the
  // bench remote exposes `$mount` (a settler) and the `usage` namespace.
  ctx.provide('remote', {
    $mount: vi.fn(() => () => {}),
    usage: remote,
  } as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, fiber }
}

/** Fake bound actions recording every call. */
function fakeActions() {
  return {
    beginLoad: vi.fn(),
    finishLoad: vi.fn(),
    failLoad: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
  }
}

describe('apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['remote', 'slots', 'locale'])
  })

  it('registers the trigger and loads reports through the usage remote', async () => {
    const report = vi.fn(async () => ({ ok: true, value: okReport() }))
    const sessionLog = vi.fn(async () => ({
      ok: true,
      value: { sessionId: SID, createdAt: '2026-01-01T00:00:00.000Z', truncated: false, events: [] },
    }))
    const { slots, fiber } = await bench({ report, sessionLog })
    const entry = slots.entries('sidebar.footer.action')
      .find(candidate => candidate.component === UsageTrigger)
    expect(entry).toBeDefined()

    const actions = fakeActions()
    const face = (entry!.inject as unknown as (actions: unknown) => UsageInjected)(actions)
    await face.loadReport(WID, { start: 1, end: 2 })
    // loadReport without a caller signal forwards `undefined` to the Remote.
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: WID,
      timeZone: expect.any(String) as unknown as string,
      rangeStart: 1,
      rangeEnd: 2,
    }), undefined)
    expect(actions.beginLoad).toHaveBeenCalledWith(WID)
    expect(actions.finishLoad).toHaveBeenCalledWith(okReport())

    await face.loadSessionLog(WID, SID)
    expect(sessionLog).toHaveBeenCalledWith({ workspaceId: WID, sessionId: SID })

    // Disposal removes the contribution (HMR-safe registration).
    await fiber.dispose()
    expect(slots.entries('sidebar.footer.action')).toHaveLength(0)
  })

  it('maps report failures into the store error and session-log failures to null', async () => {
    const report = vi.fn(async () => ({
      ok: false,
      error: { code: 'usage/workspace-not-found', message: 'missing' },
    }))
    const sessionLog = vi.fn(async () => ({
      ok: false,
      error: { code: 'workspace/session-log-unavailable', message: 'nope' },
    }))
    const { slots } = await bench({ report, sessionLog })
    const entry = slots.entries('sidebar.footer.action')
      .find(candidate => candidate.component === UsageTrigger)
    if (entry === undefined) throw new Error('usage trigger was not registered')

    const actions = fakeActions()
    const face = (entry.inject as unknown as (actions: unknown) => UsageInjected)(actions)
    await face.loadReport(WID, {})
    expect(actions.failLoad).toHaveBeenCalledWith('missing')
    expect(actions.finishLoad).not.toHaveBeenCalled()

    await expect(face.loadSessionLog(WID, SID)).resolves.toBeNull()
  })

  it('settles the lifecycle when the remote rejects and skips aborted fetches', async () => {
    const report = vi.fn(async () => { throw new Error('carrier lost') })
    const { slots } = await bench({ report })
    const entry = slots.entries('sidebar.footer.action')
      .find(candidate => candidate.component === UsageTrigger)
    if (entry === undefined) throw new Error('usage trigger was not registered')

    const actions = fakeActions()
    const face = (entry.inject as unknown as (actions: unknown) => UsageInjected)(actions)
    await face.loadReport(WID, {})
    expect(actions.failLoad).toHaveBeenCalledWith('carrier lost')

    // An aborted fetch must not paint an error over a closed panel.
    const aborted = new AbortController()
    aborted.abort()
    await face.loadReport(WID, {}, aborted.signal)
    expect(actions.failLoad).toHaveBeenCalledTimes(1)
  })
})
