/**
 * Per-session usage table of the dashboard with an inline raw-log explorer.
 * Expanding a row fetches that Session's newest events through the injected
 * loader and renders them as compact time/seq/type/summary rows.
 */
import { useEffect, useState } from 'react'
import type {
  UsageSessionLogValue,
  UsageSessionRow,
} from '../types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '../types.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { compactJson, eventSummary, formatDuration, formatEventTime, formatTokens, formatUsd } from './format.ts'
import { NS } from './locales.ts'
import type { UsageInjected } from './UsagePanel.tsx'
import css from './UsageSessionTable.module.css'

/** Per-session table props. */
export interface UsageSessionTableProps {
  bySession: readonly UsageSessionRow[]
  workspaceId: WorkspaceId
  loadSessionLog: UsageInjected['loadSessionLog']
  t: TranslateNS<typeof NS>
}

/**
 * Render the per-session table with expandable log explorers.
 * @param props - session aggregates, owning Workspace, loader, and locale.
 * @returns the table section, or null when no session rows exist.
 */
export function UsageSessionTable({ bySession, workspaceId, loadSessionLog, t }: UsageSessionTableProps) {
  if (bySession.length === 0) return null
  return (
    <section aria-label={t('session.title')}>
      <h2 className={css.heading}>{t('session.title')}</h2>
      <table className={css.table}>
        <thead>
          <tr>
            <th scope="col">{t('session.name')}</th>
            <th scope="col">{t('session.calls')}</th>
            <th scope="col">{t('summary.inputTokens')}</th>
            <th scope="col">{t('summary.outputTokens')}</th>
            <th scope="col">{t('session.cost')}</th>
            <th scope="col">{t('session.duration')}</th>
            <th scope="col" aria-label={t('session.explore')} />
          </tr>
        </thead>
        <tbody>
          {bySession.map(row => (
            <SessionRow
              key={row.sessionId}
              row={row}
              workspaceId={workspaceId}
              loadSessionLog={loadSessionLog}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** One session row plus its expandable explorer. */
function SessionRow({
  row,
  workspaceId,
  loadSessionLog,
  t,
}: {
  row: UsageSessionRow
  workspaceId: WorkspaceId
  loadSessionLog: UsageInjected['loadSessionLog']
  t: TranslateNS<typeof NS>
}) {
  const [expanded, setExpanded] = useState(false)
  const duration = row.lastEventAt > row.firstEventAt ? row.lastEventAt - row.firstEventAt : 0
  return (
    <>
      <tr className={css.row}>
        <td>
          <span className={css.sessionId}>{row.sessionId}</span>
          <span className={css.created}>{t('session.created')}: {new Date(row.createdAt).toLocaleString()}</span>
        </td>
        <td>{row.apiCalls}</td>
        <td>{formatTokens(row.inputTokens)}</td>
        <td>{formatTokens(row.outputTokens)}</td>
        <td>{formatUsd(row.costUsd)}</td>
        <td>{duration > 0 ? formatDuration(duration) : '—'}</td>
        <td>
          <button
            type="button"
            className={css.explore}
            aria-expanded={expanded}
            onClick={() => { setExpanded(!expanded) }}
          >
            {expanded ? t('session.collapse') : t('session.explore')}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className={css.explorerRow}>
          <td colSpan={7}>
            <SessionLogExplorer
              workspaceId={workspaceId}
              sessionId={row.sessionId}
              loadSessionLog={loadSessionLog}
              t={t}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/** Load and render one session's raw event log. */
function SessionLogExplorer({
  workspaceId,
  sessionId,
  loadSessionLog,
  t,
}: {
  workspaceId: WorkspaceId
  sessionId: SessionId
  loadSessionLog: UsageInjected['loadSessionLog']
  t: TranslateNS<typeof NS>
}) {
  const [state, setState] = useState<{
    loading: boolean
    log: UsageSessionLogValue | null
    failed: boolean
  }>({ loading: true, log: null, failed: false })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, log: null, failed: false })
    void loadSessionLog(workspaceId, sessionId).then((log) => {
      if (cancelled) return
      setState(log === null
        ? { loading: false, log: null, failed: true }
        : { loading: false, log, failed: false })
    })
    return () => { cancelled = true }
  }, [workspaceId, sessionId, loadSessionLog])

  if (state.loading) return <p className={css.status}>{t('panel.loading')}</p>
  if (state.failed) return <p className={css.status}>{t('panel.error')}</p>
  const log = state.log
  if (log === null) return null
  if (log.events.length === 0) return <p className={css.status}>{t('session.logEmpty')}</p>
  return (
    <div className={css.explorer}>
      {log.truncated && (
        <p className={css.truncated}>{t('session.logTruncated', { count: log.events.length })}</p>
      )}
      <ol className={css.events}>
        {log.events.map(event => (
          <li key={event.seq} className={css.event}>
            <span className={css.eventTime}>{formatEventTime(event.time)}</span>
            <span className={css.eventSeq}>#{event.seq}</span>
            <span className={css.eventType}>{event.type}</span>
            <span className={css.eventData}>
              {eventSummary(event.type, event.data, {
                turn: t('event.turn'),
                step: t('event.step'),
                ended: t('event.ended'),
                usageIn: t('event.usage.in'),
                usageOut: t('event.usage.out'),
                provider: t('event.provider'),
                model: t('event.model'),
              }) || compactJson(event.data)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
