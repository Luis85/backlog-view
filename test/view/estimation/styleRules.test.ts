// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a build script, deliberately outside tsconfig's `src/**` include.
import { assembleStyles } from '../../../scripts/styles-assemble.mjs';

/**
 * The estimation view's stylesheet as SHIPPED, asked the two questions a browser is not
 * here to answer: does a rule exist, and does it sit late enough in the cascade to win.
 * `test/view/rendering.test.ts` established this instrument and states its limits at
 * length; this file is the same idea narrowed to one surface, so that suite does not grow
 * past its 450-line budget.
 *
 * What it CANNOT do is prove a rule MATCHES anything — which is exactly how three type
 * rules here came to be present, correct, and applying to nothing. That half is covered by
 * the DOM-structure assertions in `panel.test.ts`; neither check alone is sufficient and
 * the pair is the guarantee.
 */
const styles: string = assembleStyles();

/** The assembled sheet with comments removed — what the CASCADE sees. The absence checks
 *  below must read this rather than `styles`, because this pass deliberately KEEPS a comment
 *  naming the three rules it deleted, and a substring search cannot tell a live selector from
 *  a selector being explained. */
const declarations: string = styles.replace(/\/\*[\s\S]*?\*\//g, '');

function ruleAt(selector: string, decl: string): number {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const wanted = decl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// The boundary right after the selector: a compound-list comma, or the rule's own
	// opening brace — never a bare space, which a descendant combinator also is. A space
	// there used to be swallowed as "the trailing whitespace before `{`" by the OLD
	// `[,\s]` boundary, so `.pbl-est-decomp` could walk straight through the descendant
	// combinator into `.pbl-est-decomp .pbl-est-total`'s own block and find its declarations
	// there — a bare-class lookup returning a compound selector's rule. `[,{]` accepts
	// only a real boundary; when it consumes the opening brace itself (the common,
	// non-comma case), the scan for `wanted` continues straight into the body, so there is
	// no second `\{` to require afterward.
	const pattern = new RegExp(`^[\\t]*${escaped}\\s*[,{][^}]*${wanted}`, 'gm');
	let found = -1;
	for (const match of styles.matchAll(pattern)) found = match.index ?? found;
	return found;
}

describe('the estimation view declares its own type', () => {
	it('gives the table a UI size rather than inheriting the reading size', () => {
		// Measured without this rule: 15px row titles under a 12px header. `--font-ui-small`
		// is DESIGN.md's Body entry and what the tree's rows already use.
		expect(ruleAt('.pbl-est-table', 'font-size: var(--font-ui-small);')).toBeGreaterThan(-1);
	});

	it('gives the decomposition the annotation size', () => {
		expect(ruleAt('.pbl-est-decomp', 'font-size: var(--font-ui-smaller);')).toBeGreaterThan(-1);
	});
});

describe('the panel header owns its own type', () => {
	it('declares all four steps on the header rather than borrowing them by position', () => {
		expect(ruleAt('.pbl-est-header .pbl-est-title', 'font-size: var(--font-ui-medium);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header .pbl-est-total', 'font-size: var(--font-ui-large);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header .pbl-est-coverage', 'font-size: var(--font-ui-small);')).toBeGreaterThan(-1);
	});

	it('no longer addresses the total, the coverage or the title by where they sit', () => {
		// The defect this task exists to fix, kept fixed. These three rules were present and
		// correct and matched NOTHING once the summary and the title moved into the sticky
		// header — the total silently rendered at 15px/500 instead of 20px/semibold, and no
		// check in this repository could see it. A rule that matches nothing is the thing the
		// next reader trusts, so it is deleted rather than left beside its replacement.
		expect(declarations).not.toContain('.pbl-est-decomp .pbl-est-total');
		expect(declarations).not.toContain('.pbl-est-decomp .pbl-est-coverage');
		expect(declarations).not.toContain('.pbl-est-panel > .pbl-est-title');
	});

	it('takes the pinned edge padding off the panel and gives it to the header', () => {
		// DESIGN.md: "Padding never sits on an edge something is pinned to. A sticky child
		// pins at the scroller's content edge, so whatever wants a gap owns it inside the box
		// that pins." Left on the panel it was a band above the header that rows scrolled
		// visibly through.
		expect(ruleAt('.pbl-est-panel', 'padding-block-start: 0;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header', 'padding-block-start: var(--size-4-3);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header', 'position: sticky;')).toBeGreaterThan(-1);
		// The header's own comment also claims opaqueness — "the panel's own fill, so rows
		// scroll UNDER an opaque header rather than through it". Sticky and the paddings are
		// checked above; this is the half of that claim a rule CAN see (a real background
		// paints rather than nothing).
		expect(ruleAt('.pbl-est-header', 'background-color: var(--background-secondary);')).toBeGreaterThan(-1);
	});

	it('gives the panel title the Title step WEIGHT, not the Answer beside it', () => {
		// Measured 15px/600 against a DESIGN.md Title entry declaring `--font-medium`, while
		// `.pbl-empty-title` — the entry's other wearer — renders 500. One declared step, two
		// weights on screen; `ruleAt` cannot read a computed weight, so what it reads is the
		// declaration, and the absence beside it is what stops the old one being left in place.
		expect(ruleAt('.pbl-est-header .pbl-est-title', 'font-weight: var(--font-medium);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-header .pbl-est-title', 'font-weight: var(--font-semibold);')).toBe(-1);
	});

	it('undoes the clear control transition beside it, because motion.css loads too early', () => {
		// `index.css` imports `motion.css` at position 10 and `estimationPanel.css` at 32. A
		// media query adds NO specificity, so a `transition` declared here beats motion.css's
		// `transition: none` at equal specificity and `prefers-reduced-motion` would silently not
		// apply. `.pbl-add` is safe only because `columns.css` loads at position 6, BEFORE
		// motion.css — an accident of order this partial does not share. DESIGN.md's documented
		// exception ("unless it must sit beside the rule it overrides") is exactly this case.
		const transition = ruleAt('.pbl-est-clear', 'transition: opacity 120ms ease-in-out;');
		const stopped = ruleAt('.pbl-est-clear', 'transition: none;');
		expect(transition).toBeGreaterThan(-1);
		expect(stopped, 'the reduced-motion override must come after the transition').toBeGreaterThan(transition);
	});
});

describe('the currency chip spends colour only where there is something to do', () => {
	it('names `current` in no rule at all', () => {
		// The Spent Colour Rule, applied to a state word rather than a badge: green means
		// FINISHED in this system, and a current total is trustworthy rather than done, so a
		// fully estimated backlog stays monochrome apart from its badges. The chip element
		// still CARRIES `pbl-est-cur-current` — `renderCurrencyChip` builds the class from the
		// currency name for all six — and this is the checkable half of that: no rule anywhere
		// in the sheet selects it, so the class paints nothing.
		//
		// `estimationChip.css` states the same rule in a comment beside the two coloured
		// currencies, which is why the search reads `declarations` rather than `styles`.
		expect(declarations).not.toContain('pbl-est-cur-current');
	});

	it('colours the two that need an action and dashes the two it does not vouch for', () => {
		// The other half of the sentence above: absence means "spent elsewhere", not "spent
		// nowhere", so an assertion that only the absence held would pass over a sheet that
		// deleted every currency colour.
		expect(ruleAt('.pbl-est-chip.pbl-est-cur-stale', 'color: var(--text-warning);')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-chip.pbl-est-cur-foreign', 'border-style: dashed;')).toBeGreaterThan(-1);
	});
});

/**
 * One radius across the chip family. The currency chip joined a column that already had two
 * neighbours, and DESIGN.md reserves `--radius-l` for counts, tags and the tag-add button —
 * "a second look would read as a second kind of thing".
 *
 * The family is ENUMERATED, and that is the check's ceiling: a seventh chip class added to
 * `columns.css` is not in this list until somebody puts it there. What the list cannot be
 * replaced by is a scan for `--radius-l`, which is correct in this sheet on the pill shapes
 * that are supposed to have it.
 */
const CHIP_FAMILY = [
	'.pbl-state-chip',
	'.pbl-horizon-chip',
	'.pbl-risk-chip',
	'.pbl-priority-chip',
	'.pbl-assignee-chip',
	'.pbl-date-chip',
	'.pbl-est-chip',
];

describe('the chip family shares one radius', () => {
	it.each(CHIP_FAMILY)('%s takes --radius-s', (selector) => {
		expect(ruleAt(selector, 'border-radius: var(--radius-s);')).toBeGreaterThan(-1);
	});

	it.each(CHIP_FAMILY)('%s never takes the pill radius', (selector) => {
		expect(ruleAt(selector, 'border-radius: var(--radius-l);')).toBe(-1);
	});
});

describe('the dimension rows are divided by what comes BEFORE a row', () => {
	it('draws the divider with the adjacent-sibling form, and keeps the `:last-of-type` one deleted', () => {
		// `:last-of-type` matches the last DIV of any class sharing the parent, and
		// `.pbl-est-decomp` is a div too — so a border removed from "the last row" was removed
		// from the decomposition instead, and two borders stacked above it, on every scored
		// item. The rule below only ever asks what comes before a row, which nothing after it
		// can change.
		expect(ruleAt('.pbl-est-dim + .pbl-est-dim', 'border-top: 1px solid var(--background-modifier-border);')).toBeGreaterThan(-1);
		expect(declarations).not.toContain('.pbl-est-dim:last-of-type');
		// This says the rule EXISTS, never that it matches: no cascade runs here. The structure
		// it needs — the rows adjacent to each other, the decomposition after them — is
		// asserted in `dimensionRows.test.ts`, and the pair is the guarantee.
	});
});

describe('the clear control sits in the gutter the row reserves for it', () => {
	// An absolute inset resolves against the containing block's PADDING box. Positioning
	// `.pbl-est-clear` against `.pbl-est-dim-head` therefore measured from INSIDE the
	// gutter that head reserves, putting the control over the last point button and
	// leaving the reserved space empty beside it (reported from a vault, 2026-08-21).
	// `.pbl-est-dim` has no inline padding, so its padding box's inline-end edge IS the
	// head's border-box edge, and `inset-inline-end: 0` lands in the gutter.
	it('positions the control against the row, not against the head that reserves the gutter', () => {
		expect(ruleAt('.pbl-est-dim', 'position: relative')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-dim-head', 'position: relative')).toBe(-1);
	});

	// 32px is the control, not a round number: `.clickable-icon` is
	// `padding: var(--size-2-2) var(--size-2-3)` (4px 6px) around an icon sized by the
	// INHERITED `--icon-size`, which is `--icon-m` — 18px on the desktop root and 20px at
	// the touch breakpoint. So 30px, and 32px on touch. The previous `--size-4-5` (20px)
	// was narrower than the control even before the padding-box fault above.
	//
	// This pins the TOKEN. It does not prove 32px covers the control, which needs a
	// layout engine — `npm run harness`, then a vault.
	it('reserves the control’s real width rather than the 20px it used to', () => {
		expect(ruleAt('.pbl-est-dim-head', 'padding-inline-end: var(--size-4-8)')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-dim-head', 'padding-inline-end: var(--size-4-5)')).toBe(-1);
	});
});

describe('a decoration never sizes the box the value is centred in', () => {
	it('takes the strip out of the box model without letting it out of the cell', () => {
		// The three cell classes share `overflow: hidden`, so a strip hung BELOW its cell is
		// clipped away entirely — absolute against the CELL, which is why the cell is the
		// positioning context and the strip's offsets are block-end rather than a translate.
		expect(ruleAt('.pbl-est-row > .pbl-est-total', 'position: relative;')).toBeGreaterThan(-1);
		expect(ruleAt('.pbl-est-strip', 'position: absolute;')).toBeGreaterThan(-1);
	});

	it('gives all four numeric cells the same height and the same centring, not just the strip two', () => {
		// The measured cause was two, not one: the strip cell's `column` flex plus its 3px gap
		// and 3px strip measured ~24px against a plain cell's ~18px line — but even after that
		// was fixed, `NUM top` still read 106.0 for the strip cells against 105.0 for the plain
		// two. A plain cell centres an INLINE SPAN (a line box, 17.0px); a strip cell centred a
		// FLEX ITEM (a content box, 16.9px) — two different layout paths for the same-looking
		// number. Confidence and effort join this rule for that reason, carrying no strip of
		// their own, so every numeric cell's number goes through the ONE path.
		for (const selector of ['.pbl-est-row > .pbl-est-cell', '.pbl-est-row > .pbl-est-total', '.pbl-est-row > .pbl-est-coverage']) {
			expect(ruleAt(selector, 'align-self: stretch;'), selector).toBeGreaterThan(-1);
			expect(ruleAt(selector, 'align-items: center;'), selector).toBeGreaterThan(-1);
		}
		// The column flex is what made the strip cell taller than its siblings, so it must be
		// GONE rather than overridden — an override is a rule the next reader has to reconcile.
		expect(ruleAt('.pbl-est-row > .pbl-est-total', 'flex-direction: column;')).toBe(-1);
	});
});
