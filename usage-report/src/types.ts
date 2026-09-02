/**
 * Browser-safe request, result, and error vocabulary of the usage-report
 * controller: the per-workspace usage report, the raw session-log read, and
 * the RemoteError codes the controller raises.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

export type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
export type { SessionId } from '@deepseek-ai/dsh-session/types'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The requested Workspace does not exist. */
    'usage/workspace-not-found': { readonly workspaceId: WorkspaceId }
    /** The requested Session is not accounted to the Workspace. */
    'usage/session-not-in-workspace': {
      readonly workspaceId: WorkspaceId
      readonly sessionId: SessionId
    }
    /** No persisted artifact exists for the Session. */
    'usage/session-log-unavailable': { readonly sessionId: SessionId }
  }
}

// ── per-workspace usage report ───────────────────────────────────────────────

/** Request for one Workspace's usage report, computed from its persisted session logs. */
export interface UsageReportRequest {
  /** Target Workspace whose accounted Sessions are folded. */
  readonly workspaceId: WorkspaceId
  /** IANA time-zone name used to bucket the hourly series (the caller's local zone). */
  readonly timeZone: string
  /**
   * Inclusive report window start, Unix epoch milliseconds. Absent means no
   * lower bound: only model responses at or after this instant are folded.
   */
  readonly rangeStart?: number
  /**
   * Exclusive report window end, Unix epoch milliseconds. Absent means no
   * upper bound: only model responses before this instant are folded.
   */
  readonly rangeEnd?: number
}

/** USD price per one million tokens for one model route, with an optional peak-rate split. */
export interface UsageModelPrice {
  /** USD per 1M cache-hit input tokens. */
  readonly cacheHitInputPerM: number
  /** USD per 1M cache-miss input tokens. */
  readonly cacheMissInputPerM: number
  /** USD per 1M output tokens. */
  readonly outputPerM: number
  /** Peak-rate USD per 1M tokens; absent means no peak/off-peak split. */
  readonly peak?: {
    readonly cacheHitInputPerM: number
    readonly cacheMissInputPerM: number
    readonly outputPerM: number
  }
}

/** One local-hour bucket of a usage report. */
export interface UsageHourBucket {
  /** ISO-8601 local hour key, e.g. `2026-09-01T10:00:00` in the requested zone. */
  readonly hour: string
  /** Unix epoch milliseconds at the local hour's start. */
  readonly hourStart: number
  /** Model responses (loop assistant messages and compaction summaries) within the hour. */
  readonly apiCalls: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly totalTokens: number
  /** Estimated USD cost for the hour. */
  readonly costUsd: number
}

/** Per-model usage aggregate within a Workspace report. */
export interface UsageModelRow {
  readonly provider: string
  readonly model: string
  readonly apiCalls: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly totalTokens: number
  /** Estimated USD cost; 0 when `unpriced` is true. */
  readonly costUsd: number
  /** True when no price is known for this model. */
  readonly unpriced: boolean
}

/** Per-session usage aggregate within a Workspace report. */
export interface UsageSessionRow {
  readonly sessionId: SessionId
  /** Session creation instant, ISO-8601. */
  readonly createdAt: string
  /** Parent session id when the session is a subagent child. */
  readonly parentSession?: SessionId
  readonly apiCalls: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly totalTokens: number
  readonly costUsd: number
  /** Unix epoch milliseconds of the first recorded event. */
  readonly firstEventAt: number
  /** Unix epoch milliseconds of the last recorded event. */
  readonly lastEventAt: number
  /** JSONL lines that failed to parse; a corruption signal, not silently dropped usage. */
  readonly malformedLines: number
}

/** Totals of one Workspace usage report. */
export interface UsageReportTotals {
  /** Sessions whose logs were folded. */
  readonly sessions: number
  /** Model responses (loop assistant messages and compaction summaries) across every folded session. */
  readonly apiCalls: number
  /** Tool calls requested by the model across every folded session. */
  readonly toolCalls: number
  /** Turns opened across every folded session. */
  readonly turns: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly totalTokens: number
  /** Estimated USD cost; 0 when every billed call is unpriced. */
  readonly costUsd: number
  /** Usage-bearing calls whose model has no known price. */
  readonly unpricedCalls: number
  /** Unix epoch milliseconds of the earliest folded event. */
  readonly firstEventAt: number
  /** Unix epoch milliseconds of the latest folded event. */
  readonly lastEventAt: number
}

/** The complete usage report for one Workspace, computed from persisted session logs. */
export interface UsageReportValue {
  readonly workspaceId: WorkspaceId
  /** Canonical Workspace directory path. */
  readonly path: string
  readonly title: string
  /** Unix epoch milliseconds when the report was computed. */
  readonly generatedAt: number
  /** IANA zone used for the hourly series. */
  readonly timeZone: string
  /** The inclusive report window start actually applied (epoch ms); absent when open-ended. */
  readonly rangeStart?: number
  /** The exclusive report window end actually applied (epoch ms); absent when open-ended. */
  readonly rangeEnd?: number
  readonly totals: UsageReportTotals
  /** Hourly series ordered chronologically in the requested local zone. */
  readonly byHour: readonly UsageHourBucket[]
  readonly byModel: readonly UsageModelRow[]
  readonly bySession: readonly UsageSessionRow[]
  /** Model ids seen in logs that have no known price. */
  readonly unknownModels: readonly string[]
  /** Pricing basis applied, keyed by model id. */
  readonly pricing: Readonly<Record<string, UsageModelPrice>>
}

/** Request for one Session's raw event log within a Workspace. */
export interface UsageSessionLogRequest {
  readonly workspaceId: WorkspaceId
  readonly sessionId: SessionId
}

/** One raw event row of a Session log, lossless JSON `data` included. */
export interface UsageLogEvent {
  readonly seq: number
  readonly time: number
  readonly type: string
  /** The event's full payload; session events are JSON-validated at append. */
  readonly data: JsonValue
}

/** The raw event log of one Session, newest events kept when truncated. */
export interface UsageSessionLogValue {
  readonly sessionId: SessionId
  /** Session creation instant, ISO-8601. */
  readonly createdAt: string
  /** True when older events were dropped to bound the payload. */
  readonly truncated: boolean
  readonly events: readonly UsageLogEvent[]
}
