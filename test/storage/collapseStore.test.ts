// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	DELIVERABLES_MODE,
	loadCollapseState,
	MAX_TIMELINE_LEAD_PX,
	MIN_TIMELINE_LEAD_PX,
	rekeyBase,
	saveCollapseState,
} from '../../src/storage/collapseStore';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';

installObsidianDom();

const STORE_KEY = 'product-backlog:collapse';

function stored(vault: FakeVault): Record<string, { base: string; collapsed: string[]; expanded: string[] }> {
	return (vault.localStorage.get(STORE_KEY) ?? {}) as Record<
		string,
		{ base: string; collapsed: string[]; expanded: string[] }
	>;
}

let vault: FakeVault;

beforeEach(() => {
	vault = new FakeVault();
});

describe('rekeyBase', () => {
	it('moves an entry to the renamed base, keeping its rows', () => {
		vault.addFile('Old.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Old.base', view: 'Backlog' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);

		vault.files.delete('Old.base');
		vault.addFile('Archive/New.base');
		rekeyBase(vault.app, 'Old.base', 'Archive/New.base');

		// Found under the new path, with the state that was there before.
		const restored = loadCollapseState(vault.app, { base: 'Archive/New.base', view: 'Backlog' });
		expect([...restored.collapsed]).toEqual(['Epic.md']);
		expect(Object.keys(stored(vault))).toHaveLength(1);
		expect(Object.values(stored(vault))[0].base).toBe('Archive/New.base');
	});

	it('carries a view name that contains the key separator', () => {
		vault.addFile('Old.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Old.base', view: 'Sprint #3' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);

		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		// The view name is recovered from the key, which only works because both
		// halves are encoded — the literal '#' is always the separator.
		const restored = loadCollapseState(vault.app, { base: 'New.base', view: 'Sprint #3' });
		expect([...restored.collapsed]).toEqual(['Epic.md']);
	});

	it('moves every view of the renamed base and leaves other bases alone', () => {
		for (const path of ['Old.base', 'Other.base']) vault.addFile(path);
		vault.addFile('Epic.md');
		const snap = { collapsed: new Set(['Epic.md']), expanded: new Set<string>() };
		saveCollapseState(vault.app, { base: 'Old.base', view: 'Planning' }, snap);
		saveCollapseState(vault.app, { base: 'Old.base', view: 'Triage' }, snap);
		saveCollapseState(vault.app, { base: 'Other.base', view: 'Planning' }, snap);

		vault.files.delete('Old.base');
		vault.addFile('New.base');
		rekeyBase(vault.app, 'Old.base', 'New.base');

		const bases = Object.values(stored(vault)).map((e) => e.base).sort();
		expect(bases).toEqual(['New.base', 'New.base', 'Other.base']);
		expect(loadCollapseState(vault.app, { base: 'New.base', view: 'Triage' }).collapsed.size).toBe(1);
	});

	it('does nothing when no entry names the old path', () => {
		vault.addFile('Other.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Other.base', view: 'Backlog' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);
		const before = JSON.stringify(stored(vault));

		rekeyBase(vault.app, 'Never.base', 'Whatever.base');
		expect(JSON.stringify(stored(vault))).toBe(before);
	});
});

describe('rekeyBase across a folder move', () => {
	it('carries a base that lived inside the renamed folder', () => {
		vault.addFile('Work/Backlog.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Work/Backlog.base', view: 'Backlog' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);

		// Obsidian reports the folder, not the base inside it.
		vault.files.delete('Work/Backlog.base');
		vault.addFile('Archive/Work/Backlog.base');
		rekeyBase(vault.app, 'Work', 'Archive/Work');

		const restored = loadCollapseState(vault.app, { base: 'Archive/Work/Backlog.base', view: 'Backlog' });
		expect([...restored.collapsed]).toEqual(['Epic.md']);
	});

	it('is idempotent, so a second event for the same move changes nothing', () => {
		vault.addFile('Work/Backlog.base');
		vault.addFile('Epic.md');
		saveCollapseState(
			vault.app,
			{ base: 'Work/Backlog.base', view: 'Backlog' },
			{ collapsed: new Set(['Epic.md']), expanded: new Set() },
		);
		vault.files.delete('Work/Backlog.base');
		vault.addFile('Archive/Work/Backlog.base');

		// Whether Obsidian reports a folder move once or once per descendant, the
		// second pass must find nothing left to move.
		rekeyBase(vault.app, 'Work', 'Archive/Work');
		const after = JSON.stringify(stored(vault));
		rekeyBase(vault.app, 'Work/Backlog.base', 'Archive/Work/Backlog.base');
		expect(JSON.stringify(stored(vault))).toBe(after);
	});

	it('leaves a base that merely shares a name prefix alone', () => {
		for (const path of ['Work/A.base', 'Workshop/B.base']) vault.addFile(path);
		vault.addFile('Epic.md');
		const snap = { collapsed: new Set(['Epic.md']), expanded: new Set<string>() };
		saveCollapseState(vault.app, { base: 'Work/A.base', view: 'Backlog' }, snap);
		saveCollapseState(vault.app, { base: 'Workshop/B.base', view: 'Backlog' }, snap);

		rekeyBase(vault.app, 'Work', 'Archive');

		const bases = Object.values(stored(vault)).map((e) => e.base).sort();
		expect(bases).toEqual(['Archive/A.base', 'Workshop/B.base']);
	});
});

describe('the persisted view mode', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { collapsed: new Set<string>(), expanded: new Set<string>() };

	it('round-trips beside the collapse sets, and clears with the tree default', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, mode: 'board' });
		expect(loadCollapseState(vault.app, id).mode).toBe('board');
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ mode: 'board' });

		// The tree is the default and needs no entry at all.
		saveCollapseState(vault.app, id, { ...none, mode: null });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
		expect(loadCollapseState(vault.app, id).mode).toBeNull();
	});

	it('rides a base rename with the rest of the entry', () => {
		vault.addFile('New.base');
		saveCollapseState(vault.app, { ...id, base: 'Old.base' }, { ...none, mode: 'board' });
		rekeyBase(vault.app, 'Old.base', 'New.base');
		expect(loadCollapseState(vault.app, { ...id, base: 'New.base' }).mode).toBe('board');
	});

	it('drops a stored mode it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: ['Epic.md'], expanded: [], mode: 'sideways' },
		});
		const snapshot = loadCollapseState(vault.app, id);
		// The paths survive; the unrecognized mode does not.
		expect(snapshot.collapsed.has('Epic.md')).toBe(true);
		expect(snapshot.mode).toBeNull();
	});

	it('holds the roadmap the way it holds the board', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, mode: 'roadmap' });
		expect(loadCollapseState(vault.app, id).mode).toBe('roadmap');
	});

	it('round-trips the Deliverables mode through the stored allowlist', () => {
		vault.addFile('B.base');
		saveCollapseState(
			vault.app,
			{ base: 'B.base', view: 'Backlog' },
			{ collapsed: new Set(), expanded: new Set(), mode: DELIVERABLES_MODE },
		);

		const restored = loadCollapseState(vault.app, { base: 'B.base', view: 'Backlog' });
		expect(restored.mode).toBe(DELIVERABLES_MODE);
	});

	it('still drops an unrecognised mode value, defensively', () => {
		vault.addFile('B.base');
		vault.localStorage.set(STORE_KEY, {
			'B.base%23Backlog': { base: 'B.base', collapsed: [], expanded: [], mode: 'something-else' },
		});

		const restored = loadCollapseState(vault.app, { base: 'B.base', view: 'Backlog' });
		expect(restored.mode).toBeNull();
	});

	it('keeps the axis pick beside the mode, and keeps it alone', () => {
		vault.addFile('Backlog.base');
		// The pick is retained even at every other default: an entry with only an
		// axis is still user state — restoring the cleared axis config restores it.
		saveCollapseState(vault.app, id, { ...none, axis: 'dates' });
		const snapshot = loadCollapseState(vault.app, id);
		expect(snapshot.axis).toBe('dates');
		expect(snapshot.mode).toBeNull();

		// Cleared with everything else at defaults, the entry disappears whole.
		saveCollapseState(vault.app, id, { ...none, axis: null });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('drops a stored axis it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], axis: 'sideways' },
		});
		expect(loadCollapseState(vault.app, id).axis).toBeNull();
	});

	it('round-trips the zoom, and drops a scale this plugin never wrote', () => {
		const app = vault.app;
		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), mode: 'roadmap', axis: 'dates', zoom: 'quarter' });
		expect(loadCollapseState(app, id).zoom).toBe('quarter');

		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), mode: 'roadmap', axis: 'dates', zoom: 'fortnight' });
		// Stored state is user-writable data another version may have written: anything
		// unrecognizable is dropped rather than trusted, exactly as `axis` is.
		expect(loadCollapseState(app, id).zoom).toBeNull();
	});

	it('needs no entry for a view at its defaults, zoom included', () => {
		const app = vault.app;
		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), mode: null, axis: null, zoom: null });
		expect(loadCollapseState(app, id).zoom).toBeNull();
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('round-trips the focus as written, and drops anything that is not a name', () => {
		const app = vault.app;
		// No vocabulary check here on purpose: the type list lives in `domain/`, and a
		// name matching no configured type already reads as no focus. Only shape.
		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), focus: 'Bugfix' });
		expect(loadCollapseState(app, id).focus).toBe('Bugfix');

		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], focus: 7 },
		});
		expect(loadCollapseState(app, id).focus).toBeNull();
	});

	it('needs no entry for a view showing every type', () => {
		const app = vault.app;
		saveCollapseState(app, id, { collapsed: new Set(), expanded: new Set(), focus: null });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});
});

describe('the persisted timeline row density', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { collapsed: new Set<string>(), expanded: new Set<string>() };

	it('round-trips a density on its own, with nothing else in the entry to keep it alive', () => {
		// Density ALONE, which is what makes this a check on `entryHasContent`'s own
		// density clause rather than on whatever else the view happens to store beside
		// it: the roadmap's reopen test stores `mode` too, so the entry survives that
		// round trip whether or not this pick is counted as content.
		const app = vault.app;
		saveCollapseState(app, id, { ...none, density: 'compact' });
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ density: 'compact' });
		expect(loadCollapseState(app, id).density).toBe('compact');
	});
});

describe('the persisted timeline lead-column width', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { collapsed: new Set<string>(), expanded: new Set<string>() };

	it('round-trips a width inside the allowed range', () => {
		const app = vault.app;
		saveCollapseState(app, id, { ...none, leadWidth: 300 });
		expect(loadCollapseState(app, id).leadWidth).toBe(300);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ leadWidth: 300 });
	});

	it('needs no entry for a view at the default width', () => {
		const app = vault.app;
		saveCollapseState(app, id, { ...none, leadWidth: null });
		expect(loadCollapseState(app, id).leadWidth).toBeNull();
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
	});

	it('accepts the width exactly at each clamp boundary', () => {
		const app = vault.app;
		saveCollapseState(app, id, { ...none, leadWidth: MIN_TIMELINE_LEAD_PX });
		expect(loadCollapseState(app, id).leadWidth).toBe(MIN_TIMELINE_LEAD_PX);

		saveCollapseState(app, id, { ...none, leadWidth: MAX_TIMELINE_LEAD_PX });
		expect(loadCollapseState(app, id).leadWidth).toBe(MAX_TIMELINE_LEAD_PX);
	});

	it('drops a stored width outside the clamp range rather than trusting it', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], leadWidth: MIN_TIMELINE_LEAD_PX - 1 },
		});
		expect(loadCollapseState(vault.app, id).leadWidth).toBeNull();

		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], leadWidth: MAX_TIMELINE_LEAD_PX + 1 },
		});
		expect(loadCollapseState(vault.app, id).leadWidth).toBeNull();
	});

	it('drops a stored width that is not a finite number', () => {
		for (const junk of ['300', null, NaN, Infinity, { px: 300 }]) {
			vault.localStorage.set(STORE_KEY, {
				'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], leadWidth: junk },
			});
			expect(loadCollapseState(vault.app, id).leadWidth).toBeNull();
		}
	});
});

describe('what a click on a row does', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { collapsed: new Set<string>(), expanded: new Set<string>() };

	it('defaults to opening the note, and needs no entry at all', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, clickFolds: false });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();
		expect(loadCollapseState(vault.app, id).clickFolds).toBe(false);
	});

	it('round-trips folding on click', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, clickFolds: true });
		expect(loadCollapseState(vault.app, id).clickFolds).toBe(true);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ clickFolds: true });
	});

	/** User-writable data: only the value this module writes is the value it reads back. */
	it('reads anything but a stored true as the default', () => {
		for (const junk of ['fold', 1, {}, [], null]) {
			vault.localStorage.set(STORE_KEY, {
				'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], clickFolds: junk },
			});
			expect(loadCollapseState(vault.app, id).clickFolds).toBe(false);
		}
	});
});

describe('the shelf working position', () => {
	const id = { base: 'Backlog.base', view: 'Backlog' };
	const none = { collapsed: new Set<string>(), expanded: new Set<string>() };

	it('defaults to collapsed, tree sort, nothing hidden — and needs no entry at all', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none });
		expect(stored(vault)['Backlog.base#Backlog']).toBeUndefined();

		const snapshot = loadCollapseState(vault.app, id);
		expect(snapshot.shelfExpanded).toBe(false);
		expect(snapshot.shelfSort).toBeNull();
		expect(snapshot.shelfHiddenTypes).toEqual([]);
	});

	it('round-trips an explicit expand', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, shelfExpanded: true });
		expect(loadCollapseState(vault.app, id).shelfExpanded).toBe(true);
		expect(stored(vault)['Backlog.base#Backlog']).toMatchObject({ shelfExpanded: true });
	});

	it('round-trips a non-default sort and the hidden-type list', () => {
		vault.addFile('Backlog.base');
		saveCollapseState(vault.app, id, { ...none, shelfSort: 'title', shelfHiddenTypes: ['Task', 'Bug'] });
		const snapshot = loadCollapseState(vault.app, id);
		expect(snapshot.shelfSort).toBe('title');
		expect(snapshot.shelfHiddenTypes).toEqual(['Task', 'Bug']);
	});

	it('drops a stored sort it does not recognize', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], shelfSort: 'sideways' },
		});
		expect(loadCollapseState(vault.app, id).shelfSort).toBeNull();
	});

	it('drops a stored hidden-types entry that is not an array of strings', () => {
		vault.localStorage.set(STORE_KEY, {
			'Backlog.base#Backlog': { base: 'Backlog.base', collapsed: [], expanded: [], shelfHiddenTypes: 'Task' },
		});
		expect(loadCollapseState(vault.app, id).shelfHiddenTypes).toEqual([]);
	});
});
