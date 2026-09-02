// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, MessageKey } from '../../src/i18n/t';
import { makeEstimationView, selectItem } from '../helpers/estimation';
import { configured, configuredValues } from '../helpers/estimationModel';
import { FakeVault } from '../helpers/vault';
import { MARK, drawnText, marked, markedCatalog, unmarked, useMarkedLocale } from './fixtures';

/**
 * The Estimation view, driven under a catalog that is not English — `src/view/estimation/`,
 * swept 2026-08-20 by its UX polish pass.
 *
 * The construction its four sibling files use, for their reason: against the shipped
 * registry `t('estimation.column.item')` and a literal `'Item'` render the same string, so
 * every other assertion in the estimation suite reads identically whether the call site was
 * swept or missed. Overriding the keys is what makes the difference visible.
 *
 * **It asks the CATEGORY, `toolbar.test.ts`'s question rather than `emptyStates.test.ts`'s.**
 * Naming the labels somebody remembered checks exactly the labels that already work: the
 * next column, chip or panel row added is the one nobody named. Every surface below is
 * therefore DRAINED — every visible word, every `aria-label`, every tooltip — and what is
 * asserted is that the unmarked remainder is exactly the DATA this view shows. A new English
 * literal joins that remainder and fails; a data value wrongly keyed leaves it and fails too.
 *
 * It is the runtime half of a pair. `UI_TEXT_LITERAL` and `UI_TEXT_PROPERTY` in
 * `eslint.config.mjs` refuse a NEW literal at the spellings they can see — the ESTIMATION
 * glob added them here on 2026-08-21, onto a directory that was already clean. Neither
 * covers what the other does: lint cannot tell whether a key is READ, and no test can see a
 * call site nobody has written yet. What lint does not reach here is the shape this view is
 * largely built from — a prose literal handed to `iconButton`, `guidanceShell`, `scaleSpec`
 * or `sortHeader` as a positional ARGUMENT. That shape is this file's alone to hold.
 */

/**
 * Every key this view owns, computed against `en.ts` rather than kept by hand — one
 * namespace is what makes it exact: a key added to `estimation.*` is in this list without
 * anyone editing it.
 */
const OWN = Object.keys(en).filter((key): key is MessageKey => key.startsWith('estimation.'));

/**
 * The one key this toolbar reads without owning: the undo button shares `toolbar.undo`
 * with the backlog view rather than naming its own scope, because there is one undo slot
 * for the whole vault (ADR 0030) and a per-view key would promise a scope the slot does
 * not have. On that view's own side the key is not reused at all — it falls inside
 * `toolbar.test.ts`'s namespace-derived `OWN`, whose `REUSED` list holds `count.items`
 * alone — so this list is where the shared key is declared once and nowhere else.
 */
const REUSED = ['toolbar.undo'] as const;

const SWEPT: MessageKey[] = [...OWN, ...REUSED];

const xx: Catalog = markedCatalog(SWEPT);

useMarkedLocale(xx);

const partOf = (containerEl: HTMLElement, selector: string): HTMLElement => {
	const el = containerEl.querySelector<HTMLElement>(selector);
	if (!el) throw new Error(`nothing rendered at ${selector}`);
	return el;
};

/** The full-profile note `table.test.ts` pins, plus a partial one and an unscored one. */
function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', {
		frontmatter: {
			'strategic-alignment': 5,
			'customer-value': 4,
			'business-impact': 4,
			reach: 3,
			'risk-reduction': 2,
			compliance: 1,
			'time-criticality': 4,
			enablement: 3,
		},
	});
	vault.addFile('Partial.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
	vault.addFile('Empty.md');
	return vault;
}

describe('the estimation view reads its own text from the catalog', () => {
	it('draws the toolbar from it — label, tooltip and the scored count', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const drawn = drawnText(partOf(containerEl, '.pbl-toolbar'));

		expect(drawn).toContain(marked('estimation.toolbar.init'));
		expect(drawn).toContain(marked('toolbar.undo'));
		// The two numbers are DATA and arrive as parameters, so they survive the override
		// inside a marked sentence.
		expect(drawn).toContain(MARK + en['estimation.toolbar.scored'].replace('{scored}', '2').replace('{total}', '3'));
		expect(unmarked(drawn)).toEqual([]);
	});

	it('draws every column header from it, and nothing else in the head row', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const drawn = drawnText(partOf(containerEl, '.pbl-est-head'));

		for (const key of OWN.filter((k) => k.startsWith('estimation.column.'))) {
			expect(drawn).toContain(marked(key));
		}
		expect(unmarked(drawn)).toEqual([]);
	});

	it('names a SORTED header from it, direction and all', () => {
		// The one string in this view that lint cannot see even in a swept directory: an
		// `aria-label` built by `sortHeader` from a positional argument. Unsorted, the head row
		// carries no such name at all, so the existing test above cannot reach it.
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const head = partOf(containerEl, '.pbl-est-head');
		partOf(head, '.pbl-est-sort[data-col="total"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(unmarked(drawnText(partOf(containerEl, '.pbl-est-head')))).toEqual([]);
	});

	it('leaves a body row carrying nothing but its own data', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		const row = partOf(containerEl, '.pbl-est-row[data-path="Full.md"]');

		// The title, the total, the coverage fraction — every word on this row is a value the
		// note carries, so nothing here is marked and nothing is prose.
		expect(unmarked(drawnText(row))).toEqual(['Full', '3.55', '8/8']);
	});

	it('names the currency chip from it', () => {
		// A stored total under no stamp at all is `handwritten`; the `none` rows the plain
		// fixture draws show no chip, so one has to be earned before there is a word to read.
		const vault = fixture();
		vault.addFile('Stored.md', { frontmatter: { 'strategic-alignment': 5, 'business-value': 3 } });
		const { containerEl } = makeEstimationView(vault, configuredValues());
		const chip = partOf(containerEl, '.pbl-est-row[data-path="Stored.md"] .pbl-est-chip-text');

		// Whichever of the six words this row earns, it came from the catalog: the chip is
		// built from a TEMPLATE key, the one spelling no lint selector could ever check.
		expect(chip.textContent?.startsWith(MARK)).toBe(true);
	});

	it('draws the panel from it — every heading, note and control label', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues());
		selectItem(containerEl, 'Full.md');
		const drawn = drawnText(partOf(containerEl, '.pbl-est-panel'));

		expect(drawn).toContain(marked('estimation.panel.confidence'));
		expect(drawn).toContain(marked('estimation.panel.effort'));
		expect(drawn).toContain(marked('estimation.panel.complexity'));
		expect(drawn).toContain(marked('estimation.panel.valueDimensions'));
		expect(drawn).toContain(marked('estimation.panel.whyThisScored'));

		// The remainder is the MODEL's own vocabulary and the note's numbers — every one a
		// VALUE rather than a sentence this plugin spells. Enumerated exactly rather than
		// matched by a shape: a pattern loose enough to accept a rubric sentence would
		// accept an English label too, which is the direction this epic has had to correct
		// twice. A point button's `aria-label` is `${value} — ${rubric}`, two data halves
		// joined, so the join is spelled here the one way `panel.ts` spells it.
		const model = configured();
		const scales = [model.confidence, model.effort, model.complexity];
		const rubrics = [...model.dimensions, ...scales].flatMap((spec) =>
			spec.rubric.map((sentence, index) => `${spec.min + index} — ${sentence}`),
		);
		const data = new Set<string>([
			'Full', // the note's own title, in the panel header
			'3.55', // its total, and the two derived numbers below it
			'8/8',
			...model.dimensions.map((dim) => dim.label),
			...rubrics,
			// The `.pbl-est-rubric` note under a row shows the held point's sentence BARE,
			// without the number the button's label carries.
			...[...model.dimensions, ...scales].flatMap((spec) => spec.rubric),
			...[...model.dimensions, ...scales].flatMap((spec) =>
				spec.rubric.map((_, index) => String(spec.min + index)),
			),
		]);
		expect(unmarked(drawn).filter((text) => !data.has(text))).toEqual([]);
	});

	it('draws the unconfigured empty state from it, whole', () => {
		const { containerEl } = makeEstimationView(fixture(), {});
		const drawn = drawnText(containerEl);

		expect(drawn).toContain(marked('estimation.empty.unconfigured'));
		expect(drawn).toContain(marked('estimation.empty.hint'));
		expect(drawn).toContain(marked('estimation.empty.useDefaults'));
		expect(unmarked(drawn)).toEqual([]);
	});

	it('draws the no-results table from it', () => {
		const { containerEl } = makeEstimationView(new FakeVault(), configuredValues());
		expect(drawnText(containerEl)).toContain(marked('estimation.empty.noResults'));
	});

	/**
	 * The problem block draws the SENTENCES `domain/scoringModel.ts` returns, and that file
	 * is outside every glob the two lint bans carry — so this pair is the whole check on
	 * them. It is also the shape lint could not have read anyway: each problem is a
	 * positional argument to `problems.push`, and the weight total was a two-literal
	 * ternary.
	 *
	 * Split in two because `modelProblems` short-circuits: the weight total is asked only
	 * once every per-dimension problem is clean, so no single configuration draws both.
	 */
	it('draws each problem from it, and leaves only the dimension label unmarked', () => {
		const { containerEl } = makeEstimationView(
			fixture(),
			configuredValues({ stampProperty: '', 'dimProperty.reach': '', 'dimRange.compliance': '5-1' }),
		);
		const drawn = drawnText(partOf(containerEl, '.pbl-est-problems'));

		expect(drawn).toContain(marked('estimation.problems.lead'));
		expect(drawn).toContain(marked('estimation.problem.stampUnnamed'));
		expect(drawn).toContain(MARK + en['estimation.problem.unbound'].replace('{label}', 'Reach'));
		expect(drawn).toContain(MARK + en['estimation.problem.range'].replace('{label}', 'Compliance'));
		expect(unmarked(drawn)).toEqual([]);
	});

	it('names the weight total from it, direction and all', () => {
		const { containerEl } = makeEstimationView(fixture(), configuredValues({ 'dimWeight.reach': '3' }));
		const drawn = drawnText(partOf(containerEl, '.pbl-est-problems'));

		// The two figures are DATA and arrive as parameters, so they survive the override
		// inside a marked sentence — `estimation.toolbar.scored`'s own shape.
		expect(drawn).toContain(MARK + en['estimation.problem.weightsShort'].replace('{total}', '93').replace('{off}', '7'));
		expect(unmarked(drawn)).toEqual([]);
	});
});
