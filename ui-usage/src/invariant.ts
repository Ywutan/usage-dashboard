/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-usage`.
 * @module @deepseek-ai/dsh-client-ui-usage/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-usage'

/** Cordis companion plugin name. */
export const name = 'client-ui-usage-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the dashboard is a read-only fold of Host-computed
 * reports; panel and report state are an entry-declared store owned by the
 * slot registry, and the trigger registration is an effect of this plugin's
 * fiber.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
