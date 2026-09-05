/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-usage-report`.
 * @module @deepseek-ai/dsh-usage-report/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-usage-report'

/** Cordis companion plugin name. */
export const name = 'usage-report-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

// No runtime invariant: the usage report is a pure read-only fold over
// persisted session artifacts. It holds no mutable state to check; the Remote
// namespace and its codecs are the typert Registry's effect, and each folded
// identity is derived from the session log itself.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
