import { describe, expect, it } from 'vitest';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { BacklogModel, buildModel } from '../../src/domain/model';
import { BacklogSettings } from '../../src/domain/settings';
import { CivilDate } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';
import { releaseSettingsWith } from '../helpers/releaseSettings';

/** This suite is not about `today` either, so a fixed value stands in for it. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

const KEYS = releaseSettingsWith({
	parentKey: 'parent',
	orderKey: 'order',
	typeKey: 'type',
	membershipKey: 'release',
	versionKey: 'version',
	targetDateKey: 'target-date',
	statusKey: 'status',
});

function scopeOf(vault: FakeVault, path: string, settings: BacklogSettings = settingsWith()) {
	return scopeIn(buildModel(vault.app, vault.entries(), settings), vault, path, settings.stateKey);
}

/**
 * The index the view derives once per render, handed to the scope the same way. This
 * suite is not about `done`, so `stateKey` defaults to `settingsWith()`'s own — unbound —
 * default rather than a value chosen to make a figure interesting.
 */
function scopeIn(model: BacklogModel, vault: FakeVault, path: string, stateKey = '') {
	return releaseScope(vault.app, model, KEYS, releaseIndex(vault.app, model, KEYS, { stateKey, today: TODAY }), path);
}

describe("one release's scope", () => {
	it('draws a member under a non-member ancestor, and marks the ancestor context', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]' } });
		const scope = scopeOf(vault, 'R.md');
		expect(scope.rows.map((r) => [r.item.file.basename, r.depth, r.context])).toEqual([
			['E', 0, true],
			['F', 1, false],
		]);
		expect(scope.members).toBe(1);
	});

	it('never inherits membership down a subtree', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', release: '[[R]]' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E' } });
		const scope = scopeOf(vault, 'R.md');
		expect(scope.members).toBe(1);
		expect(scope.rows.map((r) => r.item.file.basename)).toEqual(['E']);
	});

	it('draws a member whose ancestor does not exist at all at top level', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'Gone', release: '[[R]]' } });
		expect(scopeOf(vault, 'R.md').rows.map((r) => [r.item.file.basename, r.depth])).toEqual([['F', 0]]);
	});

	it('draws a member whose ancestor EXISTS but the Base filtered out at top level', () => {
		// A DIFFERENT PATH from the one above, and the one that actually bites: `parent:
		// 'Gone'` names no file, so nothing is ever loaded. An excluded Epic is loaded — as a
		// context row, because `showOutsideParents` defaults to true — and would be rendered
		// as scope context by an ancestor walk that keeps every ancestor.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: '[[E]]', release: '[[R]]' }, parentLink: 'E' });
		// The Epic is loaded for placement but is NOT a result: filter it out of the entries.
		const entries = vault.entries().filter((e) => e.file.path !== 'E.md');
		const model = buildModel(vault.app, entries, settingsWith());
		// The fixture only tests what it claims if the Epic really did arrive as a context
		// row: with no `outsideFilter` ancestor loaded, the member is a root anyway and the
		// walk's skip decides nothing.
		expect(model.byPath.get('E.md')?.outsideFilter).toBe(true);
		const scope = scopeIn(model, vault, 'R.md');
		expect(scope.rows.map((r) => [r.item.file.basename, r.depth])).toEqual([['F', 0]]);
		expect(scope.members).toBe(1);
	});

	it('keeps an INCLUDED ancestor above an excluded one, rather than promoting to root', () => {
		// The walk skips the excluded ancestor and CONTINUES: the member keeps its place
		// under the Epic that is in the results, which is what "skip" has to mean here.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Top.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Mid.md', { frontmatter: { type: 'Feature', parent: '[[Top]]' }, parentLink: 'Top' });
		vault.addFile('F.md', { frontmatter: { type: 'PBI', parent: '[[Mid]]', release: '[[R]]' }, parentLink: 'Mid' });
		const entries = vault.entries().filter((e) => e.file.path !== 'Mid.md');
		const model = buildModel(vault.app, entries, settingsWith());
		expect(model.byPath.get('Mid.md')?.outsideFilter).toBe(true);
		const rows = scopeIn(model, vault, 'R.md').rows;
		expect(rows.map((r) => r.item.file.basename)).toEqual(['Top', 'F']);
		expect(rows.find((r) => r.item.file.basename === 'Top')?.context).toBe(true);
	});

	it('keeps a context ancestor even when its own state would hide it', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]' } });
		// The state key has to be BOUND, or the Epic is not done and the claim is untested:
		// with the default empty `stateKey` nothing reads `status` at all, so this passes on
		// a fixture whose ancestor was never finished.
		const rows = scopeOf(vault, 'R.md', settingsWith({ stateKey: 'status' })).rows;
		expect(rows.find((r) => r.item.file.basename === 'E')?.item.done).toBe(true);
		expect(rows.map((r) => r.item.file.basename)).toEqual(['E', 'F']);
	});

	it('is empty, and says which release, when nothing names it', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		const scope = scopeOf(vault, 'R.md');
		expect(scope.rows).toEqual([]);
		expect(scope.members).toBe(0);
		expect(scope.release?.name).toBe('R');
	});

	it('returns no release for a path that is gone', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		expect(scopeOf(vault, 'Vanished.md').release).toBeNull();
	});

	it('never draws a release as a row inside a release, excluded or not', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Other.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		// Filed UNDER the other release by hand, and a member of R.
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'Other', release: '[[R]]' } });
		const rows = scopeOf(vault, 'R.md').rows;
		// The marker draws no row AND does not take the member down with it. Asserting only
		// the absence of `Other` passes on an EMPTY list, which is the bug wearing the
		// test's own clothes, so the member's own row is asserted beside it.
		expect(rows.map((r) => r.item.file.basename)).not.toContain('Other');
		expect(rows.map((r) => [r.item.file.basename, r.depth])).toEqual([['F', 0]]);
	});

	it('reads the whole tree, never the focus-projected one', () => {
		// A focus level is the BACKLOG view's control, and it re-roots `model.roots` at the
		// topmost rows of that level. Walking from there would drop the Epic that holds this
		// member in place — so the origin is `realRoots`, and this is what says so.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ focusLevel: 'Feature' }));
		// The fixture only tests the origin if the focus really moved the root set: with the
		// two lists equal, both spellings walk the same forest and the assertion below holds
		// whichever one the code names.
		expect(model.realRoots.map((r) => r.file.basename)).toEqual(['R', 'E']);
		expect(model.roots.map((r) => r.file.basename)).toEqual(['F']);
		expect(scopeIn(model, vault, 'R.md').rows.map((r) => [r.item.file.basename, r.depth, r.context])).toEqual([
			['E', 0, true],
			['F', 1, false],
		]);
	});

	it('marks a context ancestor that is itself in another release as context here', () => {
		const vault = new FakeVault();
		vault.addFile('R1.md', { frontmatter: { type: 'Release' } });
		vault.addFile('R2.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic', release: '[[R2]]' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R1]]' } });
		const scope = scopeOf(vault, 'R1.md');
		expect(scope.rows.find((r) => r.item.file.basename === 'E')?.context).toBe(true);
		expect(scope.members).toBe(1);
	});

	describe('a row’s memberTotal/memberDone', () => {
		it('rolls up members BELOW a row, never the row itself', () => {
			// A member LEAF has nothing below it, so its own row reports zero — the same
			// rule that makes a context row's number exactly the members it holds in
			// place, stated once for every row rather than as a context-only exception.
			const vault = new FakeVault();
			vault.addFile('R.md', { frontmatter: { type: 'Release' } });
			vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
			vault.addFile('F1.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]', status: 'Done' } });
			vault.addFile('F2.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R]]', status: 'Planned' } });
			const rows = scopeOf(vault, 'R.md', settingsWith({ stateKey: 'status' })).rows;
			const e = rows.find((r) => r.item.file.basename === 'E')!;
			expect([e.memberTotal, e.memberDone]).toEqual([2, 1]);
			const f1 = rows.find((r) => r.item.file.basename === 'F1')!;
			expect([f1.memberTotal, f1.memberDone]).toEqual([0, 0]);
		});

		it('counts only THIS release’s members on an ancestor shared with another', () => {
			// The design's own illustration: a Feature (here, an Epic) with members here
			// and members elsewhere must report only here's — `item.descendantCount` /
			// `doneDescendants` would count both, consulting no membership at all.
			const vault = new FakeVault();
			vault.addFile('R1.md', { frontmatter: { type: 'Release' } });
			vault.addFile('R2.md', { frontmatter: { type: 'Release' } });
			vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
			vault.addFile('F1.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R1]]' } });
			vault.addFile('F2.md', { frontmatter: { type: 'Feature', parent: 'E', release: '[[R2]]' } });
			const scope = scopeOf(vault, 'R1.md');
			expect(scope.rows.find((r) => r.item.file.basename === 'E')?.memberTotal).toBe(1);
		});

		it('reads a Deliverable member’s doneness through its OWN workflow', () => {
			const vault = new FakeVault();
			vault.addFile('R.md', { frontmatter: { type: 'Release' } });
			vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
			vault.addFile('D.md', {
				frontmatter: { type: 'Deliverable', parent: 'E', release: '[[R]]', status: 'Planned', dstatus: 'Done' },
			});
			const rows = scopeOf(vault, 'R.md', settingsWith({ stateKey: 'status', deliverableStateKey: 'dstatus' })).rows;
			expect(rows.find((r) => r.item.file.basename === 'E')?.memberDone).toBe(1);
		});
	});
});

/** The one row named by its path — `releases.test.ts`'s own `row`, over a scope's rows. */
function rowFor(scope: ReturnType<typeof scopeOf>, path: string) {
	const found = scope.rows.find((r) => r.item.file.path === path);
	if (found === undefined) throw new Error(`no row for ${path}`);
	return found;
}

describe('a scope row’s own completion', () => {
	it('is over the release’s MEMBERS, not the model’s descendants', () => {
		// `item.subtreeDone` counts every non-marker descendant the BASE returned and
		// consults no membership at all — so a done member whose only unfinished child is
		// in ANOTHER release would never hide by it. This predicate is why.
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release' } });
		vault.addFile('0.9.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', release: '[[0.8]]', status: 'Done' } });
		vault.addFile('Child in 0.9.md', {
			frontmatter: { type: 'Task', release: '[[0.9]]', status: 'Open' },
			parentLink: 'Feature',
		});
		const scope = scopeOf(vault, '0.8.md', settingsWith({ stateKey: 'status' }));
		expect(rowFor(scope, 'Feature.md').subtreeDone).toBe(true);
	});

	it('is false while any MEMBER below is unfinished', () => {
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', release: '[[0.8]]', status: 'Done' } });
		vault.addFile('Child.md', {
			frontmatter: { type: 'Task', release: '[[0.8]]', status: 'Open' },
			parentLink: 'Feature',
		});
		const scope = scopeOf(vault, '0.8.md', settingsWith({ stateKey: 'status' }));
		expect(rowFor(scope, 'Feature.md').subtreeDone).toBe(false);
	});

	it('reads each member through its OWN workflow', () => {
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Deliverable.md', {
			frontmatter: { type: 'Deliverable', release: '[[0.8]]', deliverableState: 'Done' },
		});
		const scope = scopeOf(vault, '0.8.md', settingsWith({ deliverableStateKey: 'deliverableState' }));
		expect(rowFor(scope, 'Deliverable.md').subtreeDone).toBe(true);
	});

	it('is false on a context row whatever sits below it', () => {
		// A context row is never a source of anything derived from the results, and its own
		// state must not keep a finished subtree on screen or take one off it.
		const vault = new FakeVault();
		vault.addFile('0.8.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		vault.addFile('Member.md', {
			frontmatter: { type: 'Feature', release: '[[0.8]]', status: 'Done' },
			parentLink: 'Epic',
		});
		const scope = scopeOf(vault, '0.8.md', settingsWith({ stateKey: 'status' }));
		expect(rowFor(scope, 'Epic.md').context).toBe(true);
		expect(rowFor(scope, 'Epic.md').subtreeDone).toBe(true);
	});
});
