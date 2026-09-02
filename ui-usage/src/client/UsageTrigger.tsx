/**
 * Sidebar footer action opening the usage dashboard. The wide form carries a
 * label; the collapsed rail shows the data icon only. The panel renders as a
 * fixed full-viewport overlay descendant of this button, mirroring the
 * settings shell's geometry.
 */
import clsx from 'clsx'
import { IconDataOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the global useSessions/useWorkspaces standard seats and the
// `sidebar.footer.action` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-usage-report/types'
import { createUsageStore } from './usage-store.ts'
import { NS } from './locales.ts'
import { UsagePanel } from './UsagePanel.tsx'
import type { UsageInjected } from './UsagePanel.tsx'
import css from './UsageTrigger.module.css'

/** Store handle type of this plugin's registration. */
export type UsageStore = ReturnType<typeof createUsageStore>

/** Composed props: sidebar geometry + store seats + injected loaders + locale. */
export type UsageTriggerProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsStore<UsageStore>
  & UsageInjected
  & PropsLocale<typeof NS>

/**
 * Render the dashboard trigger and, while open, the dashboard panel.
 * @param props - composed slot props.
 * @returns the footer action button and the optional panel overlay.
 */
export function UsageTrigger({
  wide,
  useSessions,
  useWorkspaces,
  useStore,
  actions,
  t,
  loadReport,
  loadSessionLog,
}: UsageTriggerProps) {
  const workspaces = useWorkspaces(snapshot => snapshot.items)
  const currentSession = useSessions(snapshot => snapshot.current)
  const open = useStore(snapshot => snapshot.open)
  const currentWorkspaceId = workspaces.find(workspace =>
    currentSession !== undefined && workspace.sessionIds.includes(currentSession))
    ?.workspaceId
  const defaultWorkspaceId: WorkspaceId | undefined = currentWorkspaceId ?? workspaces[0]?.workspaceId

  return (
    <>
      <Tooltip label={t('trigger.aria')} delayMs={500} disabled={wide}>
        <button
          type="button"
          className={clsx(css.trigger, !wide && css.rail)}
          aria-label={t('trigger.aria')}
          onClick={() => { actions.openPanel(defaultWorkspaceId) }}
        >
          <IconDataOutline16 size={wide ? 14 : 18} />
          {wide && <span className={css.label}>{t('trigger.label')}</span>}
        </button>
      </Tooltip>
      {open && (
        <UsagePanel
          useStore={useStore}
          actions={actions}
          useWorkspaces={useWorkspaces}
          t={t}
          loadReport={loadReport}
          loadSessionLog={loadSessionLog}
        />
      )}
    </>
  )
}
