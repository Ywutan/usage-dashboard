import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Report window selector of the usage dashboard: preset chips (today, last
 * 7/30 days, all time) plus an explicit calendar interval. Changing the
 * selection drops the cached report so the panel refetches the window.
 */
import clsx from 'clsx';
import { toLocalIso } from "./range.js";
import css from './UsageRangeSelector.module.css';
const PRESETS = ['today', '7d', '30d', 'all'];
/** Default calendar interval when switching into custom mode (last 7 days). */
const CUSTOM_DEFAULT_DAYS = 7;
/**
 * Render the window selector.
 * @param props - current selection, change callback, and locale.
 * @returns the preset chips and the optional calendar interval inputs.
 */
export function UsageRangeSelector({ range, onChange, t }) {
    const applyPreset = (preset) => {
        onChange({ kind: 'preset', preset });
    };
    const openCustom = () => {
        const now = Date.now();
        const startDate = toLocalIso(now - (CUSTOM_DEFAULT_DAYS - 1) * 86_400_000);
        const endDate = toLocalIso(now);
        onChange({ kind: 'custom', startDate, endDate });
    };
    return (_jsxs("div", { className: css.bar, role: "group", "aria-label": t('range.title'), children: [PRESETS.map(preset => (_jsx("button", { type: "button", className: clsx(css.chip, range.kind === 'preset' && range.preset === preset && css.active), "aria-pressed": range.kind === 'preset' && range.preset === preset, onClick: () => { applyPreset(preset); }, children: t(`range.${preset}`) }, preset))), _jsx("button", { type: "button", className: clsx(css.chip, range.kind === 'custom' && css.active), "aria-pressed": range.kind === 'custom', onClick: openCustom, children: t('range.custom') }), range.kind === 'custom' && (_jsxs("span", { className: css.customFields, children: [_jsxs("label", { className: css.fieldLabel, children: [_jsx("span", { children: t('range.from') }), _jsx("input", { className: css.dateInput, type: "date", value: range.startDate, "aria-label": t('range.from'), onChange: (event) => {
                                    onChange({ kind: 'custom', startDate: event.target.value, endDate: range.endDate });
                                } })] }), _jsxs("label", { className: css.fieldLabel, children: [_jsx("span", { children: t('range.to') }), _jsx("input", { className: css.dateInput, type: "date", value: range.endDate, "aria-label": t('range.to'), onChange: (event) => {
                                    onChange({ kind: 'custom', startDate: range.startDate, endDate: event.target.value });
                                } })] })] }))] }));
}
//# sourceMappingURL=UsageRangeSelector.js.map