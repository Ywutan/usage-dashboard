/**
 * Pure chart aggregation for the usage dashboard: decide the trend
 * granularity from the report's hourly series and project the rows the chart
 * renders. Within one local day the series stays hourly; once activity spans
 * two or more local dates it folds to per-day buckets, so a 30-day window
 * renders 30 bars instead of 720 hours.
 * @module @deepseek-ai/dsh-usage-dashboard/aggregation
 */
/**
 * The local-date prefix of an hourly bucket key (`YYYY-MM-DDTHH:00:00` → `YYYY-MM-DD`).
 * @param hourKey - the report's local-hour key.
 * @returns its local-date prefix.
 */
export function dayKeyOf(hourKey) {
    return hourKey.slice(0, 10);
}
/**
 * Project the report's hourly series for the trend chart.
 * @param byHour - the report's hourly series (local time).
 * @returns hourly rows when all activity sits within one local day, daily
 *   rows grouped by local date otherwise.
 */
export function projectTrend(byHour) {
    if (byHour.length === 0)
        return { granularity: 'hourly', rows: [] };
    const days = new Set(byHour.map(bucket => dayKeyOf(bucket.hour)));
    if (days.size === 1) {
        return {
            granularity: 'hourly',
            rows: byHour.map(bucket => ({
                key: bucket.hour,
                start: bucket.hourStart,
                apiCalls: bucket.apiCalls,
                inputTokens: bucket.inputTokens,
                outputTokens: bucket.outputTokens,
                cacheTokens: bucket.cacheReadTokens + bucket.cacheWriteTokens,
                totalTokens: bucket.totalTokens,
                costUsd: bucket.costUsd,
            })),
        };
    }
    return { granularity: 'daily', rows: foldByDay(byHour) };
}
/** Fold the hourly series into per-local-date rows ordered chronologically. */
function foldByDay(byHour) {
    const byDay = new Map();
    for (const bucket of byHour) {
        const dayKey = dayKeyOf(bucket.hour);
        const existing = byDay.get(dayKey);
        if (existing === undefined) {
            byDay.set(dayKey, {
                key: dayKey,
                start: bucket.hourStart,
                apiCalls: bucket.apiCalls,
                inputTokens: bucket.inputTokens,
                outputTokens: bucket.outputTokens,
                cacheTokens: bucket.cacheReadTokens + bucket.cacheWriteTokens,
                totalTokens: bucket.totalTokens,
                costUsd: bucket.costUsd,
            });
        }
        else {
            existing.apiCalls += bucket.apiCalls;
            existing.inputTokens += bucket.inputTokens;
            existing.outputTokens += bucket.outputTokens;
            existing.cacheTokens += bucket.cacheReadTokens + bucket.cacheWriteTokens;
            existing.totalTokens += bucket.totalTokens;
            existing.costUsd += bucket.costUsd;
        }
    }
    return [...byDay.values()]
        .sort((a, b) => a.start - b.start)
        .map(row => ({ ...row }));
}
//# sourceMappingURL=aggregation.js.map