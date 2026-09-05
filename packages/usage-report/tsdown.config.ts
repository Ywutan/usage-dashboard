import { hostBundle } from '../../tsdown.preset.ts'

// The Typert host face and the generated `usage` Remote contribution are
// committed under `typert/` and placed into `lib/` by `tools/place-typert.mjs`
// before the build; the generator cannot run from a plugin repository (see
// `tools/gen-typert.mjs`).
export default hostBundle('@deepseek-ai/dsh-usage-report', ['lib/types/index.js', 'lib/types/invariant.js'])
