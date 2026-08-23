import { describe, expect, it } from 'vitest';
import { releaseIndex } from '../../src/domain/releases';
import { buildModel } from '../../src/domain/model';
import { BacklogSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';

const KEYS = {
	parentKey: 'parent',
	orderKey: 'order',
	typeKey: 'type',
	membershipKey: 'release',
	versionKey: 'version',
	targetDateKey: 'target-date',
	statusKey: 'status',
};

function indexOf(vault: FakeVault, settings = KEYS, model: BacklogSettings = settingsWith()) {
	return releaseIndex(vault.app, buildModel(vault.app, vault.entries(), model), settings);
}

/**
 * A note whose membership property spells a wikilink that RESOLVES — with the link cache
 * Obsidian really hands out for one.
 *
 * `addFile`'s `parentLink` builds that cache for `parent` alone, and `test/CLAUDE.md` is
 * explicit that a raw bracketed value beside a file that exists is a cache no vault
 * produces. The reader takes the raw-value path either way, so nothing here depends on
 * the entry today; the fixture carries it so this suite cannot start passing for the
 * wrong reason the day something reads `frontmatterLinks`.
 */
function addMember(vault: FakeVault, path: string, type: string, link: string): void {
	vault.addFile(path, { frontmatter: { type, release: `[[${link}]]` } });
	vault.caches.set(path, {
		frontmatter: vault.fm(path),
		frontmatterLinks: [{ key: 'release', link, original: `[[${link}]]` }],
	});
}

describe('the release index', () => {
	it('orders by target date, then rank, with the undated last', () => {
		const vault = new FakeVault();
		vault.addFile('Late.md', { frontmatter: { type: 'Release', 'target-date': '2026-12-01' } });
		vault.addFile('Early.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		vault.addFile('Undated.md', { frontmatter: { type: 'Release' } });
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual(['Early', 'Late', 'Undated']);
	});

	it('breaks a shared date by rank, and a shared rank by path', () => {
		const vault = new FakeVault();
		vault.addFile('B.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 20 } });
		vault.addFile('A.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 10 } });
		vault.addFile('C.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		vault.addFile('D.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		const names = indexOf(vault).rows.map((r) => r.name);
		expect(names.slice(0, 2)).toEqual(['A', 'B']);
		// No rank on either: the tie falls to path, which is stable across renders.
		expect(names.slice(2)).toEqual(['C', 'D']);
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual(names);
	});

	it('compares sort keys by value, never by their difference', () => {
		const vault = new FakeVault();
		// `Infinity - 5` is `Infinity` and `Infinity - Infinity` is `NaN`, so a comparator
		// built on differences either refuses the pair (a `Number.isFinite` guard drops it
		// to the path tie-break) or returns NaN and sorts at random. Both fixtures below
		// put the PATH order against the answer, which is what makes that visible: a
		// ranked release whose path sorts last, among rows whose other key ties.
		vault.addFile('A unranked.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01' } });
		vault.addFile('Z ranked.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 5 } });
		// Two UNDATED and unranked releases, so BOTH keys tie at +Infinity and the path
		// decides. Added in the reverse of path order on purpose: `model.releases` arrives
		// pre-sorted by the model's own sibling ranking, so a comparator answering NaN here
		// reads as "equal", keeps that arrival order, and would otherwise be indistinguishable
		// from a correct one.
		vault.addFile('Z undated.md', { frontmatter: { type: 'Release' } });
		vault.addFile('A undated.md', { frontmatter: { type: 'Release' } });
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual([
			'Z ranked',
			'A unranked',
			'A undated',
			'Z undated',
		]);
	});

	it('reads a rank the model’s tolerant reader accepts', () => {
		// `readNumber` is `Number.parseFloat`, so this is rank 10 everywhere else in the
		// plugin. A `Number()` conversion would make it NaN and sort the release last.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: '10 - first' } });
		vault.addFile('B.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', order: 20 } });
		expect(indexOf(vault).rows.map((r) => r.name)).toEqual(['A', 'B']);
	});

	it('reads rank from the MAPPED order key, never a literal `order`', () => {
		// The mapping is the MODEL's — `item.order` is what `readItems` parsed from the
		// configured key — so the fixture maps it there and leaves a decoy `order` on each
		// note. An index re-reading the cache for `order` would put A first.
		const vault = new FakeVault();
		vault.addFile('B.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', rank: 10, order: 99 } });
		vault.addFile('A.md', { frontmatter: { type: 'Release', 'target-date': '2026-09-01', rank: 20, order: 1 } });
		const rows = indexOf(vault, { ...KEYS, orderKey: 'rank' }, settingsWith({ orderKey: 'rank' })).rows;
		expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
	});

	it('tells unconfigured, absent and unreadable apart', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', 'target-date': 'soon', status: 'Planned' } });
		const configured = indexOf(vault).rows[0];
		expect(configured.target).toEqual({ value: null, invalid: true, unconfigured: false });
		expect(configured.version).toEqual({ value: null, invalid: false, unconfigured: false });
		expect(configured.status.value).toBe('Planned');

		const unbound = indexOf(vault, { ...KEYS, targetDateKey: '' }).rows[0];
		expect(unbound.target).toEqual({ value: null, invalid: false, unconfigured: true });
		expect(indexOf(vault, { ...KEYS, statusKey: '' }).rows[0].status).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
		expect(indexOf(vault, { ...KEYS, versionKey: '' }).rows[0].version).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
	});

	it('reads a target date, and a version, when the note spells one', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0', 'target-date': '2026-09-01' } });
		const row = indexOf(vault).rows[0];
		expect(row.version).toEqual({ value: '1.0.0', invalid: false, unconfigured: false });
		expect(row.target).toEqual({ value: { year: 2026, month: 9, day: 1 }, invalid: false, unconfigured: false });
		expect(row.path).toBe('R.md');
		expect(row.item.file.path).toBe('R.md');
	});

	it('calls an empty or malformed label unreadable, never absent', () => {
		const vault = new FakeVault();
		// 3b names the empty version explicitly: somebody wrote something there.
		vault.addFile('Empty.md', { frontmatter: { type: 'Release', version: '', status: { a: 1 }, 'target-date': '' } });
		// Whitespace-only asserted beside it rather than assumed equivalent: `readTarget`'s
		// own guard trims, so this is the SAME guard answering rather than two readers
		// agreeing about what a blank is.
		vault.addFile('Blank.md', { frontmatter: { type: 'Release', 'target-date': '   ' } });
		// A LIST is unreadable too, and it is the one `readString` would quietly unwrap to
		// its first element and call clean.
		vault.addFile('Listed.md', {
			frontmatter: { type: 'Release', version: ['0.8.0', '0.9.0'], 'target-date': ['2026-09-01', '2026-10-01'] },
		});
		vault.addFile('Missing.md', { frontmatter: { type: 'Release' } });
		const rows = indexOf(vault).rows;
		expect(rows.find((r) => r.name === 'Listed')?.version).toEqual({
			value: null,
			invalid: true,
			unconfigured: false,
		});
		// And the DATE, which would otherwise report a clean 2026-09-01 and SORT by it.
		expect(rows.find((r) => r.name === 'Listed')?.target).toEqual({
			value: null,
			invalid: true,
			unconfigured: false,
		});
		const empty = rows.find((r) => r.name === 'Empty');
		expect(empty?.version).toEqual({ value: null, invalid: true, unconfigured: false });
		expect(empty?.status).toEqual({ value: null, invalid: true, unconfigured: false });
		// The DATE keeps the same rule, and `readDate` alone does not: it trims and calls a
		// blank string ABSENT, so an empty `target-date` would read as a key nobody bound
		// while an empty `version` beside it reads as somebody's mistake. Two readers in one
		// file answering one spelling two ways is what 3b refuses.
		expect(empty?.target).toEqual({ value: null, invalid: true, unconfigured: false });
		expect(rows.find((r) => r.name === 'Blank')?.target).toEqual({
			value: null,
			invalid: true,
			unconfigured: false,
		});
		// A key the note simply does not carry stays absent — the third answer.
		const missing = rows.find((r) => r.name === 'Missing');
		expect(missing?.version).toEqual({ value: null, invalid: false, unconfigured: false });
		expect(missing?.target).toEqual({ value: null, invalid: false, unconfigured: false });
	});

	it('counts members, and a release nothing points at is still a row', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Empty.md', { frontmatter: { type: 'Release' } });
		addMember(vault, 'F.md', 'Feature', 'R');
		// The bare-name spelling `resolveParent` already tolerates, resolved the same way.
		vault.addFile('G.md', { frontmatter: { type: 'PBI', release: 'R' } });
		// A ONE-element list is a real membership, not two values at once: `readString`
		// unwraps it, so only a list of two or more is the ambiguity 1c refuses. The cache
		// is the one a vault really builds for a list value (`release.0`), through
		// `listLinks`.
		vault.addFile('H.md', { frontmatter: { type: 'PBI' }, listLinks: { release: ['R'] } });
		const rows = indexOf(vault).rows;
		expect(rows.find((r) => r.name === 'R')?.members).toEqual({
			value: 3,
			invalid: false,
			unconfigured: false,
		});
		expect(rows.find((r) => r.name === 'Empty')?.members.value).toBe(0);
	});

	it('cannot count members at all with the membership key unbound', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		addMember(vault, 'F.md', 'Feature', 'R');
		const { rows, unresolved } = indexOf(vault, { ...KEYS, membershipKey: '' });
		// Not zero. Zero is a real answer and this is not one.
		expect(rows[0].members).toEqual({ value: null, invalid: false, unconfigured: true });
		expect(unresolved).toEqual([]);
	});

	it('reports an item whose membership names a non-release, and one holding two values', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		addMember(vault, 'Bad.md', 'Feature', 'E');
		vault.addFile('Two.md', { frontmatter: { type: 'Feature' }, listLinks: { release: ['R', 'E'] } });
		// Present but unreadable is a REPORT, not an absence: the note carries the key, so
		// somebody wrote something there. A key no note carries stays silent.
		vault.addFile('Blank.md', { frontmatter: { type: 'Feature', release: '' } });
		vault.addFile('Object.md', { frontmatter: { type: 'Feature', release: { a: 1 } } });
		vault.addFile('Empty list.md', { frontmatter: { type: 'Feature', release: [] } });
		vault.addFile('None.md', { frontmatter: { type: 'Feature' } });
		const { rows, unresolved } = indexOf(vault);
		expect(unresolved.map((i) => i.file.path).sort()).toEqual(['Bad.md', 'Blank.md', 'Object.md', 'Two.md']);
		expect(rows.find((r) => r.name === 'R')?.members.value).toBe(0);
	});

	it('refuses a membership value naming a note the vault does not hold', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', release: 'No such release' } });
		const { rows, unresolved } = indexOf(vault);
		expect(unresolved.map((i) => i.file.basename)).toEqual(['F']);
		expect(rows[0].members.value).toBe(0);
	});

	it('never reassigns a link Obsidian already resolved to a non-release', () => {
		const vault = new FakeVault();
		// An Epic named R, and a release ALSO named R one folder over. `[[R]]` resolves to
		// the Epic; reassigning it to the release would be a membership nobody wrote.
		vault.addFile('R.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Releases/R.md', { frontmatter: { type: 'Release' } });
		addMember(vault, 'F.md', 'Feature', 'R');
		const { rows, unresolved } = indexOf(vault);
		expect(unresolved.map((i) => i.file.basename)).toEqual(['F']);
		expect(rows[0].members.value).toBe(0);
	});

	it('never scans a row the Base excluded, so its membership never counts', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		// A context row: excluded from the Base, pulled in as the parent of a result.
		addMember(vault, 'Outside.md', 'Feature', 'R');
		vault.addFile('Child.md', { frontmatter: { type: 'PBI' }, parentLink: 'Outside' });
		const entries = vault.entries().filter((e) => e.file.path !== 'Outside.md');
		const model = buildModel(vault.app, entries, settingsWith());
		expect(model.byPath.get('Outside.md')?.outsideFilter).toBe(true);
		// It renders, it parents, and that is all — never a source of anything derived
		// from the Base's results, a member count included.
		expect(releaseIndex(vault.app, model, KEYS).rows[0].members.value).toBe(0);
	});

	it('refuses a membership property hand-written on a non-plan row', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		addMember(vault, 'M.md', 'Milestone', 'R');
		addMember(vault, 'I.md', 'Iteration', 'R');
		addMember(vault, 'R2.md', 'Release', 'R');
		addMember(vault, 'TC.md', 'Test case', 'R');
		const { rows, unresolved } = indexOf(vault);
		expect(rows.find((r) => r.name === 'R')?.members.value).toBe(0);
		expect(unresolved.map((i) => i.file.basename).sort()).toEqual(['I', 'M', 'R2', 'TC']);
	});
});
