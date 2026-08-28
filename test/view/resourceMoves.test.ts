// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { Harness, flush, key, makeView, refresh, treeOf, useViewHarness } from '../helpers/view';
import { announced, cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { barFor, laneHead, laneNames, laneOrder, laneRoadmap as bareLaneRoadmap, shelfOf, shelfTitles } from '../helpers/roadmap';
import { resourceVault } from '../helpers/resources';

useViewHarness();

/**
 * The `Resource` note a name resolves to in `resourceVault()` — a move now names a FILE,
 * never a string, so every input this file drives needs one behind it. Throws rather than
 * returning null: a test that misspells a name should fail loudly at the point it happened,
 * not several lines later on an assertion that no longer has anything to do with it.
 */
function resourceFile(vault: FakeVault, name: string): TFile {
	const file = vault.files.get(`${name}.md`);
	if (!file) throw new Error(`no such resource note: ${name}.md`);
	return file;
}

/**
 * Every input to a resource move — the drag, the Alt+Up/Down ladder, the row menu's Set
 * assignee — and what each of them writes, keeps and says. `test/view/roadmapMoves.test.ts`
 * is this file's shape over the horizon axis; what the axis DRAWS is
 * `test/view/resourceLanes.test.ts`'s subject, and the second dimension a release on a
 * band carries is `test/view/resourceScheduling.test.ts`'s — neither is repeated here.
 */

/** A roadmap open on the resources axis with the shelf open, this file's every fixture. */
function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	return bareLaneRoadmap(vault, extra, { shelf: true });
}

/**
 * Every element of one resource's band, off the rendered DOM — the header, whatever the
 * header's own track draws inside it, and each line until the next band begins.
 *
 * COLLECTED rather than listed, which is the whole point: `laneElement` wires a band element
 * by element because there is no container to wire, so "every element is a target" cannot be
 * checked by naming the kinds that exist today — the next kind is exactly the one that breaks
 * it. See `docs/bugs/An absence stretch is a dead spot in its own band.md`.
 */
function bandElements(containerEl: HTMLElement, name: string): HTMLElement[] {
	const head = laneHead(containerEl, name);
	const found: HTMLElement[] = [head, ...head.querySelectorAll<HTMLElement>('.pbl-timeline-track > *')];
	for (let el = head.nextElementSibling; el !== null; el = el.nextElementSibling) {
		if (el.classList.contains('pbl-lane-head')) break;
		found.push(el as HTMLElement);
	}
	return found;
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

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, resourceFile(vault, 'Bob'));

		expect(moved).toBe(true);
		expect(vault.fm('Alice dated.md')['assignee']).toBe('[[Bob]]');
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

	it('re-picking the resource a note already names writes nothing and keeps the undo', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, resourceFile(vault, 'Bob'));
		expect(vault.writeLog).toHaveLength(1);

		// Compared by PATH, never by the raw text: `Undated` already names Alice's own
		// note, so picking her again plans nothing — the checkmark's own question.
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, resourceFile(vault, 'Alice'));

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
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, resourceFile(vault, 'Bob'));

		expect(moved).toBe(true);
		expect(vault.fm('Undated.md')['assignee']).toBe('[[Bob]]');
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
		const moved = await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, resourceFile(vault, 'Alice'));

		expect(moved).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Alice. Add a start or target date to place it in the row.',
		);
	});

	it('names the reason the card is shelved, where the axis refused a date rather than lacking one', async () => {
		const vault = resourceVault();
		vault.addFile('Backwards.md', {
			frontmatter: { type: 'Epic', order: 60, start: '2026-08-10', due: '2026-08-01' },
		});
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 70, start: 'soon', due: '2026-08-05' } });
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Backwards.md') as never, resourceFile(vault, 'Bob'));
		await view.performResourceMove(view.model?.byPath.get('Garbled.md') as never, resourceFile(vault, 'Bob'));

		// Both dates are there, so "add a start or target date" would send the reader
		// looking for a value they already typed instead of at the one they can see. The
		// wording is the shelf card's own reason, repeated rather than restated.
		expect(Notice.messages).toContain(
			'"Backwards" is assigned to Bob. Target date precedes the start date, so it stays on the shelf.',
		);
		expect(Notice.messages).toContain('"Garbled" is assigned to Bob. Unreadable start date, so it stays on the shelf.');
	});

	it('says nothing at all when a placed bar is dropped on its own row', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, resourceFile(vault, 'Alice'));

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

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, resourceFile(vault, 'Bob'));
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');

		await view.performResourceMove(view.model?.byPath.get('Stray.md') as never, null);
		expect(await announced()).toBe('Moved "Stray" from Zoe to Unplaced');
	});

	it('says both halves of a two-dimensional move in ONE sentence', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// The gesture a band drop hands over, driven at the one method it lands on: a live
		// region is read in order, and two messages about one gesture are two events for a
		// reader who made one.
		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, resourceFile(vault, 'Bob'), {
			plan: { start: '2026-08-08', target: '2026-08-17' },
			ends: ['start', 'target'],
			from: { start: '2026-08-01', target: '2026-08-10' },
		});

		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob, 2026-08-08 to 2026-08-17');
	});

	it('says the dated axis’s own sentence where only the dates moved', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// A slide inside one row: there is no row change to frame the span with, so the
		// sentence is the one the dated axis already says for the identical write.
		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, resourceFile(vault, 'Alice'), {
			plan: { start: '2026-08-08', target: '2026-08-17' },
			ends: ['start', 'target'],
			from: { start: '2026-08-01', target: '2026-08-10' },
		});

		expect(await announced()).toBe('Moved "Alice dated" from 2026-08-01 to 2026-08-10 to 2026-08-08 to 2026-08-17');
	});

	it('names the raw text when the link does not resolve, never the row it visually groups into', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Cased` says `alice`, lowercase and unbracketed — it draws in Alice's row by the
		// same case-insensitive NAME match that groups a bar (`assigneeName`), but the link
		// itself does not resolve to her note, so the announcement reports what the note
		// actually says rather than the row it happens to visually sit in.
		await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, resourceFile(vault, 'Bob'));
		expect(await announced()).toBe('Moved "Cased" from alice to Bob');
	});

	it('names a resource no row draws, rather than calling the note silent', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Undated` names Alice and has no date to sit at, so this axis mints no row for
		// it — but the note plainly says Alice, and "from Unplaced" would be a lie about
		// it. This is where the two axes' labels differ, and why they had to.
		await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, resourceFile(vault, 'Bob'));
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

		expect(vault.fm('Alice dated.md')['assignee']).toBe('[[Bob]]');
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

		expect(vault.fm('Stray.md')['assignee']).toBe('[[Alice]]');
	});

	it('every element the band actually draws takes the drop, whatever kind it is', async () => {
		// The category check `docs/bugs/An absence stretch is a dead spot in its own band.md`
		// asks for, stated from the RULE rather than from the kinds that existed when it was
		// written: the band's elements are COLLECTED off the rendered DOM and a drop is driven
		// at each. A fifth kind of line either joins the band or fails here, without anyone
		// having predicted it — which is exactly what the fourth kind did not do, and what the
		// stretch moving into the header's own track (2026-08-14) would have needed again.
		//
		// The count is asserted first, and it is the instrument's own check: a collector that
		// silently found nothing would satisfy the loop below for any grid at all.
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Bob.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Alice work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Alice away 2026-08-04 → 2026-08-06.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		vault.addFile('Outside.md', { frontmatter: { type: 'Epic', order: 20, assignee: 'Alice' } });
		vault.addFile('Inside.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-02', due: '2026-08-03' },
			parentLink: 'Outside',
		});
		vault.addFile('Carried.md', {
			frontmatter: { type: 'Epic', order: 30, assignee: 'Bob', start: '2026-08-01', due: '2026-08-05' },
		});
		const only = ['Alice.md', 'Bob.md', 'Alice work.md', 'Alice away 2026-08-04 → 2026-08-06.md', 'Inside.md', 'Carried.md'];
		const harness = bareLaneRoadmap(vault, {}, { only, focus: 'Epic' });
		const kinds = bandElements(harness.containerEl, 'Alice');
		// The header, the stretch drawn inside its track, the bar row, and the excluded note
		// the band places — every KIND of element this axis draws inside one band, which is
		// what the loop below then drives a drop at.
		expect(kinds.map((el) => el.className.split(' ').filter((c) => c.startsWith('pbl-lane') || c === 'pbl-absence' || c === 'pbl-timeline-row'))).toEqual([
			['pbl-lane-head'],
			['pbl-absence'],
			['pbl-timeline-row'],
			['pbl-timeline-row', 'pbl-lane-context'],
		]);

		for (let index = 0; index < kinds.length; index++) {
			vault.setFrontmatter('Carried.md', {
				type: 'Epic',
				order: 30,
				assignee: 'Bob',
				start: '2026-08-01',
				due: '2026-08-05',
			});
			refresh(harness.view, vault);
			const target = bandElements(harness.containerEl, 'Alice')[index];
			cardDrag(barFor(harness.containerEl, 'Carried'), target);
			await flush();

			expect(vault.fm('Carried.md')['assignee'], `no drop reached ${target.className}`).toBe('[[Alice]]');
		}
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

		expect(vault.fm('Nobody.md')['assignee']).toBe('[[Bob]]');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('drops on the shelf to un-assign, and undo puts the name back', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), shelf(containerEl));
		await flush();
		// Removed, not blanked: an empty value would read as a row named nothing.
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
		// This strip un-places on the axis it draws, and that axis is WHO. When the work
		// happens is not a fact the drop was asked about, so the dates stand.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('a minted row is a target like any other — observed vocabulary is writable', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Zoe'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('[[Zoe]]');
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

	it('offers date grips and still registers no grid-wide target for one', () => {
		// The grips come back with the second dimension, and the OVERLAY still must not:
		// the targets here are the rows, each reading the same pointer X for the same date,
		// and a layer taking pointer events across the whole day area while a drag is live
		// would swallow every one of them. `pbl-timeline-flat` is the other half of that —
		// it stops the today line, the one absolutely positioned mark that keeps its pointer
		// events, from doing the same thing on a smaller scale.
		const { containerEl } = laneRoadmap(resourceVault());

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(true);
	});

	it('leaves the dated axis’s own overlay alone', () => {
		// The control beside the case above: the overlay is per axis, and the axis with no
		// rows to mean anything still needs the one target that means a position.
		const { view, containerEl } = laneRoadmap(resourceVault());

		view.setAxisPick('dates');

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(false);
	});
});

describe('moving between resources without a drag', () => {
	it('Alt+Down advances the selected card one row, writing the drop’s own value', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('[[Bob]]');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('steps past the milestones row, which is a stop on nobody’s ladder', async () => {
		// The synthetic row leads the roster, so it was stop 1 and the shelf was stop 0:
		// Alt+Up off Alice landed on `Milestones` and wrote it as an assignee. What the
		// ladder must do is what it does with the row absent — reach the shelf, and
		// un-assign. Same list the menu reads (`assignableLanes`), asserted at both inputs
		// because they are the two that offered it.
		const vault = resourceVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 5, due: '2026-08-07' } });
		const { view, containerEl } = laneRoadmap(vault);
		expect(laneNames(containerEl)[0]).toBe('Milestones');

		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(treeOf(containerEl), 'ArrowUp', { altKey: true });
		await flush();

		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
	});

	it('Alt+Up off the first row un-assigns, and off the shelf does nothing', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const tree = treeOf(containerEl);

		// The shelf leads the ladder, the horizon axis's own rule: it is where un-placing
		// lives and where an untriaged card enters the axis from.
		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		// And there is nowhere further up: the edges hold rather than wrap.
		view.selectItem(view.model?.byPath.get('Nobody.md') as never);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Alice dated.md']);
	});

	it('writes nothing for a marker — the three inputs to one move must agree', async () => {
		// `wireLaneDrop` routes a marker's release to the dated gesture rather than to a row
		// write, because `deriveLanes` draws every marker in the milestones' row whatever
		// its assignee says. This ladder did not: it wrote the name and the card stayed
		// exactly where it was, spending the one undo slot on a change nobody can see.
		//
		// The rule is the category's, and `Milestone` is the marker that reaches this ladder:
		// it had the hole first and had no test.
		const vault = resourceVault();
		vault.addFile('Ship 1.0.md', { frontmatter: { type: 'Milestone', due: '2026-08-10' } });
		const { view, containerEl } = laneRoadmap(vault);

		for (const path of ['Ship 1.0.md']) {
			view.selectItem(view.model?.byPath.get(path) as never);
			const down = key(treeOf(containerEl), 'ArrowDown', { altKey: true });
			const up = key(treeOf(containerEl), 'ArrowUp', { altKey: true });
			await flush();
			// And it is refused BEFORE `preventDefault`, which the comment on the guard
			// claims and nothing checked: a chord this projection has nothing to do with is
			// not this projection's to swallow, so it stays available to whatever else
			// wants it. Guarding after the call passes every assertion below this one.
			expect(down.defaultPrevented).toBe(false);
			expect(up.defaultPrevented).toBe(false);
		}
		expect(vault.writeLog).toEqual([]);
	});

	it('holds at the last row rather than wrapping', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		// Zoe is the last row drawn.
		view.selectItem(view.model?.byPath.get('Stray.md') as never);
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Stray.md')['assignee']).toBe('Zoe');
		expect(vault.writeLog).toEqual([]);
	});

	it('reaches a card whose note names a resource NO row draws', async () => {
		// This axis mints a row only where a BAR lands, so a card naming somebody with no
		// date to sit beside names a resource that has no stop on the ladder at all — it is
		// drawn on the shelf without being ON it, and taking that name off is a real,
		// undoable write the drag and the menu can both express. The keyboard is the third
		// input to one move, so it has to reach it too. `Quinn` is neither declared nor
		// carried by any dated result, which is what makes the index genuinely absent —
		// `Undated` would not do, since Alice's own row is drawn by her two bars.
		const vault = resourceVault();
		vault.addFile('Quinn work.md', { frontmatter: { type: 'Epic', order: 60, assignee: 'Quinn' } });
		const { view, containerEl } = laneRoadmap(vault);
		expect(shelfTitles(containerEl)).toContain('Quinn work');

		view.selectItem(view.model?.byPath.get('Quinn work.md') as never);
		key(treeOf(containerEl), 'ArrowUp', { altKey: true });
		await flush();

		expect('assignee' in vault.fm('Quinn work.md')).toBe(false);
	});

	it('writes nothing on Alt+Left, Alt+Right, or Alt with a second modifier', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);

		// Left/Right on this grid is reserved: resources sit ON the dated axis, and only
		// one dimension can have those keys. A chord aimed at Obsidian or the OS must not
		// land as a frontmatter write either.
		key(tree, 'ArrowLeft', { altKey: true });
		key(tree, 'ArrowRight', { altKey: true });
		key(tree, 'ArrowDown', { altKey: true, shiftKey: true });
		key(tree, 'ArrowDown', { altKey: true, ctrlKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('leaves Alt+Up/Down inert on the horizon axis, where rows are not what moves', async () => {
		// The control beside the case above: the ladder is per axis, and the horizon
		// axis's own is Left/Right. Neither may quietly answer the other's keys.
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const harness = makeView(vault, { horizonProperty: 'note.horizon' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		harness.view.selectItem(harness.view.model?.byPath.get('Item.md') as never);

		key(treeOf(harness.containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});

describe('Set assignee on this axis', () => {
	it('offers the resource notes the base returned, alphabetically', () => {
		const { view } = laneRoadmap(resourceVault());

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		const submenu = Menu.lastShown?.item('Set assignee')?.submenu;

		// The roster is the notes now, so Bob's own row draws from the SAME source this
		// menu offers — a resource with no assigned work yet is still on both.
		expect(submenu?.items.map((i) => i.titleText)).toEqual([
			'Alice',
			'Bob',
			'Zoe',
			'New resource...',
			'Clear assignee',
		]);
		expect(submenu?.item('Alice')?.checked).toBe(true);
	});

	it('leaves the milestones row out — it is drawn on this axis and is nobody', () => {
		// The synthetic row is not a `Resource` note, so it was never a candidate for this
		// menu at all — unlike the ladder, which had to filter it out of the drawn rows
		// explicitly (`assignableLanes`). Recorded here as the control beside that ladder
		// test: the row IS on screen, so this states the exclusion rather than a fixture
		// that never drew one.
		const vault = resourceVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 5, due: '2026-08-07' } });
		const { view, containerEl } = laneRoadmap(vault);
		expect(laneNames(containerEl)[0]).toBe('Milestones');

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		const submenu = Menu.lastShown?.item('Set assignee')?.submenu;

		expect(submenu?.items.map((i) => i.titleText)).toEqual([
			'Alice',
			'Bob',
			'Zoe',
			'New resource...',
			'Clear assignee',
		]);
	});

	it('routes a pick through the one method, so a pick and a drop say one sentence', async () => {
		vi.useFakeTimers();
		const { view } = laneRoadmap(resourceVault());
		const spy = vi.spyOn(view, 'performResourceMove');

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Bob')?.clickHandler?.();

		expect(spy).toHaveBeenCalledOnce();
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');
	});

	it('clears the key from the menu, the shelf drop’s own write', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Clear assignee')?.clickHandler?.();
		await flush();

		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
	});

	it('goes straight through the gate off this axis, where there is no frame to announce into', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);
		const spy = vi.spyOn(view, 'performResourceMove');

		view.setProjection('tree');
		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Zoe')?.clickHandler?.();

		// `announced` drives the live region's own timer, which flushes the write with it —
		// `flush()` waits on a real timeout and would hang against the fake clock.
		expect(await announced()).toBe('');
		expect(spy).not.toHaveBeenCalled();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('[[Zoe]]');
	});
});
