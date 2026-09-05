---
description: "Web usage dashboard for the dsh web client: a sidebar footer action opening a full-viewport per-workspace report of session-log API calls, tokens, and estimated USD cost by local hour."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-usage

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-usage` is the web usage dashboard feature plugin, composed as an optional profile layer by the [`dsh-usage-dashboard` bundle](../../bundle/usage-dashboard/README.md). Its browser half registers one `usage-trigger` entry in the sidebar-owned `sidebar.footer.action` list; the entry opens a full-viewport panel that reports on the workspace's persisted session logs. The Host report is computed by the `@deepseek-ai/dsh-usage-report` plugin (`ctx.remote.usage.report`) from the stored session event logs and priced with the official DeepSeek API table (peak and off-peak by UTC); this plugin mounts that Remote namespace and only presents it. The panel shows totals (API calls, tool calls, turns, sessions, input/output/cache tokens, estimated USD cost), a per-hour cost chart and detail table in the browser's local time zone, per-model and per-session tables, and an inline raw-event explorer per session (`usage.sessionLog`). Its host half is empty on purpose: the dashboard is browser-side presentation over a Host controller that already exists.

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

The sidebar footer carries a data-chart action labeled `Usage dashboard` (icon-only on the collapsed rail). Opening it selects the current workspace — the workspace of the current session, or the first registered workspace — and fetches the report for the **current local day** by default; the panel's window chips widen it to the last 7/30 days, all time, or an explicit calendar interval, and the workspace selector switches workspaces. The report reflects the persisted session logs under the workspace for the selected window at fetch time; a retry button appears when a fetch fails.

### Reading the report

- **Totals cards**: API calls (model responses), tool calls, turns, sessions, input/output/cache tokens, and the estimated cost.
- **Trend chart**: bar columns scaled to estimated USD cost, with a detail table of calls, tokens, and cost. The granularity adapts to the window — per local hour while the window fits one local day (the default today view), per local date once it spans two or more days.
- **By model**: per provider/model route, calls, input/output tokens, and cost; models without a known price show `no price` and are listed in the totals warning.
- **Sessions**: one row per folded session with calls, tokens, cost, and duration; `Explore log` fetches and renders the session's newest raw events (`time · seq · type · summary`), truncated to the newest 500 when the log is longer.
- The footer note states that cost is an estimate from the official DeepSeek API pricing and the token usage recorded in the logs.

### Cost model

Token counts are disjoint: `inputTokens` is uncached input and bills at the cache-miss rate, cache-read tokens bill at the cache-hit rate on top of it, and output tokens bill at the output rate; cache-write tokens are not billed. Peak rates apply inside the DeepSeek peak window (Monday–Friday, 01:00–04:00 and 06:00–10:00 UTC). A model with no entry in the pricing table contributes tokens but no cost and is reported as unpriced.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The panel state is a non-persisted Slot store: open/close, the selected workspace, the cached report, and the load lifecycle. The registration's inject factory closes over the generated `workspace` Remote namespace; `loadReport` commits its own lifecycle through the store actions, and `loadSessionLog` returns null on failure so the explorer renders a contained error. The hourly series is bucketed Host-side with the browser's IANA zone (`Intl.DateTimeFormat` offset math), so the payload stays aggregated instead of shipping raw events for charting.

### Copy and locale

All product copy is bilingual: the plugin registers zh/en dictionaries under the `usage` namespace of `dsh-client-locale` and the entry uses the framework-bound `t` seat. Session event payloads render verbatim through `eventSummary`/`compactJson`; they are user data, never localized.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These pages cover the sidebar shell, the workspace Remote, and the Host report computation.

- [ui-sidebar](../ui-sidebar/README.md) — the sidebar shell owning the `sidebar.footer.action` slot.
- [usage-report](../../usage/usage-report/README.md) — the Host `usage` Remote namespace this plugin mounts (`report` and `sessionLog`).
- [workspace](../../workspace/workspace/README.md) — the workspace registry and its session accounting.
- [session-persistence](../../session/session-persistence/README.md) — the stored session-log seam the Host report reads through.

-----

<a id="model-experience"></a>
## Model Experience

None, as the dashboard reads persisted session logs and never reaches a model request.

#### KV Cache effect

None. The dashboard is a read-only consumer of Host-computed reports.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the report's scope; they are current package constraints.

- **Pricing is a snapshot, not live** — the DeepSeek price table is compiled into the Host controller and checked against api-docs.deepseek.com on 2026-08-30. Price changes and models added later require a code update; unknown models are reported unpriced rather than guessed.
- **Reports are point-in-time** — the panel fetches on open and on workspace switch; a long-running session's newest events appear after a manual reopen or retry, and the panel never polls.
- **Raw-event explorer shows the newest 500 events** — a longer session log is truncated Host-side to bound the payload; the truncation is labeled in the explorer.
- **Usage attribution is header-based** — a model response is attributed to the most recent `request/header` before it; responses before any header attribute to `unknown`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
