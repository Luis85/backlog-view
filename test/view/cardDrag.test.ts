// @vitest-environment jsdom
// The edges of the drag controller both card projections ride: what a move says
// when the projection that would name it is not on screen, and what a drop does
// when the note it was carrying is gone by the time it lands.
import { describe, expect, it, vi } from 'vitest';
import { BacklogItem } from '../../src/domain/model';
import { ProductBacklogView } from '../../src/view/backlogView';
import { flush, refresh, useViewHarness } from '../helpers/view';
import { announced, cardDrag, startCardDrag } from '../helpers/dnd';
import { boardVault, cardByTitle, columnByName, makeBoard } from '../helpers/board';
import { horizonVault, makeRoadmap } from '../helpers/roadmap';

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
