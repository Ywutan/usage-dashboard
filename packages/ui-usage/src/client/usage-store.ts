/**
 * Transient view state of the usage dashboard panel: open/close, the selected
 * Workspace, the last fetched report, and the load lifecycle. The Host owns
 * the report itself; this store only decides what the panel shows.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { UsageReportValue } from '@deepseek-ai/dsh-usage-report/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-usage-report/types'
import type { UsageRangeSelection } from './range.ts'

/** Panel state for one dashboard instance. */
export interface UsagePanelState {
  /** Whether the full-viewport panel is visible. */
  open: boolean
  /** Workspace the report is selected for. */
  workspaceId?: WorkspaceId
  /**
   * Report window selection. Defaults to the current local day so the first
   * open shows today's consumption; changing it drops the cached report.
   */
  range: UsageRangeSelection
  /** Last fetched report; null before the first successful load. */
  report: UsageReportValue | null
  /** Whether a report fetch is in flight. */
  loading: boolean
  /** Human-readable load failure; absent while healthy. */
  error?: string
}

type UsagePanelActions = {
  /** Open the panel, defaulting the selection to the current Workspace. */
  openPanel: (state: UsagePanelState, workspaceId?: WorkspaceId) => void
  /** Close the panel, keeping the cached report for a fast reopen. */
  closePanel: (state: UsagePanelState) => void
  /** Replace the report window; the stale report leaves immediately. */
  setRange: (state: UsagePanelState, range: UsageRangeSelection) => void
  /** Start a fetch for a Workspace; the stale report leaves immediately. */
  beginLoad: (state: UsagePanelState, workspaceId: WorkspaceId) => void
  /** Commit a fetched report. */
  finishLoad: (state: UsagePanelState, report: UsageReportValue) => void
  /** Record a fetch failure. */
  failLoad: (state: UsagePanelState, error: string) => void
  /** Abandon an in-flight fetch whose panel went away, so a later open retries. */
  cancelLoad: (state: UsagePanelState) => void
}

/**
 * Declare the usage dashboard's transient store.
 * @returns a non-persisted store handle whose instance is owned by the Slot registry.
 */
export function createUsageStore(): EngineStoreHandle<UsagePanelState, UsagePanelActions> {
  return defineStore({
    init: (): UsagePanelState => ({
      open: false,
      range: { kind: 'preset', preset: 'today' },
      report: null,
      loading: false,
    }),
    actions: {
      openPanel: (state, workspaceId) => {
        state.open = true
        delete state.error
        if (workspaceId !== undefined) state.workspaceId = workspaceId
      },
      closePanel: (state) => {
        state.open = false
      },
      setRange: (state, range) => {
        state.range = range
        state.loading = false
        state.report = null
        delete state.error
      },
      beginLoad: (state, workspaceId) => {
        state.workspaceId = workspaceId
        state.loading = true
        state.report = null
        delete state.error
      },
      finishLoad: (state, report) => {
        state.loading = false
        state.report = report
        delete state.error
      },
      failLoad: (state, error) => {
        state.loading = false
        state.error = error
      },
      cancelLoad: (state) => {
        // An aborted load settles nothing, so the flag it raised would outlive
        // it and the load effect — which skips while `loading` is true — would
        // never try again.
        state.loading = false
      },
    },
  })
}
