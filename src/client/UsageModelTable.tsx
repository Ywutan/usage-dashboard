/**
 * Per-model usage table of the dashboard: calls, input/output tokens, and
 * estimated cost per provider/model route. Unpriced models render a muted
 * "no price" marker instead of a cost figure.
 */
import clsx from 'clsx'
import type { UsageModelRow } from '../types.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { formatTokens, formatUsd } from './format.ts'
import { NS } from './locales.ts'
import css from './UsageModelTable.module.css'

/** Per-model table props. */
export interface UsageModelTableProps {
  byModel: readonly UsageModelRow[]
  t: TranslateNS<typeof NS>
}

/**
 * Render the per-model usage table.
 * @param props - model aggregates and locale.
 * @returns the table section, or null when no model rows exist.
 */
export function UsageModelTable({ byModel, t }: UsageModelTableProps) {
  if (byModel.length === 0) return null
  return (
    <section aria-label={t('model.title')}>
      <h2 className={css.heading}>{t('model.title')}</h2>
      <table className={css.table}>
        <thead>
          <tr>
            <th scope="col">{t('model.route')}</th>
            <th scope="col">{t('model.calls')}</th>
            <th scope="col">{t('model.input')}</th>
            <th scope="col">{t('model.output')}</th>
            <th scope="col">{t('model.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {byModel.map(row => (
            <tr key={`${row.provider}/${row.model}`}>
              <td>
                <span className={css.model}>{row.model}</span>
                <span className={css.provider}>{row.provider}</span>
              </td>
              <td>{row.apiCalls}</td>
              <td>{formatTokens(row.inputTokens)}</td>
              <td>{formatTokens(row.outputTokens)}</td>
              <td className={clsx(row.unpriced && css.unpriced)}>
                {row.unpriced ? t('model.unpriced') : formatUsd(row.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
