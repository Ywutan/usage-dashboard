#!/usr/bin/env node
/**
 * Link a deepseek-harness installation into this repository's node_modules.
 *
 * The plugin packages declare every harness package as a peerDependency: the
 * profile supplies them at run time from its own module fallback, and a second
 * installed copy would fork the shared runtime identity (two `dsh-session`, two
 * `cordis`) so the services stop recognizing each other. Building and
 * typechecking still need those packages on disk, which is what this script
 * provides — one symlink per harness package, never a copy.
 *
 *   node tools/link-harness.mjs [harness-root]
 *
 * The root defaults to $DSH_HARNESS, then to a `deepseek-harness` checkout
 * beside this repository. Re-running replaces the links, so it is safe after a
 * `pnpm install` (which prunes them) or a harness `git pull`.
 */
import { existsSync, globSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

/** Workspace globs holding the harness packages a plugin may resolve. */
const HARNESS_PACKAGE_GLOBS = ['packages/*/*/package.json', 'vendor/*/package.json']

const harnessRoot = resolve(
  process.argv[2] ?? process.env.DSH_HARNESS ?? join(REPOSITORY_ROOT, '..', 'deepseek-harness'),
)

if (!existsSync(join(harnessRoot, 'pnpm-workspace.yaml')) || !existsSync(join(harnessRoot, 'packages'))) {
  console.error(`link-harness: ${harnessRoot} is not a deepseek-harness checkout (no pnpm-workspace.yaml).`)
  console.error('Pass the checkout path, or set DSH_HARNESS: node tools/link-harness.mjs /path/to/deepseek-harness')
  process.exit(1)
}

/** This package's own name: it must never be shadowed by a harness link. */
const localPackages = new Set([
  JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')).name,
])

const scopeDirectory = join(REPOSITORY_ROOT, 'node_modules', '@deepseek-ai')
mkdirSync(scopeDirectory, { recursive: true })

let linked = 0
for (const glob of HARNESS_PACKAGE_GLOBS) {
  for (const manifestPath of globSync(glob, { cwd: harnessRoot })) {
    const packageDirectory = join(harnessRoot, dirname(manifestPath))
    const { name } = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'))
    if (typeof name !== 'string' || !name.startsWith('@deepseek-ai/')) continue
    const link = join(scopeDirectory, name.slice('@deepseek-ai/'.length))
    // A package this repository owns must resolve to its own source, never to
    // a same-named harness package the build would read instead.
    if (localPackages.has(name)) continue
    if (lstatSync(link, { throwIfNoEntry: false }) !== undefined) rmSync(link, { recursive: true, force: true })
    symlinkSync(relative(scopeDirectory, packageDirectory), link, 'dir')
    linked += 1
  }
}

console.log(`link-harness: linked ${linked} packages from ${harnessRoot}`)
