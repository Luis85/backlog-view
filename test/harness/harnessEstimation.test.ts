// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountEstimationHarness, EstimationConfigVariant } from './mountEstimation';
import { applyWantedEstimationSelection, drawEstimationMeasurements } from './knobs';
import { installObsidianDom } from '../helpers/dom';

installObsidianDom();

/**
 * The ESTIMATION entry's own guarantees, split from `harness.test.ts` when that file
 * reached the suite's line cap. Its own file rather than its own half of one: this entry
 * mounts a different view over a different fixture through a different pair
 * (`mountEstimation.ts` / `estimation.ts`), and shared nothing with the backlog entry's
 * blocks but the `installObsidianDom()` call every jsdom file makes.
 *
 * The layout-fix block below travels with it because `ruleBody` is its instrument and two
 * of its three pins are on `styles/estimation.css`.
 */

/** The estimation table's own row/title accessor — the backlog entry's `rowFor` reads
 *  `.pbl-row`, the tree's class, which this view never draws. */
function estRowFor(containerEl: HTMLElement, title: string): HTMLElement {
	const row = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-est-row')).find(
		(r) => r.querySelector('.pbl-est-title')?.textContent === title,
	);
	if (!row) throw new Error(`estimation row not found: ${title}`);
	return row;
}

/**
 * The estimation entry's own guarantees, `describe('the browser harness mounts', ...)`'s
 * shape for the second view: it still mounts, the fixture still draws the cases it
 * exists for, and the URL knobs still make their state.
 */
describe('the estimation harness mounts', () => {
	function mount(variant?: EstimationConfigVariant) {
		const root = document.createElement('div');
		document.body.appendChild(root);
		return mountEstimationHarness(root, variant);
	}

	it('draws a table row for every fixture note, and the widened dimension bound to it', () => {
		const { view, containerEl } = mount();

		expect(containerEl.querySelectorAll('.pbl-est-row').length).toBe(11);
		expect(view.settings.model.dimensions.find((d) => d.id === 'enablement')?.max).toBe(12);
	});

	it('draws the currency vocabulary end to end — current, stale, foreign, handwritten, orphan, none', () => {
		const { containerEl } = mount();
		const currency = (title: string) => estRowFor(containerEl, title).querySelector('.pbl-est-chip')?.textContent ?? '';

		expect(currency('Full profile')).toBe('Current');
		expect(currency('Stale total')).toBe('Needs re-estimation');
		expect(currency('Foreign stamp')).toBe('Another model');
		expect(currency('Hand-written total')).toBe('Hand-written');
		expect(currency('Orphan total')).toBe('Inputs gone');
		expect(currency('Nothing answered')).toBe('');
	});

	it('draws the clamp note and the between-points note the panel exists to show', () => {
		const { containerEl } = mount();

		estRowFor(containerEl, 'Out-of-range answer').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-est-panel')?.textContent).toContain('Out of range');

		estRowFor(containerEl, 'Fractional score').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(containerEl.querySelector('.pbl-est-panel')?.textContent).toContain('Between points');
	});

	it('omits the value-to-effort line for a zero and a negative effort', () => {
		const { containerEl } = mount();

		for (const title of ['Zero effort', 'Negative effort']) {
			estRowFor(containerEl, title).dispatchEvent(new MouseEvent('click', { bubbles: true }));
			const derived = containerEl.querySelector('.pbl-est-derived')?.textContent ?? '';
			expect(derived).toContain('Confidence-adjusted value');
			expect(derived).not.toContain('Value to effort');
		}
	});

	it('selects a row through the ?select= knob, the same panel a click draws', () => {
		const { view, containerEl } = mount();

		applyWantedEstimationSelection(view, '?select=Full profile');

		expect(estRowFor(containerEl, 'Full profile').classList.contains('pbl-selected')).toBe(true);
		expect(containerEl.querySelector('.pbl-est-panel')).not.toBeNull();
	});

	it('draws the guided empty state for ?config=empty, with the shared shell’s own title class', () => {
		const { containerEl } = mount('empty');

		expect(containerEl.querySelector('.pbl-est-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty-title')?.textContent).toBe(
			'No estimation model is configured for this view.',
		);
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
	});

	it('draws the config-warning block for ?config=problems, naming the missing stamp', () => {
		const { containerEl } = mount('problems');

		const warning = containerEl.querySelector('.pbl-est-problems');
		expect(warning).not.toBeNull();
		expect(warning?.textContent).toMatch(/stamp/i);
		expect(containerEl.querySelector('.pbl-est-table')).toBeNull();
	});

	it('resolves every icon it asks for, across the unconfigured, configured and selected states', () => {
		const missing = new Set<string>();
		const collect = (containerEl: HTMLElement) => {
			for (const el of containerEl.querySelectorAll<HTMLElement>('[data-icon-missing]')) missing.add(el.dataset.iconMissing ?? '');
		};

		collect(mount('empty').containerEl); // the guided empty state's icon
		const { containerEl } = mount();
		estRowFor(containerEl, 'Full profile').dispatchEvent(new MouseEvent('click', { bubbles: true })); // the clear buttons' icon
		collect(containerEl);

		expect([...missing]).toEqual([]);
	});

	it('the ?measure knob reports a box per column, a type per probe and a number per numeric column', () => {
		// The instrument this repository has no other way to check. jsdom lays nothing out, so
		// every number below is 0 and asserting one would measure the runner — what is asserted
		// is that the knob REPORTS, per column and per probe, because a knob that quietly
		// stopped emitting is a page that looks fine and answers nothing (`test/CLAUDE.md`).
		const root = document.body.createDiv();
		const { view } = mountEstimationHarness(root, 'full');
		// The panel probes below need a selected row to exist at all — the same click
		// this file's other panel-reading tests dispatch (e.g. line 201).
		view.tableEl?.querySelector<HTMLElement>('.pbl-est-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		drawEstimationMeasurements(view);
		const pre = document.getElementById('pbl-measure');
		expect(pre).not.toBeNull();
		const lines = (pre!.textContent ?? '').split('\n');
		for (const cls of ['pbl-est-title', 'pbl-est-total', 'pbl-est-coverage', 'pbl-est-currency']) {
			expect(lines.filter((l) => l.startsWith(`BOX ${cls} `)).length, `${cls} boxes`).toBeGreaterThan(1);
		}
		// Confidence and effort share the bare `.pbl-est-cell` class (`renderTable.ts`'s own
		// `data-col` disambiguation) — asserted on BOTH disambiguated labels so a probe that
		// silently went back to reporting only one of the two columns fails here.
		for (const cls of ['pbl-est-cell[confidence]', 'pbl-est-cell[effort]']) {
			expect(lines.filter((l) => l.startsWith(`BOX ${cls} `)).length, `${cls} boxes`).toBeGreaterThan(1);
		}
		expect(lines.filter((l) => l.startsWith('BOX pbl-est-title head '))).toHaveLength(1);
		for (const probe of ['row title', 'panel total', 'panel title', 'decomp term']) {
			expect(lines.filter((l) => l.startsWith(`TYPE ${probe} `)), `${probe} type`).toHaveLength(1);
		}
		// Decision 6's probe. What is asserted is that the knob REPORTS one number line per
		// numeric column — never what the numbers are, which is a browser's answer and would be
		// the screenshot suite ADR 0020 refuses.
		for (const col of ['total', 'coverage', 'confidence', 'effort']) {
			expect(lines.filter((l) => l.startsWith(`NUM ${col} `)), `${col} number`).toHaveLength(1);
		}
	});
});

/**
 * One rule's own declarations, matched by an EXACT selector — anchored on the rule
 * boundary (`}` or the start of the file) rather than a bare substring search, because
 * `.pbl-est-title` is also the tail of `.pbl-est-header .pbl-est-title`'s selector, and
 * an unanchored search would read that rule's declarations instead of the one asked for.
 * Comments are stripped first (`test/helpers/cssVars.ts`'s own `eachBlock` does the same)
 * so a rule documented right above its selector cannot break the anchor.
 */
function ruleBody(css: string, selector: string): string {
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const escaped = selector.replace(/[.#]/g, '\\$&');
	const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(stripped);
	if (!match) throw new Error(`no rule for ${selector}`);
	return match[1];
}

/**
 * Three layout defects Chromium showed and jsdom cannot: it lays out nothing, so a grid
 * item stretching to fill a row it has no sibling in, a flex row's title column shrinking
 * to zero width, and a release band's name ellipsising away while its version keeps full
 * width are all states no DOM query here can see. What is checkable is pinned instead —
 * the declaration each fix added — narrower than the visual claim, and said so rather than
 * left implying more than a `toMatch` on a stylesheet can back up.
 */
describe('three layout fixes found in the browser, pinned as declarations jsdom can read', () => {
	const estimationCss = readFileSync('styles/estimation.css', 'utf8');
	// The warning block's rules live with the other "nothing to show" states rather than in
	// `estimation.css`, which is at its line cap — same concern, different partial.
	const emptyStatesCss = readFileSync('styles/emptyStates.css', 'utf8');

	it('does not stretch the config-warning block to the grid row’s full height', () => {
		expect(ruleBody(emptyStatesCss, '.pbl-est-problems')).toMatch(/align-self:\s*start/);
	});

	it('keeps a floor under the title column so it cannot shrink to nothing', () => {
		expect(ruleBody(estimationCss, '.pbl-est-title')).toMatch(/min-width:\s*96px/);
	});

	// The band's own instance of `src/view/CLAUDE.md`'s sticky-lead rule, found the same way
	// (2026-08-26): with the version at `flex: 0 0 auto` the NAME was line 1's only cell that
	// could give, so at the 500px pane minimum the `1.0` band showed ~2px of its name beside
	// its icon while a 151.72px version kept every pixel. The shrink factor is what makes the
	// version yield first; the before/after widths are in the partial, beside the rule.
	it('makes a release band’s version yield before its name does', () => {
		expect(ruleBody(readFileSync('styles/release.css', 'utf8'), '.pbl-rel-version')).toMatch(/flex:\s*0 100 auto/);
	});
});
