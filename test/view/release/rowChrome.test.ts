import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * One release's screen is TWO partials since 2026-09-04, when `releaseScope.css` hit the
 * 400-line cap and its member tree and toolbar went to `releaseScopeTree.css`. Each
 * describe below reads the one partial its rules are in; the absence claims read both,
 * for the reason stated there.
 */
const SCOPE_PARTIALS = ['styles/releaseScope.css', 'styles/releaseScopeTree.css'];

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
 * (`renderScope.ts`) are the only two IN `release.css` that name a real `<button>` besides
 * the row above, and both WANT Obsidian's button chrome rather than losing to it by
 * accident — so neither gets an element-qualified override. `releaseScope.css`'s own bare
 * buttons are a separate audit, below: this file grew a second partial the day the release
 * had a screen of its own, and `release.css` alone stopped being the whole of "every real
 * `<button>` this view draws". These two tests pin that "no override" is the decision, not
 * an oversight: either control gaining a `button.pbl-rel-new { … }` or `button.pbl-rel-back
 * { … }` reset later is a deliberate re-audit, not a silent add.
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

/**
 * The scope screen's own bare buttons (`releaseScope.css`), added on this branch and never
 * before covered here — the gap this test closes. `.pbl-twisty` (the disclosure,
 * `scopeTree.ts`) and `.pbl-rel-toggle` (the hide-done toggle, `scopeToolbar.ts`) are real
 * `<button>`s carrying no `clickable-icon` and no `mod-cta`, so an Obsidian `button` rule
 * reaches them exactly as it reached `.pbl-rel-band` before that one was fixed
 * (`docs/issues/The release index rows paint as Obsidian buttons.md`) — this is that same
 * live-vault risk, on the newest controls, and it is the highest-risk item left unguarded
 * on this branch. The code is already right; this test is what stops it drifting back.
 */
describe('the scope screen’s bare buttons do not paint as Obsidian buttons', () => {
	const css = readFileSync('styles/releaseScopeTree.css', 'utf8');

	it('resets the disclosure’s chrome at `button.pbl-twisty`', () => {
		const block = css.match(/button\.pbl-twisty\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the disclosure').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
		expect(block?.[0]).toContain('border: none');
		expect(block?.[0]).toContain('padding: 0');
	});

	it('resets the hide-done toggle’s chrome at `button.pbl-rel-toggle`', () => {
		const block = css.match(/button\.pbl-rel-toggle\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the toggle').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
		expect(block?.[0]).toContain('border: 1px solid');
		expect(block?.[0]).toContain('padding:');
	});
});

/**
 * The scope toolbar's other two buttons, and the empty-state ✨ — `.pbl-rel-collapse` and
 * `.pbl-rel-expand` (`scopeToolbar.ts`'s `iconBtn`) carry `clickable-icon`, and
 * `.pbl-rel-init` carries `clickable-icon` on the bar and `mod-cta` on an empty state
 * (`initControl.ts`) — so all three are correctly EXCLUDED from an element-qualified reset
 * the same way `.pbl-rel-new` and `.pbl-rel-back` are above. Pinned for the same reason:
 * a class gaining its own `clickable-icon`/`mod-cta` or losing it is a decision worth
 * re-auditing, not a silent drift either way.
 */
describe('the scope toolbar’s icon buttons and the ✨ keep Obsidian’s chrome on purpose', () => {
	// BOTH scope partials, concatenated: these are ABSENCE claims, and an absence is only
	// evidence if what is read is everywhere the rule could have been written. Reading one
	// partial would have started passing for free the moment the split (2026-09-04) moved
	// the toolbar to the other file.
	const css = SCOPE_PARTIALS.map((file) => readFileSync(file, 'utf8')).join('\n');

	it('leaves `.pbl-rel-collapse` and `.pbl-rel-expand` unqualified — both carry `clickable-icon`', () => {
		expect(css).not.toMatch(/button\.pbl-rel-collapse\s*\{/);
		expect(css).not.toMatch(/button\.pbl-rel-expand\s*\{/);
	});

	it('leaves `.pbl-rel-init` unqualified here too — `initControl.ts` is what carries `clickable-icon`/`mod-cta` on it', () => {
		expect(css).not.toMatch(/button\.pbl-rel-init\s*\{/);
	});
});

/**
 * **The three controls this branch added to the scope HEADER, and the audit above did not
 * reach.** The status chip, the description line and the released date are all real
 * `<button>`s carrying neither `clickable-icon` nor `mod-cta`, so Obsidian's
 * `button:not(.clickable-icon)` — `color`, `background-color`, `box-shadow`, at (0,1,1) —
 * reaches every one of them exactly as it reached `.pbl-rel-band`.
 *
 * Each was written as a bare class with a reset in it and a comment saying the reset
 * refuses the app's chrome, and MEASURED in headless Chromium on 2026-08-29 it did not: the
 * description and the released date computed `rgb(51, 51, 51)` with Obsidian's raised
 * `--input-shadow` under them, and both took `--text-normal` where the partial asked for
 * `--text-muted` and `--text-faint`. A boxed, filled sentence is the 2026-08-08 defect the
 * root guide records, arriving for the third time on the newest controls.
 *
 * The status chip is the opposite finding and is why this block names it: every one of its
 * four declarations was INERT — `button.pbl-state-chip` (`styles/columns.css`) already ties
 * Obsidian at (0,1,1) and supplies the height, the shadow, the background and the font
 * size, so the chip was correct and its rule was saying so for the wrong reason. Only its
 * `flex` needed the qualification, to beat the chip rule's own `flex: 0 1 auto`.
 *
 * Narrow in the same way the block at the top of this file is narrow: what is checked is
 * the SHAPE in the partial as written, never a specificity computed against a sheet no test
 * here can load.
 */
describe('the scope header’s three write surfaces do not paint as Obsidian buttons', () => {
	const css = readFileSync('styles/releaseScope.css', 'utf8');

	it('resets the description line at `button.pbl-rel-desc`', () => {
		const block = css.match(/button\.pbl-rel-desc\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the description').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
		// The colour is the third declaration Obsidian's rule carries, and the one a
		// background-and-shadow-only reset leaves behind: a description is muted prose.
		expect(block?.[0]).toContain('color: var(--text-muted)');
		// The QUIETER loss, and the one an element-qualified reset does not fix by itself:
		// Obsidian's bare `button` rule supplies `justify-content: center` to a rule that
		// declares none, and a button is a flex container — so `text-align: start` lands on
		// an anonymous flex item already centred in a full-width box. Measured centred in
		// Chromium on 2026-08-29, after the reset above was already winning. Same finding as
		// the band's, in `docs/issues/The release index rows paint as Obsidian buttons.md`.
		expect(block?.[0]).toContain('justify-content: flex-start');
	});

	it('resets the released date at `button.pbl-rel-released`', () => {
		const block = css.match(/button\.pbl-rel-released\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the released date').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
		expect(block?.[0]).toContain('color: inherit');
	});

	it('preserves the newlines the description box lets the reader type', () => {
		// `TextPromptModal` deliberately does not submit on Enter, so a line break is content
		// somebody meant — and `white-space: normal` collapsed every one of them into a space,
		// so two paragraphs came back as one (found by review, PR #211). `pre-wrap` keeps them
		// and still wraps a long line, which is what `normal` was chosen for.
		const block = css.match(/button\.pbl-rel-desc\s*\{[^}]*\}/);
		expect(block?.[0]).toContain('white-space: pre-wrap');
	});

	it('qualifies both invitation states, which say a COLOUR and nothing else', () => {
		// `color` is the only property either adds that Obsidian's rule also declares, so a
		// bare class here is a rule whose whole point loses while its `font-style` lands —
		// an italic sentence in the wrong ink, which reads as deliberate.
		expect(css).toMatch(/button\.pbl-rel-desc-empty\s*\{[^}]*color: var\(--text-faint\)/);
		expect(css).toMatch(/button\.pbl-rel-released-unset\s*\{[^}]*color: var\(--text-faint\)/);
	});

	it('qualifies the status chip’s `flex`, and states nothing the chip rule already states', () => {
		// The chip rule wins at (0,1,1) on every property it names, `flex: 0 1 auto` among
		// them — so the refusal to shrink has to tie it, and the other four declarations were
		// a reset that could never fire. Pinned as the decision: a `background-color` added
		// back here would now WIN and take the chip's own box off.
		const block = css.match(/button\.pbl-rel-status\s*\{[^}]*\}/);
		expect(block, 'no element-qualified rule for the status chip').not.toBeNull();
		expect(block?.[0]).toContain('flex: 0 0 auto');
		expect(block?.[0]).not.toContain('background-color');
		expect(block?.[0]).not.toContain('box-shadow');
	});
});

/**
 * The state column's own width (`releaseScope.css`), corrected on 2026-09-01 alongside the
 * my-work tree's identical cell, which was copied from this one.
 *
 * It was a fixed `inline-size: 92px` — narrower than the 140px cap `columns.css` puts on
 * `.pbl-state-chip` itself — so a chip in it was truncated at EVERY pane width, `In
 * progress` reading `In progr…` with hundreds of pixels of spare row beside it. The cell
 * keeps a gap for a stateless row, as it always has; what changed is that the gap is the
 * chip's own icon rather than four times it, and that the cell may now shrink to that
 * floor rather than truncating a chip it had room to show. It does not go BELOW the floor:
 * the chip cannot shrink past its icon, so a cell that could would clip the icon to a
 * sliver — which is what the my-work tree (whose cell was copied from this one) did at
 * 280px before this pass gave both the same floor. `styles/mywork.css` is where the whole
 * argument is written; the partial holding this rule keeps the short form deliberately,
 * and since 2026-09-04 that partial is `styles/releaseScopeTree.css` — the tree half of
 * the split `releaseScope.css` took at that same 400-line cap.
 *
 * Comments are STRIPPED before matching — this file's rules are written beside paragraphs
 * quoting the declaration they replaced, and a `not.toMatch` otherwise reads the prose
 * saying why the declaration is gone (the shape that failed in the my-work half of this
 * pass the moment it was written).
 */
describe('the scope tree’s state column is sized by what it holds', () => {
	const css = readFileSync('styles/releaseScopeTree.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

	it('sizes it to its content, with a floor at the chip’s own icon', () => {
		const block = /\.pbl-rel-statecol\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
		expect(block).toMatch(/flex:\s*0 1 auto/);
		expect(block).toMatch(/min-inline-size:\s*22px/);
		// The floor is what stops the cell shrinking past the chip inside it, which is how
		// the my-work column clipped its own icon to a sliver before the floor was added.
		expect(block).not.toMatch(/[^-]inline-size:\s*92px/);
	});

});
