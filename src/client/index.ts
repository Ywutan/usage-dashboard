/**
 * Usage dashboard plugin, browser half: mounts the generated `usage` Remote
 * namespace, registers the `sidebar.footer.action` occupant that opens the
 * full-viewport dashboard, owns the `usage` dictionaries, and provides the
 * report/session-log loaders. The Host computes reports from the persisted
 * session logs; this package only presents them.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Value import: the generated `usage` Remote contribution this plugin mounts.
import usageRemote from '@deepseek-ai/dsh-usage-dashboard/remote'
// Type-only: the generated `usage` namespace merge rides the same artifact.
import type {} from '@deepseek-ai/dsh-usage-dashboard/remote'
import type { UsageSessionLogValue } from '../types.ts'
import type { WorkspaceId } from '../types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageRangeBounds } from './range.ts'
// Type-only: pulls the ctx.remote merge and the client standard seats.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { en, NS, zh, type UsageKey } from './locales.ts'
import { createUsageStore } from './usage-store.ts'
import { UsageTrigger, type UsageStore } from './UsageTrigger.tsx'
import type { UsageInjected } from './UsagePanel.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Usage dashboard copy. */
    usage: UsageKey
  }
}

/**
 * Required services: the Remote service (to mount onto), the Slot registry,
 * and locale. `remote.usage` is deliberately absent: this plugin provides that
 * namespace, and injecting a service one provides never settles.
 */
export const inject = ['remote', 'slots', 'locale']

/** The browser's IANA zone, falling back to UTC when unavailable. */
function resolvedTimeZone(): string {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  return typeof zone === 'string' && zone.length > 0 ? zone : 'UTC'
}

/**
 * Loaders over the generated `usage` Remote. The report loader commits
 * its own lifecycle through the store actions and always settles it — a
 * rejected or cancelled fetch records the failure instead of leaving the
 * panel stuck on "loading". The session-log loader returns null on failure
 * so the explorer can render a contained error.
 * @param ctx - client root context.
 * @param actions - the store's baked write set.
 * @returns the injected loaders.
 */
function usageActions(
  ctx: ClientContext,
  actions: BoundActions<UsageStore>,
): UsageInjected {
  return {
    loadReport: async (
      workspaceId: WorkspaceId,
      range: UsageRangeBounds,
      signal?: AbortSignal,
    ) => {
      actions.beginLoad(workspaceId)
      try {
        const result = await ctx.remote.usage.report(
          {
            workspaceId,
            timeZone: resolvedTimeZone(),
            ...range.start !== undefined ? { rangeStart: range.start } : {},
            ...range.end !== undefined ? { rangeEnd: range.end } : {},
          },
          signal,
        )
        if (signal?.aborted) return
        if (result.ok) {
          actions.finishLoad(result.value)
        } else {
          actions.failLoad(result.error.message)
        }
      } catch (error) {
        if (signal?.aborted) return
        actions.failLoad(error instanceof Error ? error.message : String(error))
      }
    },
    loadSessionLog: async (
      workspaceId: WorkspaceId,
      sessionId: SessionId,
    ): Promise<UsageSessionLogValue | null> => {
      const result = await ctx.remote.usage.sessionLog({ workspaceId, sessionId })
      return result.ok ? result.value : null
    },
  }
}

/**
 * The dashboard itself, as a child fiber. Cordis guards every Remote property
 * behind its own injection, so reading `ctx.remote.usage` requires naming it —
 * which the owning plugin cannot do for a namespace it mounts itself. The
 * child declares the injection and the parent's mount settles it.
 */
const usageDashboard = {
  name: 'ui-usage-dashboard',
  inject: ['remote.usage', 'slots', 'locale'],
  /**
   * Register the sidebar trigger and its dashboard panel.
   * @param ctx - child context carrying the mounted `usage` namespace.
   */
  apply(ctx: ClientContext): void {
    const usageStore = createUsageStore()
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'usage-trigger',
      order: 100,
      locale: NS,
      store: usageStore,
      inject: actions => usageActions(ctx, actions),
    }, UsageTrigger))
  },
}

/**
 * Client plugin body: mount the `usage` Remote namespace, register the
 * dictionaries, and load the dashboard over them.
 * @param ctx - client root context.
 * @returns disposer unmounting the namespace.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  // The namespace exists only while this plugin is loaded (bundle-installed).
  const unmount = await ctx.remote.$mount(usageRemote)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-usage: dictionaries')
  ctx.plugin(usageDashboard)
  return unmount
}
