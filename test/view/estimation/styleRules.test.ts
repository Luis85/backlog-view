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
	});
});
