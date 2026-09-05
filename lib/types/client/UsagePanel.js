import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Full-viewport usage dashboard panel: workspace selector, totals, hourly
 * cost chart, per-model and per-session tables, and per-session log
 * exploration. The panel owns no business state — it reads the store seats
 * and calls the injected loaders.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { IconCloseOutline16, IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { rangeBounds } from "./range.js";
import { UsageRangeSelector } from "./UsageRangeSelector.js";
import { projectTrend } from "./aggregation.js";
import { UsageTrendChart } from "./UsageTrendChart.js";
import { UsageModelTable } from "./UsageModelTable.js";
import { UsageSessionTable } from "./UsageSessionTable.js";
import { UsageSummary } from "./UsageSummary.js";
import css from './UsagePanel.module.css';
/**
 * Render the dashboard panel for the store-selected Workspace.
 * @param props - store seats, workspace list, loaders, and locale.
 * @returns the fixed full-viewport overlay, or null while closed.
 */
export function UsagePanel({ useStore, actions, useWorkspaces, t, loadReport, loadSessionLog, }) {
    const open = useStore(snapshot => snapshot.open);
    const workspaceId = useStore(snapshot => snapshot.workspaceId);
    const rangeSelection = useStore(snapshot => snapshot.range);
    const report = useStore(snapshot => snapshot.report);
    const loading = useStore(snapshot => snapshot.loading);
    const error = useStore(snapshot => snapshot.error);
    const workspaces = useWorkspaces(snapshot => snapshot.items);
    const range = useMemo(() => rangeBounds(rangeSelection), [rangeSelection]);
    // One live load at a time: a new load supersedes the previous one, and the
    // panel's unmount (close) cancels the in-flight Host read so a closed
    // dashboard never keeps the server busy or paints a stale error.
    const loadController = useRef(undefined);
    const startLoad = useCallback((target, window) => {
        loadController.current?.abort();
        const controller = new AbortController();
        loadController.current = controller;
        void loadReport(target, window, controller.signal);
    }, [loadReport]);
    // Reached through a ref so the cleanup never re-runs on the actions'
    // identity: a cleanup keyed to them would abort a healthy load whenever the
    // slot re-bakes its write set.
    const actionsRef = useRef(actions);
    actionsRef.current = actions;
    useEffect(() => () => {
        loadController.current?.abort();
        actionsRef.current.cancelLoad();
    }, []);
    // Load the report when the panel opens or the window/selection changes and
    // the cached report does not match; loadReport commits its own lifecycle
    // state. A range change clears the report in the store, so this effect
    // refetches. The error guard prevents an automatic retry loop after a
    // failure (Retry is the explicit path).
    useEffect(() => {
        if (!open || loading || error !== undefined)
            return;
        if (workspaceId === undefined)
            return;
        if (report !== null && report.workspaceId === workspaceId)
            return;
        startLoad(workspaceId, range);
    }, [open, loading, workspaceId, report, error, range, startLoad]);
    if (!open)
        return null;
    return (_jsxs("div", { className: css.panel, role: "dialog", "aria-modal": "true", "aria-label": t('panel.title'), children: [_jsxs("header", { className: css.header, children: [_jsx("h1", { className: css.title, children: t('panel.title') }), _jsxs("label", { className: css.workspaceLabel, children: [_jsx("span", { children: t('panel.workspace') }), _jsx("select", { className: css.workspaceSelect, value: workspaceId ?? '', "aria-label": t('panel.workspace'), onChange: (event) => {
                                    const selected = workspaces.find(workspace => workspace.workspaceId === event.target.value);
                                    if (selected !== undefined)
                                        startLoad(selected.workspaceId, range);
                                }, children: workspaces.map(workspace => (_jsx("option", { value: workspace.workspaceId, children: workspace.title }, workspace.workspaceId))) })] }), _jsxs("button", { type: "button", className: css.close, "aria-label": t('panel.close'), onClick: () => { actions.closePanel(); }, children: [_jsx(IconCloseOutline16, { size: 14 }), _jsx("span", { children: t('panel.close') })] })] }), _jsxs("div", { className: css.body, children: [_jsx(UsageRangeSelector, { range: rangeSelection, onChange: (selection) => { actions.setRange(selection); }, t: t }), loading && (_jsxs("p", { className: css.status, children: [_jsx(IconLoadingOutline16, { size: 14, className: css.spinner }), _jsx("span", { children: t('panel.loading') })] })), !loading && error !== undefined && (_jsxs("div", { className: css.statusRow, children: [_jsxs("p", { className: css.status, children: [t('panel.error'), ": ", error] }), _jsx("button", { type: "button", className: css.retry, onClick: () => { if (workspaceId !== undefined)
                                    startLoad(workspaceId, range); }, children: t('panel.retry') })] })), !loading && error === undefined && report === null && (_jsx("p", { className: css.status, children: t('panel.empty') })), !loading && error === undefined && report !== null && _jsx(DashboardBody, { report: report, props: { t, loadSessionLog } })] })] }));
}
/** The report sections below the header; extracted so the panel stays small. */
function DashboardBody({ report, props, }) {
    const { t, loadSessionLog } = props;
    return (_jsxs(_Fragment, { children: [_jsx(UsageSummary, { totals: report.totals, unknownModels: report.unknownModels, t: t }), _jsx(UsageTrendChart, { series: projectTrend(report.byHour), appliedRange: {
                    ...report.rangeStart !== undefined ? { start: report.rangeStart } : {},
                    ...report.rangeEnd !== undefined ? { end: report.rangeEnd } : {},
                }, t: t }), _jsx(UsageModelTable, { byModel: report.byModel, t: t }), _jsx(UsageSessionTable, { bySession: report.bySession, workspaceId: report.workspaceId, loadSessionLog: loadSessionLog, t: t }), _jsx("p", { className: css.note, children: t('pricing.note') })] }));
}
//# sourceMappingURL=UsagePanel.js.map