// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Notice } from '../helpers/obsidian-mock';
import { Harness, flush, makeView, refresh, useViewHarness } from '../helpers/view';
import { announced, cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { barFor, laneOrder, lanesOf, shelfOf, shelfTitles } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';

useViewHarness();

/**
 * Every input to a resource move — the drag, the Alt+Up/Down ladder, the row menu's Set
 * assignee — and what each of them writes, keeps and says. `test/view/roadmapMoves.test.ts`
 * is this file's shape over the horizon axis; what the axis DRAWS is
 * `test/view/resourceLanes.test.ts`'s subject and is not repeated here.
 */

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/** A roadmap open on the resources axis, with Alice and Bob declared. */
function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	harness.view.setShelfCollapsed(false);
	return harness;
}

/** The header for a resource, which is one element of that resource's band. */
function laneHead(containerEl: HTMLElement, name: string): HTMLElement {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	if (!head) throw new Error(`no row for ${name}`);
	return head;
}

function shelf(containerEl: HTMLElement): HTMLElement {
	const el = shelfOf(containerEl);
	if (!el) throw new Error('the shelf is not rendered');
	return el;
}

describe('the one method a resource move lands on', () => {
	it('writes the name into the assignee property and touches nothing else', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');

		expect(moved).toBe(true);
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		// A row is who and a date is when: the bar's own dates are not a side effect of
		// which row it lands in.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('removes the key rather than blanking it, and undo puts it back', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, null);
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('re-picking the name the note already holds writes nothing and keeps the undo', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');
		expect(vault.writeLog).toHaveLength(1);

		// Case-insensitively, the same matching that put `Cased` in Alice's row.
		const moved = await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, 'ALICE');

		expect(moved).toBe(false);
		expect(vault.writeLog).toHaveLength(1);
		// The slot still holds the first move, not the no-op.
		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('3c — the write lands on a dateless card, and says why nothing entered a row', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// The assignee changes and nothing visibly moves: `Undated` has no date to be
		// positioned at, so it stays on the shelf under its new owner. Said out loud rather
		// than left looking like a drop that missed.
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Bob');

		expect(moved).toBe(true);
		expect(vault.fm('Undated.md')['assignee']).toBe('Bob');
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Bob. Add a start or target date to place it in the row.',
		);
	});

	it('1e — a shelved card dropped on the resource it already names says so anyway', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// Nothing is written and the undo slot is untouched, exactly as 1a — but unlike a
		// bar that stayed where the cursor found it, a shelved card that stays shelved
		// gives the reader no other way to tell the drop landed on an unchanged value.
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Alice');

		expect(moved).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Alice. Add a start or target date to place it in the row.',
		);
	});

	it('says nothing at all when a placed bar is dropped on its own row', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Alice');

		expect(moved).toBe(false);
		// 1a: a bar that stayed exactly where the cursor found it already answers the
		// question, so the shelved card's notice must not fire here.
		expect(Notice.messages).toEqual([]);
	});
});

describe('what a resource move announces', () => {
	it('names the rows on screen, in both directions', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');

		await view.performResourceMove(view.model?.byPath.get('Stray.md') as never, null);
		expect(await announced()).toBe('Moved "Stray" from Zoe to Unplaced');
	});

	it('names a row in the casing on screen, never the casing on the note', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Cased` says `alice`; the row it renders in says `Alice`.
		await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Cased" from Alice to Bob');
	});

	it('names a resource no row draws, rather than calling the note silent', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Undated` names Alice and has no date to sit at, so this axis mints no row for
		// it — but the note plainly says Alice, and "from Unplaced" would be a lie about
		// it. This is where the two axes' labels differ, and why they had to.
		await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Undated" from Alice to Bob');
	});

	it('names an empty key rather than reporting a real cleanup as no change', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		// The stub the ✨ backfill leaves: the key is there and says nothing, and removing
		// it is a real, undo-consuming write.
		vault.addFile('Stub.md', { frontmatter: { type: 'Epic', order: 10, assignee: '' } });
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Stub.md') as never, null);

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Stub" from an empty assignee to Unplaced');
	});
});

describe('moving between resources by drag', () => {
	it('dropping a bar on another row’s header writes that resource, and nothing else', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		// Dragging between rows changes only who it is assigned to.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('the whole band takes the drop, not only its header', async () => {
		// A header, its bars and the excluded notes it places are siblings over one shared
		// day grid — there is no container to wire, so every element of the band is a
		// target of its own and a drop on a NEIGHBOUR'S bar row means that neighbour.
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const aliceRow = barFor(containerEl, 'Cased').closest<HTMLElement>('.pbl-timeline-row');

		cardDrag(barFor(containerEl, 'Stray'), aliceRow as HTMLElement);
		await flush();

		expect(vault.fm('Stray.md')['assignee']).toBe('Alice');
	});

	it('the element under the drag highlights, and the highlight dies with the gesture', () => {
		const { containerEl } = laneRoadmap(resourceVault());
		const bob = laneHead(containerEl, 'Bob');

		cardDrag(barFor(containerEl, 'Alice dated'), bob);

		expect(bob.hasClass('pbl-drop-over')).toBe(false);
	});

	it('drags off the shelf into a row, the same single write', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		expect(shelfTitles(containerEl).sort()).toEqual(['Nobody', 'Undated']);

		cardDrag(cardByTitle(containerEl, 'Nobody'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Nobody.md')['assignee']).toBe('Bob');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('drops on the shelf to un-assign, and undo puts the name back', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), shelf(containerEl));
		await flush();
		// Removed, not blanked: an empty value would read as a row named nothing.
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('a minted row is a target like any other — observed vocabulary is writable', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Zoe'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Zoe');
	});

	it('renders in its new row on the write’s own refresh', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();
		refresh(view, vault);

		// Where a bar renders is the note's own frontmatter and nothing else, which is
		// what makes that one write the whole of the move.
		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'Cased', 'lane:Bob', 'Alice dated', 'lane:Zoe', 'Stray']);
	});

	it('config problems block a resource move, exactly as every other write', async () => {
		const vault = resourceVault();
		// Parent and order share a key: the gate must refuse everything.
		const { containerEl } = laneRoadmap(vault, { orderProperty: 'note.parent' });

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('offers no date grip here, and registers no positional target for one', () => {
		// The half that must NOT come back with the drag: a bar on this axis is an ordinary
		// card — hold `null`, no baseline, no ends — because a move here writes an assignee.
		// The overlay is what a date gesture lands on, and it is not drawn: left in place it
		// would take pointer events for the whole day area while a drag is live and swallow
		// every drop the rows above are the target for.
		const { containerEl } = laneRoadmap(resourceVault());

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(true);
	});

	it('leaves the dated axis’s own overlay and grips alone', () => {
		// The control beside the case above: the withholding is per axis, not a deletion.
		const { view, containerEl } = laneRoadmap(resourceVault());

		view.setAxisPick('dates');

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(false);
	});
});
