import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatTokens, formatUsd } from "./format.js";
import css from './UsageSummary.module.css';
/**
 * Render the totals card row.
 * @param props - report totals, unknown model ids, and locale.
 * @returns the summary cards grid.
 */
export function UsageSummary({ totals, unknownModels, t }) {
    const cards = [
        { key: 'calls', label: t('summary.apiCalls'), value: String(totals.apiCalls) },
        { key: 'tools', label: t('summary.toolCalls'), value: String(totals.toolCalls) },
        { key: 'turns', label: t('summary.turns'), value: String(totals.turns) },
        { key: 'sessions', label: t('summary.sessions'), value: String(totals.sessions) },
        { key: 'input', label: t('summary.inputTokens'), value: formatTokens(totals.inputTokens) },
        { key: 'output', label: t('summary.outputTokens'), value: formatTokens(totals.outputTokens) },
        { key: 'cache', label: t('summary.cacheTokens'), value: formatTokens(totals.cacheReadTokens + totals.cacheWriteTokens) },
        { key: 'cost', label: t('summary.cost'), value: formatUsd(totals.costUsd) },
    ];
    return (_jsxs("section", { "aria-label": t('panel.title'), children: [_jsx("div", { className: css.grid, children: cards.map(card => (_jsxs("div", { className: css.card, children: [_jsx("span", { className: css.label, children: card.label }), _jsx("span", { className: css.value, children: card.value })] }, card.key))) }), unknownModels.length > 0 && totals.unpricedCalls > 0 && (_jsxs("p", { className: css.unpriced, children: [t('summary.unpriced', { count: totals.unpricedCalls }), ": ", unknownModels.join(', ')] }))] }));
}
//# sourceMappingURL=UsageSummary.js.map