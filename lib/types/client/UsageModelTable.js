import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Per-model usage table of the dashboard: calls, input/output tokens, and
 * estimated cost per provider/model route. Unpriced models render a muted
 * "no price" marker instead of a cost figure.
 */
import clsx from 'clsx';
import { formatTokens, formatUsd } from "./format.js";
import css from './UsageModelTable.module.css';
/**
 * Render the per-model usage table.
 * @param props - model aggregates and locale.
 * @returns the table section, or null when no model rows exist.
 */
export function UsageModelTable({ byModel, t }) {
    if (byModel.length === 0)
        return null;
    return (_jsxs("section", { "aria-label": t('model.title'), children: [_jsx("h2", { className: css.heading, children: t('model.title') }), _jsxs("table", { className: css.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: t('model.route') }), _jsx("th", { scope: "col", children: t('model.calls') }), _jsx("th", { scope: "col", children: t('model.input') }), _jsx("th", { scope: "col", children: t('model.output') }), _jsx("th", { scope: "col", children: t('model.cost') })] }) }), _jsx("tbody", { children: byModel.map(row => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("span", { className: css.model, children: row.model }), _jsx("span", { className: css.provider, children: row.provider })] }), _jsx("td", { children: row.apiCalls }), _jsx("td", { children: formatTokens(row.inputTokens) }), _jsx("td", { children: formatTokens(row.outputTokens) }), _jsx("td", { className: clsx(row.unpriced && css.unpriced), children: row.unpriced ? t('model.unpriced') : formatUsd(row.costUsd) })] }, `${row.provider}/${row.model}`))) })] })] }));
}
//# sourceMappingURL=UsageModelTable.js.map