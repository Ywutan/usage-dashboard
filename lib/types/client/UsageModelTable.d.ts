import type { UsageModelRow } from '../types.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Per-model table props. */
export interface UsageModelTableProps {
    byModel: readonly UsageModelRow[];
    t: TranslateNS<typeof NS>;
}
/**
 * Render the per-model usage table.
 * @param props - model aggregates and locale.
 * @returns the table section, or null when no model rows exist.
 */
export declare function UsageModelTable({ byModel, t }: UsageModelTableProps): import("react").JSX.Element | null;
//# sourceMappingURL=UsageModelTable.d.ts.map