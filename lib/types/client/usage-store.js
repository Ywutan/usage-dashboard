/**
 * Transient view state of the usage dashboard panel: open/close, the selected
 * Workspace, the last fetched report, and the load lifecycle. The Host owns
 * the report itself; this store only decides what the panel shows.
 */
import { defineStore } from '@deepseek-ai/dsh-client-store';
/**
 * Declare the usage dashboard's transient store.
 * @returns a non-persisted store handle whose instance is owned by the Slot registry.
 */
export function createUsageStore() {
    return defineStore({
        init: () => ({
            open: false,
            range: { kind: 'preset', preset: 'today' },
            report: null,
            loading: false,
        }),
        actions: {
            openPanel: (state, workspaceId) => {
                state.open = true;
                delete state.error;
                if (workspaceId !== undefined)
                    state.workspaceId = workspaceId;
            },
            closePanel: (state) => {
                state.open = false;
            },
            setRange: (state, range) => {
                state.range = range;
                state.loading = false;
                state.report = null;
                delete state.error;
            },
            beginLoad: (state, workspaceId) => {
                state.workspaceId = workspaceId;
                state.loading = true;
                state.report = null;
                delete state.error;
            },
            finishLoad: (state, report) => {
                state.loading = false;
                state.report = report;
                delete state.error;
            },
            failLoad: (state, error) => {
                state.loading = false;
                state.error = error;
            },
            cancelLoad: (state) => {
                // An aborted load settles nothing, so the flag it raised would outlive
                // it and the load effect — which skips while `loading` is true — would
                // never try again.
                state.loading = false;
            },
        },
    });
}
//# sourceMappingURL=usage-store.js.map