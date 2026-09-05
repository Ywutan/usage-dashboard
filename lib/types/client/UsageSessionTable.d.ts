import type { UsageSessionRow } from '../types.ts';
import type { WorkspaceId } from '../types.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
import type { UsageInjected } from './UsagePanel.tsx';
/** Per-session table props. */
export interface UsageSessionTableProps {
    bySession: readonly UsageSessionRow[];
    workspaceId: WorkspaceId;
    loadSessionLog: UsageInjected['loadSessionLog'];
    t: TranslateNS<typeof NS>;
}
/**
 * Render the per-session table with expandable log explorers.
 * @param props - session aggregates, owning Workspace, loader, and locale.
 * @returns the table section, or null when no session rows exist.
 */
export declare function UsageSessionTable({ bySession, workspaceId, loadSessionLog, t }: UsageSessionTableProps): import("react").JSX.Element | null;
//# sourceMappingURL=UsageSessionTable.d.ts.map