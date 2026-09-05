import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Sidebar footer action opening the usage dashboard. The wide form carries a
 * label; the collapsed rail shows the data icon only. The panel renders as a
 * fixed full-viewport overlay descendant of this button, mirroring the
 * settings shell's geometry.
 */
import clsx from 'clsx';
import { IconDataOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { UsagePanel } from "./UsagePanel.js";
import css from './UsageTrigger.module.css';
/**
 * Render the dashboard trigger and, while open, the dashboard panel.
 * @param props - composed slot props.
 * @returns the footer action button and the optional panel overlay.
 */
export function UsageTrigger({ wide, useSessions, useWorkspaces, useStore, actions, t, loadReport, loadSessionLog, }) {
    const workspaces = useWorkspaces(snapshot => snapshot.items);
    const currentSession = useSessions(snapshot => snapshot.current);
    const open = useStore(snapshot => snapshot.open);
    const currentWorkspaceId = workspaces.find(workspace => currentSession !== undefined && workspace.sessionIds.includes(currentSession))
        ?.workspaceId;
    const defaultWorkspaceId = currentWorkspaceId ?? workspaces[0]?.workspaceId;
    return (_jsxs(_Fragment, { children: [_jsx(Tooltip, { label: t('trigger.aria'), delayMs: 500, disabled: wide, children: _jsxs("button", { type: "button", className: clsx(css.trigger, !wide && css.rail), "aria-label": t('trigger.aria'), onClick: () => { actions.openPanel(defaultWorkspaceId); }, children: [_jsx(IconDataOutline16, { size: wide ? 14 : 18 }), wide && _jsx("span", { className: css.label, children: t('trigger.label') })] }) }), open && (_jsx(UsagePanel, { useStore: useStore, actions: actions, useWorkspaces: useWorkspaces, t: t, loadReport: loadReport, loadSessionLog: loadSessionLog }))] }));
}
//# sourceMappingURL=UsageTrigger.js.map