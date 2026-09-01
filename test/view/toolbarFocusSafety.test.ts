// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Modal } from '../helpers/obsidian-mock';
import { syncBusy } from '../../src/view/render/toolbar';
import { fixture, loadToolbarStyles, makeView, refresh, toolbarOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Split out of `toolbar.test.ts` for the same reason `deliverablesToolbar.test.ts` was:
 * one subject, kept out of a file already near its line budget. This one is two
 * regressions with a shared shape — a focusable control the toolbar can make
 * unreachable without ever taking it out of the accessibility tree — found in the same
 * final whole-branch review.
 *
 * The real partials, loaded once for the module so `getComputedStyle` answers for real
 * — jsdom parses a stylesheet it is given, it lays nothing out on its own. The list of
 * them is `loadToolbarStyles`'s, which states why each one is in it.
 */
loadToolbarStyles();

describe('focus safety when the toolbar narrows or a batch ends', () => {
	/**
	 * The config warning's own "What to fix" link is a direct, non-shrinking child of the
	 * toolbar (`.pbl-toolbar > *` defaults to `flex: 0 0 auto`), drawn outside the warning
	 * it belongs to so a control is never clipped-but-tabbable inside `.pbl-config-warning`'s
	 * own last-rung shrink. Left with no rung of its own it would still be the last element
	 * on the row — everything after it already gone by step 5 — and so the first thing that
	 * last rung's clip reaches: clipped alone while the DOM still claimed it was there. It
	 * joins the SAME step-2 rule as the help button rather than a rule of its own, per
	 * `toolbarFit.css`'s own header, so it is gone by the time the `⋯` it sheds into first
	 * renders, and untouched at step 1 — the same two rungs `toolbarFit.test.ts`'s help
	 * button test asserts, over the same rule.
	 */
	it('sheds the config warning link at step 2, before the warning itself ever clips', () => {
		const { containerEl } = makeView(fixture(), { orderProperty: 'note.parent' });
		const bar = toolbarOf(containerEl);
		const link = containerEl.querySelector<HTMLElement>('[data-pbl-key="config-help"]');
		if (!link) throw new Error('the toolbar drew no config warning link to shed');

		expect(getComputedStyle(link).display).not.toBe('none');

		bar.setAttribute('data-pbl-fit', '1');
		expect(getComputedStyle(link).display).not.toBe('none');

		bar.setAttribute('data-pbl-fit', '2');
		expect(getComputedStyle(link).display).toBe('none');
	});

	/**
	 * The stranding this codebase had not caught: the mechanism above refuses to LAND
	 * focus in a hidden `.pbl-busy`, but nothing handled focus already being there the
	 * instant the container hides out from under it. The path: a batch is in flight, the
	 * user opens the manual from "What is happening" (still genuinely visible), closes it,
	 * tier 1 correctly returns focus to the still-visible link — and only THEN does the
	 * batch end, dropping `pbl-busy-on` and hiding the link's own container. A real
	 * browser blurs a focused descendant to `<body>` the moment its container goes
	 * `display: none`; jsdom does not, which is what makes this handler directly
	 * observable rather than merely inferred — `document.activeElement` would still read
	 * as the link here even with no fix at all, so this test proves `syncBusy`'s own
	 * handler runs and moves focus, not that it beats a real browser's blur to the punch.
	 * That race is unobservable from here and stays on the vault list.
	 */
	it('moves focus off the busy help link before its container hides underneath it', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);

		syncBusy(bar, { done: 1, total: 2 }, false, true);
		const link = bar.querySelector<HTMLElement>('.pbl-busy .pbl-help-link');
		link?.focus();
		expect(document.activeElement).toBe(link);

		syncBusy(bar, null, false, false);

		expect(document.activeElement).toBe(bar.querySelector('.pbl-help-btn'));
	});

	/**
	 * The config warning's `onClosed` (`toolbar.ts`, the door's own `focusInBar` fallback)
	 * is tier 3 of `manualLink`'s chain — reached only once tier 1 (the live link,
	 * resolved from `barEl` and confirmed visible) and tier 2 (`barEl` itself, which
	 * carries no `tabindex`) both fail. The test above drives tier 1 failing by CLIPPING;
	 * this drives it failing by the link being GONE outright — fixing the configuration
	 * removes `.pbl-config-warning`, and this link with it, on the very next render, the
	 * same shape the busy indicator's own fallback (`manualEntryPoints.test.ts`) covers
	 * for a finished batch. Neither test above exercises this closure at all: the first
	 * only reads `display`, the second belongs to the busy indicator's different
	 * mechanism (`syncBusy`'s own stranded-focus handler, not a door's `onClosed`).
	 */
	it('falls back to the help button when the config warning link is gone by closing time', () => {
		const vault = fixture();
		const { view, config, containerEl } = makeView(vault, { parentProperty: 'note.x', orderProperty: 'note.x' });
		const link = containerEl.querySelector<HTMLElement>('[data-pbl-section="setup"]');
		if (!link) throw new Error('the toolbar drew no config warning link to open the manual from');
		link.click();
		expect(Modal.lastOpened?.contentEl.querySelector('.pbl-manual-pane h3')?.textContent).toBe(
			'Setting up the view',
		);

		// Fixed: the collision is gone, so the warning — and this link — are gone from the
		// very next render.
		config.set('orderProperty', 'note.order');
		refresh(view, vault);
		expect(containerEl.querySelector('[data-pbl-section="setup"]')).toBeNull();

		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-help-btn'));
	});
});
