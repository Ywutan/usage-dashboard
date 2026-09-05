#!/usr/bin/env node
/**
 * Regenerate the committed Typert artifacts of `@deepseek-ai/dsh-usage-report`.
 *
 *   node tools/gen-typert.mjs [harness-root]
 *
 * The generator recognizes a `@Remote` decorator only when
 * `@deepseek-ai/dsh-typert-protocol` is a registered package of the same
 * workspace, and it registers only project references resolving under
 * `<workspace>/packages` (`analyzer.ts`, `loadRegistrations` and
 * `isTypeMetaSymbol`). A plugin repository can satisfy neither, so generation
 * runs inside a harness checkout instead of at build time: this script stages
 * the package there, generates, copies the artifacts back under
 * `packages/usage-report/typert/`, and restores the checkout.
 *
 * The artifacts are a pure function of the package's own Remote surface, so
 * they are committed here and the ordinary build only copies them into `lib/`.
 * Re-run this after changing a `@Remote` method, its request/response types, or
 * the harness release the package targets.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

/** Package generated here, and where it must sit inside a harness checkout. */
const SUBJECT = {
  name: '@deepseek-ai/dsh-usage-dashboard',
  source: REPOSITORY_ROOT,
  harnessPath: join('packages', 'usage', 'usage-dashboard'),
  output: join(REPOSITORY_ROOT, 'typert'),
}

/**
 * Compiler project the staged package needs inside the checkout. Its own
 * out-of-tree tsconfig resolves the harness through node_modules; the analyzer
 * needs the harness's source-level project graph instead.
 */
const STAGED_TSCONFIG = {
  extends: '../../../tsconfig.base.json',
  compilerOptions: { rootDir: 'src', outDir: 'lib/types' },
  include: ['src'],
  references: [
    { path: '../../../vendor/cordis' },
    { path: '../../core/session' },
    { path: '../../llm/llm' },
    { path: '../../runtime-diagnostics/invariants' },
    { path: '../../session/session-persistence' },
    { path: '../../typert/protocol' },
    { path: '../../util/values' },
    { path: '../../workspace/workspace' },
  ],
}

const harnessRoot = resolve(
  process.argv[2] ?? process.env.DSH_HARNESS ?? join(REPOSITORY_ROOT, '..', 'deepseek-harness'),
)
const hostSolution = join(harnessRoot, 'tsconfig.host.json')
const generatorModule = join(harnessRoot, 'packages', 'typert', 'generator', 'lib', 'types', 'workspace.js')

if (!existsSync(hostSolution) || !existsSync(generatorModule)) {
  console.error(`gen-typert: ${harnessRoot} is not a built deepseek-harness checkout.`)
  console.error('Pass the checkout path, or set DSH_HARNESS, and run `pnpm run build` there first.')
  process.exit(1)
}

const stagedRoot = join(harnessRoot, SUBJECT.harnessPath)
if (existsSync(stagedRoot)) {
  console.error(`gen-typert: ${stagedRoot} already exists; refusing to overwrite a checkout's own package.`)
  process.exit(1)
}
const originalSolution = readFileSync(hostSolution, 'utf8')

try {
  // Only the Host face is analyzed; the browser sources would pull the client
  // Context merge into the same program.
  mkdirSync(join(stagedRoot, 'src'), { recursive: true })
  for (const file of ['index.ts', 'types.ts', 'usage.ts', 'invariant.ts']) {
    cpSync(join(SUBJECT.source, 'src', file), join(stagedRoot, 'src', file))
  }
  cpSync(join(SUBJECT.source, 'package.json'), join(stagedRoot, 'package.json'))
  writeFileSync(join(stagedRoot, 'tsconfig.json'), `${JSON.stringify(STAGED_TSCONFIG, null, 2)}\n`)

  // The reference is what puts the staged package in the analyzer's inventory.
  const reference = `    { "path": "./${SUBJECT.harnessPath.replaceAll('\\', '/')}" },\n`
  writeFileSync(hostSolution, originalSolution.replace('  "references": [\n', `  "references": [\n${reference}`))

  const { WorkspaceTypertGenerator } = await import(pathToFileURL(generatorModule).href)
  const artifacts = new WorkspaceTypertGenerator(harnessRoot).generate([SUBJECT.name], ['host'])
  if (artifacts.length === 0) throw new Error(`gen-typert: the generator produced nothing for ${SUBJECT.name}`)

  rmSync(SUBJECT.output, { recursive: true, force: true })
  mkdirSync(SUBJECT.output, { recursive: true })
  const written = []
  for (const artifact of artifacts) {
    write(`typert.${artifact.face}.js`, artifact.js)
    write(`typert.${artifact.face}.d.ts`, artifact.dts)
    if (artifact.remote === undefined) continue
    write('typert.remote-client.js', artifact.remote.js)
    write('typert.remote-client.d.ts', artifact.remote.dts)
    write('typert.remote-client.d.ts.map', artifact.remote.dtsMap)
  }
  console.log(`gen-typert: wrote ${written.join(', ')} to ${SUBJECT.output}`)

  function write(name, content) {
    writeFileSync(join(SUBJECT.output, name), content)
    written.push(name)
  }
} finally {
  rmSync(stagedRoot, { recursive: true, force: true })
  writeFileSync(hostSolution, originalSolution)
  // The parent directory exists only when this run created it.
  const group = dirname(stagedRoot)
  try { rmdirSync(group) } catch { /* the checkout owns this group directory */ }
}
