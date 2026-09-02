/** Pure usage-dashboard formatter behavior. */
import { describe, expect, it } from 'vitest'
import {
  compactJson, eventSummary, formatDuration, formatEventTime, formatHourLabel, formatTokens, formatUsd,
  type EventSummaryLabels,
} from '../src/client/format.ts'

/** English label atoms for event summaries. */
const labels: EventSummaryLabels = { turn: 'turn', step: 'step', ended: 'ended', usageIn: 'in', usageOut: 'out', provider: 'provider', model: 'model' }

describe('formatTokens', () => {
  it('formats compact token counts', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(42)).toBe('42')
    expect(formatTokens(1_234)).toBe('1.2K')
    expect(formatTokens(12_000)).toBe('12K')
    expect(formatTokens(1_234_000)).toBe('1.2M')
  })
})

describe('formatUsd', () => {
  it('keeps significant digits for sub-cent costs', () => {
    expect(formatUsd(0)).toBe('$0')
    expect(formatUsd(1.5)).toBe('$1.50')
    expect(formatUsd(0.031)).toBe('$0.0310')
    expect(formatUsd(0.0000123)).toBe('$0.000012')
  })
})

describe('formatHourLabel', () => {
  it('renders a compact local label', () => {
    expect(formatHourLabel('2026-09-01T10:00:00')).toMatch(/Sep 1 · 10:00/)
  })

  it('passes through unknown keys', () => {
    expect(formatHourLabel('garbage')).toBe('garbage')
  })
})

describe('formatDuration', () => {
  it('renders compact durations', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(3 * 60_000 + 12_000)).toBe('3m 12s')
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000)).toBe('2h 5m')
    expect(formatDuration(4 * 86_400_000 + 2 * 3_600_000)).toBe('4d 2h')
  })
})

describe('formatEventTime', () => {
  it('renders a local time without throwing', () => {
    expect(formatEventTime(0)).toMatch(/^\d{2}:\d{2}/)
  })
})

describe('compactJson', () => {
  it('caps long payloads', () => {
    const text = compactJson({ content: 'x'.repeat(500) }, 40)
    expect(text.endsWith('…')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(41)
  })
})

describe('eventSummary', () => {
  it('summarizes messages, tool calls, and request headers', () => {
    expect(eventSummary('user/message', {
      content: [{ type: 'text', text: 'hello' }],
    }, labels)).toBe('hello')
    expect(eventSummary('assistant/message', {
      message: { content: [{ type: 'text', text: 'hi' }] },
      usage: { inputTokens: 3, outputTokens: 4 },
    }, labels)).toBe('hi · in 3 / out 4')
    expect(eventSummary('tool/call', { name: 'bash', arguments: '{"cmd":"ls"}' }, labels))
      .toBe('bash({"cmd":"ls"})')
    expect(eventSummary('request/header', {
      header: { config: { provider: 'p', model: 'm' } },
    }, labels)).toBe('provider=p · model=m')
    expect(eventSummary('turn/start', { turn: 2 }, labels)).toBe('turn 2')
  })

  it('falls back to compact JSON for unknown shapes', () => {
    expect(eventSummary('mystery', { a: 1 }, labels)).toBe('{"a":1}')
  })
})
