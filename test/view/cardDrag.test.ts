// @vitest-environment jsdom
// The edges of the drag controller both card projections ride: what a move says
// when the projection that would name it is not on screen, and what a drop does
// when the note it was carrying is gone by the time it lands.
import { describe, expect, it, vi } from 'vitest';
import { BacklogItem } from '../../src/domain/model';
import { BacklogViewHost } from '../../src/view/host';
import { ProductBacklogView } from '../../src/view/backlogView';
import { CardDragController } from '../../src/view/interactions/cardDrag';
import { flush, makeView, refresh, useViewHarness } from '../helpers/view';
import { announced, cardDrag, gridDrag, overlayOf, pannedGrid, startCardDrag } from '../helpers/dnd';
import { boardVault, cardByTitle, columnByName, makeBoard } from '../helpers/board';
import { gripOf, horizonVault, makeRoadmap } from '../helpers/roadmap';
import { FakeVault } from '../helpers/vault';

useViewHarness();

function itemAt(view: ProductBacklogView, path: string): BacklogItem {
	const item = view.model?.byPath.get(path);
	if (!item) throw new Error(`no item loaded: ${path}`);
	return item;
}

describe('a card move made while its projection is not on screen', () => {
	it('moves the card and announces nothing — no columns, no vocabulary to say it in', async () => {
		vi.useFakeTimers();
		const vault = boardVault();
		const { view } = makeBoard(vault);
		// Back in the tree, `performBoardMove` is still the one place a board move is
		// planned and announced — but the columns whose labels would name the move
		// are not drawn, so there is nothing truthful to announce.
		view.setProjection('tree');

		const moved = await view.performBoardMove(itemAt(view, 'Epic A.md'), 'Done');

		// The move is not withheld, only the sentence about it — and that is what
		// makes the silence readable rather than vacuous: the write is the proof the
		// announcement was reached at all.
		expect(moved).toBe(true);
		expect(vault.fm('Epic A.md')['status']).toBe('Done');
		expect(await announced()).toBe('');
	});

	it('places the card and announces nothing — the same rule on the roadmap’s buckets', async () => {
		vi.useFakeTimers();
		const vault = horizonVault();
		const { view } = makeRoadmap(vault);
		view.setProjection('tree');

		const moved = await view.performHorizonMove(itemAt(view, 'Now item.md'), 'Later');

		expect(moved).toBe(true);
		expect(vault.fm('Now item.md')['horizon']).toBe('Later');
		expect(await announced()).toBe('');
	});
});

describe('a drop whose note went away mid-drag', () => {
	it('lands, resolves to nothing and writes nothing', async () => {
		const vault = boardVault();
		const { view, containerEl } = makeBoard(vault);
		const drop = startCardDrag(cardByTitle(containerEl, 'Epic A'));

		// The note is deleted while the card is in the air and Bases hands the view
		// the smaller result set: the columns are rebuilt, and the path the drag is
		// carrying now names nothing.
		vault.files.delete('Epic A.md');
		refresh(view, vault);
		drop(columnByName(containerEl, 'Done'));
		await flush();

		expect(vault.writeLog).toHaveLength(0);

		// And the rebuilt column is a live target: the same gesture with a note that
		// still exists writes through it, so the silence above is not a dead target.
		// Resolving the missing path to any item instead fails the assertion above;
		// dropping the `item` guard fails the RUN rather than the assertion, on the
		// TypeError the plan then throws for an item that is not there.
		cardDrag(cardByTitle(containerEl, 'Epic B'), columnByName(containerEl, 'Done'));
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Epic B.md']);
	});
});

describe('a positional drag whose note is gone by the time the grid resolves it', () => {
	it('previews nothing and writes nothing', async () => {
		// The dated axis's grid is the one target `wirePositionalTarget` wires
		// (`interactions/timelineDrag.ts`), and its `canDrop` checks only the view
		// token, not resolvability — so a vanished note reaches `report`'s and
		// `onDrop`'s own `if (resolved)` guards rather than being refused earlier, the
		// same way the region target above is. Taken straight out of the live model
		// rather than a full `refresh`, which would rebuild the grid and its
		// listeners along with everything else and drop the gesture with them.
		const vault = new FakeVault();
		vault.addFile('Planned.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' },
		});
		const harness = makeView(vault, { startProperty: 'note.start', targetProperty: 'note.target' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		// 700, matching the other grid fixtures' placing tests, keeps the pointer well
		// clear of the sticky lead column — a coordinate that landed there would take
		// `onDrag`'s and `onDrop`'s OWN early return before ever reaching `resolved`,
		// which would make this pass whether or not `report`'s guard does its job.
		const at = pannedGrid(harness.containerEl, { rectLeft: 220, scrollLeft: 640 });

		const gesture = gridDrag.start(gripOf(harness.containerEl, 'Planned', 'body'), { clientX: at(700) });
		harness.view.model?.byPath.delete('Planned.md');

		const overlay = overlayOf(harness.containerEl);
		gesture.over(overlay, { clientX: at(700) });
		expect(overlay.querySelector('.pbl-drop-ghost')).toBeNull();
		gesture.drop(overlay, { clientX: at(700) });
		await flush();

		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('a link-kind payload against an ordinary drop target', () => {
	it('wireDropTarget refuses a link by construction, with no accepts filter of its own', async () => {
		// The category guarantee this proves: a target registered the everyday way —
		// `wireDropTarget` with no fourth argument, no `accepts` — refuses a link drag
		// BY CONSTRUCTION, never by an incidental filter the target happens to carry.
		// The dated shelf's own "does not unschedule" test cannot stand for this one: its
		// `accepts: (source) => source.hold === 'body'` already refuses a link on its own
		// (a link's `hold` is always null), so that test passes whether or not `mine()`
		// does its job. This one wires no such filter, so only the gate can be refusing.
		//
		// Built directly on the controller rather than through a rendered view: a real
		// connector and a real "ordinary" target (a board column, a horizon bucket) are
		// never on screen together — connectors exist only on the dated axis, those
		// targets only on the other projections — so there is no DOM path that reaches
		// this case through the UI. `CardDragController` reads nothing off `host` except
		// `model.byPath`, so a minimal fake host is the real controller under test, not a
		// stand-in for one.
		const item = { file: { path: 'Alpha.md' } } as unknown as BacklogItem;
		const host = { model: { byPath: new Map([['Alpha.md', item]]) } } as unknown as BacklogViewHost;
		const viewEl = document.body.createDiv();
		const dnd = new CardDragController(host, viewEl);
		const source = viewEl.createDiv();
		const target = viewEl.createDiv();
		const plan = vi.fn();

		dnd.wireLinkSource(source, item, { onStart: () => {}, onEnd: () => {} });
		dnd.wireDropTarget(target, plan);

		cardDrag(source, target);
		await flush();

		expect(plan).not.toHaveBeenCalled();
	});

	it('refuses a drop whose SOURCE note was replaced at the same path mid-gesture', async () => {
		// The identity rule the target side already keeps (`drop` in `linkDrag.ts` compares
		// `.file`, never the path), asked of the source. A payload names a path and
		// `resolve` looks it up in the model that exists at DROP time, so a note deleted
		// and another created under the same name while the gesture is held satisfies the
		// lookup while being a different note — and the write lands on something the user
		// never picked up.
		//
		// Asked of the CONTROLLER rather than of the link gesture, because `resolve` is
		// what every drag in this view goes through: a board move, a bucket, the shelf and
		// a link all carry the same payload shape, so a guard checked through one of them
		// says nothing about the other three. Same minimal fake host as the test above.
		// Fuller than the fake above, because `wireCard`'s payload reads the note's stated
		// dates and its type at drag START (`statedSpan`, `placementEnds`) — a thinner one
		// throws inside `getInitialData`, pragmatic never registers the drag, and the test
		// passes having driven nothing at all. That is how the first draft of this test
		// went green against the bug it was written for.
		const fake = (path: string): BacklogItem =>
			({
				file: { path },
				typeName: 'PBI',
				plannedStart: { value: null, invalid: false },
				plannedTarget: { value: null, invalid: false },
			}) as unknown as BacklogItem;
		const item = fake('Alpha.md');
		const byPath = new Map([['Alpha.md', item]]);
		const host = { model: { byPath } } as unknown as BacklogViewHost;
		const viewEl = document.body.createDiv();
		const dnd = new CardDragController(host, viewEl);
		const card = viewEl.createDiv();
		const target = viewEl.createDiv();
		const plan = vi.fn();

		dnd.wireCard(card, item);
		dnd.wireDropTarget(target, plan);

		const drop = startCardDrag(card);
		// Same path, different file object — a delete-and-recreate, which is the one thing
		// a path compare cannot see. Watching this test fail is also the positive control:
		// without the guard `plan` IS called, so the gesture itself reaches the target.
		byPath.set('Alpha.md', fake('Alpha.md'));
		drop(target);
		await flush();

		expect(plan).not.toHaveBeenCalled();
	});

	it('follows a RENAME of the dragged note mid-gesture rather than cancelling', async () => {
		// The other half of the same rule, and the half a path-keyed payload gets wrong in
		// the opposite direction. Obsidian renames by mutating the one `TFile` in place, so
		// a note renamed while the gesture is held keeps its identity and changes its path
		// — and a lookup keyed by the path captured at drag START then finds nothing and
		// cancels a drop that was entirely valid.
		//
		// So the payload's file is the lookup key as well as the confirmation: its `.path`
		// is always the note's CURRENT path, which is exactly why the captured string is
		// not. Same fact `src/storage/CLAUDE.md` leans on for the dependency undo — a
		// rename mutates in place, a deletion does not — used here for the other question.
		const fake = (path: string): BacklogItem =>
			({
				file: { path },
				typeName: 'PBI',
				plannedStart: { value: null, invalid: false },
				plannedTarget: { value: null, invalid: false },
			}) as unknown as BacklogItem;
		const item = fake('Alpha.md');
		const byPath = new Map([['Alpha.md', item]]);
		const host = { model: { byPath } } as unknown as BacklogViewHost;
		const viewEl = document.body.createDiv();
		const dnd = new CardDragController(host, viewEl);
		const card = viewEl.createDiv();
		const target = viewEl.createDiv();
		const plan = vi.fn();

		dnd.wireCard(card, item);
		dnd.wireDropTarget(target, plan);

		const drop = startCardDrag(card);
		// The one file object, mutated — and the model rebuilt under its new key. Nothing
		// was deleted and nothing created, so this drop still means what it meant.
		item.file.path = 'Renamed.md';
		byPath.delete('Alpha.md');
		byPath.set('Renamed.md', item);
		drop(target);
		await flush();

		expect(plan).toHaveBeenCalledTimes(1);
		expect(plan.mock.calls[0][0].item).toBe(item);
	});
});

describe('a Bases update that re-renders mid-gesture', () => {
	it('still takes the drag state back off the view when the drop lands', async () => {
		// The class rides `.pbl-view`, which is built once and outlives every render, so
		// nothing else will ever take it off: a stale one leaves
		// `.pbl-dragging .pbl-timeline-drop { pointer-events: auto }` standing, and the
		// full-grid overlay then swallows every pointer event for the life of the view —
		// no row hover, no connector, no way to start another drag.
		//
		// What makes that reachable is the render pass: `onRenderStart` unhooks every
		// draggable this controller registered, and pragmatic resolves a source's own
		// callbacks out of its registry AT DISPATCH TIME ("a draggable can be … removed
		// completely"), so the `draggable`'s `onDrop` is skipped for a gesture that
		// crossed a render. The drop itself still lands — the target under the pointer is
		// a live element the new pass registered — which is exactly why the stale class
		// goes unnoticed until the pane stops responding.
		const vault = new FakeVault();
		vault.addFile('Planned.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-04', target: '2026-08-10' } });
		const { view, containerEl } = makeView(vault, { startProperty: 'note.start', targetProperty: 'note.target' }, { collapsed: true });
		view.setProjection('roadmap');
		const viewEl = containerEl.querySelector<HTMLElement>('.pbl-view');
		if (!viewEl) throw new Error('no view element');

		const gesture = gridDrag.start(gripOf(containerEl, 'Planned', 'body'), { clientX: 300 });
		gesture.over(overlayOf(containerEl), { clientX: 300 });
		expect(viewEl.classList.contains('pbl-dragging')).toBe(true);

		refresh(view, vault);
		// The overlay is re-queried on purpose: the one the gesture entered was destroyed
		// by that render, and the drop lands on the element the new pass drew.
		gesture.drop(overlayOf(containerEl), { clientX: 300 });
		await flush();

		expect(viewEl.classList.contains('pbl-dragging')).toBe(false);
	});
});
