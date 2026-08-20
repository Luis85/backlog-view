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

function ruleAt(selector: string, decl: string): number {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const wanted = decl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`^[\\t]*${escaped}[,\\s][^{]*\\{[^}]*${wanted}`, 'gm');
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
