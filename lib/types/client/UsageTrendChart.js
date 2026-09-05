import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatDayLabel, formatHourLabel, formatTokens, formatUsd, formatPeriod } from "./format.js";
import css from './UsageTrendChart.module.css';
/** Chart baseline height in px (bars grow upward from it). */
const CHART_HEIGHT_PX = 120;
/**
 * Render the trend chart and its detail table at the series granularity.
 * @param props - the projected series and locale.
 * @returns the chart section, or null when the series is empty.
 */
export function UsageTrendChart({ series, appliedRange, t }) {
    if (series.rows.length === 0)
        return null;
    const hourly = series.granularity === 'hourly';
    const title = hourly ? t('chart.cost.title') : t('chart.cost.title.daily');
    const label = (key) => (hourly ? formatHourLabel(key) : formatDayLabel(key));
    const maxCost = Math.max(...series.rows.map(row => row.costUsd), 0);
    return (_jsxs("section", { "aria-label": title, children: [_jsx("h2", { className: css.heading, children: title }), appliedRange !== undefined && (appliedRange.start !== undefined || appliedRange.end !== undefined) && (_jsx("p", { className: css.period, children: t('chart.period', { period: formatPeriod(appliedRange) }) })), _jsx("div", { className: css.chartScroll, children: _jsx("div", { className: css.chart, style: { height: CHART_HEIGHT_PX }, children: series.rows.map((row) => {
                        const height = maxCost <= 0
                            ? 0
                            : Math.max(2, Math.round((row.costUsd / maxCost) * (CHART_HEIGHT_PX - 14)));
                        return (_jsxs("div", { className: css.barCell, title: t('chart.tooltip', {
                                hour: label(row.key),
                                calls: t('chart.axis.calls', { count: row.apiCalls }),
                                tokens: formatTokens(row.totalTokens),
                                cost: formatUsd(row.costUsd),
                            }), children: [_jsx("div", { className: css.barTrack, children: height > 0 && _jsx("div", { className: css.bar, style: { height } }) }), _jsx("span", { className: css.barLabel, children: label(row.key) })] }, row.key));
                    }) }) }), _jsxs("table", { className: css.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: hourly ? t('chart.hour') : t('chart.day') }), _jsx("th", { scope: "col", children: t('chart.calls') }), _jsx("th", { scope: "col", children: t('summary.inputTokens') }), _jsx("th", { scope: "col", children: t('summary.outputTokens') }), _jsx("th", { scope: "col", children: t('summary.cacheTokens') }), _jsx("th", { scope: "col", children: t('summary.cost') })] }) }), _jsx("tbody", { children: series.rows.map(row => (_jsxs("tr", { children: [_jsx("td", { children: label(row.key) }), _jsx("td", { children: row.apiCalls }), _jsx("td", { children: formatTokens(row.inputTokens) }), _jsx("td", { children: formatTokens(row.outputTokens) }), _jsx("td", { children: formatTokens(row.cacheTokens) }), _jsx("td", { children: formatUsd(row.costUsd) })] }, row.key))) })] })] }));
}
//# sourceMappingURL=UsageTrendChart.js.map