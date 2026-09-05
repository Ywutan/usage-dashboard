/**
 * Per-workspace usage report fold over session event logs: attribute each loop
 * response to the request header that preceded it and each compaction summary
 * to the route it recorded, price tokens with the built-in DeepSeek table
 * (peak and off-peak by UTC), and bucket the series by local hour in the
 * caller's IANA zone. Stored sessions are read through the handle-based
 * persistence seam and live ones from their in-memory log, so both paths fold
 * the same validated `SessionEvent` rows. I/O (registry lookup, persistence
 * reads) lives in the service; the fold and pricing helpers are pure so the
 * report logic is unit-testable.
 *
 * @module @deepseek-ai/dsh-usage-dashboard/usage
 */
import type { Context } from '@deepseek-ai/cordis';
import type { TokenUsage } from '@deepseek-ai/dsh-llm';
import type { SessionHeader } from '@deepseek-ai/dsh-session';
import type { UsageModelPrice, UsageReportRequest, UsageReportValue, UsageSessionLogRequest, UsageSessionLogValue } from './types.ts';
/** One model response recorded from a session log: a loop response or a compaction summary. */
export interface UsageCall {
    /** Event append time, Unix epoch milliseconds. */
    readonly time: number;
    /** Provider route the request header attributed, or the summary's own route; `unknown` when neither recorded one. */
    readonly provider: string;
    /** Model id the request header attributed, or the summary's own model; `unknown` when neither recorded one. */
    readonly model: string;
    /** Adapter-reported token accounting; absent when the adapter reported none. */
    readonly usage?: TokenUsage;
}
/** One session's folded event log plus its header metadata. */
export interface FoldedSessionLog {
    readonly meta: SessionHeader;
    /** Model responses in log order. */
    readonly calls: readonly UsageCall[];
    /** `tool/call` events. */
    readonly toolCalls: number;
    /** `turn/start` events. */
    readonly turns: number;
    /** Unix epoch milliseconds of the first folded event, 0 for an empty log. */
    readonly firstEventAt: number;
    /** Unix epoch milliseconds of the last folded event, 0 for an empty log. */
    readonly lastEventAt: number;
}
/** The official DeepSeek API pricing basis, checked against api-docs.deepseek.com on 2026-08-30. */
export declare const DEEPSEEK_PRICING: Readonly<Record<string, UsageModelPrice>>;
/**
 * Resolve the USD price basis for one model id.
 * @param model - model id recorded in a session log.
 * @returns the price basis, or `undefined` when the model is not priced.
 */
export declare function modelPrice(model: string): UsageModelPrice | undefined;
/**
 * Whether a UTC instant falls in the DeepSeek peak window (Monday–Friday,
 * 01:00–04:00 and 06:00–10:00 UTC; all other hours are off-peak).
 * @param epochMs - Unix epoch milliseconds.
 * @returns true during the peak window.
 */
export declare function isPeakUtc(epochMs: number): boolean;
/**
 * Price one model response. `TokenUsage` counts are disjoint: `inputTokens`
 * is uncached input, billed at the cache-miss rate, and `cacheReadTokens` is
 * the cache-hit input, billed at the hit rate; output tokens bill at the
 * output rate and cache-write tokens are not billed. Peak rates apply inside
 * the DeepSeek peak window.
 * @param price - the model's price basis.
 * @param usage - the response's token accounting.
 * @param epochMs - response time, decides the peak window.
 * @returns the estimated USD cost.
 */
export declare function priceCall(price: UsageModelPrice, usage: TokenUsage, epochMs: number): number;
/**
 * Wall-clock hour parts of one instant in a zone.
 * @param formatter - one reusable formatter built by {@link buildHourFormatter}.
 * @param epochMs - instant to bucket.
 * @returns the local hour key and the Unix epoch milliseconds at that hour's start.
 */
export declare function hourBucketOf(formatter: Intl.DateTimeFormat, epochMs: number): {
    readonly key: string;
    readonly start: number;
};
/**
 * Build one reusable local-hour formatter for a zone.
 * @param timeZone - IANA time-zone name.
 * @returns a formatter yielding year/month/day/hour/minute/second parts in that zone.
 */
export declare function buildHourFormatter(timeZone: string): Intl.DateTimeFormat;
/** One event row consumed by the usage fold, from a stored read or live memory. */
interface EventRow {
    readonly time: number;
    readonly type: string;
    readonly data: unknown;
}
/** An optional inclusive/exclusive window restricting which events a report folds. */
export interface ReportRange {
    /** Inclusive window start, Unix epoch milliseconds. */
    readonly start: number;
    /** Exclusive window end, Unix epoch milliseconds. */
    readonly end: number;
}
/**
 * Fold one session's canonical events into model responses and counters.
 * Stored logs arrive from the persistence handle seam and live ones from the
 * running session's in-memory log; both are already validated `SessionEvent`
 * rows, so the fold is the only step either path needs.
 * @param meta - the session's storage header.
 * @param events - the session's canonical events, in log order.
 * @param range - optional window restricting which events are folded.
 * @returns the log fold.
 */
export declare function foldSessionLog(meta: SessionHeader, events: readonly EventRow[], range?: ReportRange): FoldedSessionLog;
/**
 * The optional inclusive/exclusive window a request asks for.
 * @param request - the report request carrying the optional bounds.
 * @returns the window, or undefined when the request set neither bound.
 */
export declare function rangeOf(request: UsageReportRequest): ReportRange | undefined;
/**
 * Fold folded session logs into the complete report value.
 * @param request - the originating request, for the echoed window and zone.
 * @param path - canonical Workspace directory path.
 * @param title - Workspace display title.
 * @param generatedAt - Unix epoch milliseconds stamped on the report.
 * @param logs - one fold per accounted Session.
 * @returns totals, the hourly series, and the per-model and per-session aggregates.
 */
export declare function buildUsageReport(request: UsageReportRequest, path: string, title: string, generatedAt: number, logs: readonly FoldedSessionLog[]): UsageReportValue;
/** Newest event rows kept in one session-log response; older rows are dropped. */
export declare const MAX_USAGE_LOG_EVENTS = 500;
/** Compute the usage report for one Workspace from its persisted session logs. */
export declare class WorkspaceUsage {
    private readonly ctx;
    /** @param ctx - Host context carrying the Workspace registry and session persistence. */
    constructor(ctx: Context);
    /**
     * Fold every accounted Session log of a Workspace into a usage report.
     * Stored reads run concurrently (bounded) so a large Workspace does not
     * serialize every log read.
     * @param request - target Workspace and caller-local time zone.
     * @param signal - cancellation for persistence reads.
     * @returns the computed report.
     * @throws RemoteError `usage/workspace-not-found` when the Workspace is unknown.
     */
    report(request: UsageReportRequest, signal: AbortSignal): Promise<UsageReportValue>;
    /**
     * Read the raw event log of one Session accounted to a Workspace.
     * @param request - Workspace and Session identities.
     * @param signal - cancellation for persistence reads.
     * @returns the Session's creation instant and its newest event rows.
     * @throws RemoteError `usage/workspace-not-found` for an unknown Workspace,
     *   `usage/session-not-in-workspace` for a Session the Workspace does not
     *   account, and `usage/session-log-unavailable` when no stored log exists
     *   for the Session.
     */
    sessionLog(request: UsageSessionLogRequest, signal: AbortSignal): Promise<UsageSessionLogValue>;
    /**
     * Read one stored session log through a read handle, which never takes
     * ownership and so works while the session's writer holds it. Absence is a
     * value, not a failure: a Workspace keeps accounting a Session whose log has
     * been deleted, and both callers treat that as no data. The stored events
     * are returned as recorded — an interrupted tail is not repaired, because
     * neither an accounting fold nor a raw log view may show a response that was
     * never recorded.
     * @param sessionId - the stored Session to read.
     * @param signal - cancellation for the open and read.
     * @returns the stored header and events, or undefined when no log exists.
     */
    private readStoredLog;
}
export {};
//# sourceMappingURL=usage.d.ts.map