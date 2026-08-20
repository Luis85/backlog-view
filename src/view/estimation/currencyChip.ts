import { setIcon } from 'obsidian';
import { t } from '../../i18n/t';
import { Currency } from '../../domain/weightedScore';

/** `Currency` is a union of string literals, so the template key is exactly one of the
 *  six `estimation.currency.*` entries — checked by the same compiler that would refuse
 *  a switch case naming a key `en.ts` does not have. */
function currencyWord(currency: Currency): string {
	return t(`estimation.currency.${currency}`);
}

/**
 * The two currencies that need an action carry an icon beside their colour, so the state
 * survives a monochrome screenshot — DESIGN.md's Shape-Before-Colour Rule, and the same
 * colour-and-icon pair the WIP over-limit count already uses.
 *
 * `current` is deliberately absent: green means FINISHED in this system and nothing else,
 * a current total is trustworthy rather than done, and a fully estimated backlog carrying a
 * green chip on every row is exactly the screen DESIGN.md says must stay "monochrome apart
 * from its badges". The plain chip is the whole treatment.
 */
const CURRENCY_ICON: Partial<Record<Currency, string>> = {
	stale: 'refresh-cw',
	orphan: 'unlink',
};

/**
 * The chip inside the cell — never the cell itself, which is the column and must keep a
 * fixed width. `null` for `none`: there is no stored total to judge, so the cell is left
 * empty and `styles/estimation.css`'s `:empty::before` supplies the same dash every other
 * absent value in the row uses.
 */
export function renderCurrencyChip(host: HTMLElement, currency: Currency): HTMLElement | null {
	if (currency === 'none') return null;
	const chip = host.createSpan({ cls: `pbl-est-chip pbl-est-cur-${currency}` });
	const icon = CURRENCY_ICON[currency];
	if (icon) setIcon(chip.createSpan({ cls: 'pbl-est-chip-icon' }), icon);
	chip.createSpan({ cls: 'pbl-est-chip-text', text: currencyWord(currency) });
	return chip;
}
