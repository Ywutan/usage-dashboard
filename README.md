# dsh plugins monorepo

A monorepo of optional deepseek-harness plugins. Each plugin is one folder composing its own Host capability + browser UI, installed per profile as a bundle. Add a new plugin as a sibling folder with the same shape.

## Layout

```
usage-dashboard/            ← the usage dashboard plugin (one plugin = one folder)
  package.json              installable bundle (@deepseek-ai/dsh-usage-dashboard): dsh.bundle.patch
  cordis.patch.yml          composes usage-report (Host) + ui-usage (browser) rows
  src/, tests/, READMEs
usage-report/               ← the Host half (@deepseek-ai/dsh-usage-report)
  package.json              the `usage` Remote namespace: report + sessionLog
  src/usage.ts              fold persisted session logs → totals, hourly series, cost, window filter
  src/types.ts, src/index.ts, src/invariant.ts
  tests/, READMEs
ui-usage/                   ← the browser half (@deepseek-ai/dsh-client-ui-usage)
  package.json              mounts the `usage` Remote namespace; sidebar action + dashboard panel
  src/client/               trigger, panel, trend chart (hour/day), range selector, tables, store, i18n
  tests/, READMEs
```

## Install

These packages are harness workspace packages: they reference the deepseek-harness SDK packages (`dsh-llm`, `dsh-session`, `dsh-client-*`, `dsh-typert-protocol`, …) via `workspace:^`, so they must live in a deepseek-harness checkout to build and run. When they are part of the harness workspace:

```sh
# compose the plugin into a web profile
dsh plugin --profile web add /path/to/this/repo/usage-dashboard
pnpm dsh --profile web
```

Open the `Usage dashboard` action at the sidebar foot. The dashboard defaults to the current local day, has a date-range selector (today / 7 / 30 days / all / custom), an adaptive trend chart (per hour within one day, per day across dates), per-model and per-session tables, and an inline raw-session event explorer.

## Adding another plugin

Create a sibling folder with an installable bundle (`package.json` + `cordis.patch.yml` + a `dsh.bundle.patch`) that composes its Host and browser rows, exactly like `usage-dashboard`. See the [profile plugin bundles design](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.md) in the harness.
