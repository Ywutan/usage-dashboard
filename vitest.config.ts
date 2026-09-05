import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

/**
 * Resolve the harness to its sources, the way the harness's own suite does.
 *
 * Its `tsconfig.base.json` carries a generated map from every `@deepseek-ai/*`
 * specifier to the source file behind it, and that map must win over the
 * package `exports`: a built `lib/` artifact is a bundle carrying its own
 * resolved dependencies, so loading one here would put a second copy of a
 * module singleton — React, the client store — in the same program. The
 * browser avoids this by sharing those modules through the loader module
 * table; a test process has to be told.
 *
 * Tests therefore need a harness checkout, which `tools/link-harness.mjs`
 * already requires. The build does not: it consumes published declarations
 * and artifacts.
 * @returns the resolution plugin, bound to the linked checkout.
 * @throws {Error} when no checkout is linked.
 */
function harnessSources(): ReturnType<typeof tsconfigPaths>[] {
  const require = createRequire(import.meta.url)
  // <harness>/packages/client/web -> <harness>
  const harnessRoot = resolve(
    dirname(require.resolve('@deepseek-ai/dsh-client-web/package.json')), '..', '..', '..',
  )
  const project = join(harnessRoot, 'tsconfig.base.json')
  if (!existsSync(project)) {
    throw new Error(
      `vitest: ${project} is missing; the tests resolve the harness through its source map. `
      + 'Run `node tools/link-harness.mjs /path/to/deepseek-harness` against a checkout.',
    )
  }
  return [tsconfigPaths({ root: harnessRoot, projects: [project] })]
}

export default defineConfig({
  plugins: harnessSources(),
  resolve: {
    // React and its renderer must be one instance across this repository and
    // the linked checkout, or a component rendered from the checkout reads a
    // null hook dispatcher. The browser shares React through the loader module
    // table for the same reason.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  },
  test: {
    // Component specs select jsdom with their own `@vitest-environment`
    // pragma, as the harness's own client suites do; everything else runs on
    // node.
    include: ['packages/*/tests/**/*.spec.ts', 'packages/*/tests/**/*.spec.tsx'],
  },
})
