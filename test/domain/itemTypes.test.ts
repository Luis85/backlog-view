import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import {
	allTypeChoices,
	childTypeChoices,
	extraTypeRank,
	folderForType,
	isExtraType,
} from '../../src/domain/itemTypes';
import { defaultSettings, defaultTypeFolder, resolveSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

/** Stand-in for BasesViewConfig backed by a plain object. */
function fakeConfig(values: Record<string, unknown> = {}) {
	return {
		get: (key: string) => values[key],
		getAsPropertyId: (key: string) => {
			const v = values[key];
			return typeof v === 'string' && v.includes('.') ? v : null;
		},
	} as never;
}

/** A backlog holding one of everything, so a rung can be asked for by name. */
function fixture() {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
	vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Feature' });
	vault.addFile('Task.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'PBI' });
	// A Bug hanging straight off the Epic: three rungs from where a Task-holder "should" be.
	vault.addFile('Bug.md', { frontmatter: { type: 'Bug', order: 20 }, parentLink: 'Epic' });
	vault.addFile('Bugfix.md', { frontmatter: { type: 'Bugfix', order: 30 }, parentLink: 'Epic' });
	const model = buildModel(vault.app, vault.entries(), settings);
	const get = (title: string) => {
		const item = model.items.find((i) => i.title === title);
		if (!item) throw new Error(`missing fixture item ${title}`);
		return item;
	};
	return { vault, model, get };
}

describe('extra types on the ladder', () => {
	it('ranks an extra type by its type, not by where it hangs', () => {
		const { get } = fixture();
		// Rank is pinned: the Bug sits under an Epic, which would imply a Feature.
		expect(get('Bug').effectiveLevelIndex).toBe(extraTypeRank(settings.levels));
		expect(get('Bug').effectiveLevelIndex).toBe(get('PBI').effectiveLevelIndex);
		// It is not a rung, so nothing may re-type it by position.
		expect(get('Bug').levelIndex).toBe(-1);
		expect(get('Bug').impliedType).toBe(false);
	});

	it('leaves an unknown custom type inheriting its parent slot, as before', () => {
		const { get } = fixture();
		// The contrast that makes the pinning meaningful: Bugfix is not declared, so it
		// still occupies the slot below its parent and its children continue the ladder.
		expect(get('Bugfix').effectiveLevelIndex).toBe(1);
		expect(get('Bug').effectiveLevelIndex).toBe(2);
	});

	it('implies the deepest level for a child of an extra type wherever it hangs', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Deep PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Epic' });
		// The same Bug under the shallowest and the deepest legal parent.
		vault.addFile('High Bug.md', { frontmatter: { type: 'Bug' }, parentLink: 'Epic' });
		vault.addFile('Low Bug.md', { frontmatter: { type: 'Bug' }, parentLink: 'Deep PBI' });
		vault.addFile('High Child.md', { parentLink: 'High Bug' });
		vault.addFile('Low Child.md', { parentLink: 'Low Bug' });
		const model = buildModel(vault.app, vault.entries(), settings);
		const level = (title: string) => {
			const item = model.items.find((i) => i.title === title);
			return item ? settings.levels[item.effectiveLevelIndex] : '';
		};
		expect(level('High Child.md'.replace('.md', ''))).toBe('Task');
		expect(level('Low Child')).toBe('Task');
	});
});

describe('childTypeChoices', () => {
	it('offers the extra types under every rung above the deepest', () => {
		const { get } = fixture();
		expect(childTypeChoices(get('Epic'), settings)).toEqual(['Feature', 'Issue', 'Bug']);
		expect(childTypeChoices(get('Feature'), settings)).toEqual(['PBI', 'Issue', 'Bug']);
		expect(childTypeChoices(get('PBI'), settings)).toEqual(['Task', 'Issue', 'Bug']);
	});

	it('offers no extras under a Task or under an extra type', () => {
		const { get } = fixture();
		// Nothing hangs below a Task, and an extra type holds only the deepest level.
		expect(childTypeChoices(get('Task'), settings)).toEqual(['Task']);
		expect(childTypeChoices(get('Bug'), settings)).toEqual(['Task']);
	});

	it('lets an unknown custom type carry on down the ladder, without extras', () => {
		const { get } = fixture();
		// Unchanged behaviour, and the contrast worth pinning: Bugfix is not declared, so
		// it occupies the slot below its Epic and its children are the slot below that —
		// a Bug in the same place would offer Tasks. Neither offers the extra types,
		// because neither is a rung this view can reason from.
		expect(childTypeChoices(get('Bugfix'), settings)).toEqual(['PBI']);
	});

	it('offers only the top level at the top level', () => {
		// A Bug hangs from something; creating a parentless one would make an item whose
		// own rule says it should have had a parent.
		expect(childTypeChoices(null, settings)).toEqual(['Epic']);
	});

	it('offers the ladder then the extras for assignment by hand', () => {
		expect(allTypeChoices(settings)).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug']);
	});

	it('falls back to the ladder alone when the extra types are turned off', () => {
		const { get } = fixture();
		const none = { ...settings, extraTypes: [] };
		expect(childTypeChoices(get('Epic'), none)).toEqual(['Feature']);
		expect(allTypeChoices(none)).toEqual(['Epic', 'Feature', 'PBI', 'Task']);
	});
});

describe('extra types in the view options', () => {
	it('defaults to Issue and Bug, and matches case-insensitively', () => {
		expect(resolveSettings(fakeConfig()).extraTypes).toEqual(['Issue', 'Bug']);
		expect(isExtraType('bug', settings)).toBe(true);
		expect(isExtraType('Bugfix', settings)).toBe(false);
		expect(isExtraType(null, settings)).toBe(false);
	});

	it('treats a cleared list as off, not as unset', () => {
		// Same rule as the tags property: this option defaults to something real, so
		// clearing it has to be able to mean "none" or it could never be turned off.
		expect(resolveSettings(fakeConfig({ extraTypes: '' })).extraTypes).toEqual([]);
		expect(resolveSettings(fakeConfig({ extraTypes: ' , ' })).extraTypes).toEqual([]);
	});

	it('parses and dedupes the configured list', () => {
		const resolved = resolveSettings(fakeConfig({ extraTypes: ' Defect , Spike ,, defect ' }));
		expect(resolved.extraTypes).toEqual(['Defect', 'Spike']);
	});

	it('yields a name that is already a level instead of reporting a collision', () => {
		// The level wins wherever both are read, so the declaration is merely inert —
		// and gating every write in the view over an inert duplicate would be worse.
		const resolved = resolveSettings(fakeConfig({ extraTypes: 'PBI, Bug' }));
		expect(resolved.extraTypes).toEqual(['Bug']);
	});

	it('ranks extras against a reconfigured ladder', () => {
		const resolved = resolveSettings(fakeConfig({ levels: 'Theme, Story, Chore' }));
		// Always the rung whose children are the deepest level, whatever that ladder is.
		expect(extraTypeRank(resolved.levels)).toBe(1);
		expect(resolved.levels[extraTypeRank(resolved.levels)]).toBe('Story');
	});
});

describe('extra types and the hierarchy scope', () => {
	it('keeps a parentless extra type in the model', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		// No parent, no parent value: it belongs only if its type is recognised. Both
		// "Set type → Bug" on a leaf and a drag to the top level produce exactly this,
		// and counting only the ladder as supported made the note disappear instead.
		vault.addFile('Loose Bug.md', { frontmatter: { type: 'Bug' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.items.map((i) => i.title).sort()).toEqual(['Epic', 'Loose Bug']);
		expect(model.ignoredCount).toBe(0);
	});

	it('still prunes a parentless note whose type is not declared at all', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Meeting.md', { frontmatter: { type: 'meeting-note' } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.items.map((i) => i.title)).toEqual(['Epic']);
		expect(model.ignoredCount).toBe(1);
	});
});

describe('folders by type', () => {
	it('files each shipped type in its own folder', () => {
		expect(folderForType('Epic', settings)).toBe('docs/requirements');
		expect(folderForType('Feature', settings)).toBe('docs/requirements');
		expect(folderForType('PBI', settings)).toBe('docs/requirements');
		expect(folderForType('Task', settings)).toBe('docs/tasks');
		expect(folderForType('Issue', settings)).toBe('docs/issues');
		expect(folderForType('Bug', settings)).toBe('docs/bugs');
		// Type names are matched case-insensitively, like every other type lookup.
		expect(folderForType('bug', settings)).toBe('docs/bugs');
	});

	it('reads one option per type, so each folder is picked rather than typed', () => {
		const resolved = resolveSettings(fakeConfig({ 'typeFolder.bug': 'triage/inbox' }));
		expect(folderForType('Bug', resolved)).toBe('triage/inbox');
		// Every other type keeps its own default: one input cannot disturb another,
		// which is the whole reason these are separate options.
		expect(folderForType('Epic', resolved)).toBe('docs/requirements');
	});

	it('answers null for a type with no folder, so the caller falls back to home', () => {
		expect(folderForType('Bugfix', settings)).toBeNull();
		expect(folderForType('Epic', { ...settings, typeFolders: {} })).toBeNull();
		// Cleared means cleared, not "never set".
		expect(folderForType('Bug', resolveSettings(fakeConfig({ 'typeFolder.bug': '' })))).toBeNull();
	});

	it('gives a renamed level no folder of its own', () => {
		// This plugin never chose that name, so it has no opinion about where it goes —
		// the home folder is the honest answer rather than a guess.
		const resolved = resolveSettings(fakeConfig({ levels: 'Theme, Story, Chore' }));
		expect(folderForType('Theme', resolved)).toBeNull();
		expect(resolved.homeFolder).toBe('docs');
	});

	it('does not read a type name off Object.prototype', () => {
		// A level or extra type named `constructor` finds a function on a plain record,
		// which is truthy — the creation flow would take it for a path and fail on
		// `.trim()`. Unmapped means unmapped, whatever the name.
		for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
			expect(folderForType(name, settings)).toBeNull();
			expect(folderForType(name, { ...settings, typeFolders: {} })).toBeNull();
		}
		// And such a name can still be MAPPED, rather than being a hole the other way.
		const mapped = resolveSettings(fakeConfig({ extraTypes: 'constructor', 'typeFolder.constructor': 'odd' }));
		expect(folderForType('constructor', mapped)).toBe('odd');

		// The DEFAULT table is a second lookup and needs the same guard: unset, such a
		// type must fall back to the home folder, not to `docs/function Object() {…}`.
		expect(defaultTypeFolder('constructor')).toBe('');
		const unset = resolveSettings(fakeConfig({ extraTypes: 'constructor, toString' }));
		expect(folderForType('constructor', unset)).toBeNull();
		expect(folderForType('toString', unset)).toBeNull();
	});

	it('moves every untouched type folder with the home folder', () => {
		// Separate pickers did not cost the "relocate a backlog in one setting" property:
		// each default is derived from the home folder, and the options are generated per
		// view, so the value shown in each box is the value that applies.
		const moved = resolveSettings(fakeConfig({ homeFolder: 'Roadmap' }));
		expect(folderForType('Epic', moved)).toBe('Roadmap/requirements');
		expect(folderForType('Bug', moved)).toBe('Roadmap/bugs');
		// A folder picked by hand stays picked; only the untouched defaults follow.
		const pinned = resolveSettings(fakeConfig({ homeFolder: 'Roadmap', 'typeFolder.bug': 'triage' }));
		expect(pinned.typeFolders['bug']).toBe('triage');
		expect(folderForType('Epic', pinned)).toBe('Roadmap/requirements');
	});

	it('knows whether a base has named a folder at all', () => {
		// The distinction the creation flow needs: a folder someone chose is a decision,
		// and one nobody chose is this plugin's guess, which must not beat evidence.
		expect(resolveSettings(fakeConfig()).foldersConfigured).toBe(false);
		expect(resolveSettings(fakeConfig({ homeFolder: 'X' })).foldersConfigured).toBe(true);
		expect(resolveSettings(fakeConfig({ newItemFolder: 'X' })).foldersConfigured).toBe(true);
		expect(resolveSettings(fakeConfig({ 'typeFolder.bug': 'X' })).foldersConfigured).toBe(true);
		// Cleared counts as named: turning a folder off is a decision too.
		expect(resolveSettings(fakeConfig({ homeFolder: '' })).foldersConfigured).toBe(true);
	});

	it('keeps a base configured before the home folder existed filing where it filed', () => {
		// The old key means what the home folder means. Without this, upgrading moves
		// every new item into docs/ — most likely outside the filter that view was built
		// around, so the note is created and then simply not there.
		const legacy = resolveSettings(fakeConfig({ newItemFolder: 'Backlog' }));
		expect(legacy.homeFolder).toBe('Backlog');
		expect(folderForType('Bug', legacy)).toBe('Backlog/bugs');
		// An explicit home folder wins over the old key.
		expect(resolveSettings(fakeConfig({ newItemFolder: 'Backlog', homeFolder: 'Now' })).homeFolder).toBe('Now');
	});

	it('keeps the home folder as the one general fallback', () => {
		expect(resolveSettings(fakeConfig()).homeFolder).toBe('docs');
		expect(resolveSettings(fakeConfig({ homeFolder: '/Roadmap/' })).homeFolder).toBe('Roadmap');
		// Cleared means "nothing configured", which sends creation back to inference.
		expect(resolveSettings(fakeConfig({ homeFolder: '' })).homeFolder).toBe('');
	});
});
