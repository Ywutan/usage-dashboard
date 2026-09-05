# dsh usage dashboard

A per-workspace usage dashboard for [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness): API calls, tokens, and estimated USD cost folded from session logs, as a sidebar action and a full-viewport report.

## Install

```sh
dsh plugin --profile web add github:Ywutan/usage-dashboard
dsh --profile web
```

Open the `Usage dashboard` action at the sidebar foot. The dashboard defaults to the current local day, has a date-range selector (today / 7 / 30 days / all / custom), an adaptive trend chart (per hour within one day, per day across dates), per-model and per-session tables, and an inline raw-session event explorer.

Remove it with `dsh plugin --profile web remove @deepseek-ai/dsh-usage-dashboard`.

Nothing is written into the harness checkout. The package is an ordinary profile bundle: `dsh.bundle.patch` names the composition it contributes, and the harness supplies its own packages at run time from the profile's module fallback.

## Shape

One package carrying both halves, which is why a single row composes it:

```
cordis.patch.yml       the bundle patch: one row naming this package
src/index.ts           Host half — the `usage` Remote namespace (report + sessionLog)
src/usage.ts           fold session event logs → totals, hourly series, cost, window filter
src/types.ts           wire types, shared by both faces
src/client/            browser half — trigger, panel, trend chart, range selector, tables, store, i18n
typert/                generated Remote contribution, committed (see below)
lib/                   the built plugin, committed so a git install needs no build step
```

## Version compatibility

The peer ranges name the harness release this was built against (`0.1.3-alpha.1`). The Host half reads stored logs through the `SessionPersistence` handle seam (`open(id, 'read')` → `read()`), not through any on-disk format of its own.

## Development

The harness packages are peer dependencies: the profile supplies them at run time, and a second installed copy would fork the shared runtime identity — two `dsh-session`, two `cordis` — so the services stop recognizing each other. Building needs them on disk, which is what the link step provides.

```sh
pnpm install
pnpm run setup                  # links ../deepseek-harness; pass a path or set DSH_HARNESS
pnpm run build                  # tsc both faces, then the node and browser bundles
pnpm run test
```

`pnpm run build` emits the ESM node half plus `lib/client.js`, the browser bundle: a CJS artifact wrapped in the `window.__ModuleLoader__.load({ id, factory })` handoff, with the shell's shared modules left as `require()` calls and everything else inlined. `tsdown.preset.ts` owns that contract, standing in for the harness's own client build preset, which resolves packages through the harness workspace layout and cannot be imported from here. It declares the shell module table in `SHELL_MODULE_TABLE_BASELINE` and proves that declaration against a linked checkout, so drift is a build error rather than a duplicated runtime identity in the browser.

### Generated Typert artifacts

`typert/` is committed. The generator recognizes a `@Remote` decorator only when `@deepseek-ai/dsh-typert-protocol` is a registered package of the same workspace, and it registers only project references resolving under `<workspace>/packages`, so it cannot run from here. `tools/gen-typert.mjs` stages the package inside a harness checkout, generates there, copies the artifacts back, and restores the checkout. Re-run it after changing a `@Remote` method or its request/response types.
