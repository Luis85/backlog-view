import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * **This test is narrower than the claim it guards, and the narrow sentence is the honest
 * one.** No test here can compute a selector's specificity against Obsidian's own
 * stylesheet: `app.css` is not a dependency, jsdom computes no styles, and the browser
 * harness draws without asserting (ADR 0020). What is checked is that `styles/release.css`
 * — the PARTIAL as written, read straight off disk rather than through `assembleStyles()`,
 * which is what `releaseStyleRules.test.ts` beside it does — still spells the band's chrome
 * reset at a COMPOUND selector, so a change that lowers it back to a bare class fails here.
 * It would not notice a DIFFERENT Obsidian rule outranking a DIFFERENT declaration.
 *
 * Retargeted from `.pbl-rel-row` to `.pbl-rel-band` on 2026-08-25, when the band replaced
 * the column grid: the guard is about the SHAPE (an element-qualified reset beating
 * Obsidian's own `button:not(.clickable-icon)`), not about which class carries it, and a
 * rename that left this pinned to a selector nothing renders would keep passing while
 * guarding nothing.
 *
 * The measurement that found the defect is a headless-Chromium probe, recorded in
 * `docs/issues/The release index rows paint as Obsidian buttons.md`, and it is deliberately
 * not in `npm run check` for the reason ADR 0020 gives.
 */
describe('the index band does not paint as an Obsidian button', () => {
	const css = readFileSync('styles/release.css', 'utf8');

	it('resets the background and the shadow at a compound selector', () => {
		// `button.pbl-rel-band` is (0,1,1) and ties Obsidian's `button:not(.clickable-icon)`,
		// then wins on source order. A bare `.pbl-rel-band` is (0,1,0) and loses outright.
		const block = css.match(/button\.pbl-rel-band\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the band').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
	});

	it('keeps a focus indicator that does not depend on Obsidian’s ring', () => {
		// The reset above declares `box-shadow: none` at (0,1,1), which ties Obsidian's own
		// `button:focus-visible` and wins on order — so without an explicit outline, focus
		// would go invisible rather than merely lose its fill.
		expect(css).toMatch(/\.pbl-rel-band:focus-visible\s*\{[^}]*outline:/);
	});
});

/**
 * Step 7's audit of the stylesheet's other `.pbl-rel-*` bare classes against the real
 * elements in `src/view/release/`: `.pbl-rel-new` (`newRelease.ts`) and `.pbl-rel-back`
 * (`renderScope.ts`) are the only two that name a real `<button>` besides the row above,
 * and both WANT Obsidian's button chrome rather than losing to it by accident — so neither
 * gets an element-qualified override. These two tests pin that "no override" is the
 * decision, not an oversight: either control gaining a `button.pbl-rel-new { … }` or
 * `button.pbl-rel-back { … }` reset later is a deliberate re-audit, not a silent add.
 */
describe('the two other release buttons keep Obsidian’s chrome on purpose', () => {
	const css = readFileSync('styles/release.css', 'utf8');

	it('leaves `.pbl-rel-new` unqualified — it carries `mod-cta` and wants the filled button look', () => {
		expect(css).not.toMatch(/button\.pbl-rel-new\s*\{/);
	});

	it('leaves `.pbl-rel-back` unqualified — it carries `clickable-icon`, which Obsidian’s colliding rule already excludes', () => {
		expect(css).not.toMatch(/button\.pbl-rel-back\s*\{/);
	});
});
