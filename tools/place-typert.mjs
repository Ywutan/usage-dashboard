#!/usr/bin/env node
/**
 * Place the committed Typert artifacts where each package's `exports` publish
 * them from.
 *
 * They are generated inside a harness checkout (`tools/gen-typert.mjs`) and
 * committed under `<package>/typert/`, because the generator cannot run from a
 * plugin repository. Copying them into `lib/` keeps the published layout
 * identical to every other harness package, and it must happen before the
 * TypeScript build: a package's browser half imports the `/remote`
 * contribution of another, so the declarations have to be on disk first.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

let placed = 0
for (const packageName of readdirSync(join(REPOSITORY_ROOT, 'packages'))) {
  const generated = join(REPOSITORY_ROOT, 'packages', packageName, 'typert')
  if (!existsSync(generated)) continue
  const output = join(REPOSITORY_ROOT, 'packages', packageName, 'lib')
  mkdirSync(output, { recursive: true })
  for (const file of readdirSync(generated)) {
    copyFileSync(join(generated, file), join(output, file))
    placed += 1
  }
}

console.log(`place-typert: placed ${placed} generated artifacts`)
