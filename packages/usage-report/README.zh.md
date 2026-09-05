---
description: "自包含的按工作区用量报告 Host 能力：将持久化会话日志折叠为 API 调用、tokens 与基于可选窗口的预估美元费用分析。"
kind: "package-reference"
---

# @deepseek-ai/dsh-usage-report

English | [中文](README.md)

## 概述

`dsh-usage-report` 是用量仪表盘插件的 Host 半边，由 [`dsh-usage-dashboard` bundle](../../bundle/usage-dashboard/README.zh.md) 作为可选的配置文件层组合。它拥有生成的 `ctx.remote.usage` Remote 命名空间，含两个只读动词：`report`（把每个已归属 Session 的规范日志折叠为总计、本地小时序列、按模型与按会话的聚合，以及基于可选 `rangeStart`/`rangeEnd` 窗口的预估美元费用）与 `sessionLog`（单个 Session 的原始事件行，供内联查看器使用）。它是自包含的：基础 workspace 控制器未被修改，且只有 bundle 组合该插件时该能力才存在。

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

通过 usage-dashboard bundle 把它组合进基于 base 的 web profile（`dsh plugin --profile web add @deepseek-ai/dsh-usage-dashboard`），或直接把它作为 bundle 层添加。它读取工作区注册表、会话持久化与内存会话存储；从不恢复 Agent 或触及模型请求。

### 报告窗口

`report` 接受 `rangeStart`/`rangeEnd`（含起点的闭区间/开区间结束，单位毫秒）。活动 Session 从内存规范日志折叠，因此循环仍在追加的会话不会阻塞报告；已存储日志通过不取写所有权的只读句柄并发读取（有界）。窗口内没有活动的 Session 会从按会话视图与会话计数中剔除。

### 计价

tokens 按 DeepSeek 官方 API 价格表（UTC 高峰/低谷费率）计价，校验于 2026-08-30。缓存命中输入 token 按命中价计费，其余输入按未命中价，输出按输出价；缓存写入 token 不计费。价格表之外的模型按无价格报告。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

控制器是基于 `usage` 命名空间的 `TypertRemoteService`。纯折叠函数（`usage.ts`）接收每个 Session 的规范事件——经由 `SessionPersistence` 句柄读取，或取自内存中的活动日志——把每个模型响应归属到其之前最近的 `request/header`，计价，并归入调用方的 IANA 时区；窗口检查丢弃范围外的事件。客户端自行装载生成的 `usage` remote 贡献，因此只有加载该插件时命名空间才出现。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [usage-dashboard](../../bundle/usage-dashboard/README.zh.md) — 组合该 Host 能力与浏览器仪表盘的可安装 bundle。
- [ui-usage](../../client/ui-usage/README.zh.md) — 装载并消费该 Remote 命名空间的浏览器插件。
- [workspace-controller](../../api/workspace-controller/README.zh.md) — 该报告折叠的工作区注册表与归属。

-----

<a id="model-experience"></a>
## 模型体验

无，因为报告只读取持久化会话日志，从不发起模型请求。

#### KV 缓存影响

无。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- **价格是快照而非实时** — DeepSeek 价格表编译在 `usage.ts` 中，于 2026-08-30 对照 api-docs.deepseek.com 校验；后续价格变动需要更新代码，未知模型按无价格报告。
- **`sessionLog` 查看器上限为 500 条** — 更长的日志在 Host 端截断以限制载荷，UI 中会标注。
- **基于请求头的归属** — 模型响应按其之前最近的 `request/header` 计费；任何请求头之前的响应归属为 `unknown`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
