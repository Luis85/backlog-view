// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { flush, key, makeView, refresh, submitPrompt, treeOf, useViewHarness } from '../helpers/view';
import { announced, cardDrag } from '../helpers/dnd';
import { cardByTitle } from '../helpers/board';
import { bucketByName, bucketNames, horizonVault, makeRoadmap, shelfOf, shelfTitles } from '../helpers/roadmap';
import { unschedule } from '../../src/view/interactions/plan';

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

		// Two steps: the shelf leads the reading order now, so the first bucket card —
		// the one an Alt+arrow can advance — is the second stop.
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown');
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

	it('Alt+Left cleans up a shelved card whose key still holds something', async () => {
		const vault = horizonVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 40, horizon: { when: 'soon' } } });
		vault.addFile('Stub.md', { frontmatter: { type: 'Epic', order: 50, horizon: '' } });
		const { view, containerEl } = makeRoadmap(vault);
		const tree = treeOf(containerEl);

		// Both are DRAWN on the shelf and neither is ON it — the note still holds
		// something, and removing it is the write the shelf drop and Clear horizon
		// both plan for the same card. The keyboard is the third input to one move, so
		// it must reach it too; indexing these at stop 0 made the edge rule swallow it.
		for (const path of ['Garbled.md', 'Stub.md']) {
			view.selectItem(view.model?.byPath.get(path) as never);
			key(tree, 'ArrowLeft', { altKey: true });
			await flush();
			expect('horizon' in vault.fm(path)).toBe(false);
		}
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Garbled.md', 'Stub.md']);

		// And the edge still holds for a card with no key at all: nothing to clean up,
		// so nothing is written and the undo slot is not spent.
		view.selectItem(view.model?.byPath.get('Untriaged.md') as never);
		key(tree, 'ArrowLeft', { altKey: true });
		await flush();
		expect(vault.writeLog).toHaveLength(2);
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

	it('the card menu leads with the buckets on screen, checked on the current one', async () => {
		const vault = horizonVault();
		vault.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 40, horizon: 'Someday' } });
		const { view } = makeRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		// Declared and minted alike, in the order the frame draws them — every bucket a
		// drop can reach, so the menu's targets cannot be a different set from the
		// drag's. `Clear horizon` is the way out, offered because this note carries the
		// key; it is the shelf's drop under the name the row menu gives it everywhere.
		const submenu = Menu.lastShown?.item('Set horizon')?.submenu;
		expect(submenu?.items.map((i) => i.titleText)).toEqual(['Now', 'Next', 'Later', 'Someday', 'Clear horizon']);
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

		// The card is on the shelf, but its key still holds something, so clearing
		// REMOVES that value — a write, and a spent undo slot. A checkmark anywhere
		// here would offer a mutation as the state the note is already in.
		expect(submenu?.items.filter((i) => i.checked)).toEqual([]);
		submenu?.item('Clear horizon')?.clickHandler?.();
		await flush();
		expect('horizon' in vault.fm('Garbled.md')).toBe(false);
	});

	it('clears the key from the menu, the shelf drop’s own write', async () => {
		const vault = horizonVault();
		const { view } = makeRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		Menu.lastShown?.item('Set horizon')?.submenu?.item('Clear horizon')?.clickHandler?.();
		await flush();

		expect('horizon' in vault.fm('Now item.md')).toBe(false);
		// Nothing to clear is not offered at all, so no entry in this menu can write
		// nothing: an untriaged note has no way out to be given.
		view.showContextMenuFor(view.model?.byPath.get('Untriaged.md') as never);
		expect(Menu.lastShown?.item('Set horizon')?.submenu?.item('Clear horizon')).toBeUndefined();
	});

	it('offers the placement wherever the axis is configured, not only where it is drawn', async () => {
		// The property belongs to the ITEM, not to the mode: the projections share one
		// model, one gate and one undo history, so a placement settable only inside the
		// roadmap would be a projection disagreeing about what the backlog can do. The
		// drag is what is roadmap-only, because only there is there a bucket to drop on.
		const vault = horizonVault();
		const { view } = makeRoadmap(vault, { startProperty: 'note.start' });

		// On the roadmap, drawing the OTHER axis: no bucket is on screen to drop on,
		// and the placement is offered anyway.
		view.setAxisPick('dates');
		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		expect(Menu.lastShown?.item('Set horizon')).toBeDefined();

		// And in the tree, where no roadmap is on screen at all — where it writes
		// through the plain gate, there being no frame to announce into.
		view.setProjection('tree');
		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		Menu.lastShown?.item('Set horizon')?.submenu?.item('Later')?.clickHandler?.();
		await flush();
		expect(vault.fm('Now item.md')['horizon']).toBe('Later');
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

	it('names an unreadable value rather than calling a cleanup a move to where it is', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'Epic', order: 10, horizon: { when: 'soon' } } });
		const { containerEl } = makeRoadmap(vault);

		// The card sits on the shelf and stays there, but its key held something and
		// now does not. "From Unplaced to Unplaced" would report that as no change.
		cardDrag(cardByTitle(containerEl, 'Garbled'), shelf(containerEl));
		expect(await announced()).toBe('Moved "Garbled" from an unreadable horizon to Unplaced');
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

	it('never names a type the axis cannot hold, whatever focus arrives from elsewhere', () => {
		// `newItemType` follows the FOCUS and `focusTarget` accepts any declared name, so
		// focusing `Release` had every bucket header offering "New Release in Now" — into an
		// axis that draws no releases, through a creation write with no type gate. It is
		// closed one layer up now: the roadmap honours no focus on a type it cannot draw
		// (`honouredFocusLevel`), so the `+` is OFFERED and names a type this axis holds.
		// The withheld-control version of this was `canPlaceHorizon` guarding the `+`
		// itself, and it went with the branch nothing could drive any more.
		const vault = horizonVault();
		vault.addFile('1.0.md', { frontmatter: { type: 'Release', order: 40 } });
		const released = bucketByName(makeRoadmap(vault, {}, { focus: 'Release' }).containerEl, 'Now');
		expect(released.querySelector('.pbl-bucket-add')?.getAttribute('aria-label')).toBe('New Epic in Now');
		// The focus it must not disturb: a Milestone IS placed on the bucket axis, so it is
		// honoured and the `+` makes one — which is what says this is about releases and not
		// about markers.
		const marked = bucketByName(makeRoadmap(horizonVault(), {}, { focus: 'Milestone' }).containerEl, 'Now');
		expect(marked.querySelector('.pbl-bucket-add')?.getAttribute('aria-label')).toBe('New Milestone in Now');
	});

	it('offers no Release anywhere on the roadmap, since no axis of it draws one', () => {
		// A projection does not offer a type it cannot draw — the iteration board's own rule,
		// reaching a fourth projection. All THREE surfaces `offerableTypes` feeds, because
		// each fails differently: `New` would make a note that vanished on the next refresh,
		// `Set type` would vanish the card it was used on, and the focus picker would offer a
		// `Release`-only scope drawing an empty roadmap with nothing saying why.
		//
		// The narrowing is no longer the roadmap's own: `inPlan` refuses a release in every
		// projection since 2026-08-24, so `byProjectionType` withholds the type from all of
		// them and this reads as the roadmap's instance of a rule rather than as its rule.
		// The three surfaces are still worth driving here, because they are three.
		const vault = horizonVault();
		const { containerEl, view } = makeRoadmap(vault);

		containerEl.querySelector<HTMLElement>('.pbl-new-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const created = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(created).toContain('New Milestone');
		expect(created).not.toContain('New Release');

		view.showContextMenuFor(view.model?.byPath.get('Now item.md') as never);
		const retype = Menu.lastShown?.item('Set type')?.submenu?.items.map((i) => i.titleText) ?? [];
		expect(retype).toContain('Milestone');
		expect(retype).not.toContain('Release');

		containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const focuses = Menu.lastShown?.items.map((i) => i.titleText) ?? [];
		expect(focuses).toContain('Milestone');
		expect(focuses).not.toContain('Release');

		// **This block asserted the OPPOSITE until 2026-08-24**: the tree still offered the
		// type, "which is the decision step 7 took and this must not undo". `Releases own
		// their creation` undid it deliberately — the release view is the door now — so the
		// tree is asserted here as the same answer rather than as the contrast. Kept rather
		// than deleted because a narrowing that reached only the roadmap would now be a bug,
		// and this is where a reader looks for that. `New Milestone` is not re-asserted
		// here: the roadmap's own three checks above already hold the marker control.
		const tree = makeView(vault, {});
		tree.containerEl
			.querySelector<HTMLElement>('.pbl-new-pick')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(expect.not.arrayContaining(['New Release']));
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

describe('scheduling from the row, on the one path', () => {
	function datedVault() {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Parent.md', {
			frontmatter: { type: 'Feature', order: 10, start: '2026-08-01', target: '2026-08-31' },
		});
		vault.addFile('Child.md', {
			frontmatter: { type: 'PBI', order: 10, start: '2026-08-10', target: '2026-08-20' },
			parentLink: 'Parent',
		});
		return vault;
	}

	function datedView(vault: FakeVault) {
		const harness = makeView(
			vault,
			{ startProperty: 'note.start', targetProperty: 'note.target' },
			{ collapsed: true },
		);
		harness.view.setProjection('roadmap');
		return harness;
	}

	it('announces the dates the WRITER saw, not the ones the row was drawn from', async () => {
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Child.md');
		// The note moved under the row: the screen says the 10th, the note says the 11th.
		vault.fm('Child.md').start = '2026-08-11';

		await view.performScheduleMove(item as never, { start: '2026-08-12' });

		expect(await announced()).toBe('Moved "Child" from 2026-08-11 to 2026-08-20 to 2026-08-12 to 2026-08-20');
	});

	it('says nothing at all when the write changed nothing', async () => {
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Child.md');

		const moved = await view.performScheduleMove(item as never, { start: '2026-08-10' });

		expect(moved).toBe(false);
		expect(await announced()).toBe('');
	});

	it('names the INFERRED span a parent keeps rather than claiming it was unscheduled', async () => {
		// `inferSpan` refills an end the note no longer states, so announcing a removal
		// as "Unscheduled" would describe something other than what renders. This is
		// `announceHorizonMove`'s own lesson — it recorded a cleanup as "from Unplaced
		// to Unplaced" — reached by the other axis.
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Parent.md');

		await view.performScheduleMove(item as never, { start: null, target: null });

		expect(await announced()).toBe('Moved "Parent" from 2026-08-01 to 2026-08-31 to 2026-08-10 to 2026-08-20');
	});

	it('says Unscheduled only where the item actually leaves the axis', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Alone.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Alone.md');

		await view.performScheduleMove(item as never, { start: null, target: null });

		expect(await announced()).toBe('Moved "Alone" from 2026-08-01 onwards to Unscheduled');
	});

	it('reports a real cleanup of an unreadable date, not "Unscheduled" both ways', async () => {
		// The note held something this axis refuses to read; clearing it is a real,
		// undoable change, and "Unscheduled" was already true before the write — the
		// exact confusion `placementLabel` stopped making on the horizon axis.
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Garbled.md', { frontmatter: { type: 'PBI', order: 10, start: 'soon' } });
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Garbled.md');

		const moved = await view.performScheduleMove(item as never, { start: null, target: null });

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Garbled" from an unreadable start date to Unscheduled');
	});

	it('names the shelf reason on the TO side too, when the OTHER end stays unreadable', async () => {
		// A one-ended write (`computeScheduleWrites`) can leave the end it never touched
		// exactly as unreadable as it found it. `outcome.dates.after` now carries that
		// genuine `invalid: true` through — round 1 only fixed the source side, and
		// `placementWords` was still throwing the reason away on this one: the same
		// collapse, newly reachable here because the writer no longer forces every
		// after-reading to `invalid: false`.
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Half.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: 'soon' } });
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Half.md');

		const moved = await view.performScheduleMove(item as never, { start: '2026-08-05' });

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Half" from an unreadable target date to an unreadable target date');
	});

	it('names a marker as the point it is drawn as, on both sides of the sentence', async () => {
		// A marker keeps a stale start deliberately, so an unnarrowed source span would
		// announce "from 2026-07-01 to 2026-09-30 to 2026-10-15" for a note the timeline
		// draws and edits as one September point.
		vi.useFakeTimers();
		const vault = new FakeVault();
		vault.addFile('Ship.md', {
			frontmatter: { type: 'Milestone', order: 10, start: '2026-07-01', target: '2026-09-30' },
		});
		const { view } = datedView(vault);
		const item = view.model?.byPath.get('Ship.md');

		await view.performScheduleMove(item as never, { target: '2026-10-15' });

		expect(await announced()).toBe('Moved "Ship" from 2026-09-30 to 2026-10-15');
	});

	it('routes the menu’s Unschedule through the same method', async () => {
		vi.useFakeTimers();
		const vault = datedVault();
		const { view } = datedView(vault);
		const spy = vi.spyOn(view, 'performScheduleMove');
		const item = view.model?.byPath.get('Child.md');

		await unschedule(view, item as never);

		expect(spy).toHaveBeenCalledOnce();
	});
});
