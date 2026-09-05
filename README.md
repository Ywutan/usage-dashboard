# dsh plugins monorepo

A monorepo of optional deepseek-harness plugins. Each plugin is one folder composing its own Host capability + browser UI, installed per profile as a bundle. Add a new plugin as a sibling folder under `packages/` with the same shape.

## Layout

```
packages/usage-dashboard/   ← the usage dashboard plugin (one plugin = one folder)
  package.json              installable bundle (@deepseek-ai/dsh-usage-dashboard): dsh.bundle.patch
  cordis.patch.yml          composes usage-report (Host) + ui-usage (browser) rows
  src/, tests/, READMEs
packages/usage-report/      ← the Host half (@deepseek-ai/dsh-usage-report)
  package.json              the `usage` Remote namespace: report + sessionLog
  src/usage.ts              fold session event logs → totals, hourly series, cost, window filter
  typert/                   committed Typert host face + generated `usage` Remote contribution
  src/types.ts, src/index.ts, src/invariant.ts
  tests/, READMEs
packages/ui-usage/          ← the browser half (@deepseek-ai/dsh-client-ui-usage)
  package.json              mounts the `usage` Remote namespace; sidebar action + dashboard panel
  src/client/               trigger, panel, trend chart (hour/day), range selector, tables, store, i18n
  tests/, READMEs
tsdown.preset.ts            browser-bundle and node-library build presets (see below)
vitest.config.ts            resolves the harness to its sources, as its own suite does
tools/link-harness.mjs      links a harness checkout into node_modules for building
tools/gen-typert.mjs        regenerates packages/usage-report/typert/
harness/, install.sh, tools/patch-harness.py
                            the older in-tree installer, kept for a workspace install
```

The `packages/` parent is required, not cosmetic: the typert generator only registers packages that sit under it.

## Build

The packages declare every harness package as a `peerDependency`. The profile supplies them at run time from its own module fallback (`$DSH_HOME/profiles/node_modules`, one link per package of the installation closure, regenerated at each launch); a second installed copy would fork the shared runtime identity — two `dsh-session`, two `cordis` — and the services stop recognizing each other. Building still needs those packages on disk, which is what the link step provides.

```sh
pnpm install                                  # links ../deepseek-harness by default
node tools/link-harness.mjs /path/to/harness  # or point it somewhere else, or set DSH_HARNESS
pnpm run build                                # tsc -b, then one tsdown per package
pnpm run test
```

`pnpm run build` emits, per package, the ESM node half under `lib/` and — for `ui-usage` — the browser bundle `lib/client.js`: a CJS artifact wrapped in the `window.__ModuleLoader__.load({ id, factory })` handoff, with the shell's shared modules left as `require()` calls and everything else inlined. `tsdown.preset.ts` owns that contract out-of-tree, in place of the harness's own `packages/client/tsdown.client.ts`, which resolves packages through the harness workspace layout and cannot be imported from here.

It declares the shell module table itself, in `SHELL_MODULE_TABLE_BASELINE`: the harness does not publish `@deepseek-ai/dsh-client-web`'s sources, and that package's root entry pulls the whole node-side shell, so neither face is usable from a build. `assertShellModuleTable()` proves the declaration still matches whenever the linked checkout carries its compiled `platform` module, so drift is a build error rather than a duplicated runtime identity in the browser.

### Generated Typert artifacts

`packages/usage-report/typert/` is committed. The generator recognizes a `@Remote` decorator only when `@deepseek-ai/dsh-typert-protocol` is a registered package of the same workspace, and it registers only project references resolving under `<workspace>/packages`, so it cannot run from a plugin repository. `tools/gen-typert.mjs` stages the package inside a harness checkout, generates there, copies the artifacts back, and restores the checkout. Re-run it after changing a `@Remote` method, its request/response types, or the harness release the package targets.

## Compose into a profile

```sh
dsh plugin --profile web add /path/to/this/repo/packages/usage-dashboard
dsh --profile web
```

Open the `Usage dashboard` action at the sidebar foot. The dashboard defaults to the current local day, has a date-range selector (today / 7 / 30 days / all / custom), an adaptive trend chart (per hour within one day, per day across dates), per-model and per-session tables, and an inline raw-session event explorer.

## Version compatibility

The packages carry the harness release they were built against (`0.1.3-alpha.1`) in their peer ranges. The Host half reads stored logs through the `SessionPersistence` handle seam (`open(id, 'read')` → `read()`), not through any on-disk format of its own.

## Installing into a harness workspace instead

`install.sh` remains for the in-tree path: it copies the packages into a checkout, wires the compiler solutions, package maps and curated generator tables, then installs, builds, and regenerates the catalogs.

## Adding another plugin


Create a sibling folder with an installable bundle (`package.json` + `cordis.patch.yml` + a `dsh.bundle.patch`) that composes its Host and browser rows, exactly like `usage-dashboard`. See the [profile plugin bundles design](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.md) in the harness.
