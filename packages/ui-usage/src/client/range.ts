/**
 * Pure date-range vocabulary for the usage dashboard: the user's selection
 * (presets or an explicit calendar interval) and its conversion to
 * epoch-millisecond window bounds in the browser's LOCAL calendar. No React
 * and no subscriptions — components translate the selection and hand the
 * bounds to the loader.
 * @module @deepseek-ai/dsh-client-ui-usage/range
 */

/** Preset window choices. */
export type UsagePreset = 'today' | '7d' | '30d' | 'all'

/** One user-facing range selection. */
export type UsageRangeSelection =
  | { readonly kind: 'preset'; readonly preset: UsagePreset }
  | { readonly kind: 'custom'; readonly startDate: string; readonly endDate: string }

/** The epoch-millisecond window a selection maps to; absent bounds mean open-ended. */
export interface UsageRangeBounds {
  /** Inclusive window start, Unix epoch milliseconds. */
  start?: number
  /** Exclusive window end, Unix epoch milliseconds. */
  end?: number
}

/** Local midnight of a calendar date shifted by whole local days from `now`. */
function localMidnightShifted(dayOffset: number, now: number): number {
  const local = new Date(now)
  // The Date constructor applies the browser's zone; rolling the day component
  // keeps month/year overflow and DST transitions on the local calendar.
  return new Date(local.getFullYear(), local.getMonth(), local.getDate() + dayOffset).getTime()
}

/** Parse a `YYYY-MM-DD` calendar date into its local [start, next-day start) window. */
function parseCalendarDate(iso: string): { readonly start: number; readonly end: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) return undefined
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined
  const start = new Date(year, month, day).getTime()
  if (Number.isNaN(start)) return undefined
  return { start, end: new Date(year, month, day + 1).getTime() }
}

/**
 * Resolve a selection to window bounds in the browser's local calendar.
 * @param selection - preset or explicit interval.
 * @param now - reference instant for the preset anchors (defaults to now).
 * @returns the inclusive-start/exclusive-end window; empty for "all".
 */
export function rangeBounds(
  selection: UsageRangeSelection,
  now: number = Date.now(),
): UsageRangeBounds {
  if (selection.kind === 'custom') {
    const parsed = parseCalendarDate(selection.startDate)
    const parsedEnd = parseCalendarDate(selection.endDate)
    if (parsed === undefined || parsedEnd === undefined) return {}
    return { start: parsed.start, end: parsedEnd.end }
  }
  switch (selection.preset) {
    case 'all':
      return {}
    case 'today':
      return { start: localMidnightShifted(0, now), end: localMidnightShifted(1, now) }
    case '7d':
      return { start: localMidnightShifted(-6, now), end: localMidnightShifted(1, now) }
    case '30d':
      return { start: localMidnightShifted(-29, now), end: localMidnightShifted(1, now) }
  }
}

/**
 * Stable identity of a selection, used to spot range changes cheaply.
 * @param selection - the preset or custom range the user chose.
 * @returns a key equal exactly for selections naming the same range.
 */
export function selectionKey(selection: UsageRangeSelection): string {
  return selection.kind === 'preset'
    ? `preset:${selection.preset}`
    : `custom:${selection.startDate}:${selection.endDate}`
}

/**
 * Format an instant as a local `YYYY-MM-DD` calendar date.
 * @param epochMs - the instant to render.
 * @returns the calendar date in the browser's zone.
 */
export function toLocalIso(epochMs: number): string {
  const local = new Date(epochMs)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
}
