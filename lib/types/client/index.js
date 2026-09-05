// Value import: the generated `usage` Remote contribution this plugin mounts.
import usageRemote from '@deepseek-ai/dsh-usage-dashboard/remote';
import { en, NS, zh } from "./locales.js";
import { createUsageStore } from "./usage-store.js";
import { UsageTrigger } from "./UsageTrigger.js";
/**
 * Required services: the Remote service (to mount onto), the Slot registry,
 * and locale. `remote.usage` is deliberately absent: this plugin provides that
 * namespace, and injecting a service one provides never settles.
 */
export const inject = ['remote', 'slots', 'locale'];
/** The browser's IANA zone, falling back to UTC when unavailable. */
function resolvedTimeZone() {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.length > 0 ? zone : 'UTC';
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
function usageActions(ctx, actions) {
    return {
        loadReport: async (workspaceId, range, signal) => {
            actions.beginLoad(workspaceId);
            try {
                const result = await ctx.remote.usage.report({
                    workspaceId,
                    timeZone: resolvedTimeZone(),
                    ...range.start !== undefined ? { rangeStart: range.start } : {},
                    ...range.end !== undefined ? { rangeEnd: range.end } : {},
                }, signal);
                if (signal?.aborted)
                    return;
                if (result.ok) {
                    actions.finishLoad(result.value);
                }
                else {
                    actions.failLoad(result.error.message);
                }
            }
            catch (error) {
                if (signal?.aborted)
                    return;
                actions.failLoad(error instanceof Error ? error.message : String(error));
            }
        },
        loadSessionLog: async (workspaceId, sessionId) => {
            const result = await ctx.remote.usage.sessionLog({ workspaceId, sessionId });
            return result.ok ? result.value : null;
        },
    };
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
    apply(ctx) {
        const usageStore = createUsageStore();
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
            name: 'sidebar.footer.action',
            id: 'usage-trigger',
            order: 100,
            locale: NS,
            store: usageStore,
            inject: actions => usageActions(ctx, actions),
        }, UsageTrigger));
    },
};
/**
 * Client plugin body: mount the `usage` Remote namespace, register the
 * dictionaries, and load the dashboard over them.
 * @param ctx - client root context.
 * @returns disposer unmounting the namespace.
 */
export async function apply(ctx) {
    // The namespace exists only while this plugin is loaded (bundle-installed).
    const unmount = await ctx.remote.$mount(usageRemote);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-usage: dictionaries');
    ctx.plugin(usageDashboard);
    return unmount;
}
//# sourceMappingURL=index.js.map