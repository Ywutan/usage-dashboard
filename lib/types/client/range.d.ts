/**
 * Pure date-range vocabulary for the usage dashboard: the user's selection
 * (presets or an explicit calendar interval) and its conversion to
 * epoch-millisecond window bounds in the browser's LOCAL calendar. No React
 * and no subscriptions — components translate the selection and hand the
 * bounds to the loader.
 * @module @deepseek-ai/dsh-usage-dashboard/range
 */
/** Preset window choices. */
export type UsagePreset = 'today' | '7d' | '30d' | 'all';
/** One user-facing range selection. */
export type UsageRangeSelection = {
    readonly kind: 'preset';
    readonly preset: UsagePreset;
} | {
    readonly kind: 'custom';
    readonly startDate: string;
    readonly endDate: string;
};
/** The epoch-millisecond window a selection maps to; absent bounds mean open-ended. */
export interface UsageRangeBounds {
    /** Inclusive window start, Unix epoch milliseconds. */
    start?: number;
    /** Exclusive window end, Unix epoch milliseconds. */
    end?: number;
}
/**
 * Resolve a selection to window bounds in the browser's local calendar.
 * @param selection - preset or explicit interval.
 * @param now - reference instant for the preset anchors (defaults to now).
 * @returns the inclusive-start/exclusive-end window; empty for "all".
 */
export declare function rangeBounds(selection: UsageRangeSelection, now?: number): UsageRangeBounds;
/**
 * Stable identity of a selection, used to spot range changes cheaply.
 * @param selection - the preset or custom range the user chose.
 * @returns a key equal exactly for selections naming the same range.
 */
export declare function selectionKey(selection: UsageRangeSelection): string;
/**
 * Format an instant as a local `YYYY-MM-DD` calendar date.
 * @param epochMs - the instant to render.
 * @returns the calendar date in the browser's zone.
 */
export declare function toLocalIso(epochMs: number): string;
//# sourceMappingURL=range.d.ts.map