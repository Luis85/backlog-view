// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { horizonVault, makeRoadmap, roadmapView, shelfHeavyVault, shelfOf } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { bodyOf } from '../helpers/cssVars';
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

		it('measures with its own strip already in the band', () => {
			// The grip is a flex item whose negative start margin cancels the GAP above it and
			// not its own height, so it ADDS to a band sizing to its content — 8px, measured in
			// the harness at 236px against 228px with the strip removed and restored. Read
			// before it is inserted, every number here is that much short of the edge a reader
			// can see. jsdom computes no layout, so the stub answers differently once the strip
			// is present, which is what tells the two orders apart. (Codex, PR #183.)
			const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
			Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
				configurable: true,
				get(this: HTMLElement) {
					if (!this.classList.contains('pbl-shelf')) return 0;
					return this.querySelector('.pbl-shelf-grip') ? 128 : 120;
				},
			});
			try {
				const { containerEl } = makeRoadmap(horizonVault());
				expect(grip(containerEl).getAttribute('aria-valuenow')).toBe('128');
			} finally {
				if (own) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', own);
			}
		});

		it('re-reads the edge when a gesture starts, not once when the grip was drawn', () => {
			// The band's height moves under redraws that rebuild no grip: expanding a shelved
			// parent's children is `renderCardChildren`'s own `draw`, which replaces that list
			// in place. An origin captured at the render would then describe an edge the reader
			// is no longer looking at, and the first drag would jump the band back to it — a
			// 120px origin on a band now drawn at 400px commits 110px for one step up.
			// (Codex, PR #183.) The stub grows the band between the render and the gesture,
			// which is that redraw as far as this can see it.
			const { view, containerEl } = makeRoadmap(horizonVault());
			let height = 120;
			const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
			Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
				configurable: true,
				get(this: HTMLElement) {
					return this.classList.contains('pbl-shelf') ? height : 0;
				},
			});
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				expect(el.getAttribute('aria-valuenow')).toBe('120');

				// The content grew and nothing rebuilt the grip.
				height = 400;
				press(el, 'ArrowUp');

				// One step up from where the edge IS, never from where it was.
				expect(view.shelfHeight).toBe(390);
				// And the announcement on the element the reader was HOLDING caught up to the
				// real edge before the step, rather than staying at the render's 120. Asserted
				// on `el` deliberately: the commit re-rendered and this one is detached now, so
				// what it records is the correction made at the moment the gesture took hold —
				// which is the whole of what a per-gesture read buys a screen reader.
				expect(el.getAttribute('aria-valuenow')).toBe('400');
			} finally {
				if (own) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', own);
			}
		});

		it('takes a PICKED height straight from the store, with no measurement at all', () => {
			// The band IS the picked height, so the stored number is the edge — the measurement
			// is only for a band nobody has sized. Asserted with a stub that would answer 120
			// if anything asked, so a reading of `offsetHeight` here would show up as 120.
			const { view, containerEl } = makeRoadmap(horizonVault());
			view.setShelfHeight(600);
			const undo = stubDrawnHeight(120);
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				expect(el.getAttribute('aria-valuenow')).toBe('600');

				press(el, 'ArrowUp');
				expect(view.shelfHeight).toBe(590);
			} finally {
				undo();
			}
		});

		it('grows the band downward, which a maximum could not', () => {
			// The defect this model replaced: under `max-height` a band drawn shorter than its
			// cap could not grow at all, and ArrowDown committed a number nothing on screen
			// reflected — silently replacing a larger stored value. Both halves are gone; a
			// step down is a taller band and nothing else. (Codex, PR #183.)
			const { view, containerEl } = makeRoadmap(horizonVault());
			view.setShelfHeight(600);
			try {
				press(grip(containerEl), 'ArrowDown');
				expect(view.shelfHeight).toBe(610);
			} finally {
				// nothing stubbed: a picked height needs no measurement
			}
		});

		it('publishes nothing back when there was no stored height to put back', () => {
			// `restore`'s one remaining case, and the reason it still exists. An UNPICKED band
			// is content-sized, so its origin is a measurement — and drawing that origin on an
			// uncommitted gesture would pin a band the stylesheet was sizing at whatever height
			// it happened to have. Absence is the value: the declaration is removed.
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

		it('puts an unpicked band back on a platform cancel too', () => {
			const { view, containerEl } = makeRoadmap(horizonVault());
			const undo = stubDrawnHeight(120);
			try {
				view.setShelfLayout('list');
				const el = grip(containerEl);
				el.dispatchEvent(pointer('pointerdown', 0));
				el.dispatchEvent(pointer('pointermove', 90));
				el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));

				expect(view.shelfHeight).toBeNull();
				expect(drawn(containerEl)).toBe('');
			} finally {
				undo();
			}
		});

		it('leaves a picked height standing when the gesture changes nothing', () => {
			const { view, containerEl } = makeRoadmap(horizonVault());
			view.setShelfHeight(600);
			const el = grip(containerEl);
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', 0));

			expect(view.shelfHeight).toBe(600);
			expect(drawn(containerEl)).toBe('600px');
		});
	});

	/**
	 * A picked height is a real `height`, so a band carrying one is exactly that tall — which
	 * makes WHERE the value is published a correctness question rather than a tidiness one.
	 * It belongs to precisely the states the grip belongs to, and is set beside it for that
	 * reason. Both cases below were regressions from the height model, measured in the
	 * harness before the fix: a collapsed band drew 400px — its 24px header and 376px of
	 * blank space — where a collapsed band is 34px. (Codex, PR #183.)
	 */
	describe('where the height is not published', () => {
		it('leaves a collapsed band alone, however tall the reader sized it open', () => {
			const { view, containerEl } = makeRoadmap(horizonVault(), {}, { shelfCollapsed: true });
			view.setShelfHeight(400);

			expect(drawn(containerEl)).toBe('');
			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-sized')).toBe(false);
		});

		it('leaves the empty drop strip alone, which a drag reveals at full size', () => {
			// `.pbl-dragging .pbl-shelf-empty` puts the strip back in the layout so a card has
			// somewhere to land. With a height on it that target would be as tall as the band
			// the reader last sized, over a shelf holding nothing.
			const vault = horizonVault();
			vault.files.delete('Untriaged.md');
			const { view, containerEl } = makeRoadmap(vault);
			view.setShelfHeight(400);

			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-empty')).toBe(true);
			expect(drawn(containerEl)).toBe('');
			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-sized')).toBe(false);
		});

		it('marks a sized band so it cannot be shrunk by the line it sits on', () => {
			// The class travels with the value from the one place that sets either, because the
			// dated axis leaves these bands `flex: 0 1 auto`: a stored 400 drew 222px in a
			// 500px window and 102px in a 380px one, with the grip still starting from 400.
			const { view, containerEl } = makeRoadmap(horizonVault());
			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-sized')).toBe(false);

			view.setShelfHeight(400);
			expect(drawn(containerEl)).toBe('400px');
			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-sized')).toBe(true);

			view.setShelfHeight(null);
			expect(drawn(containerEl)).toBe('');
			expect(shelfOf(containerEl)?.hasClass('pbl-shelf-sized')).toBe(false);
		});

		it('states the shrink refusal at a specificity that beats the dated axis', () => {
			// jsdom resolves no cascade, so what is checkable is the SELECTOR — and it is the
			// load-bearing part: `.pbl-view.pbl-roadmap-dates .pbl-shelf` is (0,3,0) and sets
			// `flex` as a shorthand, so a bare `.pbl-shelf-sized` would lose however late it is
			// imported. Narrowed to the declaration and its selector; whether the cascade
			// actually resolves this way was measured in Chromium (400px honoured at 800, 500
			// and 380px window heights, `flex-shrink: 0`).
			const css = readFileSync('styles/shelf.css', 'utf8');
			expect(bodyOf(css, '.pbl-view .pbl-shelf.pbl-shelf-sized', 'styles/shelf.css')).toContain('flex-shrink: 0;');
		});

		it('is pushed to the foot of a band taller than its cards', () => {
			// `position: sticky` never MOVES an element — it holds one inside its scrollport when
			// scrolling would carry it away, and does nothing at all otherwise. A band with a
			// picked height and less content than that leaves the grip in flow, directly under the
			// last group: measured in the browser harness with every type group folded and a 400px
			// pick, the grip's bottom sat 139px above the band's foot, and −5px with this margin
			// (which is where it sits when the band DOES overflow, so the two states now agree).
			//
			// Scoped to `.pbl-shelf-sized` in both directions. An unpicked band is `height: auto`,
			// so its grip is already at the foot and there is no free space for an auto margin to
			// consume — and the base rule's `margin-block-start: calc(-1 * var(--size-4-2))` is the
			// gap-cancel extension 1e's measurement depends on, which an unscoped `auto` would
			// silently drop. Measured: the unpicked band stayed at 219px.
			const css = readFileSync('styles/shelfControls.css', 'utf8');
			expect(bodyOf(css, '.pbl-shelf-sized .pbl-shelf-grip', 'styles/shelfControls.css')).toContain(
				'margin-block-start: auto;',
			);
			// And the base rule keeps the negative pull, which is what the unpicked band is sized by.
			expect(bodyOf(css, '.pbl-shelf-grip', 'styles/shelfControls.css')).toContain(
				'margin-block-start: calc(-1 * var(--size-4-2));',
			);
		});
	});

	describe('which edge it sits on', () => {
		/** A grid axis, where the shelf renders AFTER the timeline and so sits at the frame's foot. */
		const datedShelf = (): HTMLElement => {
			const { containerEl } = roadmapView(shelfHeavyVault(), {
				startProperty: 'note.start',
				targetProperty: 'note.due',
			});
			const el = shelfOf(containerEl);
			if (!el) throw new Error('no shelf');
			return el;
		};

		it('leads the band that sits BELOW the axis, and trails the one that leads', () => {
			// The grip belongs on the edge the band and the axis SHARE, which is the whole rule
			// — not "the foot", which is only where that edge happens to be when the shelf leads
			// the frame. Moved in the DOM rather than by `order`, so the tab stop is where the
			// strip is drawn: `styles/shelf.css` says outright that reordering a focusable thing
			// out of its reading order on this band must not happen.
			expect(datedShelf().firstElementChild?.hasClass('pbl-shelf-grip')).toBe(true);

			const { containerEl } = makeRoadmap(horizonVault());
			expect(shelfOf(containerEl)?.lastElementChild?.hasClass('pbl-shelf-grip')).toBe(true);
		});

		it('makes UP taller where it sits at the top, the mirror of the foot’s own sign', () => {
			// One flag decides both halves, so the pointer and the keys cannot disagree about
			// which way is bigger: a grip at the top grows the band when it is dragged up, and
			// the horizon axis's own test above grows it when dragged DOWN.
			const el = datedShelf().querySelector<HTMLElement>('.pbl-shelf-grip');
			if (!el) throw new Error('no shelf resize grip');
			el.dispatchEvent(pointer('pointerdown', 0));
			el.dispatchEvent(pointer('pointerup', -200));
			expect(el.getAttribute('aria-valuenow')).toBe(String(MIN_SHELF_HEIGHT_PX + 200));
		});

		it('takes the band’s block gutter with it, on the open band alone', () => {
			// Both edges, and for two different reasons: the foot has nothing pinned to it any
			// more, so the last row of cards would end 4px from the border while the cards beside
			// it keep 12px; the head is where the strip now is, and at 4px it sat flush against
			// the header with the flex gap cancelled under it. jsdom resolves no cascade — what is
			// checkable here is the class and the rule it turns on, and the two are one decision
			// made in `render/shelf.ts`.
			expect(datedShelf().hasClass('pbl-shelf-below')).toBe(true);
			const css = readFileSync('styles/shelf.css', 'utf8');
			// The `:not()` pair is the load-bearing half: a collapsed or empty band draws no grip,
			// so an unscoped gutter is 16px reserved for a control that is not there.
			const gutter = bodyOf(
				css,
				'.pbl-shelf-below:not(.pbl-shelf-collapsed):not(.pbl-shelf-empty)',
				'styles/shelf.css',
			);
			expect(gutter).toContain('padding-block: var(--size-4-3);');
			// And the strip's own offsets are mirrored with it — sticky to the top, docked flush
			// to the border by the gutter it has to scroll out from under, and the foot's
			// gap-cancel dropped so the flex gap is the air between the handle and the header.
			const chrome = readFileSync('styles/shelfControls.css', 'utf8');
			const body = bodyOf(chrome, '.pbl-shelf-below .pbl-shelf-grip', 'styles/shelfControls.css');
			expect(body).toContain('top: calc(-1 * var(--size-4-3));');
			expect(body).toContain('bottom: auto;');
			// The sized band's `margin-block-start: auto` pushes the strip to the foot — which is
			// exactly what must NOT happen here, and this file's order is what overrules it.
			expect(body).toContain('margin-block-start: 0;');
			expect(body).toContain('margin-block-end: 0;');
		});

		it('is opaque, so the band’s own rows cannot scroll through the strip', () => {
			// The strip is STICKY, which holds its place while the content goes past it — so a
			// transparent one shows the band's rows sliding through the 8px a reader grabs.
			// Measured at a 40px scroll on the dated axis before this: the header sat 36px inside
			// the strip. Padding cannot reserve that room, because the band IS the scrollport and
			// a scroll container's block padding scrolls away with its content. Asserted on the
			// rule BOTH arrangements share: the foot strip is sticky too and had the same hole.
			const chrome = readFileSync('styles/shelfControls.css', 'utf8');
			expect(bodyOf(chrome, '.pbl-shelf-grip', 'styles/shelfControls.css')).toContain(
				'background-color: var(--background-secondary);',
			);
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
