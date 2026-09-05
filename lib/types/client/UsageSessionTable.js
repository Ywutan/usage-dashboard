import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Per-session usage table of the dashboard with an inline raw-log explorer.
 * Expanding a row fetches that Session's newest events through the injected
 * loader and renders them as compact time/seq/type/summary rows.
 */
import { useEffect, useState } from 'react';
import { compactJson, eventSummary, formatDuration, formatEventTime, formatTokens, formatUsd } from "./format.js";
import css from './UsageSessionTable.module.css';
/**
 * Render the per-session table with expandable log explorers.
 * @param props - session aggregates, owning Workspace, loader, and locale.
 * @returns the table section, or null when no session rows exist.
 */
export function UsageSessionTable({ bySession, workspaceId, loadSessionLog, t }) {
    if (bySession.length === 0)
        return null;
    return (_jsxs("section", { "aria-label": t('session.title'), children: [_jsx("h2", { className: css.heading, children: t('session.title') }), _jsxs("table", { className: css.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: t('session.name') }), _jsx("th", { scope: "col", children: t('session.calls') }), _jsx("th", { scope: "col", children: t('summary.inputTokens') }), _jsx("th", { scope: "col", children: t('summary.outputTokens') }), _jsx("th", { scope: "col", children: t('session.cost') }), _jsx("th", { scope: "col", children: t('session.duration') }), _jsx("th", { scope: "col", "aria-label": t('session.explore') })] }) }), _jsx("tbody", { children: bySession.map(row => (_jsx(SessionRow, { row: row, workspaceId: workspaceId, loadSessionLog: loadSessionLog, t: t }, row.sessionId))) })] })] }));
}
/** One session row plus its expandable explorer. */
function SessionRow({ row, workspaceId, loadSessionLog, t, }) {
    const [expanded, setExpanded] = useState(false);
    const duration = row.lastEventAt > row.firstEventAt ? row.lastEventAt - row.firstEventAt : 0;
    return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: css.row, children: [_jsxs("td", { children: [_jsx("span", { className: css.sessionId, children: row.sessionId }), _jsxs("span", { className: css.created, children: [t('session.created'), ": ", new Date(row.createdAt).toLocaleString()] })] }), _jsx("td", { children: row.apiCalls }), _jsx("td", { children: formatTokens(row.inputTokens) }), _jsx("td", { children: formatTokens(row.outputTokens) }), _jsx("td", { children: formatUsd(row.costUsd) }), _jsx("td", { children: duration > 0 ? formatDuration(duration) : '—' }), _jsx("td", { children: _jsx("button", { type: "button", className: css.explore, "aria-expanded": expanded, onClick: () => { setExpanded(!expanded); }, children: expanded ? t('session.collapse') : t('session.explore') }) })] }), expanded && (_jsx("tr", { className: css.explorerRow, children: _jsx("td", { colSpan: 7, children: _jsx(SessionLogExplorer, { workspaceId: workspaceId, sessionId: row.sessionId, loadSessionLog: loadSessionLog, t: t }) }) }))] }));
}
/** Load and render one session's raw event log. */
function SessionLogExplorer({ workspaceId, sessionId, loadSessionLog, t, }) {
    const [state, setState] = useState({ loading: true, log: null, failed: false });
    useEffect(() => {
        let cancelled = false;
        setState({ loading: true, log: null, failed: false });
        void loadSessionLog(workspaceId, sessionId).then((log) => {
            if (cancelled)
                return;
            setState(log === null
                ? { loading: false, log: null, failed: true }
                : { loading: false, log, failed: false });
        });
        return () => { cancelled = true; };
    }, [workspaceId, sessionId, loadSessionLog]);
    if (state.loading)
        return _jsx("p", { className: css.status, children: t('panel.loading') });
    if (state.failed)
        return _jsx("p", { className: css.status, children: t('panel.error') });
    const log = state.log;
    if (log === null)
        return null;
    if (log.events.length === 0)
        return _jsx("p", { className: css.status, children: t('session.logEmpty') });
    return (_jsxs("div", { className: css.explorer, children: [log.truncated && (_jsx("p", { className: css.truncated, children: t('session.logTruncated', { count: log.events.length }) })), _jsx("ol", { className: css.events, children: log.events.map(event => (_jsxs("li", { className: css.event, children: [_jsx("span", { className: css.eventTime, children: formatEventTime(event.time) }), _jsxs("span", { className: css.eventSeq, children: ["#", event.seq] }), _jsx("span", { className: css.eventType, children: event.type }), _jsx("span", { className: css.eventData, children: eventSummary(event.type, event.data, {
                                turn: t('event.turn'),
                                step: t('event.step'),
                                ended: t('event.ended'),
                                usageIn: t('event.usage.in'),
                                usageOut: t('event.usage.out'),
                                provider: t('event.provider'),
                                model: t('event.model'),
                            }) || compactJson(event.data) })] }, event.seq))) })] }));
}
//# sourceMappingURL=UsageSessionTable.js.map