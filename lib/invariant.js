//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@deepseek-ai/dsh-usage-dashboard`.
* @module @deepseek-ai/dsh-usage-dashboard/invariant
*/
const PACKAGE_NAME = "@deepseek-ai/dsh-usage-dashboard";
/** Cordis companion plugin name. */
const name = "usage-report-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns The installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
