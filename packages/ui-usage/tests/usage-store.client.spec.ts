/** Usage dashboard panel store behavior. */
import { describe, expect, it } from 'vitest'
import type { UsageReportValue, WorkspaceId } from '@deepseek-ai/dsh-usage-report/types'
import { createUsageStore } from '../src/client/usage-store.ts'

const WID = 'workspace-a' as WorkspaceId

function report(workspaceId = WID): UsageReportValue {
  return {
    workspaceId,
    path: '/workspace',
    title: 'Workspace',
    generatedAt: 1,
    timeZone: 'UTC',
    totals: {
      sessions: 0, apiCalls: 0, toolCalls: 0, turns: 0,
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      totalTokens: 0, costUsd: 0, unpricedCalls: 0, firstEventAt: 0, lastEventAt: 0,
    },
    byHour: [], byModel: [], bySession: [], unknownModels: [], pricing: {},
  }
}

describe('createUsageStore', () => {
  it('opens and closes the panel while caching the report', () => {
    const store = createUsageStore().create()

    expect(store.getSnapshot()).toMatchObject({
      open: false,
      report: null,
      loading: false,
      range: { kind: 'preset', preset: 'today' },
    })

    store.actions.openPanel(WID)
    expect(store.getSnapshot().open).toBe(true)
    expect(store.getSnapshot().workspaceId).toBe(WID)

    store.actions.beginLoad(WID)
    expect(store.getSnapshot().loading).toBe(true)
    expect(store.getSnapshot().report).toBeNull()

    store.actions.finishLoad(report())
    expect(store.getSnapshot().loading).toBe(false)
    expect(store.getSnapshot().report).toMatchObject({ workspaceId: WID })

    store.actions.closePanel()
    expect(store.getSnapshot().open).toBe(false)
    expect(store.getSnapshot().loading).toBe(false)
    // The cached report survives so a reopen renders immediately.
    expect(store.getSnapshot().report).toMatchObject({ workspaceId: WID })
  })

  it('clears the cached report when the window changes', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.finishLoad(report())
    expect(store.getSnapshot().report).not.toBeNull()

    store.actions.setRange({ kind: 'preset', preset: '7d' })
    expect(store.getSnapshot().range).toEqual({ kind: 'preset', preset: '7d' })
    expect(store.getSnapshot().report).toBeNull()
    expect(store.getSnapshot().loading).toBe(false)
  })

  it('records and clears load errors', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.failLoad('boom')
    expect(store.getSnapshot().error).toBe('boom')

    store.actions.beginLoad(WID)
    expect(store.getSnapshot().error).toBeUndefined()
  })
})
