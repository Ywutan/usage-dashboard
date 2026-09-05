/**
 * Pure chart aggregation for the usage dashboard: decide the trend
 * granularity from the report's hourly series and project the rows the chart
 * renders. Within one local day the series stays hourly; once activity spans
 * two or more local dates it folds to per-day buckets, so a 30-day window
 * renders 30 bars instead of 720 hours.
 * @module @deepseek-ai/dsh-usage-dashboard/aggregation
 */
import type { UsageHourBucket } from '../types.ts';
/** One chart row at the chosen granularity. */
export interface UsageTrendRow {
    /** ISO local key: `YYYY-MM-DDTHH:00:00` hourly or `YYYY-MM-DD` daily. */
    readonly key: string;
    /** Unix epoch milliseconds at the bucket start. */
    readonly start: number;
    readonly apiCalls: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheTokens: number;
    readonly totalTokens: number;
    readonly costUsd: number;
}
/** The trend series at the granularity the window deserves. */
export interface UsageTrendSeries {
    readonly granularity: 'hourly' | 'daily';
    readonly rows: readonly UsageTrendRow[];
}
/**
 * The local-date prefix of an hourly bucket key (`YYYY-MM-DDTHH:00:00` → `YYYY-MM-DD`).
 * @param hourKey - the report's local-hour key.
 * @returns its local-date prefix.
 */
export declare function dayKeyOf(hourKey: string): string;
/**
 * Project the report's hourly series for the trend chart.
 * @param byHour - the report's hourly series (local time).
 * @returns hourly rows when all activity sits within one local day, daily
 *   rows grouped by local date otherwise.
 */
export declare function projectTrend(byHour: readonly UsageHourBucket[]): UsageTrendSeries;
//# sourceMappingURL=aggregation.d.ts.map