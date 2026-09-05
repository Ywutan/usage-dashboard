// @vitest-environment jsdom
/** Usage dashboard trigger/panel component behavior with a driven fixture runtime. */
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: the SlotMap and standard-props merges this file's fixture props
// rely on. A test compiles against ui-usage's emitted declarations, which
// erase the source's own side-effect imports, so the merges are declared here.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceSnapshot, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-usage-dashboard/types'
import type { UsageReportValue } from '@deepseek-ai/dsh-usage-dashboard/types'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import { en } from '../src/client/locales.ts'
import { createUsageStore, type UsagePanelState } from '../src/client/usage-store.ts'
import { UsageTrigger } from '../src/client/UsageTrigger.tsx'
import type { UsageInjected } from '../src/client/UsagePanel.tsx'

afterEach(cleanup)

const WID = 'workspace-a' as WorkspaceId
const WID_B = 'workspace-b' as WorkspaceId
const SID = SessionId('session-1')

const workspaceA: WorkspaceView = {
  workspaceId: WID,
  path: '/workspace-a',
  title: 'Alpha',
  sessionIds: [SID],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}
const workspaceB: WorkspaceView = {
  workspaceId: WID_B,
  path: '/workspace-b',
  title: 'Beta',
  sessionIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const sessionsState = {
  ids: [SID],
  byId: {},
  current: SID,
  phase: 'ready',
} as unknown as SessionListState

const workspacesState = {
  items: [workspaceA, workspaceB],
  archivedSessionIds: [],
  phase: 'ready',
} as unknown as WorkspaceSnapshot

/** A report for workspace A with one hour, one model, and one session row. */
function report(): UsageReportValue {
  return {
    workspaceId: WID,
    path: '/workspace-a',
    title: 'Alpha',
    generatedAt: 1_700_000_000_000,
    timeZone: 'UTC',
    totals: {
      sessions: 1,
      apiCalls: 2,
      toolCalls: 1,
      turns: 1,
      inputTokens: 150,
      outputTokens: 30,
      cacheReadTokens: 40,
      cacheWriteTokens: 0,
      totalTokens: 180,
      costUsd: 0.0123,
      unpricedCalls: 0,
      firstEventAt: 1_700_000_000_000,
      lastEventAt: 1_700_000_001_000,
    },
    byHour: [{
      hour: '2023-11-14T22:00:00',
      hourStart: 1_700_000_000_000,
      apiCalls: 2,
      inputTokens: 150,
      outputTokens: 30,
      cacheReadTokens: 40,
      cacheWriteTokens: 0,
      totalTokens: 180,
      costUsd: 0.0123,
    }],
    byModel: [{
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      apiCalls: 2,
      inputTokens: 150,
      outputTokens: 30,
      cacheReadTokens: 40,
      cacheWriteTokens: 0,
      totalTokens: 180,
      costUsd: 0.0123,
      unpriced: false,
    }],
    bySession: [{
      sessionId: SID,
      createdAt: '2026-01-01T00:00:00.000Z',
      apiCalls: 2,
      inputTokens: 150,
      outputTokens: 30,
      cacheReadTokens: 40,
      cacheWriteTokens: 0,
      totalTokens: 180,
      costUsd: 0.0123,
      firstEventAt: 1_700_000_000_000,
      lastEventAt: 1_700_000_001_000,
    }],
    unknownModels: [],
    pricing: {},
  }
}

/** Translate seat over the en dictionary with a common fallback. */
const seat = ((key: string) => (en as Record<string, string>)[key] ?? (commonEn as Record<string, string>)[key] ?? key) as never

/** Store instance type of this plugin's store handle. */
type UsageStoreInstance = ReturnType<ReturnType<typeof createUsageStore>['create']>

/** Render the trigger over a real store instance, driven through uSES. */
function renderTrigger(
  store: UsageStoreInstance,
  loaders: Partial<UsageInjected> = {},
) {
  const loadReport = loaders.loadReport ?? vi.fn()
  const loadSessionLog = loaders.loadSessionLog ?? vi.fn()
  const Hooked = (): React.ReactElement => {
    const snapshot = useSyncExternalStore(listener => store.subscribe(listener), () => store.getSnapshot())
    const useStore = <S,>(selector: (snapshot: UsagePanelState) => S): S => selector(snapshot)
    return (
      <UsageTrigger
        wide={false}
        useStore={useStore}
        actions={store.actions}
        useSessions={selector => selector(sessionsState)}
        useWorkspaces={selector => selector(workspacesState)}
        useSessionPendingInteraction={() => undefined as never}
        t={seat}
        loadReport={loadReport}
        loadSessionLog={loadSessionLog}
      />
    )
  }
  const result = render(<Hooked />)
  return { ...result, loadReport, loadSessionLog }
}

describe('UsageTrigger', () => {
  it('retries the load after a panel unmount aborted the previous one', () => {
    const store = createUsageStore().create()
    const first = renderTrigger(store)
    fireEvent.click(screen.getByRole('button', { name: en['trigger.aria'] }))
    expect(first.loadReport).toHaveBeenCalledTimes(1)
    // The loader never settles: the unmount below aborts it, which is what a
    // remount (React's development double-invoke, a slot re-mount) does to the
    // very first load a panel starts.
    store.actions.beginLoad(WID)
    first.unmount()

    const second = renderTrigger(store)

    expect(store.getSnapshot().loading).toBe(false)
    expect(second.loadReport).toHaveBeenCalledTimes(1)
  })

  it('opens the panel and loads the current workspace on click', () => {
    const store = createUsageStore().create()
    const { loadReport } = renderTrigger(store)

    fireEvent.click(screen.getByRole('button', { name: en['trigger.aria'] }))

    expect(store.getSnapshot().open).toBe(true)
    expect(store.getSnapshot().workspaceId).toBe(WID)
    // Default window is the current local day.
    expect(store.getSnapshot().range).toEqual({ kind: 'preset', preset: 'today' })
    expect(loadReport).toHaveBeenCalledWith(
      WID,
      expect.objectContaining({ start: expect.any(Number) as unknown as number, end: expect.any(Number) as unknown as number }),
      expect.any(AbortSignal),
    )
    expect(screen.getByText(en['panel.title'])).toBeDefined()
  })

  it('renders the report sections when a report is cached for the selection', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.finishLoad(report())
    const { loadReport } = renderTrigger(store)
    // Several labels legitimately repeat across cards, chart, and tables.
    const present = (key: keyof typeof en): void => {
      expect(screen.getAllByText(en[key]).length).toBeGreaterThan(0)
    }

    present('summary.apiCalls')
    present('summary.cost')
    present('chart.cost.title')
    present('model.title')
    present('session.title')
    expect(screen.getAllByText('2').length).toBeGreaterThan(0) // API calls value
    // The cached report matches the selection: no refetch.
    expect(loadReport).not.toHaveBeenCalled()
  })

  it('shows the load error and retries without an automatic retry loop', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.failLoad('boom')
    const { loadReport } = renderTrigger(store)

    expect(screen.getByText(/boom/)).toBeDefined()
    // The error guard keeps the mount effect from hammering a failing fetch.
    expect(loadReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['panel.retry'] }))
    expect(loadReport).toHaveBeenCalledWith(
      WID,
      expect.objectContaining({ start: expect.any(Number) as unknown as number, end: expect.any(Number) as unknown as number }),
      expect.any(AbortSignal),
    )
  })

  it('reloads when the workspace selection changes', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.finishLoad(report())
    const loadReport = vi.fn(async (
      workspaceId: WorkspaceId,
      _range: { start?: number; end?: number },
      _signal?: AbortSignal,
    ) => {
      store.actions.beginLoad(workspaceId)
    })
    renderTrigger(store, { loadReport })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: WID_B } })

    expect(loadReport).toHaveBeenCalledWith(
      WID_B,
      expect.objectContaining({ start: expect.any(Number) as unknown as number, end: expect.any(Number) as unknown as number }),
      expect.any(AbortSignal),
    )
    expect(store.getSnapshot().loading).toBe(true)
  })

  it('shows the empty state while no report is loaded', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    renderTrigger(store)

    expect(screen.getByText(en['panel.empty'])).toBeDefined()
  })
})

describe('trend granularity', () => {
  it('switches to a daily chart when the report spans multiple local dates', () => {
    const store = createUsageStore().create()
    const base = report()
    const multiDay = {
      ...base,
      byHour: [
        {
          ...base.byHour[0]!,
          hour: '2026-09-01T10:00:00',
          hourStart: new Date(2026, 8, 1, 10).getTime(),
        },
        {
          hour: '2026-09-02T10:00:00',
          hourStart: new Date(2026, 8, 2, 10).getTime(),
          apiCalls: 1,
          inputTokens: 5,
          outputTokens: 2,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 7,
          costUsd: 0.001,
        },
      ],
    }
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.finishLoad(multiDay)
    renderTrigger(store)

    expect(screen.getByText(en['chart.cost.title.daily'])).toBeDefined()
    expect(screen.getAllByText(/Sep 1/).length).toBeGreaterThan(0)
  })
})

describe('range selector', () => {
  it('refetches with the selected window when a preset changes', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.finishLoad(report())
    const loadReport = vi.fn(async (
      workspaceId: WorkspaceId,
      _range: { start?: number; end?: number },
      _signal?: AbortSignal,
    ) => {
      store.actions.beginLoad(workspaceId)
    })
    renderTrigger(store, { loadReport })

    fireEvent.click(screen.getByRole('button', { name: en['range.7d'] }))

    expect(store.getSnapshot().range).toEqual({ kind: 'preset', preset: '7d' })
    expect(store.getSnapshot().report).toBeNull()
    expect(loadReport).toHaveBeenCalledWith(
      WID,
      expect.objectContaining({ start: expect.any(Number) as unknown as number, end: expect.any(Number) as unknown as number }),
      expect.any(AbortSignal),
    )
  })

  it('switches into custom mode with date inputs and reloads on change', () => {
    const store = createUsageStore().create()
    store.actions.openPanel(WID)
    store.actions.beginLoad(WID)
    store.actions.finishLoad(report())
    const loadReport = vi.fn(async (
      workspaceId: WorkspaceId,
      _range: { start?: number; end?: number },
      _signal?: AbortSignal,
    ) => {
      store.actions.beginLoad(workspaceId)
    })
    renderTrigger(store, { loadReport })

    fireEvent.click(screen.getByRole('button', { name: en['range.custom'] }))

    const selection = store.getSnapshot().range
    expect(selection.kind).toBe('custom')
    expect(loadReport).toHaveBeenCalledTimes(1)

    // Changing the end date fires another windowed fetch.
    const startDate = selection.kind === 'custom' ? selection.startDate : '2026-01-01'
    const endInput = screen.getByLabelText(en['range.to'])
    fireEvent.change(endInput, { target: { value: '2026-01-05' } })
    expect(store.getSnapshot().range).toEqual({ kind: 'custom', startDate, endDate: '2026-01-05' })
    expect(loadReport).toHaveBeenCalledTimes(2)
  })
})
