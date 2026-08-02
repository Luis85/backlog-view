// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, key, makeView, refresh, submitPrompt, treeOf, useViewHarness } from '../helpers/view';
import { announced, cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { bucketByName, bucketNames, horizonVault, makeRoadmap, shelfOf, shelfTitles } from '../helpers/roadmap';

useViewHarness();

/** A roadmap on the dated axis, where no move is built and none may be offered. */
function datedRoadmap() {
	const vault = new FakeVault();
	vault.addFile('Dated.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01' } });
	const harness = makeView(vault, { startProperty: 'note.start' }, { collapsed: true });
	harness.view.setProjection('roadmap');
	return { ...harness, vault };
}

/** The shelf, which the horizon axis renders whether or not it holds anything. */
function shelf(containerEl: HTMLElement): HTMLElement {
	const el = shelfOf(containerEl);
	if (!el) throw new Error('the shelf is not rendered');
	return el;
}

/** Every title in a bucket, in rendered order. */
function bucketTitles(containerEl: HTMLElement, name: string): string[] {
	return Array.from(bucketByName(containerEl, name).querySelectorAll('.pbl-card-title')).map(
		(t) => t.textContent ?? '',
	);
}

describe('moving between horizons by drag', () => {
	it('dropping on a bucket writes that horizon’s value, and nothing else', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);

		cardDrag(cardByTitle(containerEl, 'Now item'), bucketByName(containerEl, 'Next'));
		await flush();

		expect(vault.fm('Now item.md')['horizon']).toBe('Next');
		// One value into one property: a horizon move never touches parent, order or type.
		expect(vault.fm('Now item.md')['order']).toBe(10);
		expect(vault.fm('Now item.md')['type']).toBe('Epic');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('the bucket under the drag highlights — the only drop signal', () => {
		const { containerEl } = makeRoadmap(horizonVault());
		const next = bucketByName(containerEl, 'Next');

		const card = cardByTitle(containerEl, 'Now item');
		card.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
		// No dataTransfer on this event: pragmatic ignores it, and no drag starts.
		expect(next.hasClass('pbl-drop-over')).toBe(false);

		cardDrag(card, next);
		// The gesture ended; the highlight must not survive it.
		expect(next.hasClass('pbl-drop-over')).toBe(false);
	});

	it('dragging off the shelf places the item — triage is the same single write', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);
		expect(shelfTitles(containerEl)).toEqual(['Untriaged']);

		cardDrag(cardByTitle(containerEl, 'Untriaged'), bucketByName(containerEl, 'Now'));
		await flush();

		expect(vault.fm('Untriaged.md')['horizon']).toBe('Now');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('dropping on the shelf removes the key, and undo puts it back', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);

		cardDrag(cardByTitle(containerEl, 'Now item'), shelf(containerEl));
		await flush();
		// Removed, not blanked: an empty value would read as a bucket named nothing.
		expect('horizon' in vault.fm('Now item.md')).toBe(false);

		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Now item.md')['horizon']).toBe('Now');
	});

	it('reaches the shelf even when it is holding nothing', async () => {
		const vault = new FakeVault();
		vault.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const { containerEl } = makeRoadmap(vault);
		// Nothing is unplaced, so the shelf is the strip only a live drag can see.
		expect(shelf(containerEl).hasClass('pbl-shelf-empty')).toBe(true);

		cardDrag(cardByTitle(containerEl, 'Placed'), shelf(containerEl));
		await flush();

		expect('horizon' in vault.fm('Placed.md')).toBe(false);
	});

	it('dropping a card on its own bucket writes nothing and keeps the undo slot', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);

		// A real change first, so there is an undo slot to protect.
		cardDrag(cardByTitle(containerEl, 'Later item'), bucketByName(containerEl, 'Next'));
		await flush();
		expect(vault.fm('Later item.md')['horizon']).toBe('Next');
		expect(vault.writeLog).toHaveLength(1);

		// Same bucket, case-insensitively: the match that placed the card there.
		cardDrag(cardByTitle(containerEl, 'Now item'), bucketByName(containerEl, 'Now'));
		await flush();
		expect(vault.writeLog).toHaveLength(1);

		// The slot still holds the first move, not the no-op.
		key(treeOf(containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Later item.md')['horizon']).toBe('Later');
	});

	it('un-places an unreadable value, and leaves a card that was never placed alone', async () => {
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 10, horizon: { when: 'soon' } } });
		vault.addFile('Bare.md', { frontmatter: { type: 'Epic', order: 20 } });
		const { containerEl } = makeRoadmap(vault);
		expect(shelfTitles(containerEl)).toEqual(['Garbled', 'Bare']);

		// Both cards sit on the shelf, and only one of them has anything to un-place.
		cardDrag(cardByTitle(containerEl, 'Garbled'), shelf(containerEl));
		await flush();
		expect('horizon' in vault.fm('Garbled.md')).toBe(false);

		cardDrag(cardByTitle(containerEl, 'Bare'), shelf(containerEl));
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Garbled.md']);
	});

	it('a minted bucket is a target like any other, writing the observed value', async () => {
		const vault = horizonVault();
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 40, horizon: 'Someday' } });
		const { containerEl } = makeRoadmap(vault);
		expect(bucketNames(containerEl)).toEqual(['Now', 'Next', 'Later', 'Someday']);

		// Observed vocabulary is writable vocabulary — the board's own rule — and the
		// value written is the observed string, exactly.
		cardDrag(cardByTitle(containerEl, 'Now item'), bucketByName(containerEl, 'Someday'));
		await flush();
		expect(vault.fm('Now item.md')['horizon']).toBe('Someday');
	});

	it('never accepts another roadmap’s drag, even over the same note', async () => {
		const vaultA = horizonVault();
		const a = makeRoadmap(vaultA);
		const vaultB = horizonVault();
		const b = makeRoadmap(vaultB);

		// The adapter's registry is document-global; without the instance token this
		// drop would write B's horizon key for a gesture made on A's roadmap.
		cardDrag(cardByTitle(a.containerEl, 'Now item'), bucketByName(b.containerEl, 'Later'));
		await flush();

		expect(vaultA.fm('Now item.md')['horizon']).toBe('Now');
		expect(vaultA.writeLog).toHaveLength(0);
		expect(vaultB.writeLog).toHaveLength(0);
		expect(bucketByName(b.containerEl, 'Later').hasClass('pbl-drop-over')).toBe(false);
	});

	it('config problems block a horizon move, exactly as every other write', async () => {
		const vault = horizonVault();
		// Parent and order share a key: the gate must refuse everything.
		const { containerEl } = makeRoadmap(vault, { orderProperty: 'note.parent' });

		cardDrag(cardByTitle(containerEl, 'Now item'), bucketByName(containerEl, 'Next'));
		await flush();

		expect(vault.fm('Now item.md')['horizon']).toBe('Now');
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('the card renders in its new bucket on the write’s own refresh', async () => {
		const vault = horizonVault();
		const { view, containerEl } = makeRoadmap(vault);
		expect(bucketTitles(containerEl, 'Now')).toEqual(['Now item']);

		cardDrag(cardByTitle(containerEl, 'Now item'), bucketByName(containerEl, 'Next'));
		await flush();
		refresh(view, vault);

		// Where a card renders is the note's own frontmatter and nothing else, which
		// is what makes that one write the whole of the move.
		expect(bucketTitles(containerEl, 'Now')).toEqual([]);
		expect(bucketTitles(containerEl, 'Next')).toEqual(['Now item']);
	});
});

describe('moving between horizons without a drag', () => {
	it('Alt+Right advances the selected card one bucket, writing the drop’s own value', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);
		const tree = treeOf(containerEl);

		key(tree, 'ArrowDown'); // the first card in reading order
		expect(cardByTitle(containerEl, 'Now item').hasClass('pbl-selected')).toBe(true);
		key(tree, 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.fm('Now item.md')['horizon']).toBe('Next');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('Alt+Left off the first bucket un-places, and off the shelf does nothing', async () => {
		const vault = horizonVault();
		const { view, containerEl } = makeRoadmap(vault);
		const tree = treeOf(containerEl);

		// The shelf leads the ladder: it is the roadmap's no-state column.
		view.selectItem(view.model?.byPath.get('Now item.md') as never);
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();
		expect('horizon' in vault.fm('Now item.md')).toBe(false);

		// And there is nowhere further left: the edges hold rather than wrap.
		view.selectItem(view.model?.byPath.get('Untriaged.md') as never);
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Now item.md']);
	});

	it('holds at the last bucket rather than wrapping', async () => {
		const vault = horizonVault();
		const { view, containerEl } = makeRoadmap(vault);

		view.selectItem(view.model?.byPath.get('Later item.md') as never);
		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.fm('Later item.md')['horizon']).toBe('Later');
		expect(vault.writeLog).toEqual([]);
	});

	it('writes nothing on Alt+Up, Alt+Down, or Alt with a second modifier', async () => {
		const vault = horizonVault();
		const { view, containerEl } = makeRoadmap(vault);
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Now item.md') as never);

		// Within-bucket order is derived, so there is no rank to move within; and a
		// chord aimed at Obsidian or the OS must not land as a frontmatter write.
		key(tree, 'ArrowUp', { altKey: true });
		key(tree, 'ArrowDown', { altKey: true });
		key(tree, 'ArrowRight', { altKey: true, shiftKey: true });
		key(tree, 'ArrowRight', { altKey: true, ctrlKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
		// The selection stayed put: a move modifier never doubles as navigation.
		expect(cardByTitle(containerEl, 'Now item').hasClass('pbl-selected')).toBe(true);
	});

	it('the shortcut is silent on the dated axis, where the moves are not built', async () => {
		const { view, containerEl, vault } = datedRoadmap();
		view.selectItem(view.model?.byPath.get('Dated.md') as never);

		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();
		expect(vault.writeLog).toEqual([]);
	});

	it('the card menu offers every bucket on screen plus the shelf, checked on the current one', async () => {
		const vault = horizonVault();
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 40, horizon: 'Someday' } });
		const { view } = makeRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		// Declared and minted alike: every bucket a drop can reach, and no other.
		const submenu = Menu.lastShown?.item('Set horizon')?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toEqual(['Unplaced', 'Now', 'Next', 'Later', 'Someday']);
		expect(submenu?.item('Now')?.checked).toBe(true);

		submenu?.item('Later')?.clickHandler?.();
		await flush();
		expect(vault.fm('Now item.md')['horizon']).toBe('Later');
	});

	it('checks nothing for an unreadable value — every entry there would write', async () => {
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 10, horizon: { when: 'soon' } } });
		const { view } = makeRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Garbled.md') as never);
		const submenu = Menu.lastShown?.item('Set horizon')?.submenu;

		// The card is on the shelf, but its key still holds something, so picking
		// Unplaced REMOVES that value — a write, and a spent undo slot. A checkmark
		// there would offer a mutation as the state the note is already in.
		expect(submenu?.items.filter((i) => i.checked)).toEqual([]);
		submenu?.item('Unplaced')?.clickHandler?.();
		await flush();
		expect('horizon' in vault.fm('Garbled.md')).toBe(false);
	});

	it('the menu’s shelf entry removes the key, the drop’s own write', async () => {
		const vault = horizonVault();
		const { view } = makeRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		Menu.lastShown?.item('Set horizon')?.submenu?.item('Unplaced')?.clickHandler?.();
		await flush();

		expect('horizon' in vault.fm('Now item.md')).toBe(false);
	});

	it('offers no Set horizon where no buckets render', () => {
		const timeline = datedRoadmap();
		timeline.view.showContextMenuFor(timeline.view.model?.byPath.get('Dated.md') as never);
		expect(Menu.lastShown?.item('Set horizon')).toBeUndefined();

		// And in the tree, where the roadmap is not what is on screen at all.
		const { view } = makeRoadmap(horizonVault());
		view.setProjection('tree');
		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		expect(Menu.lastShown?.item('Set horizon')).toBeUndefined();
	});
});

describe('what a horizon move announces', () => {
	it('names the buckets on screen, whichever input made the move', async () => {
		vi.useFakeTimers();
		const vault = horizonVault();
		const { view, containerEl } = makeRoadmap(vault);

		cardDrag(cardByTitle(containerEl, 'Now item'), bucketByName(containerEl, 'Next'));
		expect(await announced()).toBe('Moved "Now item" from Now to Next');

		// The menu says it in the same words the drag did.
		view.showContextMenuFor(view.model?.byPath.get('Later item.md') as never);
		Menu.lastShown?.item('Set horizon')?.submenu?.item('Now')?.clickHandler?.();
		expect(await announced()).toBe('Moved "Later item" from Later to Now');
	});

	it('names the shelf in both directions, never a silence', async () => {
		vi.useFakeTimers();
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);

		cardDrag(cardByTitle(containerEl, 'Untriaged'), bucketByName(containerEl, 'Now'));
		expect(await announced()).toBe('Moved "Untriaged" from Unplaced to Now');

		cardDrag(cardByTitle(containerEl, 'Now item'), shelf(containerEl));
		expect(await announced()).toBe('Moved "Now item" from Now to Unplaced');
	});
});

describe('creating from a bucket', () => {
	it('writes the bucket’s value in the creation write itself', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault);

		bucketByName(containerEl, 'Later')
			.querySelector<HTMLElement>('.pbl-bucket-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'Planned work' });
		await flush();

		// One note, one write: its type, its rank and its placement together, so it
		// never exists in a bucket its own frontmatter does not claim.
		const created = vault.fm('docs/requirements/Planned work.md');
		expect(created['horizon']).toBe('Later');
		expect(created['type']).toBe('Epic');
		expect(created['order']).toBe(40);
	});

	it('mints into a bucket a stray value named, the value it renders under', async () => {
		const vault = horizonVault();
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 40, horizon: 'someday' } });
		const { containerEl } = makeRoadmap(vault);

		bucketByName(containerEl, 'someday')
			.querySelector<HTMLElement>('.pbl-bucket-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		submitPrompt({ title: 'More of it' });
		await flush();

		expect(vault.fm('docs/requirements/More of it.md')['horizon']).toBe('someday');
	});

	it('is blocked by the config gate, exactly as every other creation is', async () => {
		const vault = horizonVault();
		const { containerEl } = makeRoadmap(vault, { orderProperty: 'note.parent' });

		bucketByName(containerEl, 'Now')
			.querySelector<HTMLElement>('.pbl-bucket-add')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});
});

describe('a move whose value leaves the base', () => {
	/** Move a card, then hand back the results a base filtering on that value returns. */
	function moveThenRequery(harness: ReturnType<typeof makeRoadmap>, vault: FakeVault, dropped: string[]) {
		(harness.view as unknown as Record<string, unknown>).data = {
			data: vault.entries().filter((e) => !dropped.includes(e.file.path)),
		};
		harness.view.onDataUpdated();
	}

	it('says so on the write’s own refresh, and offers the way back to the note', async () => {
		const vault = horizonVault();
		const harness = makeRoadmap(vault);

		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Later'));
		await flush();
		expect(vault.fm('Now item.md')['horizon']).toBe('Later');

		// The base filters on the very property the move wrote, so the requery it
		// triggered no longer returns the note. The write stands — that is what was
		// asked for — and the card leaving is the filter speaking, said out loud.
		moveThenRequery(harness, vault, ['Now item.md']);
		expect(Notice.messages.some((m) => m.includes('no longer matches this base'))).toBe(true);

		// A real button, not a bare anchor: the way back has to be reachable by the
		// keyboard, and an `<a>` with no `href` is not in the tab order at all.
		const action = Notice.last?.messageEl.querySelector<HTMLElement>('.pbl-notice-open');
		expect(action?.tagName).toBe('BUTTON');
		expect(action?.textContent).toBe('Open the note');
		action?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Now item.md']);
	});

	it('reports when the requery lands INSIDE the write — the pass that answers is that one', async () => {
		const vault = horizonVault();
		const harness = makeRoadmap(vault);
		// Bases requeries as the write lands, which is the ordinary case: the update is
		// deferred while the batch runs and flushed in its `finally` — synchronously,
		// before the move's own await resolves. A watch armed after that await would
		// miss the only pass that could have answered.
		vault.afterWrite = () => {
			(harness.view as unknown as Record<string, unknown>).data = {
				data: vault.entries().filter((e) => e.file.path !== 'Now item.md'),
			};
			harness.view.onDataUpdated();
		};

		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Later'));
		await flush();

		expect(Notice.messages.some((m) => m.includes('no longer matches this base'))).toBe(true);
	});

	it('answers for every move still waiting, not only the last', async () => {
		const vault = horizonVault();
		const harness = makeRoadmap(vault);

		// Two moves before any refresh arrives — nothing stops the user making the
		// second, and a single slot would drop the first one's answer on the floor.
		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Later'));
		await flush();
		cardDrag(cardByTitle(harness.containerEl, 'Later item'), bucketByName(harness.containerEl, 'Now'));
		await flush();

		moveThenRequery(harness, vault, ['Now item.md', 'Later item.md']);
		expect(Notice.messages.filter((m) => m.includes('left the view'))).toHaveLength(2);
		expect(Notice.messages.some((m) => m.includes('"Now item"'))).toBe(true);
		expect(Notice.messages.some((m) => m.includes('"Later item"'))).toBe(true);
	});

	it('says nothing when the write never lands', async () => {
		const vault = horizonVault();
		// Parent and order share a key: the gate refuses the batch outright.
		const harness = makeRoadmap(vault, { orderProperty: 'note.parent' });

		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Later'));
		await flush();
		Notice.reset();
		// Nothing was written, so nothing became of anything — and a watch left armed
		// would answer for whatever data pass came next.
		moveThenRequery(harness, vault, ['Now item.md']);
		expect(Notice.messages).toEqual([]);
	});

	it('still undoes it — the note is gone from the view, not from the slot', async () => {
		const vault = horizonVault();
		const harness = makeRoadmap(vault);

		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Later'));
		await flush();
		moveThenRequery(harness, vault, ['Now item.md']);

		key(treeOf(harness.containerEl), 'z', { ctrlKey: true });
		await flush();
		expect(vault.fm('Now item.md')['horizon']).toBe('Now');
	});

	it('says nothing when the note is still a result', async () => {
		const vault = horizonVault();
		const harness = makeRoadmap(vault);

		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Next'));
		await flush();
		moveThenRequery(harness, vault, []);

		expect(Notice.messages).toEqual([]);
	});

	it('never blames the write for a filter the user typed', async () => {
		const vault = horizonVault();
		const harness = makeRoadmap(vault);

		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Next'));
		await flush();
		// A quick filter hides the card too, and reporting THAT would blame the move
		// for something the user just did. Only the data pass answers for a write.
		harness.view.setFilter('zzz');
		expect(Notice.messages).toEqual([]);

		// Nor when the data pass arrives with that filter still on: the filter is the
		// user's doing and never the write's, so it is no part of the verdict.
		moveThenRequery(harness, vault, []);
		expect(Notice.messages).toEqual([]);

		// And the answer still arrives when the note really has left the results.
		harness.view.setFilter('');
		cardDrag(cardByTitle(harness.containerEl, 'Now item'), bucketByName(harness.containerEl, 'Later'));
		await flush();
		moveThenRequery(harness, vault, ['Now item.md']);
		expect(Notice.messages.some((m) => m.includes('no longer matches this base'))).toBe(true);
	});
});
