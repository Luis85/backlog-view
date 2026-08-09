// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ProductBacklogView } from '../../src/view/backlogView';
import { FakeVault } from '../helpers/vault';
import { FuzzySuggestModal, Menu, Modal, Notice, TFile } from '../helpers/obsidian-mock';
import { flush, makeView, refresh, rowByTitle, useViewHarness } from '../helpers/view';

/**
 * The menu path that states and clears a prerequisite, from the acceptance criteria of
 * `Linking two items`.
 *
 * Everything here drives the real context menu and the real write gate, so what is
 * asserted is what a note ends up holding rather than what a planner intended.
 */

useViewHarness();

const withKey = { dependsOnProperty: 'note.dependsOn' };

/** Three siblings, so there is always something legal to depend on. */
function vaultWith(frontmatter: Record<string, Record<string, unknown>> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	for (const [index, title] of ['A', 'B', 'C'].entries()) {
		vault.addFile(`${title}.md`, {
			frontmatter: { type: 'PBI', order: (index + 1) * 10, ...(frontmatter[title] ?? {}) },
			parentLink: 'Epic',
		});
	}
	return vault;
}

function openMenu(containerEl: HTMLElement, title: string): Menu {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	const menu = Menu.lastShown;
	if (!menu) throw new Error('no menu opened');
	return menu;
}

const titles = (menu: Menu): string[] => menu.items.map((item) => item.titleText);

/** Activate a menu entry by its exact title. */
function click(menu: Menu, title: string): void {
	const item = menu.item(title);
	if (!item) throw new Error(`no menu entry "${title}" in [${titles(menu).join(' | ')}]`);
	item.click();
}

/** The suggester the last menu click opened. */
function suggester(): FuzzySuggestModal<unknown> {
	const modal = Modal.lastOpened;
	if (!(modal instanceof FuzzySuggestModal)) throw new Error('no suggester opened');
	return modal as FuzzySuggestModal<unknown>;
}

/** Rebuild the model with one note dropped from the Base's own results — the way an
 *  external edit can remove a note while a suggester sits open over it. */
function refreshExcluding(view: ProductBacklogView, vault: FakeVault, path: string): void {
	(view as unknown as Record<string, unknown>).data = { data: vault.entries().filter((e) => e.file.path !== path) };
	view.onDataUpdated();
}

/** Rebuild the model with a DIFFERENT file object at the same path — the shape a note
 *  deleted and recreated under its own name leaves behind. Obsidian mutates a renamed
 *  file in place, so this is the one way `byPath` can hold something that is not the
 *  note the menu was opened on. */
function refreshReplacingFile(view: ProductBacklogView, vault: FakeVault, path: string): void {
	const entries = vault.entries().map((e) => (e.file.path === path ? { ...e, file: new TFile(path) } : e));
	(view as unknown as Record<string, unknown>).data = { data: entries };
	view.onDataUpdated();
}

describe('when the entries are offered at all', () => {
	it('offers both on a result carrying the key, and no removal without it', () => {
		const vault = vaultWith({ B: { dependsOn: 'A' } });
		const { containerEl } = makeView(vault, withKey);

		expect(titles(openMenu(containerEl, 'B'))).toContain('Remove dependency…');
		expect(titles(openMenu(containerEl, 'B'))).toContain('Depends on…');
		// A carries no key at all, so there is nothing it could remove.
		expect(titles(openMenu(containerEl, 'A'))).toContain('Depends on…');
		expect(titles(openMenu(containerEl, 'A'))).not.toContain('Remove dependency…');
	});

	it('offers neither on a row the Base excluded', () => {
		const vault = vaultWith();
		// The epic is context: loaded to place its children, never a write target.
		const { containerEl } = makeView(vault, withKey, {
			only: ['A.md', 'B.md', 'C.md'],
		});

		const entries = titles(openMenu(containerEl, 'Epic'));
		expect(entries).not.toContain('Depends on…');
		expect(entries).not.toContain('Remove dependency…');
		// Withheld here AND refused at the gate: the menu is what stops it being offered,
		// `applySafely` is what stops it landing. Removing this guard alone writes
		// nothing, which is why the rule needs stating at the control as well.
		expect(titles(openMenu(containerEl, 'B'))).toContain('Depends on…');
	});

	it('offers neither when the property is unbound', () => {
		const { containerEl } = makeView(vaultWith({ B: { dependsOn: 'A' } }));

		const entries = titles(openMenu(containerEl, 'B'));
		expect(entries).not.toContain('Depends on…');
		expect(entries).not.toContain('Remove dependency…');
	});

	it('offers the removal on a value that reads as nothing, and clears the key', async () => {
		// The key is present and holds nothing nameable. Keyed to the parsed list, this
		// control would be absent and the value unreachable from anywhere in the view.
		const vault = vaultWith({ B: { dependsOn: '' } });
		const { containerEl } = makeView(vault, withKey);

		expect(titles(openMenu(containerEl, 'B'))).toContain('Remove dependency…');
		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		expect(suggester().offered()).toEqual(['Remove the empty property']);
		suggester().choose('Remove the empty property');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
	});
});

describe('what the picker offers', () => {
	it('leaves out itself, what it already waits for, and anything that would loop', () => {
		// C waits on B, B waits on A. Offering A a prerequisite may not name B or C.
		const vault = vaultWith({ B: { dependsOn: 'A' }, C: { dependsOn: 'B' } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'A'), 'Depends on…');

		// Only the epic is left: B and C both already wait on A, transitively.
		expect(suggester().offered()).toEqual(['Epic Epic.md']);
	});

	it('says so rather than opening empty', () => {
		const vault = new FakeVault();
		vault.addFile('Only.md', { frontmatter: { type: 'PBI', order: 10 } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'Only'), 'Depends on…');

		expect(Modal.lastOpened).toBeNull();
	});

	it('leaves out a target already named through a broken, cyclic entry', () => {
		// A and B name each other, so `Dependencies as a property` 4b marks BOTH entries
		// broken — neither lands in `prerequisites`, only in `brokenPrerequisites`.
		const vault = vaultWith({ A: { dependsOn: 'B' }, B: { dependsOn: 'A' } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'A'), 'Depends on…');

		// B is already named on A's own list — the entry just happens to be broken — so
		// offering it again would be a no-op at the writer. Only what A does not yet
		// name remains.
		expect(suggester().offered()).toEqual(['Epic Epic.md', 'C C.md']);
	});

	it('offers a result the focus level currently hides', () => {
		// Every candidate here sits at the SAME level as A (a flat PBI fixture), so
		// focusing on PBI re-roots the tree there and Epic — one level up — drops out of
		// the rendered tree and the Base's own result set entirely.
		const vault = vaultWith();
		const { containerEl } = makeView(vault, withKey, { focus: 'PBI' });

		click(openMenu(containerEl, 'A'), 'Depends on…');

		// The link is to a note, not to a row: a result the focus level hides from view
		// is still legal vocabulary for a prerequisite.
		expect(suggester().offered()).toContain('Epic Epic.md');
	});
});

describe('the write', () => {
	it('lands on the item the menu was opened on, and nowhere else', async () => {
		const vault = vaultWith();
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Depends on…');
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toEqual(['[[A]]']);
		expect(vault.fm('A.md')['dependsOn']).toBeUndefined();
		expect(vault.writeLog.map((entry) => entry.path)).toEqual(['B.md']);
	});

	it('is taken back by one undo', async () => {
		const vault = vaultWith();
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Depends on…');
		suggester().choose('A');
		await flush();
		await view.undoLast();
		await flush();

		// The key goes with the last entry rather than being left empty.
		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('removes every entry one offered line stands for', async () => {
		// One dependency on screen, three lines on disk, two spellings.
		const vault = vaultWith({ B: { dependsOn: ['A', '[[A]]', 'A'] } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('groups a broken cyclic entry by the note it names, so one removal clears every spelling', async () => {
		// A and B name each other, so both entries are broken (a cycle) even though each
		// names a real note. B repeats its entry under two spellings of A.
		const vault = vaultWith({ A: { dependsOn: 'B' }, B: { dependsOn: ['A', '[[A]]'] } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		// One line for the pair, reading as the note it names rather than as raw text.
		expect(suggester().offered()).toEqual(['A A.md']);
		suggester().choose('A');
		await flush();

		// Both spellings gone in one action — leaving the second behind is B still
		// waiting on A, which is the defect a picker split by raw text would reintroduce.
		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('groups a genuine cycle by the note it names, and offers by raw text a note this base never loaded — never presenting one as the other', async () => {
		// A and B name each other: a genuine cycle, and both notes are in this base's
		// model. B also names Excluded, a real vault note the `only` filter never
		// returned and which is nobody's ancestor either, so it never enters the model
		// at all — `Dependencies as a property` 3b's "never loaded" case, not a typo.
		const vault = vaultWith({ A: { dependsOn: 'B' }, B: { dependsOn: ['A', '[[Excluded]]'] } });
		vault.addFile('Excluded.md', { frontmatter: { type: 'PBI', order: 99 } });
		const { containerEl } = makeView(vault, withKey, { only: ['Epic.md', 'A.md', 'B.md', 'C.md'] });

		click(openMenu(containerEl, 'B'), 'Remove dependency…');

		// The cyclic entry resolves to the note it names, by title, exactly as a broken
		// self-reference does. The out-of-model entry is offered by its own raw text
		// with the "does not resolve" detail — never by a title this base cannot vouch
		// for, and never grouped as though it named a note the base knows.
		expect(suggester().offered()).toEqual(['A A.md', '[[Excluded]] Does not resolve in this base']);
	});

	it('removes a broken entry the same way, however many times it repeats', async () => {
		const vault = vaultWith({ B: { dependsOn: ['[[Missing]]', '[[Missing]]'] } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		// One line for the pair — offering two would be YAML on screen.
		expect(suggester().offered()).toEqual(['[[Missing]] Does not resolve in this base']);
		suggester().choose('[[Missing]]');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('writes nothing when the note gained the prerequisite while the menu was open', async () => {
		const vault = vaultWith();
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Depends on…');
		// The stale-refresh race, which is the only way this state is reachable: the
		// dependency arrives between the menu being built and the pick landing.
		vault.fm('B.md')['dependsOn'] = ['[[A]]'];
		suggester().choose('A');
		await flush();

		// Not appended twice. A second entry would read as no visible change, and its
		// inverse — which drops every line naming A — would take the other one too.
		expect(vault.fm('B.md')['dependsOn']).toEqual(['[[A]]']);
		// And it costs nothing: a write that changed nothing emits no inverse, so it must
		// not spend the single undo slot on a change the user cannot see.
		expect(view.canUndo()).toBe(false);
	});

	it('refuses a pick that would close a loop after the model refreshed while the picker was open', async () => {
		// A stale pick, not a stale write: the offer excluded nothing at open time, then
		// B gains a dependency on A before the choice lands — picking B for A now would
		// close the very loop the offer was built to keep out.
		const vault = vaultWith();
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'A'), 'Depends on…');
		expect(suggester().offered()).toContain('B B.md');
		vault.fm('B.md')['dependsOn'] = 'A';
		refresh(view, vault);
		suggester().choose('B');
		await flush();

		expect(vault.fm('A.md')['dependsOn']).toBeUndefined();
		expect(view.canUndo()).toBe(false);
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('leaves the other entries alone when one of several goes', async () => {
		const vault = vaultWith({ C: { dependsOn: ['A', 'B'] } });
		const { containerEl } = makeView(vault, withKey);

		click(openMenu(containerEl, 'C'), 'Remove dependency…');
		suggester().choose('A');
		await flush();

		expect(vault.fm('C.md')['dependsOn']).toEqual(['B']);
	});

	it('writes nothing when the source note leaves the Base while the "Depends on…" picker is open', async () => {
		// B is not an ancestor of anything here, so dropping it from the Base's results
		// removes it from the model entirely — it is not even a context row — which is
		// the shape `outsideFilter` alone cannot catch.
		const vault = vaultWith();
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Depends on…');
		refreshExcluding(view, vault, 'B.md');
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
		expect(view.canUndo()).toBe(false);
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('writes nothing when the source note leaves the Base while the "Remove dependency…" picker is open', async () => {
		const vault = vaultWith({ B: { dependsOn: 'A' } });
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		refreshExcluding(view, vault, 'B.md');
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBe('A');
		expect(view.canUndo()).toBe(false);
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('writes nothing when the OFFERED prerequisite is replaced by another at the same path', async () => {
		// The mirror of the source-side guard: the picker's captured file is detached, and
		// the link would be written from it, naming a note the user never chose.
		const vault = vaultWith();
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Depends on…');
		refreshReplacingFile(view, vault, 'A.md');
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
		expect(view.canUndo()).toBe(false);
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('still removes a prerequisite renamed while the picker was open', async () => {
		const vault = vaultWith({ B: { dependsOn: '[[A]]' } });
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		// Obsidian renames by mutating the one file object AND rewriting the links that
		// named it. The fake does the first; the second is done here as the external edit
		// it is. A choice holding the path it was built with would now match no live
		// entry, and the pick would close the picker having removed nothing.
		vault.renameFile('A.md', 'A renamed.md');
		vault.fm('B.md')['dependsOn'] = '[[A renamed]]';
		refresh(view, vault);
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
	});

	it('writes nothing when the chosen unresolvable entry is gone from the note', async () => {
		const vault = vaultWith({ B: { dependsOn: 'Ghost' } });
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		// Removed by hand while the picker sat open. `removeRaw` matches on text, so the
		// delta would find no line, write nothing, and close as though it had worked.
		vault.fm('B.md')['dependsOn'] = 'Other ghost';
		refresh(view, vault);
		suggester().choose('Ghost');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBe('Other ghost');
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('writes nothing when the source stopped naming the chosen prerequisite', async () => {
		const vault = vaultWith({ B: { dependsOn: '[[A]]' } });
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		// A still exists — the earlier guard passes — but B no longer waits for it, so
		// there is no line for this pick to take out.
		delete vault.fm('B.md')['dependsOn'];
		refresh(view, vault);
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('writes nothing when the prerequisite is DELETED while the picker was open', async () => {
		const vault = vaultWith({ B: { dependsOn: '[[A]]' } });
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Remove dependency…');
		vault.files.delete('A.md');
		refresh(view, vault);
		suggester().choose('A');
		await flush();

		// Nothing resolves to that path now, so the delta had no line to take out. The
		// entry survives — and reopening the picker offers it as unresolved raw text,
		// which is removable. What must not happen is the silent close.
		expect(vault.fm('B.md')['dependsOn']).toBe('[[A]]');
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});

	it('writes nothing when the source note is replaced by another at the same path', async () => {
		// The path still resolves, and the replacement is a perfectly ordinary result —
		// so a path-only recheck passes and the batch writes through the captured, now
		// detached file. Identity is the only question that separates the two.
		const vault = vaultWith();
		const { containerEl, view } = makeView(vault, withKey);

		click(openMenu(containerEl, 'B'), 'Depends on…');
		refreshReplacingFile(view, vault, 'B.md');
		suggester().choose('A');
		await flush();

		expect(vault.fm('B.md')['dependsOn']).toBeUndefined();
		expect(view.canUndo()).toBe(false);
		expect(Notice.messages.some((m) => m.includes('changed while the picker was open'))).toBe(true);
	});
});
