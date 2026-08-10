// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pickStateColorsCommand } from '../../src/commands/stateColors';
import { stateColorKey } from '../../src/domain/stateColors';
import { FileView, Modal } from '../helpers/obsidian-mock';
import { makeView, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

useViewHarness();

/**
 * The palette's way into the picker, driven through the REAL view — the command reaches
 * one only through `registry.ts`, so what is worth checking is exactly that seam: whether
 * it offers itself, and whether the thing it opens is the same dialog the `⋯` opens.
 */

const WORKFLOW = { stateProperty: 'note.status', stateValues: 'New, Active' };
const BASE = 'work/Product Backlog.base';

/** A view over a backlog, open in the leaf the workspace calls active. */
function openBacklog() {
	const vault = new FakeVault();
	vault.addFile('P.md', { frontmatter: { type: 'PBI', order: 10, status: 'Active' } });
	const { view } = makeView(vault, WORKFLOW, { base: BASE, collapsed: true });
	vault.activeView = vault.leaves[vault.leaves.length - 1].view;
	return { vault, view };
}

describe('the state colours command', () => {
	it('offers itself only while a backlog view is the active leaf', () => {
		const { vault } = openBacklog();
		expect(pickStateColorsCommand(vault.app as never, true)).toBe(true);

		// An ordinary note: there is no workflow to colour, and no view to colour it in.
		vault.activeView = new FileView(vault.addFile('Notes.md'), document.body.createDiv());
		expect(pickStateColorsCommand(vault.app as never, true)).toBe(false);

		vault.activeView = null;
		expect(pickStateColorsCommand(vault.app as never, false)).toBe(false);
	});

	it('opens the same dialog the ⋯ entry does, and writes through it', () => {
		// One function serves both inputs (`StateColorTarget`), so this asserts the command
		// reaches the whole flow rather than a copy of it: the rows are the view's own
		// vocabulary, and Save lands on the view's own `.base`.
		const { vault, view } = openBacklog();
		expect(pickStateColorsCommand(vault.app as never, false)).toBe(true);

		const modal = Modal.lastOpened;
		if (!modal) throw new Error('the command opened no dialog');
		const inputs = modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="color"]');
		expect(Array.from(inputs)).toHaveLength(2);

		inputs[0].value = '#123456';
		inputs[0].dispatchEvent(new Event('change'));
		const save = Array.from(modal.contentEl.querySelectorAll('button')).find((el) => el.textContent === 'Save');
		save?.dispatchEvent(new MouseEvent('click'));

		expect(view.config.setCalls).toEqual([{ key: stateColorKey('New'), value: '#123456' }]);
	});

	it('withholds itself while the view is still waiting for its first results', () => {
		// The rows come from the palettes, which come from the model: with none there is
		// nothing to open the dialog onto, and a command that opened an empty one would be
		// offering a control that cannot work yet.
		const vault = new FakeVault();
		const { view } = makeView(vault, WORKFLOW, { base: BASE, collapsed: true });
		vault.activeView = vault.leaves[vault.leaves.length - 1].view;
		(view as unknown as { model: unknown }).model = null;

		expect(pickStateColorsCommand(vault.app as never, true)).toBe(false);
	});
});
