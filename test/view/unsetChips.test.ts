// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeView, rows, useViewHarness } from '../helpers/view';
import { demoOptions, demoOrder, demoVault } from '../helpers/fixtures';

useViewHarness();

/**
 * An absent property is an affordance the reader reaches, not a fact the view states.
 *
 * The measurement behind it (`.impeccable/critique/2026-08-30T12-26-06Z__src-view.md`): a
 * default tree row drew a chip in 7 of 9 columns, all of them saying "nothing here" — 30
 * of them on the demo fixture — at 2.57:1 dark and 2.12:1 light against AA's 4.5:1, on an
 * element that is also a button.
 *
 * **jsdom computes no styles from a linked sheet, so most of this is the SHAPE of the
 * partial** — `rowChrome.test.ts`'s approach and its own honesty about being narrower than
 * the claim. Every case below is a rule this file must still declare, each verified in
 * headless Chromium when it was written (with `--blink-settings=availableHoverTypes=2`,
 * since the default headless build reports `hover: none` and so takes the touch branch).
 * One case is jsdom's outright, and it is the last.
 */
describe('an unset chip is drawn but shown only where the reader is', () => {
	const css = readFileSync('styles/columns.css', 'utf8');

	it('carries the visibility as an inherited property, defaulting to SHOWN', () => {
		// The fallback is the whole scoping rule, and it is what the reviewed version got
		// wrong: a global `opacity: 0` on the chip classes made the release header's own
		// status chip (`renderScope.ts`, in no row and no card) permanently invisible, with
		// no reveal selector that could ever match it. Reading the variable with a `1`
		// fallback means a chip outside a row or card is shown by construction, so a
		// surface that grows one later is visible without anybody remembering a selector.
		expect(css.indexOf('--pbl-unset-chip: 0')).toBeGreaterThan(-1);
		expect(css).toContain('opacity: var(--pbl-unset-chip, 1)');
	});

	it('reveals it for the pointer AND for the roving keyboard selection', () => {
		// `.pbl-selected` is not decoration. The tree and the board are composites: arrow
		// keys keep DOM focus on `.pbl-tree` and move `aria-activedescendant`, so
		// `:focus-within` on a row never becomes true from the keyboard. Without this the
		// chips stayed hidden for exactly the reader the reveal was claimed to serve.
		const reveal = css.match(/[^}]*\.pbl-card\.pbl-selected\s*\{[^}]*\}/);
		expect(reveal, 'no reveal rule naming the selected card').not.toBeNull();
		for (const selector of ['.pbl-row:hover', '.pbl-row:focus-within', '.pbl-row.pbl-selected', '.pbl-card:hover']) {
			expect(reveal?.[0], `${selector} does not reveal the chips`).toContain(selector);
		}
		expect(reveal?.[0]).toContain('--pbl-unset-chip: 1');
	});

	it('reveals it on a hoverless device, AFTER the rule it overrides', () => {
		// A touch user can produce neither a hover nor a tab stop — the chips are
		// `tabindex="-1"` because the tree and the board are each one stop — so this reveal
		// is the only thing that makes them reachable. A media query adds no specificity, so
		// written above the rule it undoes it loses the tie and silently reveals nothing,
		// which is how the bucket button once shipped unreachable on touch
		// (`styles/touch.css` records it).
		const hides = css.indexOf('--pbl-unset-chip: 0');
		const touch = css.indexOf('@media (hover: none)', hides);
		expect(touch, 'no hoverless reveal for the unset chips').toBeGreaterThan(-1);
		expect(touch, 'the hoverless reveal must come after the rule it overrides').toBeGreaterThan(hides);
		expect(css.slice(touch, touch + 200)).toContain('--pbl-unset-chip: 1');
	});

	it('reveals it when it is focused, whatever put focus there', () => {
		// `.pbl-add`'s own rule, one screen up in this file: focus can only arrive
		// programmatically on a `tabindex="-1"` control, and a control that is focused and
		// invisible is worse than one merely always shown.
		expect(css).toContain('.pbl-date-chip.pbl-date-unset:focus-visible');
	});

	it('drops the fade for a reader who asked for reduced motion', () => {
		// The reveal is not the motion — the chip still appears — but the EASING is, and this
		// repository turns every transition off in one place. `.pbl-add` is the precedent
		// listed beside it.
		//
		// Ordering is load-bearing and is why this is asserted rather than assumed: a media
		// query adds NO specificity, so `motion.css` beats `columns.css`'s `transition` only
		// because `index.css` imports columns 7th and motion 11th. Measured in headless
		// Chromium with `--force-prefers-reduced-motion`: 0.12s becomes 0s, the same as
		// `.pbl-add`. `test/view/estimation/styleRules.test.ts` records the partial this
		// does NOT hold for. (Codex, PR #228.)
		const motion = readFileSync('styles/motion.css', 'utf8');
		const block = motion.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition: none;/);
		expect(block, 'no reduced-motion block turning a transition off').not.toBeNull();
		expect(block?.[0]).toContain('.pbl-date-chip.pbl-date-unset');
		expect(block?.[0]).toContain('.pbl-state-chip.pbl-state-unset');
	});

	it('still renders the chip as a button, so it stays clickable and focusable', () => {
		// The half jsdom answers exactly, and the one that guards against removing the
		// affordance instead of hiding it.
		//
		// `order` is not optional decoration: the Bases properties menu decides which
		// properties become chip columns, so `makeView` without it renders 33 rows and no
		// chip at all — measured, after a first version of this test asserted on a tree that
		// had none for that reason rather than for the reason it was testing.
		const { containerEl } = makeView(demoVault(), demoOptions(), { order: demoOrder() });
		const chips = rows(containerEl).flatMap((row) =>
			[...row.querySelectorAll<HTMLElement>('button')].filter((el) =>
				[...el.classList].some((cls) => cls.endsWith('-unset')),
			),
		);
		expect(chips.length, 'no unset chip rendered at all').toBeGreaterThan(0);
		for (const chip of chips) {
			expect(chip.tagName).toBe('BUTTON');
			expect(chip.getAttribute('tabindex')).toBe('-1');
		}
	});
});
