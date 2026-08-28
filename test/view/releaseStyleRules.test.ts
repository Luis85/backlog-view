import { describe, expect, it } from 'vitest';
// @ts-expect-error — a build script, deliberately outside tsconfig's `src/**` include.
import { assembleStyles } from '../../scripts/styles-assemble.mjs';

/**
 * `styles/release.css` as SHIPPED. The shape is `estimation/styleRules.test.ts`'s, for its
 * reason: one surface's partial, asked the questions a browser is not here to answer, kept
 * out of `rendering.test.ts` so that suite does not grow past its budget.
 *
 * It exists because the partial was rewritten wholesale on 2026-08-23 — the shared grid
 * dropped, every row given its own box — and NOTHING in this repository could see any of
 * it. Deleting `.pbl-rel-view .pbl-row { user-select: auto }`, which is a whole changelog
 * bullet, passed `npm run check`.
 *
 * What it cannot do is prove a rule MATCHES anything, or that it wins where two could
 * disagree. The structure the rules need is asserted in `releaseIndex.test.ts` and
 * `releaseScopeRender.test.ts`; the appearance and the cascade were measured in headless
 * Chromium (see `.superpowers/sdd/…/task-11-keyboard-report.md`), which is a reading taken
 * once rather than a check that runs.
 */
const styles: string = assembleStyles();

/** The assembled sheet with comments removed — what the CASCADE sees, and required here
 *  rather than optional: this partial's comments quote `display: contents` and the old
 *  `:focus-visible > div` rule at length precisely to say they are GONE, so a substring
 *  search over the raw text cannot tell a live selector from one being explained. */
const declarations: string = styles.replace(/\/\*[\s\S]*?\*\//g, '');

/** Where the last rule naming `selector` and declaring `decl` starts, or -1 — the estimation
 *  file's reading of `rendering.test.ts`'s instrument, boundary and escaping included. */
function ruleAt(selector: string, decl: string): number {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const wanted = decl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`^[\\t]*${escaped}\\s*[,{][^}]*${wanted}`, 'gm');
	let found = -1;
	for (const match of declarations.matchAll(pattern)) found = match.index ?? found;
	return found;
}

describe('a release band is a box of its own', () => {
	it('keeps `display: contents` off the band', () => {
		// The measured defect: a `display: contents` element has NO BOX, so Tab skips it,
		// `.focus()` on it does nothing and `:focus-visible` on it can never match. It is
		// asserted as an ABSENCE across the whole partial rather than at one selector, because
		// the next band-shaped thing added here is exactly what a one-selector check would
		// not name.
		expect(declarations).not.toContain('display: contents');
		// And the indicator that could never match is gone with the row it belonged to,
		// rather than left beside its replacement for the next reader to reconcile.
		expect(declarations).not.toContain('.pbl-rel-row:focus-visible > div');
	});

	it('undoes Obsidian’s own button appearance, since a band is a band', () => {
		// A bare `<button>` in a vault arrives with a fill, a shadow, a radius and padding.
		// `test/harness/theme.css` has no baseline for one at all, which is how a control
		// styled like this shipped looking right in the harness and wrong in a vault
		// (2026-08-08), so the reset is pinned here rather than trusted to a look.
		for (const decl of ['background-color: transparent;', 'box-shadow: none;', 'border-radius: 0;']) {
			expect(ruleAt('.pbl-rel-band', decl), decl).toBeGreaterThan(-1);
		}
		// `button:hover` in app.css re-adds the shadow at (0,1,1); our hover is (0,2,0) and
		// must therefore say so itself rather than rely on the base rule above.
		expect(ruleAt('.pbl-rel-band:hover', 'box-shadow: none;')).toBeGreaterThan(-1);
	});

	it('draws a focus indicator on the band itself, now that there is a box to draw it on', () => {
		expect(ruleAt('.pbl-rel-band:focus-visible', 'outline: 2px solid var(--interactive-accent);')).toBeGreaterThan(-1);
	});
});

describe('the overdue signal is one condition driving four declarations', () => {
	it('reserves the leading rule on every band, so colouring it costs no reflow', () => {
		expect(ruleAt('.pbl-rel-band', 'border-inline-start: 3px solid transparent;')).toBeGreaterThan(-1);
	});

	it('colours the rule, the date, the bar and the note off the SAME class', () => {
		// Four declarations, and every one of them keyed off `.pbl-rel-overdue` rather than
		// four rules each re-deriving "is this release overdue" — the design's "one
		// condition, four signals", and the reason the four cannot drift apart.
		expect(ruleAt('.pbl-rel-overdue', 'border-inline-start-color: var(--text-error);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-overdue .pbl-rel-date', 'color: var(--text-error);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-overdue .pbl-rel-bar-fill', 'background-color: var(--text-error);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-overdue .pbl-rel-band-note', 'color: var(--text-error);')).toBeGreaterThan(-1);
	});
});

describe('the progress bar draws no fill without a published one', () => {
	it('reads the fill from the published custom property, never a bare width', () => {
		// `renderIndex.ts`'s `drawProgressLine` publishes `--pbl-rel-fill` per band; the
		// stylesheet reads the reference rather than repeating a percentage.
		expect(ruleAt('.pbl-rel-bar-fill', 'inline-size: var(--pbl-rel-fill, 0%);')).toBeGreaterThan(-1);
	});
});

describe('a release’s own screen is a target again, since Task 3', () => {
	it('opens its note on click — a real pointer, a real hover — and still lets a title be selected', () => {
		// `.pbl-row` is reused for its LAYOUT and arrived carrying three refusals this screen
		// no longer keeps: there is a click now (`scopeTree.ts`), so `cursor` and the hover
		// say so. `user-select: auto` has to be RESTATED here, not merely left off the rule —
		// `styles/tree.css` sets `.pbl-row { user-select: none }` for the tree's own drag, and
		// an unstated property does not "stay" at the browser default, it resolves from
		// whichever rule wins the cascade. Missing this once left a reader unable to select a
		// title on a screen with nothing to justify the tree's `none`.
		expect(ruleAt('.pbl-rel-view .pbl-row', 'user-select: auto;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-view .pbl-row', 'cursor: pointer;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-view .pbl-row:hover', 'background-color: var(--background-modifier-hover);')).toBeGreaterThan(
			-1,
		);
	});

	it('sets the hover at `:hover`, so the import order still decides nothing', () => {
		// `tree.css` declares `.pbl-row:hover` at (0,2,0). Setting it again at `.pbl-rel-view
		// .pbl-row` — also (0,2,0) — would be decided by which partial `index.css` imports
		// last, and this partial's own header states that its position is NOT load-bearing.
		// (0,3,0) makes that sentence true whatever the order.
		// `ruleAt`'s boundary is `[,{]` right after the selector, so this asks the BARE rule
		// and never the `:hover` one beside it.
		expect(ruleAt('.pbl-rel-view .pbl-row', 'background-color')).toBe(-1);
	});
});

/**
 * Line 1's width, which a browser decides and jsdom cannot. What is checkable here is that
 * the two declarations a MEASUREMENT found missing are still written — narrower than the
 * claim, in this file's own way: nothing here proves a name ellipsises, only that the
 * property saying it should is on the element the text is in.
 *
 * The measurement (headless Chromium, 500px, four name lengths, 2026-08-26): a 65-character
 * name drew in a 189.42px box with a `scrollWidth` of 446 and NO ellipsis, because the
 * `text-overflow` sat on the flex parent while the text sat in a child span; and
 * `.pbl-rel-version`, a figure the reader had bound, was 0px wide on every name past ~20
 * characters. An earlier round measured the one band whose name never overflows and read
 * both as fixed.
 */
describe('line 1 yields its width readably, and no figure yields all of it', () => {
	it('puts the ellipsis on the name TEXT, not on the flex box around it', () => {
		// A `text-overflow` on `.pbl-rel-name` is inert: what overflows there is a child BOX.
		for (const decl of ['min-inline-size: 0;', 'overflow: hidden;', 'text-overflow: ellipsis;']) {
			expect(ruleAt('.pbl-rel-name > span:not(.pbl-rel-icon)', decl), decl).toBeGreaterThan(-1);
		}
	});

	it('gives the version a floor, so a bound figure is never rendered invisible', () => {
		// The forbidden thing is a floor of ZERO, not a missing `5ch` — a check pinned to the
		// value would fail on a deliberate 4ch and pass on `min-inline-size: 0px`.
		const block = declarations.match(/^\.pbl-rel-version\s*\{[^}]*\}/m)?.[0] ?? '';
		const floor = block.match(/min-inline-size:\s*([^;]+);/)?.[1];
		expect(floor, 'the version cell declares no floor at all').toBeDefined();
		expect(floor, 'a floor of zero is what let it reach 0px').not.toMatch(/^0[a-z%]*$/);
	});
});
