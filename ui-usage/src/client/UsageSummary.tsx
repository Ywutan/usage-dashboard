/**
 * Totals cards of the usage dashboard: counts, token volumes, and the
 * estimated cost. Pure presentation over the report totals.
 */
import type { UsageReportTotals } from '@deepseek-ai/dsh-usage-report/types'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { formatTokens, formatUsd } from './format.ts'
import { NS } from './locales.ts'
import css from './UsageSummary.module.css'

/** Totals card props. */
export interface UsageSummaryProps {
  totals: UsageReportTotals
  unknownModels: readonly string[]
  t: TranslateNS<typeof NS>
}

/** Card values in display order. */
interface SummaryCard {
  key: string
  label: string
  value: string
}

/**
 * Render the totals card row.
 * @param props - report totals, unknown model ids, and locale.
 * @returns the summary cards grid.
 */
export function UsageSummary({ totals, unknownModels, t }: UsageSummaryProps) {
  const cards: SummaryCard[] = [
    { key: 'calls', label: t('summary.apiCalls'), value: String(totals.apiCalls) },
    { key: 'tools', label: t('summary.toolCalls'), value: String(totals.toolCalls) },
    { key: 'turns', label: t('summary.turns'), value: String(totals.turns) },
    { key: 'sessions', label: t('summary.sessions'), value: String(totals.sessions) },
    { key: 'input', label: t('summary.inputTokens'), value: formatTokens(totals.inputTokens) },
    { key: 'output', label: t('summary.outputTokens'), value: formatTokens(totals.outputTokens) },
    { key: 'cache', label: t('summary.cacheTokens'), value: formatTokens(totals.cacheReadTokens + totals.cacheWriteTokens) },
    { key: 'cost', label: t('summary.cost'), value: formatUsd(totals.costUsd) },
  ]
  return (
    <section aria-label={t('panel.title')}>
      <div className={css.grid}>
        {cards.map(card => (
          <div key={card.key} className={css.card}>
            <span className={css.label}>{card.label}</span>
            <span className={css.value}>{card.value}</span>
          </div>
        ))}
      </div>
      {unknownModels.length > 0 && totals.unpricedCalls > 0 && (
        <p className={css.unpriced}>
          {t('summary.unpriced', { count: totals.unpricedCalls })}: {unknownModels.join(', ')}
        </p>
      )}
    </section>
  )
}
