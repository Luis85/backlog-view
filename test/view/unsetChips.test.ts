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
 * of them on the demo fixture — so the most repeated word on a first screen was
 * `Assignee`, in grey, at 2.57:1 dark and 2.12:1 light against AA's 4.5:1. Unreadable and
 * clickable at once.
 *
 * **This file is two tests because the claim has two halves and only one of them is
 * jsdom's.** jsdom computes no styles from a linked sheet, so "hidden at rest" can only be
 * checked as the SHAPE of the partial — `rowChrome.test.ts`'s own approach and its own
 * honesty about being narrower than the claim. What jsdom answers exactly is the other
 * half: the chip is still RENDERED and still a button, which is what keeps the roving
 * focus and the click-to-set alive. A future "simplification" that stopped drawing an
 * unset chip would look like the same design and would take the affordance away.
 */
describe('an unset chip is drawn but not shown at rest', () => {
	const css = readFileSync('styles/columns.css', 'utf8');

	it('hides it at rest and clears AA when it is shown', () => {
		// `opacity`, never `display` or `visibility`: the chip keeps its box so revealing one
		// reflows nothing, and it stays hit-testable, which is what makes hover-to-reveal
		// work — the row's own hover fires with the pointer already over the chip.
		const block = css.match(/\.pbl-state-chip\.pbl-state-unset[^{]*\{[^}]*\}/);
		expect(block, 'no rule for the unset chips').not.toBeNull();
		expect(block?.[0]).toContain('opacity: 0');
		// Measured in headless Chromium after the change: 7.03:1 dark, 6.19:1 light.
		// `--text-faint` was the 2.57 / 2.12 that failed.
		expect(block?.[0]).toContain('color: var(--text-muted)');
	});

	it('reveals it on hover and on roving focus, for rows and for cards', () => {
		// `:focus-within` is not decoration. Every chip is a real `<button tabindex="-1">`
		// reached by the tree's roving focus, so without this a keyboard user would rove
		// through controls that never appear.
		// Anchored on a selector only THIS rule carries. A pattern starting at
		// `.pbl-row:hover` matched an unrelated `.pbl-add` rule earlier in the file and
		// passed while asserting nothing — the instrument has to see the right block first.
		const reveal = css.match(/[^}]*\.pbl-card:focus-within \.pbl-date-chip\.pbl-date-unset\s*\{[^}]*\}/);
		expect(reveal, 'no reveal rule').not.toBeNull();
		for (const selector of ['.pbl-row:hover', '.pbl-row:focus-within', '.pbl-card:hover', '.pbl-card:focus-within']) {
			expect(reveal?.[0], `${selector} does not reveal the chips`).toContain(selector);
		}
	});

	it('still renders the chip as a button, so it stays clickable and focusable', () => {
		// The half jsdom can answer, and the one that guards against removing the affordance
		// instead of hiding it.
		// The DEMO fixture, not the four-note one: the chips only draw for columns that are
		// in the order, and this is the configuration that puts all of them there — the same
		// one the browser harness mounts, where these chips were counted at 30.
		// `order` is not optional decoration: the Bases properties menu is what decides which
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
