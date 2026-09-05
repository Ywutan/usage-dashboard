/**
 * Pure presentational formatters for the usage dashboard: token counts, USD
 * amounts, hour keys, durations, and compact event summaries. No React, no
 * subscriptions — components receive formatted strings as props.
 * @module @deepseek-ai/dsh-usage-dashboard/format
 */
/**
 * Format a non-negative token count compactly (1.2K, 3.4M).
 * @param value - the token count; a non-finite or non-positive value renders `0`.
 * @returns the compact rendering.
 */
export declare function formatTokens(value: number): string;
/**
 * Format a USD amount: dollars with two decimals, cents with four.
 * @param value - the amount in USD.
 * @returns the rendering, `$0` for zero or a non-finite amount.
 */
export declare function formatUsd(value: number): string;
/**
 * Format a local-hour bucket key (`2026-09-01T10:00:00`) for display.
 * @param hourKey - ISO-8601 local hour key from the report.
 * @returns a compact `MMM d · HH:00` label in the browser's locale.
 */
export declare function formatHourLabel(hourKey: string): string;
/**
 * Format a local-date key (`YYYY-MM-DD`) for a daily trend label.
 * @param dayKey - the local-date key; an unparseable key renders verbatim.
 * @returns a `MMM d` label, carrying the year outside the current one.
 */
export declare function formatDayLabel(dayKey: string): string;
/**
 * Format a report applied window for the period caption.
 * @param range - the window the report applied; an absent bound renders as a dash.
 * @returns the `start → end` caption.
 */
export declare function formatPeriod(range: {
    start?: number;
    end?: number;
}): string;
/**
 * Format an event instant in the browser's local time.
 * @param epochMs - the instant to render.
 * @returns the local clock time.
 */
export declare function formatEventTime(epochMs: number): string;
/**
 * Format a duration in milliseconds compactly (45s, 3m 12s, 2h 5m, 4d 2h).
 * @param ms - the duration; a negative value renders as zero seconds.
 * @returns the compact rendering, at most two units.
 */
export declare function formatDuration(ms: number): string;
/**
 * Compact one payload for an event row. Strings stay raw (tool arguments and
 * message content are already text); other values serialize as JSON.
 * @param value - the event payload to render.
 * @param maxChars - inclusive cap on the rendered length; longer text is elided.
 * @returns the single-line rendering.
 */
export declare function compactJson(value: unknown, maxChars?: number): string;
/** Structural label atoms for event summaries; supplied by the locale seat. */
export interface EventSummaryLabels {
    /** `turn` noun (e.g. "turn 2"). */
    turn: string;
    /** `step` noun (e.g. "step 1"). */
    step: string;
    /** `ended` fallback for an unknown turn-end reason kind. */
    ended: string;
    /** `in` prefix for input tokens in a usage summary. */
    usageIn: string;
    /** `out` prefix for output tokens in a usage summary. */
    usageOut: string;
    /** `provider` label for request-header summaries. */
    provider: string;
    /** `model` label for request-header summaries. */
    model: string;
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
export declare function eventSummary(type: string, data: unknown, labels: EventSummaryLabels): string;
//# sourceMappingURL=format.d.ts.map