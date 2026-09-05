---
description: "dsh Web 客户端的用量仪表盘：侧边栏底部操作按钮打开全屏的工作区用量报告，展示会话日志中的 API 调用、tokens 以及按本地小时估算的美元费用。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-usage

English | [中文](README.md)

## 概述

`dsh-client-ui-usage` 是 Web 用量仪表盘功能插件，由 [`dsh-usage-dashboard` bundle](../../bundle/usage-dashboard/README.zh.md) 作为可选的配置文件层组合。其浏览器半边在侧边栏的 `sidebar.footer.action` 列表里注册一个 `usage-trigger` 条目，点击后打开全屏面板，展示该工作区持久化会话日志的用量报告。Host 端报告由 `@deepseek-ai/dsh-usage-report` 插件（`ctx.remote.usage.report`）从已存储的会话事件日志计算，并按 DeepSeek 官方 API 价格表（按 UTC 区分高峰/低谷）计价；本插件装载该 Remote 命名空间，只负责展示。面板包含汇总卡片（API 调用、工具调用、轮次、会话数、输入/输出/缓存 tokens、预估美元费用）、按浏览器本地时区聚合的每小时费用柱状图与明细表、按模型和按会话的表格，以及每个会话的内联原始事件查看器（`usage.sessionLog`）。其 Host 半边刻意为空：仪表盘只是对已有 Host 控制器的浏览器端展示。

## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

侧边栏底部有一个数据图表操作按钮，标签为 `用量仪表盘`（折叠为窄栏时仅显示图标）。点击后默认选择当前工作区（当前会话所属的工作区，或第一个已注册工作区），并默认拉取**当前本地日**的报告；面板上的时间范围 chips 可扩展到近 7/30 天、全部时间或显式日历区间，工作区下拉框可切换工作区。报告反映所选窗口下该工作区在拉取时刻已持久化的会话日志；拉取失败时显示重试按钮。

### 阅读报告

- **汇总卡片**：API 调用（模型响应）、工具调用、轮次、会话数、输入/输出/缓存 tokens，以及预估费用。
- **趋势图**：按预估美元费用缩放的柱状图，下方明细表列出每个桶的调用数、tokens 与费用。粒度随窗口自适应——窗口在单个本地日内时按本地小时（默认的今日视图），跨两个或更多日期时按本地日期。
- **按模型**：每个 provider/model 路由的调用数、输入/输出 tokens 与费用；无已知价格的模型显示 `无价格`，并在汇总警告中列出。
- **会话**：每个折叠过的会话一行，显示调用数、tokens、费用与时长；点击 `查看日志` 拉取并渲染该会话最新的原始事件（`时间 · seq · 类型 · 摘要`），日志超过 500 条时截断为最新的 500 条。
- 底部注释说明费用是根据官方 DeepSeek API 价格与日志中记录的用量估算的。

### 计费模型

token 计数互不重叠：`inputTokens` 是未命中缓存的输入，按缓存未命中价计费；缓存读取 tokens 在其之上按缓存命中价计费；输出 tokens 按输出价计费；缓存写入 tokens 不计费。高峰时段（UTC 周一至周五 01:00–04:00 与 06:00–10:00）应用高峰价格。价格表中没有的模型只计入 tokens 不计费用，并标记为无价格。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

面板状态是一个不持久化的 Slot store：开关、所选工作区、缓存的报告与加载生命周期。注册的 inject 工厂闭包持有生成的 `workspace` Remote 命名空间；`loadReport` 通过 store actions 提交自己的生命周期，`loadSessionLog` 失败时返回 null，让查看器渲染受限的错误提示。每小时序列由 Host 端用浏览器的 IANA 时区（`Intl.DateTimeFormat` 偏移计算）分桶，因此载荷保持聚合，不需要把原始事件发给浏览器绘图。

### 文案与本地化

所有产品文案均为双语：插件在 `dsh-client-locale` 的 `usage` 命名空间下注册 zh/en 字典，条目使用框架绑定的 `t` seat。会话事件载荷通过 `eventSummary`/`compactJson` 原样渲染；它们是用户数据，不做本地化。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

以下页面覆盖侧边栏外壳、workspace Remote 与 Host 报告计算。

- [ui-sidebar](../ui-sidebar/README.zh.md) — 拥有 `sidebar.footer.action` 槽位的侧边栏外壳。
- [usage-report](../../usage/usage-report/README.zh.md) — 本插件装载的 Host 端 `usage` Remote 命名空间（`report` 与 `sessionLog`）。
- [workspace](../../workspace/workspace/README.zh.md) — 工作区注册表及其会话归属。
- [session-persistence](../../session/session-persistence/README.zh.md) — Host 报告读取所经的会话日志持久化 seam。

-----

<a id="model-experience"></a>
## 模型体验

无，因为仪表盘只读取已持久化的会话日志，从不发起模型请求。

#### KV 缓存影响

无。仪表盘是 Host 计算报告的只读消费者。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>


以下限制界定了报告的范围，是当前包的约束。

- **价格是快照而非实时** — DeepSeek 价格表编译在 Host 控制器中，于 2026-08-30 对照 api-docs.deepseek.com 校验。价格变动与后续新增模型需要更新代码；未知模型按无价格报告，不做猜测。
- **报告是即时快照** — 面板在打开与切换工作区时拉取；长时间运行的会话的最新事件需要重新打开或重试后才会出现，面板不轮询。
- **原始事件查看器只显示最新的 500 条** — 更长的会话日志在 Host 端截断以限制载荷；查看器中会标注截断。
- **用量归属基于请求头** — 模型响应归属于其之前最近的 `request/header`；任何请求头之前的响应归属为 `unknown`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
