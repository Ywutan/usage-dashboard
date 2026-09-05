/**
 * Usage dashboard plugin, browser half: mounts the generated `usage` Remote
 * namespace, registers the `sidebar.footer.action` occupant that opens the
 * full-viewport dashboard, owns the `usage` dictionaries, and provides the
 * report/session-log loaders. The Host computes reports from the persisted
 * session logs; this package only presents them.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type UsageKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Usage dashboard copy. */
        usage: UsageKey;
    }
}
/**
 * Required services: the Remote service (to mount onto), the Slot registry,
 * and locale. `remote.usage` is deliberately absent: this plugin provides that
 * namespace, and injecting a service one provides never settles.
 */
export declare const inject: string[];
/**
 * Client plugin body: mount the `usage` Remote namespace, register the
 * dictionaries, and load the dashboard over them.
 * @param ctx - client root context.
 * @returns disposer unmounting the namespace.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map