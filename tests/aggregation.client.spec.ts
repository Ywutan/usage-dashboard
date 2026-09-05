/** Trend projection: hourly within a day, daily across dates. */
import { describe, expect, it } from 'vitest'
import type { UsageHourBucket } from '@deepseek-ai/dsh-usage-dashboard/types'
import { projectTrend } from '../src/client/aggregation.ts'
import { formatDayLabel } from '../src/client/format.ts'

function hour(key: string, start: number, apiCalls: number, costUsd: number): UsageHourBucket {
  return {
    hour: key,
    hourStart: start,
    apiCalls,
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 15,
    costUsd,
  }
}

describe('projectTrend', () => {
  it('keeps hourly rows when all activity sits within one local day', () => {
    const series = projectTrend([
      hour('2026-09-01T09:00:00', 1_700_000_000_000, 1, 0.1),
      hour('2026-09-01T10:00:00', 1_700_000_003_600_000, 2, 0.2),
    ])
    expect(series.granularity).toBe('hourly')
    expect(series.rows).toHaveLength(2)
    expect(series.rows[0]).toMatchObject({ key: '2026-09-01T09:00:00', apiCalls: 1 })
  })

  it('folds to daily rows across two or more local dates', () => {
    const startA = new Date(2026, 8, 1, 9).getTime()
    const startB = new Date(2026, 8, 2, 10).getTime()
    const series = projectTrend([
      hour('2026-09-01T09:00:00', startA, 1, 0.1),
      hour('2026-09-01T12:00:00', startA + 3 * 3_600_000, 2, 0.2),
      hour('2026-09-02T10:00:00', startB, 3, 0.3),
    ])
    expect(series.granularity).toBe('daily')
    expect(series.rows).toHaveLength(2)
    expect(series.rows[0]).toMatchObject({ key: '2026-09-01', apiCalls: 3 })
    expect(series.rows[0]!.costUsd).toBeCloseTo(0.3, 10)
    expect(series.rows[1]).toMatchObject({ key: '2026-09-02', apiCalls: 3 })
    expect(series.rows[1]!.costUsd).toBeCloseTo(0.3, 10)
    // Ordered chronologically.
    expect(series.rows[0]!.start).toBeLessThan(series.rows[1]!.start)
  })

  it('returns an empty hourly series for an empty report', () => {
    expect(projectTrend([])).toEqual({ granularity: 'hourly', rows: [] })
  })
})

describe('formatDayLabel', () => {
  it('renders a compact local date label', () => {
    const label = formatDayLabel('2026-09-01')
    expect(label).toMatch(/Sep 1/)
  })

  it('passes through unknown keys', () => {
    expect(formatDayLabel('garbage')).toBe('garbage')
  })
})
