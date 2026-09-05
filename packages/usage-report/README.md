---
description: "Self-contained per-workspace usage-report Host capability: fold persisted session logs into API-call, token, and estimated USD-cost analytics over an optional window."
kind: "package-reference"
---

# @deepseek-ai/dsh-usage-report

English | [中文](README.zh.md)

## Summary

`dsh-usage-report` is the Host half of the usage dashboard plugin, composed as an optional profile layer by the [`dsh-usage-dashboard` bundle](../../bundle/usage-dashboard/README.md). It owns the generated `ctx.remote.usage` Remote namespace with two read-only verbs: `report` (fold every accounted Session's canonical log into totals, a local-hour series, per-model and per-session aggregates, and an estimated USD cost over an optional `rangeStart`/`rangeEnd` window) and `sessionLog` (one Session's raw event rows for the inline explorer). It is self-contained: the base workspace controller is unmodified, and the capability exists only when the bundle composes this plugin.

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

Compose it into a base-backed web profile through the usage-dashboard bundle (`dsh plugin --profile web add @deepseek-ai/dsh-usage-dashboard`), or add this package as a bundle layer directly. It reads the workspace registry, session persistence, and the in-memory session store; it never resumes an Agent or touches a model request.

### Report window

`report` accepts `rangeStart`/`rangeEnd` (inclusive/exclusive epoch milliseconds). Live sessions fold from the in-memory canonical log, so a session the loop is still appending never blocks the report; stored logs read concurrently (bounded) through read handles that never take write ownership. Sessions with no activity inside the window drop out of the per-session view and the session count.

### Pricing

Tokens bill with the official DeepSeek API table (peak/off-peak UTC rates) checked 2026-08-30. Cache-hit input tokens bill at the hit rate, remaining input at the miss rate, output at the output rate; cache-write tokens are not billed. Models outside the table report unpriced.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The controller is a `TypertRemoteService` on the `usage` namespace. A pure fold (`usage.ts`) takes each Session's canonical events — read through the `SessionPersistence` handle seam, or taken from the live in-memory log — attributes every model response to the most recent preceding `request/header`, prices the call, and buckets it into the caller's IANA zone; a window check drops events outside the requested range. The client mounts the generated `usage` remote contribution itself, so the namespace appears only while this plugin is loaded.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [usage-dashboard](../../bundle/usage-dashboard/README.md) — the installable bundle composing this Host capability and the browser dashboard.
- [ui-usage](../../client/ui-usage/README.md) — the browser plugin that mounts and consumes this Remote namespace.
- [workspace-controller](../../api/workspace-controller/README.md) — the workspace registry and accounting this report folds.

-----

<a id="model-experience"></a>
## Model Experience

None, as the report reads persisted session logs and never reaches a model request.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Pricing is a snapshot, not live** — the DeepSeek price table is compiled in `usage.ts` and checked against api-docs.deepseek.com on 2026-08-30; later price changes need a code update, and unknown models report unpriced.
- **The `sessionLog` explorer is capped at 500 events** — a longer log is truncated Host-side to bound the payload, labeled in the UI.
- **Header-based attribution** — a model response bills under the most recent `request/header` before it; responses before any header attribute to `unknown`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
