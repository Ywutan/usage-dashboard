import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
import type { UsageRangeSelection } from './range.ts';
/** Range selector props. */
export interface UsageRangeSelectorProps {
    range: UsageRangeSelection;
    onChange: (selection: UsageRangeSelection) => void;
    t: TranslateNS<typeof NS>;
}
/**
 * Render the window selector.
 * @param props - current selection, change callback, and locale.
 * @returns the preset chips and the optional calendar interval inputs.
 */
export declare function UsageRangeSelector({ range, onChange, t }: UsageRangeSelectorProps): import("react").JSX.Element;
//# sourceMappingURL=UsageRangeSelector.d.ts.map