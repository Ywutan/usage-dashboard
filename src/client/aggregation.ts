/**
 * Pure chart aggregation for the usage dashboard: decide the trend
 * granularity from the report's hourly series and project the rows the chart
 * renders. Within one local day the series stays hourly; once activity spans
 * two or more local dates it folds to per-day buckets, so a 30-day window
 * renders 30 bars instead of 720 hours.
 * @module @deepseek-ai/dsh-usage-dashboard/aggregation
 */

import type { UsageHourBucket } from '../types.ts'

/** One chart row at the chosen granularity. */
export interface UsageTrendRow {
  /** ISO local key: `YYYY-MM-DDTHH:00:00` hourly or `YYYY-MM-DD` daily. */
  readonly key: string
  /** Unix epoch milliseconds at the bucket start. */
  readonly start: number
  readonly apiCalls: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheTokens: number
  readonly totalTokens: number
  readonly costUsd: number
}

/** The trend series at the granularity the window deserves. */
export interface UsageTrendSeries {
  readonly granularity: 'hourly' | 'daily'
  readonly rows: readonly UsageTrendRow[]
}

/**
 * The local-date prefix of an hourly bucket key (`YYYY-MM-DDTHH:00:00` → `YYYY-MM-DD`).
 * @param hourKey - the report's local-hour key.
 * @returns its local-date prefix.
 */
export function dayKeyOf(hourKey: string): string {
  return hourKey.slice(0, 10)
}

/**
 * Project the report's hourly series for the trend chart.
 * @param byHour - the report's hourly series (local time).
 * @returns hourly rows when all activity sits within one local day, daily
 *   rows grouped by local date otherwise.
 */
export function projectTrend(byHour: readonly UsageHourBucket[]): UsageTrendSeries {
  if (byHour.length === 0) return { granularity: 'hourly', rows: [] }
  const days = new Set(byHour.map(bucket => dayKeyOf(bucket.hour)))
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
    }
  }
  return { granularity: 'daily', rows: foldByDay(byHour) }
}

/** Mutable per-day fold row, materialized as {@link UsageTrendRow} at the end. */
interface MutableDayRow {
  key: string
  start: number
  apiCalls: number
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  totalTokens: number
  costUsd: number
}

/** Fold the hourly series into per-local-date rows ordered chronologically. */
function foldByDay(byHour: readonly UsageHourBucket[]): readonly UsageTrendRow[] {
  const byDay = new Map<string, MutableDayRow>()
  for (const bucket of byHour) {
    const dayKey = dayKeyOf(bucket.hour)
    const existing = byDay.get(dayKey)
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
      })
    } else {
      existing.apiCalls += bucket.apiCalls
      existing.inputTokens += bucket.inputTokens
      existing.outputTokens += bucket.outputTokens
      existing.cacheTokens += bucket.cacheReadTokens + bucket.cacheWriteTokens
      existing.totalTokens += bucket.totalTokens
      existing.costUsd += bucket.costUsd
    }
  }
  return [...byDay.values()]
    .sort((a, b) => a.start - b.start)
    .map(row => ({ ...row }))
}
