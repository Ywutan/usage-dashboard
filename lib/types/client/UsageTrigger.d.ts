import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { createUsageStore } from './usage-store.ts';
import { NS } from './locales.ts';
import type { UsageInjected } from './UsagePanel.tsx';
/** Store handle type of this plugin's registration. */
export type UsageStore = ReturnType<typeof createUsageStore>;
/** Composed props: sidebar geometry + store seats + injected loaders + locale. */
export type UsageTriggerProps = PropsRuntime<'sidebar.footer.action'> & PropsStore<UsageStore> & UsageInjected & PropsLocale<typeof NS>;
/**
 * Render the dashboard trigger and, while open, the dashboard panel.
 * @param props - composed slot props.
 * @returns the footer action button and the optional panel overlay.
 */
export declare function UsageTrigger({ wide, useSessions, useWorkspaces, useStore, actions, t, loadReport, loadSessionLog, }: UsageTriggerProps): import("react").JSX.Element;
//# sourceMappingURL=UsageTrigger.d.ts.map