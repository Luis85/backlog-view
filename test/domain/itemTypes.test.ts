import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { childTypeChoices, EXTRA_TYPE_RANK, folderForType, isExtraType } from '../../src/domain/itemTypes';
import { ALL_TYPES, defaultSettings, defaultTypeFolder, LEVELS, resolveSettings } from '../../src/domain/settings';
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
		expect(get('Bug').effectiveLevelIndex).toBe(EXTRA_TYPE_RANK);
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
			return item ? LEVELS[item.effectiveLevelIndex] : '';
		};
		expect(level('High Child.md'.replace('.md', ''))).toBe('Task');
		expect(level('Low Child')).toBe('Task');
	});
});

describe('childTypeChoices', () => {
	it('offers the extra types under every rung above the deepest', () => {
		const { get } = fixture();
		expect(childTypeChoices(get('Epic'))).toEqual(['Feature', 'Issue', 'Bug']);
		expect(childTypeChoices(get('Feature'))).toEqual(['PBI', 'Issue', 'Bug']);
		expect(childTypeChoices(get('PBI'))).toEqual(['Task', 'Issue', 'Bug']);
	});

	it('offers no extras under a Task or under an extra type', () => {
		const { get } = fixture();
		// Nothing hangs below a Task, and an extra type holds only the deepest level.
		expect(childTypeChoices(get('Task'))).toEqual(['Task']);
		expect(childTypeChoices(get('Bug'))).toEqual(['Task']);
	});

	it('lets an unknown custom type carry on down the ladder, without extras', () => {
		const { get } = fixture();
		// Unchanged behaviour, and the contrast worth pinning: Bugfix is not declared, so
		// it occupies the slot below its Epic and its children are the slot below that —
		// a Bug in the same place would offer Tasks. Neither offers the extra types,
		// because neither is a rung this view can reason from.
		expect(childTypeChoices(get('Bugfix'))).toEqual(['PBI']);
	});

	it('offers only the top level at the top level', () => {
		// A Bug hangs from something; creating a parentless one would make an item whose
		// own rule says it should have had a parent.
		expect(childTypeChoices(null)).toEqual(['Epic']);
	});

	it('offers the ladder then the extras for assignment by hand', () => {
		expect(ALL_TYPES).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug']);
	});

	it('is a fixed vocabulary, matched case-insensitively', () => {
		// Not configurable on purpose: every level rule would otherwise have to hold for
		// any list a user can type, and the reward was a rename.
		expect(LEVELS).toEqual(['Epic', 'Feature', 'PBI', 'Task']);
		expect(ALL_TYPES).toEqual(['Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug']);
		expect(isExtraType('bug')).toBe(true);
		expect(isExtraType('Bugfix')).toBe(false);
		expect(isExtraType(null)).toBe(false);
	});

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

	it('does not read a type name off Object.prototype', () => {
		// A level or extra type named `constructor` finds a function on a plain record,
		// which is truthy — the creation flow would take it for a path and fail on
		// `.trim()`. Unmapped means unmapped, whatever the name.
		for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
			expect(folderForType(name, settings)).toBeNull();
			expect(folderForType(name, { ...settings, typeFolders: {} })).toBeNull();
		}
		// The DEFAULT table is a second lookup and needs the same guard: such a name must
		// answer nothing, not `docs/function Object() {…}`.
		expect(defaultTypeFolder('constructor')).toBe('');
		expect(defaultTypeFolder('__proto__')).toBe('');
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

	it('keeps the home folder as the one general fallback', () => {
		expect(resolveSettings(fakeConfig()).homeFolder).toBe('docs');
		expect(resolveSettings(fakeConfig({ homeFolder: '/Roadmap/' })).homeFolder).toBe('Roadmap');
		// Cleared means "nothing configured", which sends creation back to inference.
		expect(resolveSettings(fakeConfig({ homeFolder: '' })).homeFolder).toBe('');
	});
});
