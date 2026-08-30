// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { drag, flush, makeView, rowByTitle, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * A focus level re-roots the tree at one rung, and Task 5 makes those promoted rows a
 * legal rank destination: `siblingPosition` now answers for two active focus rows
 * rather than refusing on `item.focusRoot`. Two epics, so the two PBIs it ranks against
 * each other have different REAL parents — the case the brief resolves explicitly: the
 * rank writes `order` and never touches `parent`.
 */
function focusedFixture() {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
	vault.addFile('PBI A1.md', { frontmatter: { type: 'PBI', order: 2000 }, parentLink: 'Epic A' });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 3000 } });
	vault.addFile('PBI B1.md', { frontmatter: { type: 'PBI', order: 4000 }, parentLink: 'Epic B' });
	return vault;
}

describe('focus rows accept a rank', () => {
	it('ranks a focused PBI above one with a different parent, writing order only', async () => {
		const vault = focusedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });
		// Captured before the drop: `parentLink` seeds a real `parent: [[Epic B]]` key
		// (Obsidian indexes a resolved bracketed link), so the write's whole frontmatter
		// object is compared rather than probing for one key's absence — an implementation
		// that reparented onto the hovered row's own parent would still leave a `parent`
		// key on the note, just holding `[[Epic A]]` instead.
		const before = { ...vault.fm('PBI B1.md') };

		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'before');
		await flush();

		expect(vault.writeLog.map((w) => w.path)).toEqual(['PBI B1.md']);
		// Every other key, `parent` included, is exactly what it was — only `order` moved.
		expect(vault.fm('PBI B1.md')).toEqual({ ...before, order: 1500 });
	});

	it('drops a focused row back onto its own position and writes nothing', async () => {
		const vault = focusedFixture();
		const { containerEl } = makeView(vault, {}, { focus: 'PBI' });

		// PBI B1 is already second; dropping it right after PBI A1 asks for the slot
		// it already occupies. `peers` reproduces `model.roots` when the row is
		// spliced back in, so this must read as no move at all rather than a rank
		// that spends the undo slot with nothing changed on screen.
		drag(rowByTitle(containerEl, 'PBI B1'), rowByTitle(containerEl, 'PBI A1'), 'after');
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});
