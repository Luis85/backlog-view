// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { respaceRanksCommand, seedRanksCommand } from '../../src/commands/rank';
import { FileView, Modal, Notice } from '../helpers/obsidian-mock';
import { flush, makeView, refresh, useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';

/**
 * The two whole-population rewrites, driven through the REAL view: both reach the vault
 * through that view's own write gate, and the thing worth checking is what lands in the
 * frontmatter rather than what a plan returned.
 *
 * **The dialog is what makes this suite necessary.** Every other write in this plugin is
 * planned and applied inside one turn; these two put a modal between the plan and the
 * write, and a modal can stay open across a vault sync, a rename, a base being closed and
 * the user navigating to a different one. So the batch is recomputed on confirm and the
 * view is re-resolved from the registry — and the tests below are the three things that
 * costs, one per way the world can move underneath an open dialog.
 */
useViewHarness();

/** Press the confirmation's CTA. The dialog is mounted by the Modal mock, not into the
 *  view, so it is reached through `Modal.lastOpened`. */
function confirm(): void {
	Modal.lastOpened?.contentEl.querySelector<HTMLElement>('.mod-cta')?.click();
}

/** A view over a small tree, open in the leaf the workspace calls active. */
function openBacklog(vault: FakeVault, base = 'Backlog.base', only?: string[]) {
	const harness = makeView(vault, {}, { base, only });
	vault.activeView = vault.leaves[vault.leaves.length - 1].view;
	return harness;
}

/** Two epics whose EXISTING ranks contradict the order they are drawn in — the one shape
 *  Seed repairs and the backfill cannot, since neither rank is blank. */
function crossedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 9000 } });
	vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 100 }, parentLink: 'Epic A' });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 9500 } });
	return vault;
}

const orderOf = (vault: FakeVault, path: string): unknown => vault.fm(path)['order'];

describe('the seed and respace rank commands', () => {
	it('offer themselves only while a backlog view is the active leaf', () => {
		const vault = crossedVault();
		openBacklog(vault);
		expect(seedRanksCommand(vault.app as never, true)).toBe(true);
		expect(respaceRanksCommand(vault.app as never, true)).toBe(true);

		vault.activeView = new FileView(vault.addFile('Notes.md'), document.body.createDiv());
		expect(seedRanksCommand(vault.app as never, true)).toBe(false);
		expect(respaceRanksCommand(vault.app as never, true)).toBe(false);
	});

	it('writes nothing until the confirmation is answered', () => {
		const vault = crossedVault();
		openBacklog(vault);

		expect(seedRanksCommand(vault.app as never, false)).toBe(true);

		// The count in the dialog is the plan's, said before the user can answer.
		expect(Modal.lastOpened?.contentEl.textContent).toContain('Rank 3 notes in the order they appear');
		expect(vault.writeLog).toEqual([]);
	});

	it('seeds the drawn order into ranks, and says how many', async () => {
		const vault = crossedVault();
		openBacklog(vault);

		seedRanksCommand(vault.app as never, false);
		confirm();
		await flush();

		// DFS preorder over the real tree: Epic A, its child, then Epic B — which is the
		// opposite of what the ranks said, and the whole point of the command.
		const ranks = ['Epic A.md', 'A1.md', 'Epic B.md'].map((path) => orderOf(vault, path) as number);
		expect(ranks[0]).toBeLessThan(ranks[1]);
		expect(ranks[1]).toBeLessThan(ranks[2]);
		expect(Notice.messages).toEqual(['Ranked 3 notes']);
	});

	it('respaces without changing the order already on screen', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2 } });
		openBacklog(vault);

		respaceRanksCommand(vault.app as never, false);
		expect(Modal.lastOpened?.contentEl.textContent).toContain('Rewrite the ranks of 2 notes');
		confirm();
		await flush();

		const a = orderOf(vault, 'Epic A.md') as number;
		const b = orderOf(vault, 'Epic B.md') as number;
		expect(a).toBeLessThan(b);
		// Respaced, not merely kept: the pair started one apart and ends a full spacing
		// apart, which is what makes room for a drop between them.
		expect(b - a).toBeGreaterThan(1);
	});

	it('warns that respacing will redraw a population that is not distinctly ranked', async () => {
		// Legacy, sibling-scoped ranks: `Epic A`'s child holds 100 and so does `Epic B`'s.
		// Every focused list of them is drawn in TREE order (`inRankOrder`'s guard), and the
		// rank order this rewrites into is a different sequence — so "keeping the order they
		// are in now" is not what would happen.
		const vault = crossedVault();
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 100 }, parentLink: 'Epic B' });
		openBacklog(vault);

		respaceRanksCommand(vault.app as never, false);

		expect(Modal.lastOpened?.contentEl.textContent).toContain('Some lists are drawn in tree order');
		// The PLAN is untouched by the sentence: it still respaces every writable note.
		confirm();
		await flush();
		expect(vault.writeLog.map((w) => w.path).sort()).toEqual(['A1.md', 'B1.md', 'Epic A.md', 'Epic B.md']);
	});

	it('says nothing extra when every rank is already distinct', () => {
		const vault = crossedVault();
		openBacklog(vault);

		respaceRanksCommand(vault.app as never, false);

		expect(Modal.lastOpened?.contentEl.textContent).toContain('Rewrite the ranks of 3 notes');
		expect(Modal.lastOpened?.contentEl.textContent).not.toContain('Some lists are drawn in tree order');
	});

	it('writes nothing when the population stopped matching the caveat the dialog showed', async () => {
		// Distinct ranks when the dialog opened, so it promised to keep the order on screen
		// and showed no caveat. A sync then gives `Epic B`'s child the rank `A1` already
		// holds: every focused list of them falls back to tree order, and respacing would
		// write the rank order instead — the one thing the sentence they agreed to said
		// would not happen.
		const vault = crossedVault();
		const { view } = openBacklog(vault);

		respaceRanksCommand(vault.app as never, false);
		expect(Modal.lastOpened?.contentEl.textContent).not.toContain('Some lists are drawn in tree order');
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 100 }, parentLink: 'Epic B' });
		refresh(view, vault);
		confirm();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'The backlog changed while this dialog was open, and this command no longer does what the dialog said. Nothing was ranked — run it again to read the new warning.',
		]);
	});

	it('applies when the caveat the dialog showed stopped applying, rather than refusing twice', async () => {
		// The other direction: the dialog warned, the population became distinctly ranked
		// under it, and the sentence they agreed to is now merely stricter than the truth.
		// Refusing here would send the user back through a dialog saying less.
		const vault = crossedVault();
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 100 }, parentLink: 'Epic B' });
		const { view } = openBacklog(vault);

		respaceRanksCommand(vault.app as never, false);
		expect(Modal.lastOpened?.contentEl.textContent).toContain('Some lists are drawn in tree order');
		vault.fm('B1.md')['order'] = 200;
		refresh(view, vault);
		confirm();
		await flush();

		expect(vault.writeLog.map((w) => w.path).sort()).toEqual(['A1.md', 'B1.md', 'Epic A.md', 'Epic B.md']);
	});

	it('writes nothing when the view was closed while the dialog was open', async () => {
		const vault = crossedVault();
		const { view } = openBacklog(vault);

		seedRanksCommand(vault.app as never, false);
		view.onunload();
		confirm();
		await flush();

		// `onunload` leaves `model` non-null, so a captured view still answers with a
		// snapshot that stopped refreshing. Only the registry can tell the two apart.
		expect(vault.writeLog).toEqual([]);
	});

	it('writes nothing when another base became active while the dialog was open', async () => {
		const vault = crossedVault();
		openBacklog(vault, 'A.base');

		seedRanksCommand(vault.app as never, false);
		// The dialog counted base A. Re-resolving alone would rewrite whatever is active
		// NOW, which is worse than the staleness it replaced — so the SAME object is
		// required back, not merely a live one.
		openBacklog(vault, 'B.base');
		confirm();
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('ranks the model as it is on confirm, not as it was when the dialog opened', async () => {
		const vault = crossedVault();
		const { view } = openBacklog(vault);

		seedRanksCommand(vault.app as never, false);
		vault.addFile('Epic C.md', { frontmatter: { type: 'Epic', order: 9900 } });
		refresh(view, vault);
		confirm();
		await flush();

		// The captured batch would have overwritten every rank without this note in it,
		// which for a whole-population rewrite is data loss rather than a stale count.
		expect(vault.writeLog.map((w) => w.path)).toContain('Epic C.md');
		expect(Notice.messages).toEqual(['Ranked 4 notes']);
	});

	it('reports what the batch actually wrote, not what it planned, when a note stops it partway', async () => {
		const vault = crossedVault();
		openBacklog(vault);

		seedRanksCommand(vault.app as never, false);
		// Retyped by another window while the dialog was open: `applyWrites` reads the live
		// type as it opens the file and refuses the whole rest of the batch. Only `Epic A`,
		// planned before it, lands — so a notice saying 3 would contradict the refusal it
		// follows, over a rank population that is now half each scheme.
		vault.onNextProcess('A1.md', (fm) => {
			fm['type'] = 'Resource';
		});
		confirm();
		await flush();

		// `Epic B`, planned after the refusal, is never opened at all — the batch stops
		// where it stands rather than skipping past.
		expect(orderOf(vault, 'A1.md')).toBe(100);
		expect(orderOf(vault, 'Epic B.md')).toBe(9500);
		expect(Notice.messages).toEqual([
			'That note changed while the move was in flight, so the rest of the move was not written.',
			'Ranked 1 note',
		]);
	});

	it('says nothing was changed when a second respace writes no new rank', async () => {
		// Respace is correct any number of times, so the second run plans the same numbers
		// the first one wrote and every note it opens is a no-op. `written` counts those
		// files — it is how far the batch GOT, which is what the partial-batch notice above
		// needs — so reporting on it alone claims a rewrite over a vault nothing touched,
		// and the undo slot the sentence implies was never armed.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 1000 } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2000 } });
		const { view } = openBacklog(vault);

		respaceRanksCommand(vault.app as never, false);
		confirm();
		await flush();
		refresh(view, vault);
		Notice.messages.length = 0;

		respaceRanksCommand(vault.app as never, false);
		confirm();
		await flush();

		expect(Notice.messages).toEqual(['Every rank already holds the number this would write. Nothing was changed.']);
	});

	it('says so when there is nothing to rank, instead of confirming and going quiet', async () => {
		// A base returning nothing: the plan is empty, and `applySafely` answers null on an
		// empty batch before any refusal it could report.
		const vault = crossedVault();
		openBacklog(vault, 'Backlog.base', []);

		expect(seedRanksCommand(vault.app as never, false)).toBe(true);

		expect(Modal.lastOpened).toBeNull();
		expect(Notice.messages).toEqual(['There is nothing in this base to rank.']);
		expect(vault.writeLog).toEqual([]);
	});

	it('says so when the view it counted is gone by the time the dialog is answered', async () => {
		const vault = crossedVault();
		const { view } = openBacklog(vault);

		seedRanksCommand(vault.app as never, false);
		view.onunload();
		confirm();
		await flush();

		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'The backlog view this was started from is no longer showing, so nothing was ranked.',
		]);
	});

	it('names one squeezed note in the singular', () => {
		// One writable row between two excluded ranks a single grid step apart.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 2.0000002 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2.0000004 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 5000 }, parentLink: 'Epic B' });
		openBacklog(vault, 'Backlog.base', ['A1.md', 'B1.md']);

		expect(respaceRanksCommand(vault.app as never, false)).toBe(true);

		expect(Notice.messages).toEqual([
			'This item sits between two notes this base cannot write, with no room left between them: A1. Nothing was changed. Run this on an unfiltered base.',
		]);
	});

	it('says nothing of its own when the FIRST note stops the batch', async () => {
		// Nothing landed, so the writer's own refusal is the whole story — a "Ranked 0 notes"
		// beside it would be a second sentence about the same nothing.
		const vault = crossedVault();
		openBacklog(vault);

		seedRanksCommand(vault.app as never, false);
		vault.onNextProcess('Epic A.md', (fm) => {
			fm['type'] = 'Resource';
		});
		confirm();
		await flush();

		expect(Notice.messages).toEqual([
			'That note changed while the move was in flight, so nothing was written.',
		]);
	});

	it('changes nothing and names the notes when the writable rows are wedged', () => {
		// Two excluded epics a single grid step apart, with two results between them: no
		// pair of six-decimal ranks fits, and the run cannot be split without breaking the
		// order it keeps everywhere else.
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 2.0000002 }, parentLink: 'Epic A' });
		vault.addFile('A2.md', { frontmatter: { type: 'Feature', order: 2.0000004 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2.000001 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 5000 }, parentLink: 'Epic B' });
		openBacklog(vault, 'Backlog.base', ['A1.md', 'A2.md', 'B1.md']);

		expect(respaceRanksCommand(vault.app as never, false)).toBe(true);

		// No dialog at all: a wedged plan has nothing to confirm.
		expect(Modal.lastOpened).toBeNull();
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'2 items sit between two notes this base cannot write, with no room left between them: A1 and A2. Nothing was changed. Run this on an unfiltered base.',
		]);
	});

	// **The collision must not involve the ORDER key**, and the first version of this test
	// got that wrong: mapping `orderProperty` onto `note.parent` makes every rank unreadable,
	// so nothing wedges, the plan fills blanks instead, and the dialog opens — a different
	// path that reaches the gate and is already reported correctly. It would have passed
	// with the fix and failed without it for the wrong reason. `type`/`state` collide while
	// the ranks stay readable, which is the only shape that reproduces this defect.
	//
	// The SAME wedged vault, with the view options colliding as well. The wedged sentence
	// is a real remedy for a real problem — run it on an unfiltered base — and it is the
	// wrong thing to say here, because while `configProblems` is non-empty the gate refuses
	// every rank write and the user would come back to the same message. Extension 2c of
	// [[Ranking at the focused level]] states the rule; the drag path kept it through
	// `reportRefusal` and the commands did not, because a wedged or empty plan answers
	// before the gate is ever reached.
	it('names the configuration instead, when that is what blocks every remedy', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 2 } });
		vault.addFile('A1.md', { frontmatter: { type: 'Feature', order: 2.0000002 }, parentLink: 'Epic A' });
		vault.addFile('A2.md', { frontmatter: { type: 'Feature', order: 2.0000004 }, parentLink: 'Epic A' });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 2.000001 } });
		vault.addFile('B1.md', { frontmatter: { type: 'Feature', order: 5000 }, parentLink: 'Epic B' });
		makeView(vault, { stateProperty: 'note.type' }, { base: 'Backlog.base', only: ['A1.md', 'A2.md', 'B1.md'] });
		vault.activeView = vault.leaves[vault.leaves.length - 1].view;

		expect(respaceRanksCommand(vault.app as never, false)).toBe(true);

		expect(Modal.lastOpened).toBeNull();
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages).toEqual([
			'Fix the view options first: the type and state properties share the key "type".',
		]);
	});
});
