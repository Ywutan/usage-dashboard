/**
 * Pure presentational formatters for the usage dashboard: token counts, USD
 * amounts, hour keys, durations, and compact event summaries. No React, no
 * subscriptions — components receive formatted strings as props.
 * @module @deepseek-ai/dsh-client-ui-usage/format
 */

/**
 * Format a non-negative token count compactly (1.2K, 3.4M).
 * @param value - the token count; a non-finite or non-positive value renders `0`.
 * @returns the compact rendering.
 */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10}M`
  }
  if (value >= 1_000) {
    const thousands = value / 1_000
    return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}K`
  }
  return String(Math.round(value))
}

/**
 * Format a USD amount: dollars with two decimals, cents with four.
 * @param value - the amount in USD.
 * @returns the rendering, `$0` for zero or a non-finite amount.
 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0'
  const absolute = Math.abs(value)
  const digits = absolute >= 1 ? 2 : absolute >= 0.0001 ? 4 : 6
  return `$${value.toFixed(digits)}`
}

/**
 * Format a local-hour bucket key (`2026-09-01T10:00:00`) for display.
 * @param hourKey - ISO-8601 local hour key from the report.
 * @returns a compact `MMM d · HH:00` label in the browser's locale.
 */
export function formatHourLabel(hourKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00:00$/.exec(hourKey)
  if (match === null) return hourKey
  const [, year, month, day, hour] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour))
  if (Number.isNaN(date.getTime())) return hourKey
  const dayLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${dayLabel} · ${hour}:00`
}

/**
 * Format a local-date key (`YYYY-MM-DD`) for a daily trend label.
 * @param dayKey - the local-date key; an unparseable key renders verbatim.
 * @returns a `MMM d` label, carrying the year outside the current one.
 */
export function formatDayLabel(dayKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (match === null) return dayKey
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return dayKey
  const now = new Date()
  const includeYear = date.getFullYear() !== now.getFullYear()
  return date.toLocaleDateString(undefined, {
    ...(includeYear ? { year: 'numeric' } : {}),
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a report applied window for the period caption.
 * @param range - the window the report applied; an absent bound renders as a dash.
 * @returns the `start → end` caption.
 */
export function formatPeriod(range: { start?: number; end?: number }): string {
  const startLabel = range.start === undefined ? '—' : new Date(range.start).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const endLabel = range.end === undefined ? '—' : new Date(range.end).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return `${startLabel} → ${endLabel}`
}

/**
 * Format an event instant in the browser's local time.
 * @param epochMs - the instant to render.
 * @returns the local clock time.
 */
export function formatEventTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format a duration in milliseconds compactly (45s, 3m 12s, 2h 5m, 4d 2h).
 * @param ms - the duration; a negative value renders as zero seconds.
 * @returns the compact rendering, at most two units.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/** Truncate a text payload, appending an ellipsis when capped. */
function truncateText(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`
}

/**
 * Compact one payload for an event row. Strings stay raw (tool arguments and
 * message content are already text); other values serialize as JSON.
 * @param value - the event payload to render.
 * @param maxChars - inclusive cap on the rendered length; longer text is elided.
 * @returns the single-line rendering.
 */
export function compactJson(value: unknown, maxChars = 200): string {
  let text: string
  if (typeof value === 'string') {
    text = value
  } else {
    try {
      text = JSON.stringify(value)
    } catch {
      text = String(value)
    }
  }
  return truncateText(text, maxChars)
}

/** Structural label atoms for event summaries; supplied by the locale seat. */
export interface EventSummaryLabels {
  /** `turn` noun (e.g. "turn 2"). */
  turn: string
  /** `step` noun (e.g. "step 1"). */
  step: string
  /** `ended` fallback for an unknown turn-end reason kind. */
  ended: string
  /** `in` prefix for input tokens in a usage summary. */
  usageIn: string
  /** `out` prefix for output tokens in a usage summary. */
  usageOut: string
  /** `provider` label for request-header summaries. */
  provider: string
  /** `model` label for request-header summaries. */
  model: string
}

/**
 * Compact one-sentence summary of an event's payload for the log explorer.
 * Message content, tool payloads, and model names dominate logs, so those
 * render verbatim; the structural `turn`/`step`/usage atoms are localized.
 * @param type - the event's type, which selects the summary form.
 * @param data - the event's payload.
 * @param labels - localized words for the structural atoms.
 * @returns the one-line summary.
 */
export function eventSummary(type: string, data: unknown, labels: EventSummaryLabels): string {
  if (typeof data !== 'object' || data === null) return compactJson(data)
  const record = data as Record<string, unknown>
  switch (type) {
    case 'user/message': {
      const content = Array.isArray(record.content) ? record.content : []
      const text = content
        .map(part => (part as Record<string, unknown> | null)?.text)
        .find((part): part is string => typeof part === 'string')
      return text === undefined ? compactJson(record) : text
    }
    case 'assistant/message': {
      const message = record.message as Record<string, unknown> | undefined
      const content = Array.isArray(message?.content) ? message.content : []
      const text = content
        .map(part => (part as Record<string, unknown> | null)?.text)
        .find((part): part is string => typeof part === 'string')
      const usage = record.usage as Record<string, unknown> | undefined
      const usageText = usage === undefined
        ? ''
        : ` · ${labels.usageIn} ${String(usage.inputTokens)} / ${labels.usageOut} ${String(usage.outputTokens)}`
      return `${text === undefined ? compactJson(record) : text}${usageText}`
    }
    case 'tool/call':
      return `${String(record.name)}(${compactJson(record.arguments, 120)})`
    case 'tool/result': {
      const message = record.message as Record<string, unknown> | undefined
      return compactJson(message, 200)
    }
    case 'request/header': {
      const header = record.header as Record<string, unknown> | undefined
      const config = header?.config as Record<string, unknown> | undefined
      return config === undefined
        ? compactJson(record)
        : `${labels.provider}=${String(config.provider)} · ${labels.model}=${String(config.model)}`
    }
    case 'turn/start':
      return `${labels.turn} ${String(record.turn)}`
    case 'step/start':
      return `${labels.turn} ${String(record.turn)} ${labels.step} ${String(record.step)}`
    case 'turn/end': {
      const reason = record.reason as Record<string, unknown> | undefined
      const kind = typeof reason?.kind === 'string' ? reason.kind : labels.ended
      return `${labels.turn} ${String(record.turn)} · ${kind}`
    }
    default:
      return compactJson(record)
  }
}
