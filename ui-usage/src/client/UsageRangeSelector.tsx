/**
 * Report window selector of the usage dashboard: preset chips (today, last
 * 7/30 days, all time) plus an explicit calendar interval. Changing the
 * selection drops the cached report so the panel refetches the window.
 */
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type { UsagePreset, UsageRangeSelection } from './range.ts'
import { toLocalIso } from './range.ts'
import css from './UsageRangeSelector.module.css'

/** Range selector props. */
export interface UsageRangeSelectorProps {
  range: UsageRangeSelection
  onChange: (selection: UsageRangeSelection) => void
  t: TranslateNS<typeof NS>
}

const PRESETS: readonly UsagePreset[] = ['today', '7d', '30d', 'all']

/** Default calendar interval when switching into custom mode (last 7 days). */
const CUSTOM_DEFAULT_DAYS = 7

/**
 * Render the window selector.
 * @param props - current selection, change callback, and locale.
 * @returns the preset chips and the optional calendar interval inputs.
 */
export function UsageRangeSelector({ range, onChange, t }: UsageRangeSelectorProps) {
  const applyPreset = (preset: UsagePreset): void => {
    onChange({ kind: 'preset', preset })
  }
  const openCustom = (): void => {
    const now = Date.now()
    const startDate = toLocalIso(now - (CUSTOM_DEFAULT_DAYS - 1) * 86_400_000)
    const endDate = toLocalIso(now)
    onChange({ kind: 'custom', startDate, endDate })
  }
  return (
    <div className={css.bar} role="group" aria-label={t('range.title')}>
      {PRESETS.map(preset => (
        <button
          key={preset}
          type="button"
          className={clsx(css.chip, range.kind === 'preset' && range.preset === preset && css.active)}
          aria-pressed={range.kind === 'preset' && range.preset === preset}
          onClick={() => { applyPreset(preset) }}
        >
          {t(`range.${preset}`)}
        </button>
      ))}
      <button
        type="button"
        className={clsx(css.chip, range.kind === 'custom' && css.active)}
        aria-pressed={range.kind === 'custom'}
        onClick={openCustom}
      >
        {t('range.custom')}
      </button>
      {range.kind === 'custom' && (
        <span className={css.customFields}>
          <label className={css.fieldLabel}>
            <span>{t('range.from')}</span>
            <input
              className={css.dateInput}
              type="date"
              value={range.startDate}
              aria-label={t('range.from')}
              onChange={event => {
                onChange({ kind: 'custom', startDate: event.target.value, endDate: range.endDate })
              }}
            />
          </label>
          <label className={css.fieldLabel}>
            <span>{t('range.to')}</span>
            <input
              className={css.dateInput}
              type="date"
              value={range.endDate}
              aria-label={t('range.to')}
              onChange={event => {
                onChange({ kind: 'custom', startDate: range.startDate, endDate: event.target.value })
              }}
            />
          </label>
        </span>
      )}
    </div>
  )
}
