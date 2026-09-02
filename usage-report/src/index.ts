/**
 * Usage-report Remote owner: the per-workspace usage report and raw
 * session-log read, computed from persisted session logs. A read-only,
 * optional capability — composed only when the usage-dashboard bundle is
 * installed, so the base workspace controller stays unmodified.
 */

import { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { buildHourFormatter, WorkspaceUsage } from './usage.ts'
import type {
  UsageReportRequest,
  UsageReportValue,
  UsageSessionLogRequest,
  UsageSessionLogValue,
} from './types.ts'

export type * from './types.ts'
export { WorkspaceUsage, DEEPSEEK_PRICING, rangeOf } from './usage.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host usage-report business API and Remote namespace owner. */
    usageController: UsageController
  }
}

/** Host service backing the generated `ctx.remote.usage` namespace. */
export class UsageController extends TypertRemoteService {
  static inject = ['typert', 'workspaceRegistry', 'sessionPersistence', 'sessions']

  private readonly usage: WorkspaceUsage

  /** @param ctx - Host context containing the Workspace registry and session persistence. */
  constructor(ctx: Context) {
    super(ctx, 'usageController', { namespace: 'usage' })
    this.usage = new WorkspaceUsage(ctx)
  }

  /**
   * Compute the usage report for one Workspace over an optional window.
   * @param request - target Workspace, caller-local time zone, and window.
   * @param signal - cancellation for persistence reads.
   * @returns totals, hourly series, per-model and per-session aggregates.
   * @throws RemoteError `gateway/bad-request` for an invalid time zone, or
   *   `usage/workspace-not-found` for an unknown Workspace.
   */
  @Remote('report')
  report(request: UsageReportRequest, signal: AbortSignal): Promise<UsageReportValue> {
    try {
      buildHourFormatter(request.timeZone)
    } catch {
      return Promise.reject(new RemoteError(
        'gateway/bad-request',
        `usage report: unknown time zone "${request.timeZone}"`,
        {},
      ))
    }
    return this.usage.report(request, signal)
  }

  /**
   * Read the raw event log of one Session accounted to a Workspace.
   * @param request - Workspace and Session identities.
   * @param signal - cancellation for persistence reads.
   * @returns the Session's creation instant and its newest event rows.
   * @throws RemoteError `usage/workspace-not-found`,
   *   `usage/session-not-in-workspace`, or `usage/session-log-unavailable`
   *   on the documented conditions.
   */
  @Remote('sessionLog')
  sessionLog(request: UsageSessionLogRequest, signal: AbortSignal): Promise<UsageSessionLogValue> {
    return this.usage.sessionLog(request, signal)
  }
}

export default UsageController
