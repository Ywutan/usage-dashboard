/**
 * Full-viewport usage dashboard panel: workspace selector, totals, hourly
 * cost chart, per-model and per-session tables, and per-session log
 * exploration. The panel owns no business state — it reads the store seats
 * and calls the injected loaders.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { IconCloseOutline16, IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  UsageReportValue,
  UsageSessionLogValue,
} from '../types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '../types.ts'
import type { BoundActions, SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `sidebar.footer.action` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { NS } from './locales.ts'
import { rangeBounds, type UsageRangeBounds, type UsageRangeSelection } from './range.ts'
import { createUsageStore, type UsagePanelState } from './usage-store.ts'
import { UsageRangeSelector } from './UsageRangeSelector.tsx'
import { projectTrend } from './aggregation.ts'
import { UsageTrendChart } from './UsageTrendChart.tsx'
import { UsageModelTable } from './UsageModelTable.tsx'
import { UsageSessionTable } from './UsageSessionTable.tsx'
import { UsageSummary } from './UsageSummary.tsx'
import css from './UsagePanel.module.css'

/** Store handle type of this plugin's registration. */
export type UsageStore = ReturnType<typeof createUsageStore>

/** Loaders supplied by the registration inject factory. */
export interface UsageInjected {
  /**
   * Fetch and commit the usage report for a Workspace over a window. The
   * optional signal cancels the Host read; an aborted fetch never commits state.
   */
  loadReport: (
    workspaceId: WorkspaceId,
    range: UsageRangeBounds,
    signal?: AbortSignal,
  ) => Promise<void>
  /** Fetch one Session's raw event log; null when the fetch fails. */
  loadSessionLog: (workspaceId: WorkspaceId, sessionId: SessionId) => Promise<UsageSessionLogValue | null>
}

/** Props the trigger threads into the panel. */
export interface UsagePanelProps {
  useStore: SnapshotSelectorHook<UsagePanelState>
  actions: BoundActions<UsageStore>
  useWorkspaces: PropsRuntime<'sidebar.footer.action'>['useWorkspaces']
  t: TranslateNS<typeof NS>
  loadReport: UsageInjected['loadReport']
  loadSessionLog: UsageInjected['loadSessionLog']
}

/**
 * Render the dashboard panel for the store-selected Workspace.
 * @param props - store seats, workspace list, loaders, and locale.
 * @returns the fixed full-viewport overlay, or null while closed.
 */
export function UsagePanel({
  useStore,
  actions,
  useWorkspaces,
  t,
  loadReport,
  loadSessionLog,
}: UsagePanelProps) {
  const open = useStore(snapshot => snapshot.open)
  const workspaceId = useStore(snapshot => snapshot.workspaceId)
  const rangeSelection = useStore(snapshot => snapshot.range)
  const report = useStore(snapshot => snapshot.report)
  const loading = useStore(snapshot => snapshot.loading)
  const error = useStore(snapshot => snapshot.error)
  const workspaces = useWorkspaces(snapshot => snapshot.items)
  const range: UsageRangeBounds = useMemo(() => rangeBounds(rangeSelection), [rangeSelection])

  // One live load at a time: a new load supersedes the previous one, and the
  // panel's unmount (close) cancels the in-flight Host read so a closed
  // dashboard never keeps the server busy or paints a stale error.
  const loadController = useRef<AbortController | undefined>(undefined)
  const startLoad = useCallback((target: WorkspaceId, window: UsageRangeBounds): void => {
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    void loadReport(target, window, controller.signal)
  }, [loadReport])
  // Reached through a ref so the cleanup never re-runs on the actions'
  // identity: a cleanup keyed to them would abort a healthy load whenever the
  // slot re-bakes its write set.
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  useEffect(() => () => {
    loadController.current?.abort()
    actionsRef.current.cancelLoad()
  }, [])

  // Load the report when the panel opens or the window/selection changes and
  // the cached report does not match; loadReport commits its own lifecycle
  // state. A range change clears the report in the store, so this effect
  // refetches. The error guard prevents an automatic retry loop after a
  // failure (Retry is the explicit path).
  useEffect(() => {
    if (!open || loading || error !== undefined) return
    if (workspaceId === undefined) return
    if (report !== null && report.workspaceId === workspaceId) return
    startLoad(workspaceId, range)
  }, [open, loading, workspaceId, report, error, range, startLoad])

  if (!open) return null

  return (
    <div className={css.panel} role="dialog" aria-modal="true" aria-label={t('panel.title')}>
      <header className={css.header}>
        <h1 className={css.title}>{t('panel.title')}</h1>
        <label className={css.workspaceLabel}>
          <span>{t('panel.workspace')}</span>
          <select
            className={css.workspaceSelect}
            value={workspaceId ?? ''}
            aria-label={t('panel.workspace')}
            onChange={(event) => {
              const selected = workspaces.find(workspace => workspace.workspaceId === event.target.value)
              if (selected !== undefined) startLoad(selected.workspaceId, range)
            }}
          >
            {workspaces.map(workspace => (
              <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.title}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={css.close}
          aria-label={t('panel.close')}
          onClick={() => { actions.closePanel() }}
        >
          <IconCloseOutline16 size={14} />
          <span>{t('panel.close')}</span>
        </button>
      </header>

      <div className={css.body}>
        <UsageRangeSelector
          range={rangeSelection}
          onChange={(selection: UsageRangeSelection) => { actions.setRange(selection) }}
          t={t}
        />
        {loading && (
          <p className={css.status}>
            <IconLoadingOutline16 size={14} className={css.spinner} />
            <span>{t('panel.loading')}</span>
          </p>
        )}
        {!loading && error !== undefined && (
          <div className={css.statusRow}>
            <p className={css.status}>{t('panel.error')}: {error}</p>
            <button
              type="button"
              className={css.retry}
              onClick={() => { if (workspaceId !== undefined) startLoad(workspaceId, range) }}
            >
              {t('panel.retry')}
            </button>
          </div>
        )}
        {!loading && error === undefined && report === null && (
          <p className={css.status}>{t('panel.empty')}</p>
        )}
        {!loading && error === undefined && report !== null && <DashboardBody report={report} props={{ t, loadSessionLog }} />}
      </div>
    </div>
  )
}

/** The report sections below the header; extracted so the panel stays small. */
function DashboardBody({
  report,
  props,
}: {
  report: UsageReportValue
  props: { t: UsagePanelProps['t']; loadSessionLog: UsageInjected['loadSessionLog'] }
}) {
  const { t, loadSessionLog } = props
  return (
    <>
      <UsageSummary totals={report.totals} unknownModels={report.unknownModels} t={t} />
      <UsageTrendChart
        series={projectTrend(report.byHour)}
        appliedRange={{
          ...report.rangeStart !== undefined ? { start: report.rangeStart } : {},
          ...report.rangeEnd !== undefined ? { end: report.rangeEnd } : {},
        }}
        t={t}
      />
      <UsageModelTable byModel={report.byModel} t={t} />
      <UsageSessionTable
        bySession={report.bySession}
        workspaceId={report.workspaceId}
        loadSessionLog={loadSessionLog}
        t={t}
      />
      <p className={css.note}>{t('pricing.note')}</p>
    </>
  )
}
