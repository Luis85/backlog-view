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

describe('a release row is a box of its own', () => {
	it('keeps `display: contents` off the row and the heading', () => {
		// The measured defect: a `display: contents` element has NO BOX, so Tab skips it,
		// `.focus()` on it does nothing and `:focus-visible` on it can never match. It is
		// asserted as an ABSENCE across the whole partial rather than at the two selectors
		// that carried it, because the next row-shaped thing added here is exactly what a
		// two-selector check would not name.
		expect(declarations).not.toContain('display: contents');
		// And the indicator that could never match is gone with it, rather than left beside
		// its replacement for the next reader to reconcile.
		expect(declarations).not.toContain('.pbl-rel-row:focus-visible > div');
	});

	it('undoes Obsidian’s own button appearance, since a row is a row', () => {
		// A bare `<button>` in a vault arrives with a fill, a shadow, a radius and padding.
		// `test/harness/theme.css` has no baseline for one at all, which is how a control
		// styled like this shipped looking right in the harness and wrong in a vault
		// (2026-08-08), so the reset is pinned here rather than trusted to a look.
		for (const decl of ['background-color: transparent;', 'box-shadow: none;', 'border-radius: 0;', 'padding: 0;']) {
			expect(ruleAt('.pbl-rel-row', decl), decl).toBeGreaterThan(-1);
		}
		// `button:hover` in app.css re-adds the shadow at (0,1,1); our hover is (0,2,0) and
		// must therefore say so itself rather than rely on the base rule above.
		expect(ruleAt('.pbl-rel-row:hover', 'box-shadow: none;')).toBeGreaterThan(-1);
	});

	it('draws a focus indicator on the row itself, now that there is a box to draw it on', () => {
		expect(ruleAt('.pbl-rel-row:focus-visible', 'outline: 2px solid var(--interactive-accent);')).toBeGreaterThan(-1);
	});
});

describe('the columns line up without one shared grid', () => {
	it('lays every cell out from its column’s published width', () => {
		// The container publishes `--pbl-rel-w-<n>` and each cell holds a REFERENCE to its
		// own; this is the stylesheet's half — that a cell is sized by the reference at all.
		// The publishing and the references are `releaseIndex.test.ts`'s half, for the
		// heading and for every row, and neither half alone is the guarantee.
		expect(ruleAt('.pbl-rel-row > span', 'flex: 0 0 var(--pbl-rel-w, 96px);')).toBeGreaterThan(-1);
		// The name column takes the slack instead, or five fixed widths leave a gap at the end.
		expect(ruleAt('.pbl-rel-row > .pbl-rel-name', 'flex: 1 1 auto;')).toBeGreaterThan(-1);
		// A fixed column has to clip rather than push its row's figures out of line with the
		// row above — which is what makes the alignment above hold for a long title at all.
		expect(ruleAt('.pbl-rel-row span', 'text-overflow: ellipsis;')).toBeGreaterThan(-1);
	});
});

describe('a release’s own screen does not inherit the tree’s gestures', () => {
	it('gives a scope row back its text selection, its cursor and its quiet hover', () => {
		// `.pbl-row` is reused for its LAYOUT and arrives carrying three gestures this screen
		// does not have: it offers no click, no selection and no fold. `user-select` is the
		// sharp one — copying a title is most of what a read-only screen is for.
		expect(ruleAt('.pbl-rel-view .pbl-row', 'user-select: auto;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-view .pbl-row', 'cursor: auto;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-rel-view .pbl-row:hover', 'background-color: transparent;')).toBeGreaterThan(-1);
	});

	it('refuses the hover at `:hover`, so the import order still decides nothing', () => {
		// `tree.css` declares `.pbl-row:hover` at (0,2,0). Refusing it at `.pbl-rel-view
		// .pbl-row` — also (0,2,0) — would be decided by which partial `index.css` imports
		// last, and this partial's own header states that its position is NOT load-bearing.
		// (0,3,0) makes that sentence true whatever the order.
		// `ruleAt`'s boundary is `[,{]` right after the selector, so this asks the BARE rule
		// and never the `:hover` one beside it.
		expect(ruleAt('.pbl-rel-view .pbl-row', 'background-color')).toBe(-1);
	});
});
