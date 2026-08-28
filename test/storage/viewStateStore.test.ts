// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	DELIVERABLES_MODE,
	loadViewState,
	MAX_TIMELINE_LEAD_PX,
	MIN_TIMELINE_LEAD_PX,
	PREF_READERS,
	rekeyBase,
	renamePathFolds,
	renamePathPrefs,
	saveViewState,
	ViewFolds,
	ViewPrefs,
} from '../../src/storage/viewStateStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:view-state';
const LEGACY_KEY = 'product-backlog:collapse';

/**
 * Every stored value, with every key REQUIRED. The annotation states the intent; it does
 * not enforce it, because no gate type-checks `test/` — `tsconfig.json` includes the
 * `src/` tree only, and vitest transpiles a test without checking it. Two checks enforce
 * it between them: 'has a fixture value for every stored preference' compares this
 * fixture against the reader table at runtime, and a {@link ViewPrefs} field added with
 * no reader row fails the BUILD on `PREF_READERS`' mapped type.
 */
const FULL_PREFS: Required<ViewPrefs> = {
	mode: DELIVERABLES_MODE,
	axis: 'dates',
	zoom: 'quarter',
	density: 'compact',
	leadWidth: 240,
	focus: 'Feature',
	clickFolds: true,
	bucketList: true,
	shelfExpanded: true,
	shelfSort: 'modified',
	shelfList: true,
	shelfHeight: 320,
	shelfHiddenTypes: ['Task'],
	colWidths: { 'note.owner': 200 },
	// The first of the TWO prefs the vault owns — a note path, retained through a note that
	// has gone and migrated through a rename, unlike the values keyed by a name around it.
	// It said "the one" until 2026-08-23, contradicted three lines below by the pref that
	// joined it.
	scope: 'sprints/Sprint 12.md',
	// The second: the release screen's own pick, a note path like `scope` and walked by the
	// same `renamePathPrefs`.
	release: 'Releases/0.8.md',
	// The release scope's own hide-done toggle — the ON state, `bucketList`'s own rule for
	// storing only the non-default.
	releaseHideDone: true,
	// A WORD beside the path above — which board the Board position opens with no scope
	// set. In live state the two are never both set (the controller clears each on the
	// other's way in); the fixture holds both because the round trip is per key.
	board: DELIVERABLES_MODE,
	// The OTHER Bases view's own pick — see 'the persisted estimation sort' below.
	estimationSort: 'total:desc',
};

const FULL_FOLDS: Required<ViewFolds> = {
	collapsed: ['Epic.md'],
	expanded: ['Feature.md'],
	lanes: ['luis'],
	collapsedColumns: ['board\u0000done'],
	expandedColumns: ['horizons\u0000next'],
};

const ID = { base: 'Plan.base', view: 'Backlog' };

function emptyFolds(): ViewFolds {
	return { collapsed: [], expanded: [], lanes: [], collapsedColumns: [], expandedColumns: [] };
}

function stored(vault: FakeVault): Record<string, { base: string; folds: ViewFolds; prefs: ViewPrefs }> {
	return (vault.localStorage.get(STORE_KEY) ?? {}) as Record<
		string,
		{ base: string; folds: ViewFolds; prefs: ViewPrefs }
	>;
}

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
	vault.addFile('Plan.base');
	for (const path of ['Epic.md', 'Feature.md']) vault.addFile(path);
});

describe('the stored entry', () => {
	it('has a fixture value for every stored preference', () => {
		// The round trip below proves a value survives; this proves the round trip is
		// asked about ALL of them. It cannot be a type annotation: `test/` is not
		// type-checked by any gate (`tsconfig.json` includes the `src/` tree only, and
		// vitest transpiles without checking), so `Required<ViewPrefs>` above states
		// the intent and this is what enforces it. The other half — a `ViewPrefs`
		// field with no reader row — fails the build on PREF_READERS' mapped type.
		expect(Object.keys(FULL_PREFS).sort()).toEqual(Object.keys(PREF_READERS).sort());
	});

	it('round-trips every value the view can store', () => {
		saveViewState(vault.app, ID, { folds: FULL_FOLDS, prefs: FULL_PREFS });

		expect(loadViewState(vault.app, ID)).toEqual({ folds: FULL_FOLDS, prefs: FULL_PREFS });
	});

	it('needs no entry at all for a view at its defaults', () => {
		saveViewState(vault.app, ID, { folds: emptyFolds(), prefs: {} });

		expect(loadViewState(vault.app, ID)).toEqual({ folds: emptyFolds(), prefs: {} });
		expect(Object.keys(stored(vault))).toHaveLength(0);
	});

	it('refuses to WRITE a value it would refuse to read back', () => {
		// The write path validated nothing before this shape: a bad value was stored and
		// then silently dropped on the next open, reported only by a reader losing a pick.
		saveViewState(vault.app, ID, {
			folds: FULL_FOLDS,
			prefs: { mode: 'gantt', leadWidth: 4000, shelfSort: 'priority' },
		});

		expect(Object.values(stored(vault))[0].prefs).toEqual({});
	});
});

describe('the fold budget', () => {
	it('drops the oldest folds when the budget is full, never the newest', () => {
		const collapsed = Array.from({ length: 12002 }, (_, i) => `note-${i}.md`);
		saveViewState(vault.app, ID, { folds: { ...emptyFolds(), collapsed }, prefs: {} });

		const back = loadViewState(vault.app, ID).folds.collapsed;
		expect(back).toHaveLength(12000);
		// The two APPENDED last survive; the two written first are what goes.
		expect(back).toContain('note-12001.md');
		expect(back).toContain('note-12000.md');
		expect(back).not.toContain('note-0.md');
	});

	it('gives an exhausted budget nothing, rather than the whole list', () => {
		// `collapsed` alone fills the budget, so `expanded` must come back empty — the
		// `slice(-0) === slice(0)` trap, which would return every expanded key instead.
		const collapsed = Array.from({ length: 12000 }, (_, i) => `c-${i}.md`);
		saveViewState(vault.app, ID, { folds: { ...emptyFolds(), collapsed, expanded: ['e.md'] }, prefs: {} });

		expect(loadViewState(vault.app, ID).folds.expanded).toEqual([]);
	});
});

describe('folds and prefs are different kinds of thing', () => {
	it('carries both buckets through a base rename', () => {
		saveViewState(vault.app, ID, { folds: FULL_FOLDS, prefs: FULL_PREFS });
		vault.files.delete('Plan.base');
		vault.addFile('Archive/Plan.base');

		rekeyBase(vault.app, 'Plan.base', 'Archive/Plan.base');

		expect(loadViewState(vault.app, { base: 'Archive/Plan.base', view: 'Backlog' })).toEqual({
			folds: FULL_FOLDS,
			prefs: FULL_PREFS,
		});
	});
});

/**
 * The plugin-level walk over what an entry HOLDS, beside `rekeyBase`'s walk over the key.
 *
 * **Every case here asserts the stored VALUE at the new path, and that is the whole
 * point.** A rename and a deletion end identically on screen — either way the stored path
 * names no note, `releaseScope` answers `release: null`, and the release view draws the
 * index — so a test of the form "the index is showing afterwards" is green against the
 * broken behaviour it exists to catch. `toBe` on the new path fails three ways, each a
 * different defect: the value stayed put (unwalked), the value went `undefined` (pruned,
 * which `prefs` must never be), or the value became something else (matched the wrong
 * thing).
 */
describe('a note path a saved view remembers', () => {
	const RELEASE_ID = { base: 'Plan.base', view: 'Releases' };

	function savePicks(release: string, scope: string): void {
		saveViewState(vault.app, RELEASE_ID, { folds: emptyFolds(), prefs: { release, scope } });
	}

	it('follows the note to its new path, in an entry no view is holding open', () => {
		savePicks('releases/0.8.md', 'sprints/12.md');

		renamePathPrefs(vault.app, 'releases/0.8.md', 'releases/0.8.1.md');

		expect(loadViewState(vault.app, RELEASE_ID).prefs.release).toBe('releases/0.8.1.md');
		// The board's own path-valued pick is unaffected by a rename that does not name it.
		expect(loadViewState(vault.app, RELEASE_ID).prefs.scope).toBe('sprints/12.md');
	});

	it('follows a folder move above the note, which is the only event a folder reports', () => {
		savePicks('releases/0.8.md', 'sprints/12.md');

		renamePathPrefs(vault.app, 'releases', 'archive/releases');

		expect(loadViewState(vault.app, RELEASE_ID).prefs.release).toBe('archive/releases/0.8.md');
	});

	it('carries the board scope by the same rule, so one walk answers for both', () => {
		savePicks('releases/0.8.md', 'sprints/12.md');

		renamePathPrefs(vault.app, 'sprints', 'archive/sprints');

		expect(loadViewState(vault.app, RELEASE_ID).prefs.scope).toBe('archive/sprints/12.md');
	});

	it('retains a pick a rename does not name, rather than pruning it', () => {
		savePicks('releases/0.8.md', 'sprints/12.md');

		// A path that merely shares a name prefix, and a rename of something else entirely.
		renamePathPrefs(vault.app, 'releases2', 'archive/releases2');
		renamePathPrefs(vault.app, 'Epic.md', 'Story.md');

		expect(loadViewState(vault.app, RELEASE_ID).prefs.release).toBe('releases/0.8.md');
		expect(loadViewState(vault.app, RELEASE_ID).prefs.scope).toBe('sprints/12.md');
	});
});

/**
 * The FOLD half of the same walk, over the same stored entries — `renamePathFolds` beside
 * `renamePathPrefs`. Asserted on the stored VALUE for that walk's own reason: a fold key
 * left behind and a fold key deleted look identical on screen (the row simply reopens),
 * so only the key at its new spelling tells a migration from a loss.
 */
describe('a fold key a saved view remembers', () => {
	const FOLD_ID = { base: 'Plan.base', view: 'Releases' };

	function saveFolds(collapsed: string[], expanded: string[] = []): void {
		saveViewState(vault.app, FOLD_ID, { folds: { ...emptyFolds(), collapsed, expanded }, prefs: {} });
	}

	it('renames every key shape a stored entry can hold, in both lists', () => {
		saveFolds(['a.md', '\u0000card:a.md', '\u0000timeline:a.md', '\u0000release:Releases/0.8.md\u0000a.md'], ['a.md']);

		renamePathFolds(vault.app, 'a.md', 'b.md');

		const folds = loadViewState(vault.app, FOLD_ID).folds;
		expect(folds.collapsed).toEqual(['b.md', '\u0000card:b.md', '\u0000timeline:b.md', '\u0000release:Releases/0.8.md\u0000b.md']);
		expect(folds.expanded).toEqual(['b.md']);
	});

	it('moves a release fold when the RELEASE itself is renamed, not only its member', () => {
		// The half `ViewState.renamePath`'s old expression never asked about: a release-fold
		// key carries TWO paths, and renaming the release note stranded every fold in its
		// scope under a prefix no reader would ask for again.
		saveFolds(['\u0000release:Releases/0.8.md\u0000a.md']);

		renamePathFolds(vault.app, 'Releases/0.8.md', 'Releases/0.8.1.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual(['\u0000release:Releases/0.8.1.md\u0000a.md']);
	});

	it('carries a folder move above either path, which is the only event a folder reports', () => {
		saveFolds(['\u0000release:Releases/0.8.md\u0000Backlog/a.md']);

		renamePathFolds(vault.app, 'Backlog', 'Work');
		renamePathFolds(vault.app, 'Releases', 'Archive/Releases');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual([
			'\u0000release:Archive/Releases/0.8.md\u0000Work/a.md',
		]);
	});

	it('leaves a key no rename names exactly as it was', () => {
		saveFolds(['a.md', '\u0000release:Releases/0.8.md\u0000a.md']);

		// A path that merely shares a name prefix, and a rename of something else entirely.
		renamePathFolds(vault.app, 'a.md.old', 'z.md');
		renamePathFolds(vault.app, 'Epic.md', 'Story.md');

		expect(loadViewState(vault.app, FOLD_ID).folds.collapsed).toEqual(['a.md', '\u0000release:Releases/0.8.md\u0000a.md']);
	});
});

describe('the 0.8 entry', () => {
	it('is not read, and is cleared on the first write', () => {
		vault.localStorage.set(LEGACY_KEY, {
			'Plan.base#Backlog': { base: 'Plan.base', collapsed: ['Epic.md'], expanded: [], mode: 'board' },
		});

		expect(loadViewState(vault.app, ID)).toEqual({ folds: emptyFolds(), prefs: {} });

		saveViewState(vault.app, ID, { folds: FULL_FOLDS, prefs: {} });
		expect(vault.localStorage.has(LEGACY_KEY)).toBe(false);
	});
});

describe('the persisted view mode', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips beside the collapse sets, and clears with the tree default', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { mode: 'board' } });
		expect(loadViewState(vault.app, id).prefs.mode).toBe('board');
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ prefs: { mode: 'board' } });

		// The tree is the default and needs no entry at all.
		saveViewState(vault.app, id, none);
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
		expect(loadViewState(vault.app, id).prefs.mode).toBeUndefined();
	});

	it('rides a base rename with the rest of the entry', () => {
		vault.addFile('New.base');
		saveViewState(vault.app, { ...id, base: 'Old.base' }, { ...none, prefs: { mode: 'board' } });
		rekeyBase(vault.app, 'Old.base', 'New.base');
		expect(loadViewState(vault.app, { ...id, base: 'New.base' }).prefs.mode).toBe('board');
	});

	it('drops a stored mode it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', folds: { collapsed: ['Epic.md'] }, prefs: { mode: 'sideways' } },
		});
		const snapshot = loadViewState(vault.app, id);
		// The paths survive; the unrecognized mode does not.
		expect(snapshot.folds.collapsed).toEqual(['Epic.md']);
		expect(snapshot.prefs.mode).toBeUndefined();
	});

	it('holds the roadmap the way it holds the board', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { mode: 'roadmap' } });
		expect(loadViewState(vault.app, id).prefs.mode).toBe('roadmap');
	});

	it('round-trips the Deliverables mode through the stored allowlist', () => {
		vault.addFile('B.base');
		saveViewState(vault.app, { base: 'B.base', view: 'Backlog' }, { ...none, prefs: { mode: DELIVERABLES_MODE } });

		const restored = loadViewState(vault.app, { base: 'B.base', view: 'Backlog' });
		expect(restored.prefs.mode).toBe(DELIVERABLES_MODE);
	});

	it('still drops an unrecognised mode value, defensively', () => {
		vault.addFile('B.base');
		vault.localStorage.set(STORE_KEY, {
			'B.base%23Backlog': { base: 'B.base', folds: {}, prefs: { mode: 'something-else' } },
		});

		const restored = loadViewState(vault.app, { base: 'B.base', view: 'Backlog' });
		expect(restored.prefs.mode).toBeUndefined();
	});

	it('keeps the axis pick beside the mode, and keeps it alone', () => {
		vault.addFile('Backlog.base');
		// The pick is retained even at every other default: an entry with only an
		// axis is still user state — restoring the cleared axis config restores it.
		saveViewState(vault.app, id, { ...none, prefs: { axis: 'dates' } });
		const snapshot = loadViewState(vault.app, id);
		expect(snapshot.prefs.axis).toBe('dates');
		expect(snapshot.prefs.mode).toBeUndefined();

		// Cleared with everything else at defaults, the entry disappears whole.
		saveViewState(vault.app, id, none);
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('reads back a saved resources-axis pick', () => {
		// Checked separately from `RoadmapAxis` on purpose: stored state is read
		// defensively against this module's OWN string list, so an axis missing from
		// that list is silently dropped and reads back as a pick nobody ever made.
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { axis: 'resources' } });
		expect(loadViewState(vault.app, id).prefs.axis).toBe('resources');
	});

	it('drops a stored axis it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { axis: 'sideways' } },
		});
		expect(loadViewState(vault.app, id).prefs.axis).toBeUndefined();
	});

	it('round-trips the zoom, and drops a scale this plugin never wrote', () => {
		const app = vault.app;
		saveViewState(app, id, { ...none, prefs: { mode: 'roadmap', axis: 'dates', zoom: 'quarter' } });
		expect(loadViewState(app, id).prefs.zoom).toBe('quarter');

		saveViewState(app, id, { ...none, prefs: { mode: 'roadmap', axis: 'dates', zoom: 'fortnight' } });
		// Stored state is user-writable data another version may have written: anything
		// unrecognizable is dropped rather than trusted, exactly as `axis` is.
		expect(loadViewState(app, id).prefs.zoom).toBeUndefined();
	});

	it('needs no entry for a view at its defaults, zoom included', () => {
		const app = vault.app;
		saveViewState(app, id, none);
		expect(loadViewState(app, id).prefs.zoom).toBeUndefined();
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('round-trips the focus as written, and drops anything that is not a name', () => {
		const app = vault.app;
		// No vocabulary check here on purpose: the type list lives in `domain/`, and a
		// name matching no configured type already reads as no focus. Only shape.
		saveViewState(app, id, { ...none, prefs: { focus: 'Bugfix' } });
		expect(loadViewState(app, id).prefs.focus).toBe('Bugfix');

		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { focus: 7 } },
		});
		expect(loadViewState(app, id).prefs.focus).toBeUndefined();
	});

	it('needs no entry for a view showing every type', () => {
		const app = vault.app;
		saveViewState(app, id, none);
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});
});

describe('the persisted timeline row density', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips a density on its own, with nothing else in the entry to keep it alive', () => {
		// Density ALONE, which is what makes this a check on `hasContent`'s own reading
		// of the prefs bucket rather than on whatever else the view happens to store
		// beside it: the roadmap's reopen test stores `mode` too, so the entry survives
		// that round trip whether or not this pick is counted as content.
		const app = vault.app;
		saveViewState(app, id, { ...none, prefs: { density: 'compact' } });
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ prefs: { density: 'compact' } });
		expect(loadViewState(app, id).prefs.density).toBe('compact');
	});
});

describe('the persisted timeline lead-column width', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips a width inside the allowed range', () => {
		const app = vault.app;
		saveViewState(app, id, { ...none, prefs: { leadWidth: 300 } });
		expect(loadViewState(app, id).prefs.leadWidth).toBe(300);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ prefs: { leadWidth: 300 } });
	});

	it('needs no entry for a view at the default width', () => {
		const app = vault.app;
		saveViewState(app, id, none);
		expect(loadViewState(app, id).prefs.leadWidth).toBeUndefined();
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('accepts the width exactly at each clamp boundary', () => {
		const app = vault.app;
		saveViewState(app, id, { ...none, prefs: { leadWidth: MIN_TIMELINE_LEAD_PX } });
		expect(loadViewState(app, id).prefs.leadWidth).toBe(MIN_TIMELINE_LEAD_PX);

		saveViewState(app, id, { ...none, prefs: { leadWidth: MAX_TIMELINE_LEAD_PX } });
		expect(loadViewState(app, id).prefs.leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
	});

	it('drops a stored width outside the clamp range rather than trusting it', () => {
		for (const width of [MIN_TIMELINE_LEAD_PX - 1, MAX_TIMELINE_LEAD_PX + 1]) {
			vault.localStorage.set(STORE_KEY, {
				'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { leadWidth: width } },
			});
			expect(loadViewState(vault.app, id).prefs.leadWidth).toBeUndefined();
		}
	});

	it('drops a stored width that is not a finite number', () => {
		for (const junk of ['300', null, NaN, Infinity, { px: 300 }]) {
			vault.localStorage.set(STORE_KEY, {
				'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { leadWidth: junk } },
			});
			expect(loadViewState(vault.app, id).prefs.leadWidth).toBeUndefined();
		}
	});
});

describe('what a click on a row does', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('defaults to opening the note, and needs no entry at all', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { clickFolds: false } });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
		expect(loadViewState(vault.app, id).prefs.clickFolds).toBeUndefined();
	});

	it('round-trips folding on click', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { clickFolds: true } });
		expect(loadViewState(vault.app, id).prefs.clickFolds).toBe(true);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ prefs: { clickFolds: true } });
	});

	/** User-writable data: only the value this module writes is the value it reads back. */
	it('reads anything but a stored true as the default', () => {
		for (const junk of ['fold', 1, {}, [], null]) {
			vault.localStorage.set(STORE_KEY, {
				'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { clickFolds: junk } },
			});
			expect(loadViewState(vault.app, id).prefs.clickFolds).toBeUndefined();
		}
	});
});

describe('the shelf working position', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('defaults to collapsed, tree sort, nothing hidden — and needs no entry at all', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, none);
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();

		// Absence is the value: every shelf default is the key not being written.
		expect(loadViewState(vault.app, id).prefs).toEqual({});
	});

	it('round-trips an explicit expand', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { shelfExpanded: true } });
		expect(loadViewState(vault.app, id).prefs.shelfExpanded).toBe(true);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ prefs: { shelfExpanded: true } });
	});

	it('round-trips a non-default sort and the hidden-type list', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { shelfSort: 'title', shelfHiddenTypes: ['Task', 'Bug'] } });
		const snapshot = loadViewState(vault.app, id);
		expect(snapshot.prefs.shelfSort).toBe('title');
		expect(snapshot.prefs.shelfHiddenTypes).toEqual(['Task', 'Bug']);
	});

	it('drops a stored sort it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { shelfSort: 'sideways' } },
		});
		expect(loadViewState(vault.app, id).prefs.shelfSort).toBeUndefined();
	});

	it('drops a stored hidden-types entry that is not an array of strings', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { shelfHiddenTypes: 'Task' } },
		});
		expect(loadViewState(vault.app, id).prefs.shelfHiddenTypes).toBeUndefined();
	});
});

describe('the persisted estimation sort', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips a column:direction pick, and needs no entry at its default', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { estimationSort: 'currency:asc' } });
		expect(loadViewState(vault.app, id).prefs.estimationSort).toBe('currency:asc');
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ prefs: { estimationSort: 'currency:asc' } });

		saveViewState(vault.app, id, none);
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('drops a stored sort it does not recognize', () => {
		// 'value' is the column's on-screen LABEL, never its stored id ('total') — the
		// realistic mistake a hand-edited or foreign entry would make.
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', folds: {}, prefs: { estimationSort: 'value:desc' } },
		});
		expect(loadViewState(vault.app, id).prefs.estimationSort).toBeUndefined();
	});
});

describe('the picked release', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips the picked release, and refuses a value of the wrong shape', () => {
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { release: 'Releases/0.8.md' } });
		expect(loadViewState(vault.app, id).prefs.release).toBe('Releases/0.8.md');

		saveViewState(vault.app, id, { ...none, prefs: { release: 42 as never } });
		expect(loadViewState(vault.app, id).prefs.release).toBeUndefined();
	});
});

describe('the release scope’s hide-done toggle', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { folds: emptyFolds(), prefs: {} };

	it('round-trips the hide-done toggle, and discards a value of the wrong shape', () => {
		// `PREF_READERS` is exhaustive over `ViewPrefs` by TYPE and `readPrefs` writes only the
		// keys it holds, so stored state is read defensively rather than trusted.
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { releaseHideDone: true } });
		expect(loadViewState(vault.app, id).prefs.releaseHideDone).toBe(true);

		saveViewState(vault.app, id, { ...none, prefs: { releaseHideDone: 'yes' as never } });
		expect(loadViewState(vault.app, id).prefs.releaseHideDone).toBeUndefined();
	});

	it('writes nothing for the default', () => {
		// `onlyTrue`, storing the NON-default state — `bucketList`'s own documented rule, so
		// a view nobody has toggled costs no entry at all.
		vault.addFile('Backlog.base');
		saveViewState(vault.app, id, { ...none, prefs: { releaseHideDone: false } });
		expect(Object.keys(stored(vault))).toHaveLength(0);
	});
});
