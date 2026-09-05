import type { UsageSessionLogValue } from '../types.ts';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { WorkspaceId } from '../types.ts';
import type { BoundActions, SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
import { type UsageRangeBounds } from './range.ts';
import { createUsageStore, type UsagePanelState } from './usage-store.ts';
/** Store handle type of this plugin's registration. */
export type UsageStore = ReturnType<typeof createUsageStore>;
/** Loaders supplied by the registration inject factory. */
export interface UsageInjected {
    /**
     * Fetch and commit the usage report for a Workspace over a window. The
     * optional signal cancels the Host read; an aborted fetch never commits state.
     */
    loadReport: (workspaceId: WorkspaceId, range: UsageRangeBounds, signal?: AbortSignal) => Promise<void>;
    /** Fetch one Session's raw event log; null when the fetch fails. */
    loadSessionLog: (workspaceId: WorkspaceId, sessionId: SessionId) => Promise<UsageSessionLogValue | null>;
}
/** Props the trigger threads into the panel. */
export interface UsagePanelProps {
    useStore: SnapshotSelectorHook<UsagePanelState>;
    actions: BoundActions<UsageStore>;
    useWorkspaces: PropsRuntime<'sidebar.footer.action'>['useWorkspaces'];
    t: TranslateNS<typeof NS>;
    loadReport: UsageInjected['loadReport'];
    loadSessionLog: UsageInjected['loadSessionLog'];
}
/**
 * Render the dashboard panel for the store-selected Workspace.
 * @param props - store seats, workspace list, loaders, and locale.
 * @returns the fixed full-viewport overlay, or null while closed.
 */
export declare function UsagePanel({ useStore, actions, useWorkspaces, t, loadReport, loadSessionLog, }: UsagePanelProps): import("react").JSX.Element | null;
//# sourceMappingURL=UsagePanel.d.ts.map