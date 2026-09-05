/**
 * Web usage dashboard plugin, node half.
 *
 * Deliberately empty: the dashboard is a browser-side presentation of Host
 * workspace-usage data; the Host computation lives in the workspace
 * controller, and mounting anything here would add a Host effect with no
 * model- or product-visible purpose.
 */

/** Host plugin body — the dashboard is browser-only. */
export function apply(): void {}
