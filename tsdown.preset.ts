/**
 * Out-of-tree tsdown preset for DSH plugin packages. It reproduces
 * the artifact the harness's own `packages/client/tsdown.client.ts` emits —
 * the closure-factory handoff, the module-table externals, the CSS Modules
 * pipeline — from a plugin repository that is not a harness checkout.
 *
 * The two harness-internal inputs are replaced, not copied:
 * - package discovery scans this repository's own `<root>/<package>/package.json`
 *   instead of the harness `packages/<group>/<package>/package.json` layout;
 * - the shell module-table baseline is declared here, in
 *   {@link SHELL_MODULE_TABLE_BASELINE}, and verified against the installed
 *   harness whenever that installation carries it.
 *
 * The module-edge rules below (inline-safe layers, vendored libraries,
 * generated remotes) are the harness's rules and MUST match its preset: they
 * decide which specifiers the browser resolves through the loader module table
 * and which a bundle may inline. A specifier the table cannot answer throws at
 * plugin materialization, and an inlined shared runtime silently forks its
 * identity, so both failures are caught here at build time instead.
 * @module tsdown.preset
 */
import { readFile } from 'node:fs/promises'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { basename, dirname, join, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/**
 * Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline
 * (which requires @tsdown/css). The suffix matters: tsdown's guard matches ids
 * ending in `.css`, so the virtual id must not.
 */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const GLOBAL_CSS_VIRTUAL_PREFIX = '\0dsh-global-css:'
const INLINE_CSS_VIRTUAL_PREFIX = '\0dsh-inline-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
const INLINE_CSS_QUERY = '?inline'

/** This repository's root: the directory holding one folder per plugin package. */
const PLUGIN_REPOSITORY_ROOT = fileURLToPath(new URL('.', import.meta.url))

/**
 * Specifiers the web shell shares into the frozen browser module table: every
 * dynamic plugin bundle resolves these through the loader instead of carrying
 * its own copy. It mirrors `PLATFORM_MODULES` and `PRELOADED_CLIENT_EXTERNALS`
 * in `@deepseek-ai/dsh-client-web`, which a published harness does not expose
 * to a build (its `src` is unpublished, and its package root pulls the whole
 * node-side shell), so it is stated here as part of this repository's
 * compatibility promise to the peer range its packages declare.
 *
 * {@link assertShellModuleTable} proves it still matches when the harness is
 * installed from a built checkout, so drift is a build error during
 * development rather than a duplicated runtime identity in the browser.
 */
const SHELL_MODULE_TABLE_BASELINE: readonly string[] = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
]

/** Compiled `platform` module of an installed harness, relative to its package root. */
const HARNESS_PLATFORM_MODULE = join('lib', 'types', 'platform.js')

/**
 * Prove {@link SHELL_MODULE_TABLE_BASELINE} still names exactly what the
 * installed shell shares. The installed `@deepseek-ai/dsh-client-web` carries
 * its compiled `platform` module only when it was linked from a built harness
 * checkout; a published install has neither that file nor any other build-safe
 * face of the list, and the declared baseline stands alone there.
 * @throws {Error} when the installed shell shares a different set of modules.
 */
async function assertShellModuleTable(): Promise<void> {
  const require = createRequire(import.meta.url)
  let packageManifest: string
  try {
    packageManifest = require.resolve('@deepseek-ai/dsh-client-web/package.json')
  } catch {
    return // no harness installed here: nothing to compare the baseline against.
  }
  const platformModule = join(dirname(packageManifest), HARNESS_PLATFORM_MODULE)
  if (!existsSync(platformModule)) return // published install: the file is not shipped.
  const { PLATFORM_MODULES, PRELOADED_CLIENT_EXTERNALS } = await import(
    pathToFileURL(platformModule).href
  ) as { PLATFORM_MODULES: readonly string[], PRELOADED_CLIENT_EXTERNALS: readonly string[] }
  const installed = [...new Set([...PLATFORM_MODULES, ...PRELOADED_CLIENT_EXTERNALS])].sort()
  const declared = [...SHELL_MODULE_TABLE_BASELINE].sort()
  if (installed.join('\n') === declared.join('\n')) return
  throw new Error(
    `tsdown: the installed web shell shares a different module table than SHELL_MODULE_TABLE_BASELINE declares.\n`
    + `  installed: ${installed.join(', ')}\n`
    + `  declared:  ${declared.join(', ')}\n`
    + 'Update the baseline in tsdown.preset.ts and the peer ranges the plugin packages declare.',
  )
}

/**
 * Contract layers and pure folds a client bundle may inline: browser-safe
 * values with no runtime identity to share (no Symbol/instanceof/singleton state).
 * Everything else under @deepseek-ai/* is either a module-table entry
 * (external) or a leak the purity gate rejects.
 */
const INLINE_SAFE = /^(?:@deepseek-ai\/dsh-(?:file-reference|session|llm|tools|brand|deque|typert-protocol|util-crypto|util-values|util-workspace-path)(?:\/|$)|@deepseek-ai\/dsh-token-meter\/client$|@deepseek-ai\/dsh-agent-presets\/display$)/

/**
 * Vendored framework libraries: rescoped into @deepseek-ai, so the gate below
 * would read them as plugin packages. They carry no cross-plugin runtime
 * identity to share — the framework itself is a requested module-table row
 * (external), while these are ordinary libraries a browser bundle inlines.
 */
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/

/** Generated descriptor/codec contribution with no shared runtime identity. */
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/

/** Emit one plugin-owned style injector and an optional CSS Modules export. */
function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap?: Readonly<Record<string, string>>,
): string {
  const source = [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
  ]
  source.push(classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`)
  return source.join('\n')
}

/**
 * Build the tsdown configs for one out-of-tree Host plugin package: its node
 * library, plus any rolldown plugins the package's own artifacts need (the
 * typert generator, for a package exporting a Typert or Remote face).
 * @param id - package name.
 * @param libEntry - node-half entries, spelled at the call site so each
 * package's own config states the entries it publishes.
 * @param plugins - rolldown plugins appended to the node-half build.
 * @returns the package's tsdown config.
 */
export function hostBundle(
  id: string,
  libEntry: readonly string[],
  plugins: readonly unknown[] = [],
): UserConfig {
  return { ...nodeLibraryConfig(id, libEntry), plugins: [...plugins] as UserConfig['plugins'] }
}

/**
 * Build the tsdown configs for one out-of-tree UI plugin package: the node-half
 * library plus the browser client bundle.
 *
 * The node half consumes the `lib/types` JavaScript `tsc -b` emits, so a build
 * runs the TypeScript solution first; the browser half is bundled from `src`
 * directly, which is what removes this repository's need for the harness's
 * two-face (Host/Client) build orchestration. The returned function defers
 * every build decision past config loading so the module-table baseline is
 * checked once per build.
 * @param id - plugin id (package name), stamped into the __ModuleLoader__.load
 * handoff and onto the injected style tags.
 * @param libEntry - node-half entries, spelled at the call site so each
 * package's own config states the entries it publishes.
 * @returns the node-half and browser-bundle configs, in build order.
 */
export function clientBundle(id: string, libEntry: readonly string[]): () => Promise<UserConfig[]> {
  return async () => {
    await assertShellModuleTable()
    return [nodeLibraryConfig(id, libEntry), clientConfig(id, 'src/client/index.ts')]
  }
}

/** The manifest fields the build reads to state its own module edges. */
interface PluginManifest {
  readonly name?: string
  /** Sections a real install materializes on disk next to the built package. */
  readonly dependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly dsh?: { readonly client?: { readonly external?: unknown } }
}

const manifestCache = new Map<string, PluginManifest>()
const productionExternalCache = new Map<string, readonly RegExp[]>()
const clientExternalCache = new Map<string, ReadonlySet<string>>()

/**
 * Read one plugin package's manifest. Located by package name rather than by
 * cwd, because tsdown evaluates a package config with the invoking directory as
 * `process.cwd()`, which differs between a per-package and a repository-wide run.
 * @param id - package name, as spelled at the preset call site.
 * @returns the parsed manifest.
 * @throws {Error} when no package folder in this repository declares that name.
 */
function pluginManifest(id: string): PluginManifest {
  const cached = manifestCache.get(id)
  if (cached !== undefined) return cached
  for (const manifestPath of globSync('packages/*/package.json', { cwd: PLUGIN_REPOSITORY_ROOT })) {
    const manifest = JSON.parse(
      readFileSync(resolvePath(PLUGIN_REPOSITORY_ROOT, manifestPath), 'utf8'),
    ) as PluginManifest
    if (manifest.name !== id) continue
    manifestCache.set(id, manifest)
    return manifest
  }
  throw new Error(`tsdown: no packages/*/package.json under ${PLUGIN_REPOSITORY_ROOT} declares the name ${id}`)
}

/**
 * External patterns for one package's Node half: its own production sections,
 * subpaths included.
 * @param id - package name, as spelled at the preset call site.
 * @returns one `^name(/|$)` pattern per production dependency, name-sorted.
 */
function productionExternals(id: string): readonly RegExp[] {
  const cached = productionExternalCache.get(id)
  if (cached !== undefined) return cached
  const manifest = pluginManifest(id)
  const names = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ])
  const patterns = [...names].sort().map(name => new RegExp(`^${escapeSpecifier(name)}(/|$)`))
  productionExternalCache.set(id, patterns)
  return patterns
}

/**
 * Module-table specifiers one package requests. The shell baseline is implicit
 * for every dynamic bundle; `dsh.client.external` only adds package-specific
 * dynamic rows or subpaths. Matching is exact, never normalized: a package
 * declares the specifier its own code imports, and the loader keys entries the
 * same way.
 * @param id - package name, as spelled at the preset call site.
 * @returns the baseline plus the package's explicit requests.
 * @throws {Error} when `dsh.client.external` is not a string array.
 */
function clientExternals(id: string): ReadonlySet<string> {
  const cached = clientExternalCache.get(id)
  if (cached !== undefined) return cached
  const declared = pluginManifest(id).dsh?.client?.external
  if (declared !== undefined && (!Array.isArray(declared) || declared.some(item => typeof item !== 'string'))) {
    throw new Error(`tsdown: ${id} dsh.client.external must be a string array`)
  }
  const externals = new Set<string>([
    ...SHELL_MODULE_TABLE_BASELINE,
    ...(declared ?? []) as readonly string[],
  ])
  clientExternalCache.set(id, externals)
  return externals
}

/** Escape a package name for literal use inside a RegExp source. */
function escapeSpecifier(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whether an import specifier is the package a pattern names, or one of its subpaths. */
function matchesSpecifier(patterns: readonly RegExp[], specifier: string): boolean {
  return patterns.some(pattern => pattern.test(specifier))
}

function nodeLibraryConfig(id: string, libEntry: readonly string[]): UserConfig {
  const isProductionDependency = (specifier: string): boolean =>
    matchesSpecifier(productionExternals(id), specifier)
  return {
    name: id,
    entry: [...libEntry],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      // The Node half runs from a real install: a production dependency is on
      // disk there and stays an import, everything else inlines. Stating both
      // halves takes the artifact off tsdown's getProductionDeps fallback, where
      // moving a dependency between npm sections silently re-bundles it.
      // Builtins keep tsdown's own handling (neither side claims them).
      neverBundle: isProductionDependency,
      alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !isProductionDependency(specifier),
    },
  }
}

function clientConfig(id: string, entry: string): UserConfig {
  const isRequested = (specifier: string): boolean => clientExternals(id).has(specifier)
  return {
    name: `${id}/client`,
    entry: { client: entry },
    // Browser bundle lands next to the node half (single lib/ artifact dir;
    // the entryFileNames pin keeps it exactly lib/client.js). clean must stay
    // off — a default clean would wipe the node-half output emitted above.
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    // Types ship from lib/types (tsc); dts here would wrap the banner/footer into .d.cts and break parsing.
    dts: false,
    // Plugin code is fetched outside the shell's module graph, so its own
    // bundle must carry the TS/TSX mapping consumed by browser profiling tools.
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: isRequested,
      // Anything NOT requested from the loader module table must inline
      // (wire/type layers, zod, clsx — every non-shared dep). A require() the
      // table cannot answer is a guaranteed runtime throw, so the rule is the
      // package's own request list: requested specifiers stay imports,
      // everything else is bundled.
      alwaysBundle: (specifier: string) => !isRequested(specifier),
    },
    // Dual-mode libraries resolve their static flavor matching the NODE_ENV
    // the defines below bake in.
    inputOptions: {
      resolve: {
        conditionNames: [
          (process.env.NODE_ENV ?? 'production') === 'development' ? 'development' : 'production',
          'browser', 'import', 'module', 'default',
        ],
      },
    },
    // Browser bundles inline node-idiom deps that read process.env.NODE_ENV and
    // probe import.meta.env; a CJS output carries neither, and rolldown flags
    // EMPTY_IMPORT_META. The bare `import.meta.env` key is required alongside
    // the precise MODE key so a truthiness probe does not survive as an empty
    // import.meta. The empty `process.env` fallback makes an unset static
    // property read evaluate to undefined without a browser `process` global.
    define: {
      'process.env': '{}',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [{
      // Bundle purity gate (build-time mirror of the module-edge rules): the
      // baseline and package-specific requests stay external, inline-safe wire
      // layers inline, and every other @deepseek-ai value import is a build
      // error — a cross-plugin value import either inlines a duplicate runtime
      // instance or requires a specifier the module table cannot answer for
      // this package. Cross-plugin collaboration goes through cordis services.
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (isRequested(source)) return null // requested module-table row: external wins
        if (VENDORED_LIBRARY.test(source)) return null // vendored library: inline, no shared identity
        if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null // wire contribution: inline is the point
        throw new Error(
          `client bundle purity: "${source}" is not in the shell client externals or ${id}'s dsh.client.external, an inline-safe wire layer, or a generated /remote contribution — `
          + 'cross-plugin value imports are forbidden; declare a non-default module request or collaborate through cordis services '
          + '(type-only imports are erased and never reach this gate)',
        )
      },
    }, {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        // The virtual id otherwise hides the physical stylesheet from Rolldown's watch graph.
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        const exportEntries = Object.entries(cssExports ?? {})
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        for (const [local, exp] of exportEntries) classMap[local] = exp.name
        return styleInjectionModule(id, fileId, code.toString(), classMap)
      },
    }, {
      name: 'dsh-css-text-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith(`.css${INLINE_CSS_QUERY}`)) return null
        const stylesheet = source.slice(0, -INLINE_CSS_QUERY.length)
        const abs = importer !== undefined ? resolvePath(dirname(importer), stylesheet) : stylesheet
        return INLINE_CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(INLINE_CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(INLINE_CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code } = transform({ filename: fileId, code: source, minify: true })
        return `export default ${JSON.stringify(code.toString())};`
      },
    }, {
      name: 'dsh-css-global-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
        return GLOBAL_CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(GLOBAL_CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(GLOBAL_CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code } = transform({ filename: fileId, code: source, minify: true })
        return styleInjectionModule(id, fileId, code.toString())
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      sourcemapPathTransform: pluginSourcePath,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

/**
 * Rebase a physical source path onto a repository-relative one. Published maps
 * carry `sourcesContent`, so these names only have to be stable and free of the
 * build machine's directory layout.
 * @param source - source path as rolldown emitted it, relative to the map.
 * @param sourcemapPath - absolute path of the map being written.
 * @returns the path relative to this repository's root, or the input unchanged
 * when it points outside the repository.
 */
function pluginSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolvePath(dirname(sourcemapPath), source)
  const repositoryPath = relative(PLUGIN_REPOSITORY_ROOT, physicalSource).split(sep).join('/')
  return repositoryPath.startsWith('..') ? source : `./${repositoryPath}`
}
