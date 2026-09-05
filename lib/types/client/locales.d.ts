/** `usage` namespace dictionaries for the workspace usage dashboard. */
/** Dictionary namespace owned by this plugin. */
export declare const NS = "usage";
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    readonly 'trigger.label': "用量仪表盘";
    readonly 'trigger.aria': "打开工作区用量仪表盘";
    readonly 'panel.title': "用量仪表盘";
    readonly 'panel.workspace': "工作区";
    readonly 'panel.close': "关闭";
    readonly 'panel.loading': "正在加载用量…";
    readonly 'range.title': "时间范围";
    readonly 'range.today': "今天";
    readonly 'range.7d': "近 7 天";
    readonly 'range.30d': "近 30 天";
    readonly 'range.all': "全部";
    readonly 'range.custom': "自定义";
    readonly 'range.from': "从";
    readonly 'range.to': "至";
    readonly 'panel.error': "无法加载用量数据";
    readonly 'panel.retry': "重试";
    readonly 'panel.empty': "该工作区还没有记录的会话活动。";
    readonly 'summary.apiCalls': "API 调用";
    readonly 'summary.toolCalls': "工具调用";
    readonly 'summary.turns': "轮次";
    readonly 'summary.sessions': "会话";
    readonly 'summary.inputTokens': "输入 tokens";
    readonly 'summary.outputTokens': "输出 tokens";
    readonly 'summary.cacheTokens': "缓存 tokens";
    readonly 'summary.cost': "预估费用";
    readonly 'summary.unpriced': "{count} 次调用无已知价格";
    readonly 'chart.cost.title': "每小时费用（本地时间）";
    readonly 'chart.period': "窗口：{period}";
    readonly 'chart.cost.title.daily': "每日费用（本地时间）";
    readonly 'chart.tokens.title': "每小时 tokens";
    readonly 'chart.axis.calls': "{count} 次调用";
    readonly 'chart.calls': "调用";
    readonly 'chart.hour': "小时";
    readonly 'chart.day': "日期";
    readonly 'chart.hour.format': "{date} {hour}时";
    readonly 'chart.tooltip': "{hour} · {calls} · {tokens} tokens · {cost}";
    readonly 'model.title': "按模型";
    readonly 'model.route': "模型";
    readonly 'model.calls': "调用";
    readonly 'model.input': "输入";
    readonly 'model.output': "输出";
    readonly 'model.cost': "费用";
    readonly 'model.unpriced': "无价格";
    readonly 'session.title': "会话";
    readonly 'session.name': "会话";
    readonly 'session.calls': "调用";
    readonly 'session.cost': "费用";
    readonly 'session.created': "创建于";
    readonly 'session.duration': "时长";
    readonly 'session.explore': "查看日志";
    readonly 'session.collapse': "收起日志";
    readonly 'session.logEmpty': "没有记录到事件。";
    readonly 'session.logTruncated': "仅显示最新的 {count} 条事件";
    readonly 'event.turn': "轮次";
    readonly 'event.step': "步骤";
    readonly 'event.ended': "已结束";
    readonly 'event.usage.in': "输入";
    readonly 'event.usage.out': "输出";
    readonly 'event.provider': "provider";
    readonly 'event.model': "模型";
    readonly 'pricing.note': "费用按 DeepSeek 官方 API 价格（含高峰/低谷时段）估算，见会话日志中的模型与用量。";
};
/** English dictionary, key-identical to the Chinese source of truth. */
export declare const en: Record<UsageKey, string>;
/** Locale keys of the `usage` namespace. */
export type UsageKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map