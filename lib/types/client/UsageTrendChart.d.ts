/**
 * Trend chart of the usage dashboard: CSS bar columns proportional to
 * estimated USD cost per bucket — local hour when the window is a single day,
 * local date otherwise — plus a detail table with the exact calls, token, and
 * cost figures. Pure presentation over the projected series.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { UsageTrendSeries } from './aggregation.ts';
import { NS } from './locales.ts';
/** Trend chart props. */
export interface UsageTrendChartProps {
    series: UsageTrendSeries;
    /** The report window actually applied by the Host (epoch ms); absent = open-ended. */
    appliedRange?: {
        start?: number;
        end?: number;
    };
    t: TranslateNS<typeof NS>;
}
/**
 * Render the trend chart and its detail table at the series granularity.
 * @param props - the projected series and locale.
 * @returns the chart section, or null when the series is empty.
 */
export declare function UsageTrendChart({ series, appliedRange, t }: UsageTrendChartProps): import("react").JSX.Element | null;
//# sourceMappingURL=UsageTrendChart.d.ts.map