// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, shelfOf } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { MAX_SHELF_HEIGHT_PX, MIN_SHELF_HEIGHT_PX } from '../../src/storage/viewStateStore';

useViewHarness();

/**
 * The grip at the open shelf's foot: the band's cap, dragged.
 *
 * It is the column grips' own gesture with one thing changed — `wireResizeGrip`'s
 * `vertical`, which picks `clientY` and the Up/Down pair — so what
 * `test/view/columnResize.test.ts` already drives (the single-contact rule, the platform
 * cancel, the refusal to commit an unchanged size, the width drawn at release rather than
 * at the last move) is NOT re-driven here. What is here is what this grip decides for
 * itself: which axis it reads, what it announces, where the height goes, and the two
 * states it must not be drawn in at all.
 *
 * jsdom lays nothing out, so `offsetHeight` is 0 and an unpicked band reads back as the
 * storable floor — which is what the ARIA assertions below expect, and is deliberately the
 * honest answer rather than a stub: a grip on an unmeasured pane announces the smallest
 * band it could produce. What a picked height LOOKS like was measured in the browser
 * harness instead (`--pbl-shelf-h: 320px` drawing a 320px band at a 1200x800 pane).
 */
describe('the shelf’s resize grip', () => {
	const gripOf = (containerEl: HTMLElement): HTMLElement | null =>
		shelfOf(containerEl)?.querySelector<HTMLElement>('.pbl-shelf-grip') ?? null;

	function grip(containerEl: HTMLElement): HTMLElement {
		const el = gripOf(containerEl);
		if (!el) throw new Error('no shelf resize grip');
		return el;
	}

	/** What the band is currently DRAWN at — one custom property on the shelf element. */
	const drawn = (containerEl: HTMLElement): string =>
		shelfOf(containerEl)?.style.getPropertyValue('--pbl-shelf-h') ?? '';

	function pointer(type: string, clientY: number, pointerId = 1): PointerEvent {
		return new PointerEvent(type, { bubbles: true, clientY, pointerId, button: 0 });
	}

	function press(el: HTMLElement, key: string): void {
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	}

	it('carries a real separator role across the band, and states its bounds', () => {
		const { containerEl } = makeRoadmap(horizonVault());

		const el = grip(containerEl);
		expect(el.getAttribute('role')).toBe('separator');
		// HORIZONTAL, unlike either column grip: this boundary lies across the band and moves
		// up and down. The orientation and the keys it claims are one decision.
		expect(el.getAttribute('aria-orientation')).toBe('horizontal');
		// A real tab stop, like the two column grips and the shelf's own disclosure — chrome
		// fixed to the band's frame, never among the cards, so the pane keeps its arrows.
		expect(el.getAttribute('tabindex')).toBe('0');
		expect(el.getAttribute('aria-label')).toBe('Resize the shelf');
		expect(el.getAttribute('aria-valuemin')).toBe(String(MIN_SHELF_HEIGHT_PX));
		expect(el.getAttribute('aria-valuemax')).toBe(String(MAX_SHELF_HEIGHT_PX));
	});

	it('publishes nothing until a height is picked, so the stylesheet keeps its own share', () => {
		// Absence is the default all the way down: no stored pick, no custom property, and
		// the `var()` in `styles/shelf.css` falls through to the share of the pane the band
		// has always taken. A grip that published its measured height on every render would
		// pin that share to whatever the pane happened to be on the first draw.
		const { view, containerEl } = makeRoadmap(horizonVault());
		expect(view.shelfHeight).toBeNull();
		expect(drawn(containerEl)).toBe('');
	});

	describe('dragging', () => {
		it('resizes live without writing anything, and persists once on release', () => {
			const vault = horizonVault();
			const { view, containerEl, config } = makeRoadmap(vault);

			// DOWN is taller: the grip is at the band's foot, the edge a growing shelf moves.
			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointermove', 200));

			expect(drawn(containerEl)).toBe(`${MIN_SHELF_HEIGHT_PX + 200}px`);
			expect(el.getAttribute('aria-valuenow')).toBe(String(MIN_SHELF_HEIGHT_PX + 200));
			// Nothing stored, nothing in the `.base`, nothing in a note — a band's height is
			// working position and a gesture in flight is not even that yet.
			expect(view.shelfHeight).toBeNull();
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);

			el.dispatchEvent(pointer('pointerup', 200));
			expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX + 200);
			expect(config.setCalls).toEqual([]);
			expect(vault.writeLog).toHaveLength(0);
		});

		it('reads the block axis and nothing else', () => {
			// The whole of what makes this a different gesture from the column grips. A drag
			// straight across the band moves it not at all.
			const { view, containerEl } = makeRoadmap(horizonVault());

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 0, pointerId: 1 }));
			expect(drawn(containerEl)).toBe(`${MIN_SHELF_HEIGHT_PX}px`);

			el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 300, clientY: 0, pointerId: 1 }));
			expect(view.shelfHeight).toBeNull();
		});

		it('clamps to what may be stored rather than accepting whatever the pointer names', () => {
			// The same bounds `readPrefs` refuses on the way back in, so a gesture can never
			// persist a height the store would silently drop on the next open.
			const { view, containerEl } = makeRoadmap(horizonVault());

			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 5000));
			expect(view.shelfHeight).toBe(MAX_SHELF_HEIGHT_PX);

			const tall = grip(containerEl);
			tall.dispatchEvent(pointer('pointerdown', 0));
			tall.dispatchEvent(pointer('pointerup', -5000));
			expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX);
		});
	});

	describe('the keyboard', () => {
		it('steps the band with the pair its own axis claims', () => {
			const { view, containerEl } = makeRoadmap(horizonVault());

			press(grip(containerEl), 'ArrowDown');
			expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX + 10);
			press(grip(containerEl), 'ArrowDown');
			expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX + 20);
			press(grip(containerEl), 'ArrowUp');
			expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX + 10);
		});

		it('leaves every key it does not claim to the pane beneath', () => {
			// At the FORBIDDEN THING rather than by listing the keys: a grip that claimed
			// both arrow pairs would swallow the pane's own selection movement, and a grip
			// that called `preventDefault` on everything would swallow the rest. The two the
			// column grips claim are exactly the two this one must not.
			const { containerEl } = makeRoadmap(horizonVault());
			const el = grip(containerEl);

			for (const key of ['ArrowLeft', 'ArrowRight', 'Enter', 'Escape']) {
				const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
				el.dispatchEvent(evt);
				expect(evt.defaultPrevented).toBe(false);
			}
		});

		it('hands the band back to the stylesheet on Home, and takes the focus with it', () => {
			const { view, containerEl } = makeRoadmap(horizonVault());
			press(grip(containerEl), 'ArrowDown');
			expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX + 10);

			const el = grip(containerEl);
			el.focus();
			press(el, 'Home');

			// Null, never the floor and never the measured number: an explicit reset means
			// "whatever the stylesheet gives it", which is what an absent field says.
			expect(view.shelfHeight).toBeNull();
			expect(drawn(containerEl)).toBe('');
			// The reset rebuilt the pane and destroyed the grip that was pressed, so focus is
			// on its REPLACEMENT — otherwise a reader stepping the band by repeated presses is
			// dropped to the document body after the first one.
			expect(document.activeElement).toBe(grip(containerEl));
			expect(grip(containerEl)).not.toBe(el);
		});

		it('leaves focus where it was for a gesture nobody focused it for', () => {
			// A pointer gesture never focuses the grip — `pointerdown` prevents default — so a
			// commit must not hand it one the reader did not give it, after which their next
			// arrow key would resize the band instead of moving the selection.
			const { containerEl } = makeRoadmap(horizonVault());
			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 100));

			expect(document.activeElement).not.toBe(grip(containerEl));
		});
	});

	/**
	 * The band is `max-height`, so it draws `min(content, cap)` — and with a cap larger than
	 * the cards the grip a reader can put a finger on is at the CONTENT height, not at the
	 * stored number. jsdom lays nothing out, so the drawn height is stubbed on the prototype
	 * and the pane re-rendered through the real control: this asserts the ORIGIN the gesture
	 * takes, which is the whole of what the stub can stand in for.
	 */
	describe('the gesture’s origin', () => {
		/** Report `height` as the drawn height of every shelf element, until the returned undo runs. */
		function stubDrawnHeight(height: number): () => void {
			const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
			Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
				configurable: true,
				get(this: HTMLElement) {
					return this.classList.contains('pbl-shelf') ? height : 0;
				},
			});
			return () => {
				if (own) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', own);
			};
		}

		it('takes the height the band is DRAWN at, not the larger cap it is allowed', () => {
			const { view, containerEl } = makeRoadmap(horizonVault());
			// A cap far above what the cards need. The band draws its content; the stored
			// number is only a ceiling it never reaches.
			view.setShelfHeight(600);
			const undo = stubDrawnHeight(120);
			try {
				// Re-render through a real control so the grip is rebuilt with the stub in force.
				view.setShelfLayout('list');

				const el = grip(containerEl);
				// Announced as what is on screen, never as the invisible ceiling.
				expect(el.getAttribute('aria-valuenow')).toBe('120');

				// And one step up moves the edge immediately, rather than after the 480px it
				// would take to bring a 600px origin down to where the band actually is.
				press(el, 'ArrowUp');
				expect(view.shelfHeight).toBe(110);
			} finally {
				undo();
			}
		});

		it('puts the DRAWN cap back on an uncommitted gesture, not the height it measured', () => {
			// The origin is a MEASUREMENT now, and `wireResizeGrip` redraws the origin when a
			// gesture commits nothing — which for the column grips is the stored width and here
			// is not. Left alone, a tap on a band drawn at 120 under a 600 cap would publish
			// `--pbl-shelf-h: 120px` while the store still said 600, and no render would come
			// along to correct it: expanding a card's children redraws that list IN PLACE
			// (`renderCardChildren`'s own `draw`), so the band would then be unable to grow
			// toward the cap it still holds. (Codex, PR #183.)
			const { view, containerEl } = makeRoadmap(horizonVault());
			view.setShelfHeight(600);
			const undo = stubDrawnHeight(120);
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointerup', 0));

				expect(view.shelfHeight).toBe(600);
				expect(drawn(containerEl)).toBe('600px');
			} finally {
				undo();
			}
		});

		it('puts it back on a platform cancel too, which commits nothing by design', () => {
			const { view, containerEl } = makeRoadmap(horizonVault());
			view.setShelfHeight(600);
			const undo = stubDrawnHeight(120);
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointermove', 90));
				el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));

				expect(view.shelfHeight).toBe(600);
				expect(drawn(containerEl)).toBe('600px');
			} finally {
				undo();
			}
		});

		it('publishes nothing back when there was no stored cap to put back', () => {
			// Absence is the value: with no pick, the stylesheet's own share of the pane is
			// what the band takes, and a gesture that committed nothing must leave it that way
			// rather than pinning the measured height as a cap nobody chose.
			const { view, containerEl } = makeRoadmap(horizonVault());
			const undo = stubDrawnHeight(120);
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointerup', 0));

				expect(view.shelfHeight).toBeNull();
				expect(drawn(containerEl)).toBe('');
			} finally {
				undo();
			}
		});

		it('leaves a larger cap standing when the gesture changes nothing', () => {
			// The origin moved; the rule that a no-op commits nothing did not. A tap on a band
			// drawn shorter than its cap must not quietly rewrite that cap down to the
			// content height.
			const { view, containerEl } = makeRoadmap(horizonVault());
			view.setShelfHeight(600);
			const undo = stubDrawnHeight(120);
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointerup', 0));

				expect(view.shelfHeight).toBe(600);
			} finally {
				undo();
			}
		});
	});

	describe('where it is not drawn', () => {
		it('is absent from a collapsed shelf, which has no open height to size', () => {
			const { containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
			expect(gripOf(containerEl)).toBeNull();
		});

		it('is absent from an empty shelf, which is a drop strip rather than a band', () => {
			// An empty shelf stays in the DOM so a drop has somewhere to land, and the
			// stylesheet keeps it out of the layout until a drag is live. A resize grip on a
			// band with nothing in it is a control that can do nothing — and it would be the
			// first focusable thing on an element `styles/shelf.css` reorders while a card is
			// in flight, which that rule says explicitly must not happen.
			const vault = horizonVault();
			vault.files.delete('Untriaged.md');
			const { containerEl } = makeRoadmap(vault);
			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-empty')).toBe(true);
			expect(gripOf(containerEl)).toBeNull();
		});
	});

	it('sizes the iteration board’s shelf from the same pick', () => {
		// One stored height for the one band: the roadmap's shelf and this one are the same
		// component drawn by the same call, and only ever one of them is on screen. A reader
		// who sizes it on one projection is saying how much of the pane they want the band to
		// take, not something about horizons.
		const vault = new FakeVault();
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Uncommitted.md', { frontmatter: { type: 'PBI', order: 30, status: 'New' } });
		const { view, containerEl } = makeView(
			vault,
			{
				stateProperty: 'note.status',
				stateValues: 'New, Done',
				doneValues: 'Done',
				iterationProperty: 'note.iteration',
				iterationOpenStates: 'New',
				iterationResolvedStates: 'Done',
			},
			{ base: 'Plan.base' },
		);
		view.setProjection('iteration');
		view.setBoardScope('Sprint 12.md');

		const el = grip(containerEl);
		el.dispatchEvent(pointer('pointerdown', 0));
		el.dispatchEvent(pointer('pointerup', 150));
		expect(view.shelfHeight).toBe(MIN_SHELF_HEIGHT_PX + 150);
	});
});
