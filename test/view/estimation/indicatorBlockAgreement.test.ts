// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeEstimationView, selectItem } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

/**
 * The column's tooltip and the panel's own blocked line are two DIFFERENT sentences
 * (`estimation.indicator.*` vs `estimation.panel.indicator*`), read through one shared
 * table (`INDICATOR_BLOCK_KEYS` in `panel.ts`). `Record<IndicatorBlock, …>` on both ends
 * proves the two can never go out of SYNC on which reasons exist, but says nothing about
 * whether they still agree TODAY on which operand and which failure a given reason names
 * — a table that maps a reason to two independently-worded strings can still have one of
 * those strings wrong. This drives one item through the real render pipeline per reason
 * and asserts the column and the panel — drawn from the SAME `computeIndicator` call, in
 * the SAME view — both name the same operand for the same failure.
 *
 * The two sentence families are written so the clause after their own lead-in
 * ("No figure: " / "…no figure — ") is IDENTICAL text; that shared clause is what each
 * case below asserts is present, verbatim, in both the column cell's `title` and the
 * panel's derived line. A wording edit to either catalog entry alone, or a swapped
 * reason in either renderer, fails this without either surface's own test noticing —
 * each of those only reads its own sentence.
 */

function cellTitle(containerEl: HTMLElement, path: string): string {
	return (containerEl.querySelector(`.pbl-est-row[data-path="${path}"] [data-col="indicator"]`) as HTMLElement).title;
}

function panelLine(containerEl: HTMLElement): string {
	return [...containerEl.querySelectorAll('.pbl-est-derived span')].map((el) => el.textContent).join(' ');
}

interface Case {
	name: string;
	frontmatter: Record<string, unknown>;
	values: Record<string, unknown>;
	/** The clause both catalog families spell identically for this reason. */
	sharedClause: string;
}

const CASES: Case[] = [
	{
		name: 'unanswered',
		frontmatter: { 'strategic-alignment': 5 }, // no confidence value on the note
		values: configuredValues({ confidenceProperty: 'note.confidence', indicatorOperands: 'confidence', indicatorDivisor: '' }),
		sharedClause: 'Confidence is not answered',
	},
	{
		name: 'unknown',
		frontmatter: { 'strategic-alignment': 5 },
		values: configuredValues({ indicatorOperands: 'nosuchthing', indicatorDivisor: '' }),
		sharedClause: 'nothing in this model is called nosuchthing',
	},
	{
		name: 'nonpositive',
		frontmatter: { 'strategic-alignment': 5, effort: 0 },
		values: configuredValues({ effortProperty: 'note.effort', indicatorOperands: 'value', indicatorDivisor: 'effort' }),
		sharedClause: 'Effort has to be above zero to divide by',
	},
	{
		name: 'unbound',
		frontmatter: { 'strategic-alignment': 5 }, // effortProperty deliberately left unbound
		values: configuredValues({ indicatorOperands: 'effort', indicatorDivisor: '' }),
		sharedClause: 'Effort has no property bound to it yet',
	},
];

describe('the column and the panel agree about a blocked indicator', () => {
	for (const { name, frontmatter, values, sharedClause } of CASES) {
		it(`say the same thing for '${name}'`, () => {
			const vault = new FakeVault();
			vault.addFile('Item.md', { frontmatter });
			const { containerEl } = makeEstimationView(vault, values);
			selectItem(containerEl, 'Item.md');

			const title = cellTitle(containerEl, 'Item.md');
			const line = panelLine(containerEl);
			expect(title).toContain(sharedClause);
			expect(line).toContain(sharedClause);
		});
	}
});
