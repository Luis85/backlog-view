// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu } from '../helpers/obsidian-mock';
import { flush, makeView, refresh, rowByTitle, useViewHarness } from '../helpers/view';
import { barFor, gripNames, rowFor, shelfOf } from '../helpers/roadmap';
import { cardDrag, gridDrag, overlayOf, pannedGrid } from '../helpers/dnd';
import { legalTargets } from '../../src/view/interactions/dependencies';
import { CardDragController } from '../../src/view/interactions/cardDrag';
import { BacklogItem, BacklogModel } from '../../src/domain/model';

useViewHarness();

const DEPS = { dependsOnProperty: 'note.dependsOn' };

/** B waits for A, C waits for B, D waits for nothing — a two-deep chain plus a loner. */
function chainVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' } });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' } });
	vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 40 } });
	return vault;
}

/**
 * A, B (waits for A) and C (waits for B) under an Epic parent — so filtering the Epic
 * out of the results still loads it as a genuine context row (`outsideFilter: true`),
 * an ancestor of every result, rather than dropping it from the model entirely. An
 * unrelated note excluded from `only` never loads at all (nothing pulls it in as
 * someone's ancestor), so it cannot stand in for this case — this fixture exists
 * because that distinction is exactly what the target-side guard is about.
 */
function ancestorVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 5 } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' }, parentLink: 'Epic' });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' }, parentLink: 'Epic' });
	return vault;
}

function itemFor(model: BacklogModel, path: string): BacklogItem {
	const item = model.byPath.get(path);
	if (!item) throw new Error(`no item: ${path}`);
	return item;
}

describe('which bars a link may be dropped onto', () => {
	function sweep(vault: FakeVault, from: string, only?: string[]) {
		const { view } = makeView(vault, DEPS, only ? { only } : {});
		const model = view.model;
		if (!model) throw new Error('no model');
		return { paths: [...legalTargets(view, model, itemFor(model, from))].map((f) => f.path).sort(), model, view };
	}

	it('refuses the source itself and anything already waiting for it', () => {
		// A is already B's prerequisite, so dropping A on B would write the line that is
		// on disk. A on A is the loop of length one.
		expect(sweep(chainVault(), 'A.md').paths).toEqual(['C.md', 'D.md']);
	});

	it('refuses a target the source waits on THROUGH a chain, not only directly', () => {
		// C waits for B waits for A. Dropping C onto A would make A wait for C and close
		// a three-node loop — a one-hop check would miss it and offer A.
		expect(sweep(chainVault(), 'C.md').paths).toEqual(['D.md']);
	});

	it('refuses a row the Base excluded, which is never a write target', () => {
		// Epic is a genuine context row here: it is A/B/C's parent, so `only` excluding it
		// from the results still loads it into the model as an ancestor — `outsideFilter:
		// true`, not simply absent. Nothing about its own dependency graph would disqualify
		// it as a target (it declares nothing, waits on nothing, closes no loop), so this
		// is the case that tells the target-side `outsideFilter` guard apart from a target
		// that was never a candidate to begin with.
		const { paths } = sweep(ancestorVault(), 'A.md', ['A.md', 'B.md', 'C.md']);
		expect(paths).toEqual(['C.md']);
	});

	it('reads the key the first write would BIND, so an unbound option hides no edges', () => {
		// No `DEPS`: the option is unnamed, which is the configuration
		// [[Bind a property by using it]] made the connector and this drag available in.
		// The MODEL reads nothing there — its key is '' — so a sweep asked of it called
		// every bar legal, marked none, and let the drop be refused afterwards, which is
		// exactly what extension 2a says a gesture must not do. `dependsOn` is the Tasks
		// plugin's own name, so a vault already carrying it is not a corner case here; it
		// is the vault the feature was built to meet.
		const { view } = makeView(chainVault());
		const model = view.model;
		if (!model) throw new Error('no model');

		// B already waits for A on disk, and A onto A is the loop of length one — the same
		// two refusals the bound case gives above, from a key nothing has named yet.
		expect([...legalTargets(view, model, itemFor(model, 'A.md'))].map((f) => f.path).sort()).toEqual(['C.md', 'D.md']);
	});

	it('refuses a target whose existing entry never resolved into a real edge', () => {
		// B names A twice, once bare and once bracketed. Both spellings are B's own
		// declaration, so A must not be offered for B however the line reads.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: ['A', '[[A]]'] } });
		expect(sweep(vault, 'A.md').paths).toEqual([]);
	});
});

describe('a milestone is a point in time, so it waits for nothing', () => {
	/** A milestone, an ordinary PBI, and a milestone that has typed a dependency anyway. */
	function markerVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 20, dependsOn: '[[Work]]' } });
		return vault;
	}

	it('ignores a dependency a milestone declares, however it got there', () => {
		// Read at the source (`readItems`), so every consequence falls out at once rather
		// than each surface remembering: no edge, no arrow, no conflict, nothing in the
		// declared map. A note retyped to Milestone after the fact keeps the key on disk —
		// this is what stops it meaning anything.
		const { view } = makeView(markerVault(), DEPS);
		const model = view.model;
		if (!model) throw new Error('no model');

		expect(itemFor(model, 'Ship.md').dependsOnEntries).toEqual([]);
		expect(itemFor(model, 'Ship.md').prerequisites).toEqual([]);
	});

	it('is never a legal drop target, because dropping onto a bar is what makes it wait', () => {
		// The direction that matters: dragging A onto B writes to B. A milestone is never
		// the one that waits, so it is never a target — and this falls out of `candidates`
		// returning nothing for it rather than from a second rule at the drop.
		const { view } = makeView(markerVault(), DEPS);
		const model = view.model;
		if (!model) throw new Error('no model');

		expect([...legalTargets(view, model, itemFor(model, 'Work.md'))].map((f) => f.path)).toEqual([]);
	});

	it('still takes part from the other end: another item may wait FOR it', () => {
		// The half deliberately kept. `Work` waiting on `Ship` is Work's declaration, not
		// the milestone's, so the milestone is offered as a target's prerequisite and the
		// edge is real — which is why the milestone keeps its own connector to drag from.
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10 } });
		vault.addFile('Work.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[Ship]]' } });
		const { view } = makeView(vault, DEPS);
		const model = view.model;
		if (!model) throw new Error('no model');

		expect(itemFor(model, 'Work.md').prerequisites.map((p) => p.file.path)).toEqual(['Ship.md']);
		// And a THIRD item may still be dropped onto Work, which is unaffected by any of this.
		vault.addFile('Other.md', { frontmatter: { type: 'PBI', order: 30 } });
		const fresh = makeView(vault, DEPS).view.model;
		if (!fresh) throw new Error('no model');
		expect([...legalTargets(view, fresh, itemFor(fresh, 'Other.md'))].map((f) => f.path)).toContain('Work.md');
	});

	it('offers neither dependency menu entry on a milestone', () => {
		// Both, not just `Depends on…`: `Remove dependency…` would open onto the empty list
		// the reader now gives a marker, which is an entry that cannot act.
		const { view, containerEl } = makeView(markerVault(), DEPS);
		const titlesOn = (title: string): string[] => {
			rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
			return (Menu.lastShown?.items ?? []).map((item) => item.titleText);
		};
		const marker = titlesOn('Ship');
		const ordinary = titlesOn('Work');

		expect(marker).not.toContain('Depends on…');
		expect(marker).not.toContain('Remove dependency…');
		// The control: the same menu on an ordinary row does offer it, so this is the type
		// deciding rather than the fixture failing to configure the feature.
		expect(ordinary).toContain('Depends on…');
		expect(view.model).not.toBeNull();
	});
});

const DATE_AXIS = { startProperty: 'note.start', targetProperty: 'note.due' };

function datedLinkView(vault: FakeVault, values: Record<string, unknown> = { ...DATE_AXIS, ...DEPS }) {
	const harness = makeView(vault, values, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('dates');
	return harness;
}

function barVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Alpha.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' } });
	vault.addFile('Beta.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-20', due: '2026-08-28' } });
	return vault;
}

function connectorFor(containerEl: HTMLElement, title: string): HTMLElement | null {
	return barFor(containerEl, title).querySelector<HTMLElement>('.pbl-bar-connector');
}

describe('the connector on a drawn bar', () => {
	it('is drawn on a result bar when the dependency key is bound', () => {
		const { containerEl } = datedLinkView(barVault());
		expect(connectorFor(containerEl, 'Alpha')).not.toBeNull();
	});

	it('does not open the note when it is clicked without a drag', () => {
		// A tap that never travels far enough to become a drag still fires `click`, and
		// the connector sits inside the row `wireCardActivation` wired — whose handler is
		// unfiltered and opens the note. So the one control on the bar labelled "Draw a
		// dependency from…" did the one thing the rest of the row does, and did it most
		// often on a hoverless device, where the dot is permanently visible and every
		// interaction is a tap. The house answer is the control's own guard, which
		// `.pbl-card-kid` and the chevron already carry (`stopPropagation`, per control,
		// with the reason beside each) rather than a filter inside the shared handler.
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		const dot = connectorFor(containerEl, 'Alpha');

		dot?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		// Middle click never fires `click`, so it needs its own guard or it reaches the
		// row's `auxclick` and opens the note in a new tab by the one route the primary
		// guard does not cover — `.pbl-card-kid`'s own second listener, same reason.
		dot?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));

		expect(vault.opened).toEqual([]);
	});

	it('is drawn with the dependency key unbound, because the write is what binds it', () => {
		// The gate used to be the bound key, which withheld the handle from exactly the
		// base that had never named the property — and Obsidian's picker cannot offer a
		// property no note carries, so that base had no way to bind one but ✨ or a
		// hand-edited note. `Bind a property by using it` is the note.
		const { containerEl } = datedLinkView(barVault(), DATE_AXIS);
		expect(connectorFor(containerEl, 'Alpha')).not.toBeNull();
	});

	it('is absent when the option is CLEARED, which is the user saying not this', () => {
		// The one configuration the feature is still off in. Cleared and never-set resolve
		// identically in the settings, so the question is asked of the CONFIG — the same
		// rule `adoptableProperties` keeps for ✨.
		const { containerEl } = datedLinkView(barVault(), { ...DATE_AXIS, dependsOnProperty: '' });
		expect(connectorFor(containerEl, 'Alpha')).toBeNull();
	});

	it('is offered on an INFERRED bar, which has no date grip at all', () => {
		// A parent stating no dates of its own, drawn from its child's. `barHolds`
		// withholds every grip because there is no baseline to move from; a link claims
		// no date, so it needs none.
		const vault = new FakeVault();
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10 } });
		vault.addFile('Kid.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', due: '2026-08-10' },
			parentLink: 'Parent',
		});
		const { containerEl } = datedLinkView(vault);
		expect(gripNames(containerEl, 'Parent')).toEqual([]);
		expect(connectorFor(containerEl, 'Parent')).not.toBeNull();
	});

	it('marks a bar whose end the window clamps, so its connector can sit inside the grid', () => {
		// Far enough out that the window exceeds MAX_TIMELINE_DAYS and clamps around
		// today, leaving this bar's end off the drawn grid.
		const vault = barVault();
		vault.addFile('Far.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-08-04', due: '2036-08-04' } });
		const { containerEl } = datedLinkView(vault);
		const bar = barFor(containerEl, 'Far');
		expect(bar.classList.contains('pbl-bar-clipped-end')).toBe(true);
		expect(bar.querySelector('.pbl-bar-connector')).not.toBeNull();
	});

	it('is absent where no bar is drawn at all', () => {
		// Wholly outside the window: `barClasses` returns early with pbl-bar-outside and
		// there is no on-screen end for a handle to sit past.
		const vault = barVault();
		vault.addFile('Ancient.md', { frontmatter: { type: 'PBI', order: 30, start: '1990-01-01', due: '1990-02-01' } });
		const { containerEl } = datedLinkView(vault);
		const bar = barFor(containerEl, 'Ancient');
		expect(bar.classList.contains('pbl-bar-outside')).toBe(true);
		expect(bar.querySelector('.pbl-bar-connector')).toBeNull();
	});
});

describe('what wiring a bar costs, and which configuration still pays nothing', () => {
	// A few hundred rows is the scaling limit `src/view/CLAUDE.md`'s "Cost" section
	// states, and a `dropTargetForElements` registration per bar (plus its cleanup, every
	// render pass) is real work — `wireBarLink`'s early return is what keeps it at zero
	// rather than one per bar. What the gate ASKS changed on 2026-08-11: it used to be the
	// bound key, so an unnamed property paid nothing; it is now `dependenciesAvailable`,
	// so only a CLEARED option does. That is the saving handed back, measured here rather
	// than described, which is why the unbound case is asserted at one-per-bar instead of
	// being dropped. Driven through `CardDragController.prototype.wireDropTarget` — the
	// same seam `test/view/cardDrag.test.ts`'s construction test reaches the controller
	// through — because nothing on the rendered DOM distinguishes "no target registered"
	// from "a target registered that nothing can ever satisfy". The spy starts only after
	// the view is fully constructed and settled, and a plain `refresh` is what is
	// measured: setup itself (`setProjection`, `setAxisPick`) is more than one render
	// pass, and counting across all of them would make the assertion about how many times
	// THIS SUITE happens to render rather than about one pass's cost.
	const linkTargetsOn = (values: Record<string, unknown>): unknown[] => {
		const vault = barVault();
		const { view } = datedLinkView(vault, values);
		const spy = vi.spyOn(CardDragController.prototype, 'wireDropTarget');
		refresh(view, vault);
		return spy.mock.calls.filter((call) => call[3] === 'link');
	};

	it('registers no link drop target on any bar when the option is cleared', () => {
		expect(linkTargetsOn({ ...DATE_AXIS, dependsOnProperty: '' })).toHaveLength(0);
	});

	it('registers one per bar with the key unbound, which is the cost of the handle being there', () => {
		expect(linkTargetsOn(DATE_AXIS)).toHaveLength(2);
	});

	it('registers one link drop target per bar once the key is bound', () => {
		// The gate itself is falsifiable, not only its absence: with the key bound, the
		// two bars in `barVault()` each still get one — the count a link drag actually
		// needs, so the cleared case above is measuring the gate and not a helper that
		// wires nothing regardless.
		expect(linkTargetsOn({ ...DATE_AXIS, ...DEPS })).toHaveLength(2);
	});
});

/** The whole gesture: pick the connector up, cross a bar, release on it. */
function linkDrag(connector: HTMLElement, targetBar: HTMLElement): void {
	cardDrag(connector, targetBar);
}

describe('drawing a dependency from one bar to another', () => {
	it('writes to the bar dropped ONTO, which is the one that waits', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(vault.fm('Beta.md')['dependsOn']).toEqual(['[[Alpha]]']);
		expect(vault.fm('Alpha.md')['dependsOn']).toBeUndefined();
	});

	it('changes no date, on either note', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(vault.fm('Beta.md')['start']).toBe('2026-08-20');
		expect(vault.fm('Beta.md')['due']).toBe('2026-08-28');
		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});

	it('writes nothing when released on an illegal target', async () => {
		// Beta already waits for Alpha, so Alpha onto Beta would write the line on disk.
		const vault = barVault();
		vault.fm('Beta.md')['dependsOn'] = ['[[Alpha]]'];
		const { containerEl } = datedLinkView(vault);
		const before = JSON.stringify(vault.fm('Beta.md'));
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Beta'));
		await flush();

		expect(JSON.stringify(vault.fm('Beta.md'))).toBe(before);
	});

	it('writes nothing when released on its own bar', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		linkDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, barFor(containerEl, 'Alpha'));
		await flush();

		expect(vault.fm('Alpha.md')['dependsOn']).toBeUndefined();
	});

	it('marks the illegal targets while the drag is held, and clears them when it ends', () => {
		const vault = barVault();
		vault.fm('Beta.md')['dependsOn'] = ['[[Alpha]]'];
		const { containerEl } = datedLinkView(vault);
		const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
		const viewEl = containerEl.querySelector<HTMLElement>('.pbl-view');
		if (!content || !viewEl) throw new Error('no content box or view element');
		expect(content.classList.contains('pbl-linking')).toBe(false);

		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);

		expect(content.classList.contains('pbl-linking')).toBe(true);
		expect(rowFor(containerEl, 'Beta')?.classList.contains('pbl-link-illegal')).toBe(true);
		expect(rowFor(containerEl, 'Alpha')?.classList.contains('pbl-link-source')).toBe(true);
		// `.pbl-dragging` is a CARD MOVE's own class, and a link reparents nothing
		// (`.pbl-linking` is its own class for exactly this reason). Asserted here, not
		// only left as a stylesheet comment, so a future tidy-up that reuses or
		// comma-joins the two is caught by a test rather than by a card-move affordance
		// appearing under a gesture that cannot use it.
		expect(viewEl.classList.contains('pbl-dragging')).toBe(false);

		gesture.cancel();
		// End of the gesture: nothing it drew may outlive it, on every element it marked —
		// not only the row `end` was named for. `.pbl-link-preview` is checked in the
		// preview-drawing test below, where one actually gets minted.
		expect(content.classList.contains('pbl-linking')).toBe(false);
		expect(rowFor(containerEl, 'Beta')?.classList.contains('pbl-link-illegal')).toBe(false);
		expect(rowFor(containerEl, 'Alpha')?.classList.contains('pbl-link-source')).toBe(false);
	});

	it('sweeps legality ONCE per drag, not once per frame', () => {
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		const model = view.model;
		if (!model) throw new Error('no model');
		// The sweep walks `byPath` once for itself and once per target inside
		// `candidates`; what matters is that crossing more bars adds none of that.
		const spy = vi.spyOn(model.byPath, 'values');
		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);
		const afterStart = spy.mock.calls.length;
		expect(afterStart).toBeGreaterThan(0);

		gesture.over(barFor(containerEl, 'Beta'), { clientX: 40 });
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 60 });
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 80 });

		expect(spy.mock.calls.length).toBe(afterStart);
		gesture.cancel();
	});

	it('draws the preview line while the pointer moves, minting it once and moving it after', async () => {
		// `wireLinkPointer`'s own `onDrag` rides the library's per-frame throttle
		// (`raf-schd`), unlike `onDragEnter`, so this is the one interaction in the suite
		// that needs a REAL animation frame rather than a synthetic event alone — and
		// letting one elapse also ticks the scroller's own auto-scroll loop
		// (`wireScroller`, registered on every timeline render), which polls a jsdom API
		// this harness deliberately never stubs (`dnd.ts`'s own comment on `cancel()`).
		// Stubbed locally and restored after, rather than in the shared harness: every
		// other test in the suite ends its gesture before a real frame ever elapses, so
		// nothing else needs it, and a global stub would hide that from them too.
		const original = (document as { elementsFromPoint?: (x: number, y: number) => Element[] }).elementsFromPoint;
		(document as { elementsFromPoint?: (x: number, y: number) => Element[] }).elementsFromPoint = () => [];
		try {
			const vault = barVault();
			const { containerEl } = datedLinkView(vault);
			const content = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
			if (!content) throw new Error('no content box');
			const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);

			gesture.over(barFor(containerEl, 'Beta'), { clientX: 40 });
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const line = content.querySelector('.pbl-link-preview-line');
			expect(line).not.toBeNull();
			expect(content.querySelectorAll('.pbl-link-preview').length).toBe(1);

			gesture.over(barFor(containerEl, 'Beta'), { clientX: 80 });
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			// The SAME layer and path, moved rather than replaced — one node per drag,
			// not one per frame.
			expect(content.querySelectorAll('.pbl-link-preview').length).toBe(1);
			expect(content.querySelector('.pbl-link-preview-line')).toBe(line);
			expect(line?.getAttribute('d')).toContain('80');

			gesture.cancel();
			// `end`'s own claim — "nothing the gesture drew may outlive it" — checked at
			// the one thing only this test ever draws: the SVG layer is gone, not merely
			// hidden, or a cancelled drag would leave a dead layer sitting over the grid.
			expect(content.querySelector('.pbl-link-preview')).toBeNull();
		} finally {
			(document as { elementsFromPoint?: (x: number, y: number) => Element[] }).elementsFromPoint = original;
		}
	});

	it('re-checks legality against the CURRENT model, not the snapshot taken at drag start', async () => {
		// The model object itself is mutated in place rather than driven through a
		// re-render: a re-render rewires every target from scratch (a fresh `dnd`
		// registration per row, same as any other render pass), which would tear down
		// the very gesture this test is mid-way through holding — the graph changing
		// underneath a LIVE registration, which a re-render can never exercise, is
		// exactly the case `drop`'s own comment is about.
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		const model = view.model;
		const alpha = model?.byPath.get('Alpha.md');
		const beta = model?.byPath.get('Beta.md');
		if (!model || !alpha || !beta) throw new Error('missing items');

		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);
		// Beta comes to already wait for Alpha while the gesture is held — closing the
		// very loop this drop would otherwise ask for.
		beta.prerequisites = [alpha];
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 10 });
		gesture.drop(barFor(containerEl, 'Beta'), { clientX: 10 });
		await flush();

		expect(vault.fm('Beta.md')['dependsOn']).toBeUndefined();
	});
});

describe('a render mid-drag mints a box the drag state cannot reach', () => {
	// `LiveLink`'s own comment: "A render pass rebuilds the grid wholesale and mints a
	// new box, so nothing here can outlive the frame it belongs to." `live` is keyed by
	// the CONTENT element, so a drop landing on the box a mid-drag refresh minted reads
	// `live.get(newContent)`, finds nothing, and `accepts` reads `?? false` — refused,
	// not merely stale. The mechanism is `renderTimeline` minting a fresh `.pbl-timeline-
	// content` every pass and `CardDragController.onRenderStart` tearing down every
	// registration wired to the old one first (`backlogView.ts`'s `cardDnd.onRenderStart()`
	// at the top of a render). Mirrors `cardDrag.test.ts`'s "a drop whose note went away
	// mid-drag": start a drag, force the same kind of refresh mid-gesture, and drop on
	// what the refresh drew.
	it('writes nothing and marks nothing on the box a mid-drag refresh mints', async () => {
		const vault = barVault();
		const { containerEl, view } = datedLinkView(vault);
		const before = JSON.stringify(vault.fm('Beta.md'));

		// The gesture starts on the OLD connector, which is what populates `live` keyed by
		// the OLD content box.
		const gesture = gridDrag.start(connectorFor(containerEl, 'Alpha') as HTMLElement);
		// The Bases round trip a mid-drag write can trigger: the grid is torn down and
		// redrawn from scratch, exactly as `refresh` already does for the board's columns
		// in `cardDrag.test.ts`'s "a drop whose note went away mid-drag".
		refresh(view, vault);
		const newContent = containerEl.querySelector<HTMLElement>('.pbl-timeline-content');
		if (!newContent) throw new Error('no content box after refresh');

		// The SAME gesture (same payload, same view token) crossing then dropping on the
		// bar the refresh drew — a freshly registered target with no `live` entry for the
		// box it belongs to. `over` first, as every other gesture in this suite does: the
		// adapter tracks eligibility from the hover events, so a bare `drop` with no
		// preceding `dragenter`/`dragover` never reaches a target's `canDrop` at all and
		// would pass whether or not the gate under test does its job.
		gesture.over(barFor(containerEl, 'Beta'), { clientX: 0 });
		gesture.drop(barFor(containerEl, 'Beta'), { clientX: 0 });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
		expect(JSON.stringify(vault.fm('Beta.md'))).toBe(before);
		expect(newContent.classList.contains('pbl-linking')).toBe(false);
	});
});

describe('a link drag is refused by the timeline grid and the dated shelf', () => {
	it('writes no date when released on the timeline grid', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		const at = pannedGrid(containerEl, { rectLeft: 320, scrollLeft: 90 });
		gridDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, overlayOf(containerEl), { clientX: at(400) });
		await flush();

		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});

	it('does not unschedule when released on the dated shelf', async () => {
		const vault = barVault();
		const { containerEl } = datedLinkView(vault);
		const shelf = shelfOf(containerEl);
		if (!shelf) throw new Error('no shelf');
		cardDrag(connectorFor(containerEl, 'Alpha') as HTMLElement, shelf);
		await flush();

		expect(vault.fm('Alpha.md')['start']).toBe('2026-08-04');
		expect(vault.fm('Alpha.md')['due']).toBe('2026-08-10');
	});
});
