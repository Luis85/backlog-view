// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import {
	clickExpandAll,
	flush,
	key,
	makeView,
	projectionButton,
	rowByTitle,
	titlesOf,
	treeOf,
	useViewHarness,
} from '../helpers/view';

useViewHarness();

/**
 * One rule at several entry points: **no move may change which projection draws the
 * row.** `ladderFor` chains from the parent for a `Task` and for a note with no `type`,
 * so a reparent that hands either of them a parent on the other ladder takes the row off
 * the screen it was acted on. Extension 1c of
 * `docs/requirements/Test suite and test case as a ladder of their own.md` withheld that
 * act from the top-level CREATOR; the drop on the tree background and then outdent were
 * each found missing it afterwards, which is why one predicate answers for all of them
 * now. That drop was itself deleted on 2026-08-11 — a gate leaving the set is what the
 * predicate is for, and it costs the rule nothing.
 *
 * Every refusal below is asserted on a `Task` **and** on a typeless note, and every one
 * has a row beside it that must still be offered the command. A guard written as
 * `typeName === 'Task'` passes the first row of each pair while never asking the ladder,
 * and an over-wide refusal passes both while breaking the third.
 */
function twoLadders(): FakeVault {
	const vault = new FakeVault();
	// Every rank DISTINCT, in the tree's own order: `order` ranks the whole backlog now,
	// so two rows sharing a number are a spent gap the placement refuses — and a refusal
	// for arithmetic would withhold the very commands this file asserts are offered.
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	// A suite whose whole subtree is in the catalog: the rows that must keep the command.
	vault.addFile('Suite.md', { frontmatter: { type: 'Test suite', order: 20 } });
	vault.addFile('Case.md', { frontmatter: { type: 'Test case', order: 30 }, parentLink: 'Suite' });
	vault.addFile('Good task.md', { frontmatter: { type: 'Task', order: 40 }, parentLink: 'Case' });
	// The advisory mis-drag: a case under a work item, drawn in the catalog as a promoted
	// root. Its children's GRANDPARENT is the Epic, which is where outdent would land them.
	vault.addFile('Stray case.md', { frontmatter: { type: 'Test case', order: 50 }, parentLink: 'Epic' });
	vault.addFile('Stray task.md', { frontmatter: { type: 'Task', order: 60 }, parentLink: 'Stray case' });
	vault.addFile('Stray note.md', { frontmatter: { order: 70 }, parentLink: 'Stray case' });
	return vault;
}

/** Switch to the catalog through the real toolbar and open everything it drew. */
function catalog(containerEl: HTMLElement): void {
	projectionButton(containerEl, 'Show as test catalog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
	clickExpandAll(containerEl);
}

/** Whether the row's own context menu carries the entry. */
function offers(containerEl: HTMLElement, title: string, entry: string): boolean {
	rowByTitle(containerEl, title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	return Menu.lastShown?.item(entry) !== undefined;
}

describe('outdent across the two ladders', () => {
	it('is withheld where the grandparent is on the other ladder', () => {
		// `Epic → Stray case → Stray task`: the task is an ordinary child, so outdent used
		// to be offered — and taking it reparented the task under the hidden Epic, where
		// `ladderFor` re-answers from the new parent and the row left the catalog.
		const { containerEl } = makeView(twoLadders());
		catalog(containerEl);

		expect(offers(containerEl, 'Stray task', 'Outdent')).toBe(false);
		expect(offers(containerEl, 'Stray note', 'Outdent')).toBe(false);
	});

	it('is still offered where the row keeps the projection it is drawn in', () => {
		const { containerEl } = makeView(twoLadders());
		catalog(containerEl);

		// `Suite → Case → Good task` — outdenting lands it under the suite, still the test
		// ladder, so this narrows exactly the move that changes screens and nothing else.
		expect(offers(containerEl, 'Good task', 'Outdent')).toBe(true);
		// And a row whose own NAME decides its ladder is unaffected by losing its parent.
		expect(offers(containerEl, 'Case', 'Outdent')).toBe(true);
	});

	it('withholds the keyboard path with the menu, both asking one target', async () => {
		// Alt+ArrowLeft is the second input to the same move, and `outdentTarget` is what
		// both ask — so the refusal has to hold where the menu was never opened.
		const vault = twoLadders();
		const { containerEl } = makeView(vault);
		catalog(containerEl);
		const tree = treeOf(containerEl);
		const steps = titlesOf(containerEl).indexOf('Stray task') + 1;
		for (let i = 0; i < steps; i += 1) key(tree, 'ArrowDown');

		key(tree, 'ArrowLeft', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(vault.fm('Stray task.md')['parent']).toBe('[[Stray case]]');
	});
});

/**
 * `Clear parent link` and `Use folder position` reparent without producing a
 * `DropTarget` at all: they delete the parent key and let folder inference re-home the
 * note. In folder mode that landing place is a real parent, so the same rule applies —
 * and the refusal has to be the absent ENTRY rather than a refused write, since this
 * repo's rule is absent rather than inert.
 */
function folderVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('plan/Epic/Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('plan/Other.md', { frontmatter: { type: 'Epic', order: 20 } });
	vault.addFile('tests/Suite/Suite.md', { frontmatter: { type: 'Test suite', order: 30 } });
	// An unresolved link — `[[Missing]]` with no such note, so no `frontmatterLinks`
	// entry, which is what a vault produces for a link that resolves to nothing. Folder
	// inference is suppressed while the key is there, so the note draws in the plan; the
	// suite one folder up is where clearing the key would send it.
	vault.addFile('tests/Suite/Stray note.md', { frontmatter: { order: 10, parent: '[[Missing]]' } });
	vault.addFile('plan/Epic/Plain note.md', { frontmatter: { order: 20, parent: '[[Missing]]' } });
	// The same two cases for the override: a `Task` whose explicit parent hides a folder
	// position on the other ladder, and one whose folder position is on its own.
	vault.addFile('tests/Suite/Overridden.md', { frontmatter: { type: 'Task', order: 30 }, parentLink: 'Epic' });
	vault.addFile('plan/Epic/Moved.md', { frontmatter: { type: 'Task', order: 40 }, parentLink: 'Other' });
	return vault;
}

describe('handing an item back to the folder hierarchy', () => {
	it('withholds both actions when the folder position is on the other ladder', () => {
		const { containerEl } = makeView(folderVault(), { inferFolderHierarchy: true });

		expect(offers(containerEl, 'Stray note', 'Clear parent link')).toBe(false);
		expect(offers(containerEl, 'Overridden', 'Use folder position')).toBe(false);
	});

	it('still offers them when the folder position keeps the row where it is', () => {
		const { containerEl } = makeView(folderVault(), { inferFolderHierarchy: true });

		expect(offers(containerEl, 'Plain note', 'Clear parent link')).toBe(true);
		expect(offers(containerEl, 'Moved', 'Use folder position')).toBe(true);
	});

	it('withholds nothing outside folder mode, where the cleared note becomes a root', () => {
		// With no inference the note lands at the top level, which is the ladder it is
		// already answering as an unresolved orphan — nothing to withhold.
		const { containerEl } = makeView(folderVault());

		expect(offers(containerEl, 'Stray note', 'Clear parent link')).toBe(true);
	});
});
