#!/usr/bin/env node
/**
 * Place the committed Typert artifacts where this package's `exports` publish
 * them from.
 *
 * They are generated inside a harness checkout (`tools/gen-typert.mjs`) and
 * committed under `typert/`, because the generator only recognizes a `@Remote`
 * decorator inside a workspace that also registers
 * `@deepseek-ai/dsh-typert-protocol`. Copying them into `lib/` must happen
 * before the TypeScript build: the browser half imports the `/remote`
 * contribution and needs its declarations on disk first.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const generated = join(ROOT, 'typert')

if (!existsSync(generated)) {
  console.log('place-typert: no typert/ directory; nothing to place')
  process.exit(0)
}

const output = join(ROOT, 'lib')
mkdirSync(output, { recursive: true })
let placed = 0
for (const file of readdirSync(generated)) {
  copyFileSync(join(generated, file), join(output, file))
  placed += 1
}
console.log(`place-typert: placed ${placed} generated artifacts`)
