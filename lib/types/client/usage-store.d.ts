/**
 * Transient view state of the usage dashboard panel: open/close, the selected
 * Workspace, the last fetched report, and the load lifecycle. The Host owns
 * the report itself; this store only decides what the panel shows.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { UsageReportValue } from '../types.ts';
import type { WorkspaceId } from '../types.ts';
import type { UsageRangeSelection } from './range.ts';
/** Panel state for one dashboard instance. */
export interface UsagePanelState {
    /** Whether the full-viewport panel is visible. */
    open: boolean;
    /** Workspace the report is selected for. */
    workspaceId?: WorkspaceId;
    /**
     * Report window selection. Defaults to the current local day so the first
     * open shows today's consumption; changing it drops the cached report.
     */
    range: UsageRangeSelection;
    /** Last fetched report; null before the first successful load. */
    report: UsageReportValue | null;
    /** Whether a report fetch is in flight. */
    loading: boolean;
    /** Human-readable load failure; absent while healthy. */
    error?: string;
}
type UsagePanelActions = {
    /** Open the panel, defaulting the selection to the current Workspace. */
    openPanel: (state: UsagePanelState, workspaceId?: WorkspaceId) => void;
    /** Close the panel, keeping the cached report for a fast reopen. */
    closePanel: (state: UsagePanelState) => void;
    /** Replace the report window; the stale report leaves immediately. */
    setRange: (state: UsagePanelState, range: UsageRangeSelection) => void;
    /** Start a fetch for a Workspace; the stale report leaves immediately. */
    beginLoad: (state: UsagePanelState, workspaceId: WorkspaceId) => void;
    /** Commit a fetched report. */
    finishLoad: (state: UsagePanelState, report: UsageReportValue) => void;
    /** Record a fetch failure. */
    failLoad: (state: UsagePanelState, error: string) => void;
    /** Abandon an in-flight fetch whose panel went away, so a later open retries. */
    cancelLoad: (state: UsagePanelState) => void;
};
/**
 * Declare the usage dashboard's transient store.
 * @returns a non-persisted store handle whose instance is owned by the Slot registry.
 */
export declare function createUsageStore(): EngineStoreHandle<UsagePanelState, UsagePanelActions>;
export {};
//# sourceMappingURL=usage-store.d.ts.map