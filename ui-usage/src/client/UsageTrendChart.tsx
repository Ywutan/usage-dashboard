/**
 * Trend chart of the usage dashboard: CSS bar columns proportional to
 * estimated USD cost per bucket — local hour when the window is a single day,
 * local date otherwise — plus a detail table with the exact calls, token, and
 * cost figures. Pure presentation over the projected series.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageTrendSeries } from './aggregation.ts'
import { formatDayLabel, formatHourLabel, formatTokens, formatUsd, formatPeriod } from './format.ts'
import { NS } from './locales.ts'
import css from './UsageTrendChart.module.css'

/** Trend chart props. */
export interface UsageTrendChartProps {
  series: UsageTrendSeries
  /** The report window actually applied by the Host (epoch ms); absent = open-ended. */
  appliedRange?: { start?: number; end?: number }
  t: TranslateNS<typeof NS>
}

/** Chart baseline height in px (bars grow upward from it). */
const CHART_HEIGHT_PX = 120

/**
 * Render the trend chart and its detail table at the series granularity.
 * @param props - the projected series and locale.
 * @returns the chart section, or null when the series is empty.
 */
export function UsageTrendChart({ series, appliedRange, t }: UsageTrendChartProps) {
  if (series.rows.length === 0) return null
  const hourly = series.granularity === 'hourly'
  const title = hourly ? t('chart.cost.title') : t('chart.cost.title.daily')
  const label = (key: string): string => (hourly ? formatHourLabel(key) : formatDayLabel(key))
  const maxCost = Math.max(...series.rows.map(row => row.costUsd), 0)
  return (
    <section aria-label={title}>
      <h2 className={css.heading}>{title}</h2>
      {appliedRange !== undefined && (appliedRange.start !== undefined || appliedRange.end !== undefined) && (
        <p className={css.period}>{t('chart.period', { period: formatPeriod(appliedRange) })}</p>
      )}
      <div className={css.chartScroll}>
        <div className={css.chart} style={{ height: CHART_HEIGHT_PX }}>
          {series.rows.map((row) => {
            const height = maxCost <= 0
              ? 0
              : Math.max(2, Math.round((row.costUsd / maxCost) * (CHART_HEIGHT_PX - 14)))
            return (
              <div
                key={row.key}
                className={css.barCell}
                title={t('chart.tooltip', {
                  hour: label(row.key),
                  calls: t('chart.axis.calls', { count: row.apiCalls }),
                  tokens: formatTokens(row.totalTokens),
                  cost: formatUsd(row.costUsd),
                })}
              >
                <div className={css.barTrack}>
                  {height > 0 && <div className={css.bar} style={{ height }} />}
                </div>
                <span className={css.barLabel}>{label(row.key)}</span>
              </div>
            )
          })}
        </div>
      </div>
      <table className={css.table}>
        <thead>
          <tr>
            <th scope="col">{hourly ? t('chart.hour') : t('chart.day')}</th>
            <th scope="col">{t('chart.calls')}</th>
            <th scope="col">{t('summary.inputTokens')}</th>
            <th scope="col">{t('summary.outputTokens')}</th>
            <th scope="col">{t('summary.cacheTokens')}</th>
            <th scope="col">{t('summary.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {series.rows.map(row => (
            <tr key={row.key}>
              <td>{label(row.key)}</td>
              <td>{row.apiCalls}</td>
              <td>{formatTokens(row.inputTokens)}</td>
              <td>{formatTokens(row.outputTokens)}</td>
              <td>{formatTokens(row.cacheTokens)}</td>
              <td>{formatUsd(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
