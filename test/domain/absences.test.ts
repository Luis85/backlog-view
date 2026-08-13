import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { absencesConfigured } from '../../src/domain/absences';
import { ABSENCE_TYPE, ALL_TYPES, typeFolderKey } from '../../src/domain/typeVocabulary';
import { folderForType } from '../../src/domain/itemTypes';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsFrom, settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * An absence is a note this backlog recognizes in order to REFUSE it. What this file
 * checks is that refusal — where it happens, what it costs, and what is kept beside the
 * items rather than among them. Where the row it lands in is decided is
 * `test/domain/resources.test.ts`; what it looks like is `test/view/resourceAbsences.test.ts`.
 */

/** The axis's own three properties, which an absence reads through as well. */
function settingsFor(over: Partial<BacklogSettings> = {}): BacklogSettings {
	return settingsWith({ assigneeKey: 'assignee', startKey: 'start', targetKey: 'due', ...over });
}

/** One epic, and one absence written the way the prompt writes them. */
function absenceVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Work.md', {
		frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
	});
	vault.addFile('Alice away.md', {
		frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
	});
	return vault;
}

describe('an absence is never a work item', () => {
	it('is dropped before it becomes an item, and its facts kept beside them', () => {
		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor());

		// Not an item, not a result, not reachable by path — the exclusion is the type's,
		// and it happens before a `RawItem` is built rather than by failing a later test.
		expect(model.items.map((i) => i.title)).toEqual(['Work']);
		expect(model.byPath.has('Alice away.md')).toBe(false);
		expect(model.absences.map((a) => a.title)).toEqual(['Alice away']);
		expect(model.absences[0].resource).toBe('Alice');
	});

	it('is dropped with hierarchyOnly off, where every note becomes an item', () => {
		// The polarity that distinguishes this from every other declared type: the scope
		// prune is what drops an unsupported note, and it does not run at all here.
		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor({ hierarchyOnly: false }));

		expect(model.items.map((i) => i.title)).toEqual(['Work']);
		expect(model.absences).toHaveLength(1);
	});

	it('keeps the name out of every list the work-item vocabulary drives', () => {
		// Stated at the list rather than at its consumers: `childTypeChoices`, `focusTarget`,
		// the shelf's grouping, the generated README and the manual all read this one array,
		// so none of them needs an edit and none of them can grow an entry by accident.
		expect(ALL_TYPES).not.toContain('Absence');
	});

	it('reads nothing at all until both date properties are configured', () => {
		// 4d: a note with both dates in its frontmatter is not read as a one-ended
		// ordinary range from whichever single key survives — nothing distinguishes
		// "the other key left the settings" from "this was never a two-ended absence".
		expect(absencesConfigured(settingsFor())).toBe(true);
		expect(absencesConfigured(settingsFor({ targetKey: '' }))).toBe(false);
		expect(absencesConfigured(settingsFor({ startKey: '' }))).toBe(false);
		expect(absencesConfigured(settingsFor({ assigneeKey: '' }))).toBe(false);

		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor({ targetKey: '' }));
		// Still dropped from the model — that is the TYPE's doing and unconditional — and
		// still not readable as anything.
		expect(model.byPath.has('Alice away.md')).toBe(false);
		expect(model.absences).toEqual([]);
	});

	it('refuses a range a hand edit broke, the same way the prompt refuses one', () => {
		// 4g: the prompt is not the only way frontmatter changes, and this plugin cannot
		// intercept Obsidian's own editor. One rule, asked of the note's own values as
		// well as of the settings, because "a range this axis cannot trust" is one fact.
		const vault = new FakeVault();
		vault.addFile('No end.md', { frontmatter: { type: 'Absence', assignee: 'A', start: '2026-08-01' } });
		vault.addFile('Reversed.md', {
			frontmatter: { type: 'Absence', assignee: 'A', start: '2026-08-09', due: '2026-08-02' },
		});
		vault.addFile('Unreadable.md', {
			frontmatter: { type: 'Absence', assignee: 'A', start: 'soon', due: '2026-08-02' },
		});
		vault.addFile('Nobody.md', {
			frontmatter: { type: 'Absence', start: '2026-08-01', due: '2026-08-02' },
		});

		const model = buildModel(vault.app, vault.entries(), settingsFor());

		// All four are dropped from the model by their type, and none of them draws:
		// there is no shelf for a written absence to fall back to.
		expect(model.items).toEqual([]);
		expect(model.absences).toEqual([]);
	});
});

describe('where an absence is filed', () => {
	it('has a folder option of its own, resolved like every other type’s', () => {
		const settings = settingsFrom({ 'typeFolder.absence': 'docs/absences' });

		expect(folderForType(ABSENCE_TYPE, settings)).toBe('docs/absences');
	});

	it('falls back to the home folder rather than to a shipped subfolder', () => {
		// 3a. Deliberately absent from `DEFAULT_TYPE_SUBFOLDERS`: sharing the home folder
		// with every other type's notes is safe, because what keeps an absence out of the
		// tree and the other axes is its TYPE and never its folder.
		const settings = settingsFrom({ homeFolder: 'notes' });

		expect(folderForType(ABSENCE_TYPE, settings)).toBeNull();
		expect(settings.homeFolder).toBe('notes');
		// The contrast that makes the sentence a claim rather than a coincidence: a type
		// this plugin DOES ship an opinion about tracks the home folder instead.
		expect(folderForType('Epic', settings)).toBe('notes/requirements');
	});

	it('reaches that folder without joining the work-item vocabulary', () => {
		// The criterion stated at both ends: the key exists, and the list that drives every
		// creator menu, focus target and shelf group does not contain the name.
		expect(typeFolderKey(ABSENCE_TYPE)).toBe('typeFolder.absence');
		expect(ALL_TYPES).not.toContain(ABSENCE_TYPE);
	});
});
