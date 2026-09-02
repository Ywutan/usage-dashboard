---
description: "Optional profile bundle installing the web usage dashboard: the sidebar 'Usage dashboard' action and its full-viewport per-workspace report, over a base-backed web profile."
kind: "package-bundle"
---

# @deepseek-ai/dsh-usage-dashboard

English | [中文](README.zh.md)

## Summary

`dsh-usage-dashboard` is an optional profile bundle that installs the web usage dashboard into a base-backed web profile (`dsh-web-app`). Its patch composes the complete self-contained plugin: the `usage-report` Host row (the `usage` Remote namespace computing the report from persisted session logs) plus the `ui-usage` browser row (the sidebar footer action `Usage dashboard` and the full-viewport panel reporting API calls, tokens, and estimated USD cost for the selected window). The base workspace controller is unmodified — a profile without this bundle has neither the report capability nor the dashboard UI.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Install the bundle into a profile with the profile plugin command; it runs `pnpm add` in the profile directory and reconciles the profile's bundle layer list:

```sh
dsh plugin --profile web add @deepseek-ai/dsh-usage-dashboard
```

For a local checkout, pass the absolute package directory instead of a registry name (the plugin command passes absolute specs through):

```sh
dsh plugin --profile web add /path/to/deepseek-harness/packages/bundle/usage-dashboard
```

Restart the profile (`dsh --profile web`) and the `Usage dashboard` action appears at the sidebar foot. Remove it the same way:

```sh
dsh plugin --profile web remove @deepseek-ai/dsh-usage-dashboard
```

### What installing changes

The bundle inserts one row: `ui-usage` (`@deepseek-ai/dsh-client-ui-usage`). Everything else — the `usageReport`/`sessionLog` Remote methods, the DeepSeek price table, the report fold — comes from the workspace controller already composed by the base and web-app layers. The dashboard reads persisted session logs and is read-only.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A bundle is a package whose manifest declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`. The profile composer stacks the patch over the profile's bundle layers in `dsh.profile.bundles` order, so this package is a static patch-list carrier with an empty node half and a standard invariant companion, exactly like the shipped profile bundles. The `ui-usage` row resolves through the profile's module fallback, which the launcher heals from the installation dependency closure plus the selected profile's bundles on every launch.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-usage](../../client/ui-usage/README.md) — the browser plugin this bundle composes.
- [workspace-controller](../../api/workspace-controller/README.md) — the Host `workspace` Remote namespace providing `usageReport` and `sessionLog`.
- [Profile plugin bundles note](../../../.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.md) — how profiles, bundles, and the module fallback compose.
- [web-app](../web-app/README.md) — the default web surface layer this bundle extends.

-----

<a id="model-experience"></a>
## Model Experience

None: the bundle composes a read-only browser dashboard; it never reaches a model request.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Install requires resolution of the bundle from the installation or profile** — the `dsh plugin` command installs from a registry by name; a local checkout uses the absolute path form above.
- **The Host usage capability stays in the base layer** — the `usageReport`/`sessionLog` Remote methods are composed with the workspace controller in every web profile even without this bundle; only the dashboard UI is optional. Splitting the Host computation into this bundle is deferred until a second consumer of the usage report exists.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
