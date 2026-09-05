/**
 * Totals cards of the usage dashboard: counts, token volumes, and the
 * estimated cost. Pure presentation over the report totals.
 */
import type { UsageReportTotals } from '../types.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Totals card props. */
export interface UsageSummaryProps {
    totals: UsageReportTotals;
    unknownModels: readonly string[];
    t: TranslateNS<typeof NS>;
}
/**
 * Render the totals card row.
 * @param props - report totals, unknown model ids, and locale.
 * @returns the summary cards grid.
 */
export declare function UsageSummary({ totals, unknownModels, t }: UsageSummaryProps): import("react").JSX.Element;
//# sourceMappingURL=UsageSummary.d.ts.map