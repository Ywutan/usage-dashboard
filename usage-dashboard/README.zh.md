---
description: "可选配置文件包：在基于 base 的 web 配置文件中安装 Web 用量仪表盘（侧边栏「用量仪表盘」操作与全屏按工作区的报告）。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-usage-dashboard

English | [中文](README.md)

## 摘要

`dsh-usage-dashboard` 是一个可选配置文件包，把 Web 用量仪表盘安装进基于 base 的 web 配置文件（`dsh-web-app`）。它的 patch 组合完整的自包含插件：`usage-report` Host 行（`usage` Remote 命名空间，从持久化会话日志计算报告）加上 `ui-usage` 浏览器行（侧边栏底部的 `用量仪表盘` 操作，以及显示所选窗口 API 调用、tokens 与预估美元费用的全屏面板）。基础 workspace 控制器未被修改——未安装此包的 profile 既没有报告能力也没有仪表盘 UI。

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

用配置文件插件命令把该包安装进某个 profile；命令会在 profile 目录中运行 `pnpm add` 并调和 profile 的 bundle 层列表：

```sh
dsh plugin --profile web add @deepseek-ai/dsh-usage-dashboard
```

本地源码目录请传入绝对路径而不是注册表包名（插件命令原样透传绝对路径）：

```sh
dsh plugin --profile web add /path/to/deepseek-harness/packages/bundle/usage-dashboard
```

重启该 profile（`dsh --profile web`），侧边栏底部就会出现 `用量仪表盘` 操作。卸载方式相同：

```sh
dsh plugin --profile web remove @deepseek-ai/dsh-usage-dashboard
```

### 安装会改变什么

该包只插入一行：`ui-usage`（`@deepseek-ai/dsh-client-ui-usage`）。其余一切——`usageReport`/`sessionLog` Remote 方法、DeepSeek 价格表、报告折叠——都来自 base 与 web-app 层已组合的 workspace 控制器。仪表盘读取持久化会话日志，是只读的。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

bundle 是指其清单声明了 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 的包。配置文件合成器按 `dsh.profile.bundles` 的顺序把 patch 叠加到 profile 的 bundle 层上，因此本包与随附的配置文件 bundle 一样，是一个空节点半边加标准 invariant companion 的静态 patch 列表载体。`ui-usage` 行通过 profile 的模块回退解析；启动器每次启动都会从安装依赖闭包加上所选 profile 的 bundle 治愈该回退。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-usage](../../client/ui-usage/README.zh.md) — 本包组合的浏览器插件。
- [workspace-controller](../../api/workspace-controller/README.zh.md) — 提供 `usageReport` 与 `sessionLog` 的 Host `workspace` Remote 命名空间。
- [Profile plugin bundles 笔记](../../../.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.zh.md) — profile、bundle 与模块回退如何组合。
- [web-app](../web-app/README.zh.md) — 本包扩展的默认 Web 界面层。

-----

<a id="model-experience"></a>
## 模型体验

无：该包组合的是一个只读浏览器仪表盘，从不发起模型请求。

#### KV 缓存影响

无。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- **安装需要从安装或 profile 解析该包** — `dsh plugin` 命令按名称从注册表安装；本地源码目录使用上面的绝对路径形式。
- **Host 用量能力保留在 base 层** — 即使没有本包，`usageReport`/`sessionLog` Remote 方法也会随 workspace 控制器组合进每个 web profile；只有仪表盘 UI 是可选的。把 Host 计算拆进本包推迟到用量报告出现第二个消费方之时。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
