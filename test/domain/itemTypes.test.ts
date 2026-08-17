import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import {
	childTypeChoices,
	EXTRA_TYPE_RANK,
	folderForType,
	isExtraType,
	isMarkerType,
	placementEnds,
	PlacementEnd,
} from '../../src/domain/itemTypes';
import { defaultSettings } from '../../src/domain/settings';
import { resolveSettings } from '../../src/domain/settingsResolve';
import {
	ALL_TYPES,
	defaultTypeFolder,
	EXTRA_TYPES,
	ITERATION_TYPE,
	LEVELS,
	MARKER_TYPES,
	typeFolderKey,
} from '../../src/domain/typeVocabulary';
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
	vault.addFile('Issue.md', { frontmatter: { type: 'Issue', order: 25 }, parentLink: 'Epic' });
	// An Idea under the DEEPEST legal parent, where the Bug above sits under the shallowest:
	// between them the pinned rank is asked at both ends of the ladder.
	vault.addFile('Idea.md', { frontmatter: { type: 'Idea', order: 10 }, parentLink: 'PBI' });
	vault.addFile('Deliverable.md', { frontmatter: { type: 'Deliverable', order: 50 }, parentLink: 'Epic' });
	// A marker hangs from nothing — a root by nature, not by ladder position.
	vault.addFile('Milestone.md', { frontmatter: { type: 'Milestone', order: 40 } });
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

	it('pins every declared extra type at the same rank, whatever rung it hangs from', () => {
		const { get } = fixture();
		// Asked of the category rather than of one name: the Bug hangs from the Epic and
		// the Idea from the PBI, two rungs apart, and they rank identically because the
		// rank belongs to the type. A name joining EXTRA_TYPES without a fixture row of
		// its own throws here rather than passing quietly.
		for (const type of EXTRA_TYPES) {
			expect(get(type).effectiveLevelIndex).toBe(EXTRA_TYPE_RANK);
			expect(get(type).levelIndex).toBe(-1);
			expect(isExtraType(type.toLowerCase())).toBe(true);
		}
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
		expect(childTypeChoices(get('Epic'))).toEqual(['Feature', 'Issue', 'Bug', 'Idea', 'Deliverable']);
		expect(childTypeChoices(get('Feature'))).toEqual(['PBI', 'Issue', 'Bug', 'Idea', 'Deliverable']);
		expect(childTypeChoices(get('PBI'))).toEqual(['Task', 'Issue', 'Bug', 'Idea', 'Deliverable']);
	});

	it('offers no extras under a Task or under an extra type', () => {
		const { get } = fixture();
		// Nothing hangs below a Task, and an extra type holds only the deepest level.
		expect(childTypeChoices(get('Task'))).toEqual(['Task']);
		expect(childTypeChoices(get('Bug'))).toEqual(['Task']);
		expect(childTypeChoices(get('Idea'))).toEqual(['Task']);
	});

	it('lets an unknown custom type carry on down the ladder, without extras', () => {
		const { get } = fixture();
		// Unchanged behaviour, and the contrast worth pinning: Bugfix is not declared, so
		// it occupies the slot below its Epic and its children are the slot below that —
		// a Bug in the same place would offer Tasks. Neither offers the extra types,
		// because neither is a rung this view can reason from.
		expect(childTypeChoices(get('Bugfix'))).toEqual(['PBI']);
	});

	it('offers the whole vocabulary at the top level, because the toolbar does', () => {
		// Not an opinion about what SHOULD be a root: `renderToolbar` iterates ALL_TYPES
		// with no parent, so this is the one description of that path, and its only reader
		// is the generated README's root marker. Narrowing it here published a parent
		// requirement the view does not have.
		expect(childTypeChoices(null)).toEqual(ALL_TYPES);
	});

	it('offers nothing under a marker — a point in time contains no work', () => {
		const { get } = fixture();
		// Absent, not empty: `renderRowTrailing` builds its label from the first of these,
		// and `New undefined` on a modal with no types is what an empty list renders as.
		expect(childTypeChoices(get('Milestone'))).toEqual([]);
	});

	it('still refuses to put a marker under anything', () => {
		const { get } = fixture();
		// Every declared marker, not just the one the fixture happens to build a row for —
		// a second marker joining `MARKER_TYPES` without its own fixture entry still has to
		// answer this for every real rung.
		for (const parent of [...LEVELS, ...EXTRA_TYPES]) {
			for (const marker of MARKER_TYPES) {
				expect(childTypeChoices(get(parent))).not.toContain(marker);
			}
		}
	});

	it('offers the ladder then the extras for assignment by hand', () => {
		// The marker joins as a third category, after the extras — ALL_TYPES is the
		// whole vocabulary, not just the ladder and the pinned container.
		expect(ALL_TYPES).toEqual([
			'Epic',
			'Feature',
			'PBI',
			'Task',
			'Issue',
			'Bug',
			'Idea',
			'Deliverable',
			'Milestone',
			'Iteration',
			'Test suite',
			'Test case',
		]);
	});

	it('is a fixed vocabulary, matched case-insensitively', () => {
		// Not configurable on purpose: every level rule would otherwise have to hold for
		// any list a user can type, and the reward was a rename.
		expect(LEVELS).toEqual(['Epic', 'Feature', 'PBI', 'Task']);
		// `Task` is a rung of BOTH ladders and appears here exactly ONCE: two entries would
		// give it a second folder option under the same key, a duplicate in every creator
		// menu and two shelf groups.
		expect(ALL_TYPES.filter((t) => t === 'Task')).toEqual(['Task']);
		expect(ALL_TYPES).toEqual([...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES, 'Test suite', 'Test case']);
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
		// Every extra type, not one of them: the pruning rule reads the vocabulary, so
		// the check reads it too and a new name cannot join without being asked.
		for (const type of EXTRA_TYPES) vault.addFile(`Loose ${type}.md`, { frontmatter: { type } });
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.items.map((i) => i.title).sort()).toEqual(['Epic', ...EXTRA_TYPES.map((t) => `Loose ${t}`).sort()]);
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

	it('pins Deliverable at EXTRA_TYPE_RANK wherever it hangs, holding only Tasks', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('D.md', { frontmatter: { type: 'Deliverable', order: 10 }, parentLink: 'Epic' });
		const model = buildModel(vault.app, vault.entries(), defaultSettings());
		const d = model.items.find((i) => i.title === 'D');
		if (!d) throw new Error('missing D');
		expect(d.effectiveLevelIndex).toBe(EXTRA_TYPE_RANK);
		expect(d.levelIndex).toBe(-1);
		expect(childTypeChoices(d)).toEqual(['Task']);
	});

	it('defaults the Deliverable folder to <home>/deliverables', () => {
		expect(defaultTypeFolder('Deliverable')).toBe('docs/deliverables');
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
		expect(folderForType('Idea', settings)).toBe('docs/ideas');
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

describe('isMarkerType', () => {
	it('recognises every declared marker, case-insensitively, and nothing else', () => {
		for (const marker of MARKER_TYPES) {
			expect(isMarkerType(marker)).toBe(true);
			expect(isMarkerType(marker.toLowerCase())).toBe(true);
		}
		// The trap this whole design exists to avoid: a marker is not an extra type, and
		// asking one predicate the other's question must stay a wrong answer.
		for (const other of [...LEVELS, ...EXTRA_TYPES]) expect(isMarkerType(other)).toBe(false);
		expect(isMarkerType('Spike')).toBe(false);
		expect(isMarkerType(null)).toBe(false);
		expect(MARKER_TYPES.some((m) => isExtraType(m))).toBe(false);
	});
});

describe('Iteration is a declared marker', () => {
	it('is a marker type and a member of the whole vocabulary', () => {
		expect(ITERATION_TYPE).toBe('Iteration');
		expect(MARKER_TYPES).toContain('Iteration');
		expect(ALL_TYPES).toContain('Iteration');
	});

	it('inherits every marker rule rather than declaring one', () => {
		expect(isMarkerType('Iteration')).toBe(true);
		// A marker holds nothing, so nothing is offered beneath it.
		expect(childTypeChoices({ typeName: 'Iteration', levelIndex: -1, effectiveLevelIndex: 0, ladder: LEVELS })).toEqual(
			[],
		);
	});

	it('files into its own subfolder', () => {
		expect(typeFolderKey('Iteration')).toBe('typeFolder.iteration');
		// The key alone proves nothing about where a note actually lands: `typeFolderKey`
		// derives its answer from the type NAME, so a missing or misspelt row in
		// `DEFAULT_TYPE_SUBFOLDERS` would still pass a key-only assertion. One of ADR
		// 0013's three owed opinions is the shipped default folder itself, so assert the
		// resolved VALUE too, following the marker default's own test in `settings.test.ts`.
		expect(defaultTypeFolder('Iteration')).toBe('docs/iterations');
		expect(defaultTypeFolder('Iteration', 'work')).toBe('work/iterations');
		expect(defaultSettings().typeFolders.iteration).toBe('docs/iterations');
	});
});

describe('placementEnds', () => {
	it('gives a work item both ends and a marker its target alone', () => {
		expect(placementEnds('PBI', false)).toEqual(['start', 'target']);
		expect(placementEnds('Bug', false)).toEqual(['start', 'target']);
		expect(placementEnds(null, false)).toEqual(['start', 'target']);
		// The type is the stronger statement: a start a milestone merely ignores is not
		// a date any hand may write or delete.
		expect(placementEnds('Milestone', false)).toEqual(['target']);
		expect(placementEnds('milestone', false)).toEqual(['target']);
	});

	it('answers about a TYPE, not an item, so the writer can ask it of the live note', () => {
		// The writer decides against what the note currently says — including what type
		// it currently is — so this predicate may not take a BacklogItem. A signature
		// test rather than a behaviour one, because the signature is the invariant.
		const ends: PlacementEnd[] = placementEnds('Milestone', false);
		expect(ends).toHaveLength(1);
	});
});
