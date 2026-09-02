/** Pure range-selection helpers for the usage dashboard. */
import { describe, expect, it } from 'vitest'
import { rangeBounds, selectionKey, toLocalIso, type UsageRangeSelection } from '../src/client/range.ts'

/** A fixed "now" in a timezone-agnostic way: pass epoch and derive expected midnights locally. */
function localMidnight(epochMs: number): number {
  const d = new Date(epochMs)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const NOW = new Date('2026-09-15T14:30:00').getTime()

describe('rangeBounds', () => {
  it('anchors presets to local midnights of the browser calendar', () => {
    const today = rangeBounds({ kind: 'preset', preset: 'today' }, NOW)
    const midnight = localMidnight(NOW)
    expect(today).toEqual({ start: midnight, end: midnight + 86_400_000 })

    const week = rangeBounds({ kind: 'preset', preset: '7d' }, NOW)
    expect(week.start).toBe(localMidnight(NOW - 6 * 86_400_000))
    expect(week.end).toBe(midnight + 86_400_000)
  })

  it('treats all time as an open window', () => {
    expect(rangeBounds({ kind: 'preset', preset: 'all' }, NOW)).toEqual({})
  })

  it('resolves explicit calendar dates to local day windows', () => {
    const selection: UsageRangeSelection = {
      kind: 'custom',
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    }
    const bounds = rangeBounds(selection, NOW)
    expect(bounds).toEqual({
      start: new Date(2026, 8, 1).getTime(),
      end: new Date(2026, 8, 8).getTime(),
    })
  })

  it('returns an open window for malformed custom dates', () => {
    expect(rangeBounds({ kind: 'custom', startDate: 'junk', endDate: '2026-09-07' }, NOW)).toEqual({})
  })
})

describe('selectionKey / toLocalIso', () => {
  it('keys selections by their exact window', () => {
    expect(selectionKey({ kind: 'preset', preset: 'today' })).toBe('preset:today')
    expect(selectionKey({ kind: 'custom', startDate: 'a', endDate: 'b' })).toBe('custom:a:b')
  })

  it('formats local calendar dates with zero padding', () => {
    expect(toLocalIso(new Date(2026, 0, 5).getTime())).toBe('2026-01-05')
    expect(toLocalIso(new Date(2026, 11, 31).getTime())).toBe('2026-12-31')
  })
})
