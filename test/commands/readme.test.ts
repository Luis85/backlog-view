// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { writeBacklogReadmeCommand } from '../../src/commands/readme';
import { README_MARKER_PREFIX } from '../../src/domain/readmeMarker';
import { defaultSettings } from '../../src/domain/settings';
import { activeBacklogView, forgetBacklogView, rememberBacklogView } from '../../src/view/registry';
import { FileView, Notice } from '../helpers/obsidian-mock';
import { flush, makeView, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

/**
 * The command is a write, so it is driven through the REAL view: what it documents is
 * whatever that view resolved, and the only honest way to assert that is to configure
 * a view and read the file that comes out.
 */

useViewHarness();

const BASE = 'work/Product Backlog.base';
const README = 'work/README_PRODUCT_BACKLOG.md';

/** A view over a backlog, open in the leaf the workspace calls active. */
function openBacklog(configValues: Record<string, unknown> = {}): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'Doing' } });
	makeView(vault, { homeFolder: 'work', ...configValues }, { base: BASE });
	vault.activeView = vault.leaves[vault.leaves.length - 1].view;
	return vault;
}

/** The element of the leaf a `makeView` call mounted into. */
function leafElOf(vault: FakeVault, index: number): HTMLElement {
	return (vault.leaves[index].view as FileView).containerEl;
}

describe('the write backlog readme command', () => {
	it('offers itself only while a backlog view is the active leaf', () => {
		const vault = openBacklog();
		expect(writeBacklogReadmeCommand(vault.app as never, true)).toBe(true);

		// The user moved to an ordinary note: there is no configuration to describe.
		const note = new FileView(vault.addFile('Notes.md'), document.body.createDiv());
		vault.activeView = note;
		expect(writeBacklogReadmeCommand(vault.app as never, true)).toBe(false);

		vault.activeView = null;
		expect(writeBacklogReadmeCommand(vault.app as never, true)).toBe(false);
	});

	it('withholds itself while the view is still waiting for its first result set', () => {
		const vault = openBacklog();
		// Its own leaf: a view that has not been handed data yet. An empty observed-state
		// list here is "not loaded", not "no states", and generating from it would strip a
		// good readme of its whole vocabulary.
		const leafEl = document.body.createDiv();
		const leaf = new FileView(vault.addFile('other/Other.base'), leafEl);
		const loading = { viewEl: leafEl.createDiv(), settings: defaultSettings(), model: null };
		rememberBacklogView(loading);
		vault.activeView = leaf;

		expect(writeBacklogReadmeCommand(vault.app as never, true)).toBe(false);

		forgetBacklogView(loading);
	});

	it('writes the readme into the view s home folder, from the view s own settings', async () => {
		const vault = openBacklog({ parentProperty: 'note.up', stateProperty: 'note.status' });

		expect(writeBacklogReadmeCommand(vault.app as never, false)).toBe(true);
		await flush();

		const content = vault.contents.get(README) ?? '';
		expect(content.startsWith(README_MARKER_PREFIX)).toBe(true);
		// The marker names the view that wrote it, base and view name both.
		expect(content).toContain(`from "${BASE} › Backlog"`);
		expect(content).toContain('| `up` |');
		// The state vocabulary is the one the view offers, which no setting holds: this
		// base declares no workflow, so the value on the one note is what it has.
		expect(content).toContain('| `Doing` | No | Observed in these notes |');
		expect(Notice.messages.some((m) => m.startsWith(`Wrote "${README}"`))).toBe(true);
	});

	it('generates a file that cannot enrol itself in the backlog it documents', async () => {
		const vault = openBacklog();

		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		// No frontmatter at all: no type and no parent is what keeps it out of the tree
		// under the default scope setting, and a generated file must not declare either.
		expect(vault.contents.get(README)?.startsWith('---')).toBe(false);
		expect(vault.frontmatter.get(README)).toEqual({});
		expect(vault.writeLog).toEqual([]);
	});

	it('persists nothing about itself', async () => {
		const vault = openBacklog();

		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		// Not a base setting and not working position: the command has no state to keep.
		expect(vault.localStorage.size).toBe(0);
	});

	it('writes nothing the second time, and says so', async () => {
		const vault = openBacklog();
		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();
		const first = vault.contents.get(README);
		Notice.reset();

		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		expect(vault.contents.get(README)).toBe(first);
		expect(Notice.messages.some((m) => m.includes('already matches'))).toBe(true);
	});

	it('leaves a readme somebody else wrote alone', async () => {
		const vault = openBacklog();
		await vault.app.vault.create(README, '# Notes I keep here myself\n');

		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		expect(vault.contents.get(README)).toBe('# Notes I keep here myself\n');
		expect(Notice.messages.some((m) => m.includes('was not written by this plugin'))).toBe(true);
	});

	it('names the view whose readme it replaced, rather than saying only "updated"', async () => {
		// Two bases, one home folder, different keys. The second view takes the folder's
		// one readme — but never silently, which was the whole complaint against a
		// generic marker.
		const vault = openBacklog();
		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();
		const first = vault.contents.get(README);
		Notice.reset();

		makeView(vault, { homeFolder: 'work', parentProperty: 'note.up' }, { base: 'work/Other.base' });
		vault.activeView = vault.leaves[1].view;
		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		expect(vault.contents.get(README)).not.toBe(first);
		expect(Notice.messages.some((m) => m.includes(`which documented "${BASE} › Backlog"`))).toBe(true);
	});

	it('refuses while the configuration contradicts itself', async () => {
		// Parent and order on one key: every write path is gated on this, and a document
		// generated from it would state that key as the one answer for both roles.
		const vault = openBacklog({ parentProperty: 'note.rank', orderProperty: 'note.rank' });

		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		expect(vault.files.has(README)).toBe(false);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view configuration first'))).toBe(true);
	});

	it('reports a failed write instead of failing silently', async () => {
		const vault = openBacklog();
		vault.app.vault.create = () => Promise.reject(new Error('disk full'));
		const logged: unknown[] = [];
		console.error = (...args: unknown[]) => logged.push(args);

		writeBacklogReadmeCommand(vault.app as never, false);
		await flush();

		expect(Notice.messages.some((m) => m.includes('See the developer console'))).toBe(true);
		expect(logged.length).toBe(1);
	});
});

describe('the live view registry', () => {
	it('forgets a view that has been unloaded', () => {
		const vault = openBacklog();
		expect(activeBacklogView(vault.app as never)).not.toBeNull();

		const view = activeBacklogView(vault.app as never);
		(view as unknown as { onunload: () => void }).onunload();

		expect(activeBacklogView(vault.app as never)).toBeNull();
	});

	it('picks the view in the active leaf, not merely any open one', () => {
		const vault = openBacklog();
		const other = makeView(vault, { homeFolder: 'other' }, { base: 'other/Other.base' });

		vault.activeView = vault.leaves[1].view;
		expect(activeBacklogView(vault.app as never)).toBe(other.view);

		vault.activeView = vault.leaves[0].view;
		expect(activeBacklogView(vault.app as never)).not.toBe(other.view);
	});

	it('answers nothing when one leaf holds two backlog views', () => {
		// A note with two embedded bases: picking either would generate one base's
		// contract over the other's file, which is a wrong answer that looks right.
		const vault = openBacklog();
		const second = { viewEl: leafElOf(vault, 0).createDiv(), settings: defaultSettings(), model: null };
		rememberBacklogView(second);

		expect(activeBacklogView(vault.app as never)).toBeNull();

		forgetBacklogView(second);
		expect(activeBacklogView(vault.app as never)).not.toBeNull();
	});

	it('tells two leaves showing the same base apart', () => {
		// One `.base` in two split panes is two views with two configurations and one
		// path, so the file cannot choose between them — only the leaf can.
		const vault = openBacklog();
		const second = makeView(vault, { homeFolder: 'elsewhere' }, { base: BASE });

		vault.activeView = vault.leaves[0].view;
		expect(activeBacklogView(vault.app as never)).not.toBe(second.view);

		vault.activeView = vault.leaves[1].view;
		expect(activeBacklogView(vault.app as never)).toBe(second.view);
	});
});
