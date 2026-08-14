import { TFile } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { Absence, absencesConfigured, crossedAbsences, pendingAbsences } from '../../src/domain/absences';
import { CivilDate, readDate } from '../../src/domain/noteFields';
import { ABSENCE_TYPE, ALL_TYPES, typeFolderKey } from '../../src/domain/typeVocabulary';
import { folderForType } from '../../src/domain/itemTypes';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsFrom, settingsWith } from '../helpers/settings';
import { absenceVault } from '../helpers/resources';
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

function civil(text: string): CivilDate {
	const read = readDate(text).value;
	if (read === null) throw new Error(`not a date: ${text}`);
	return read;
}

function away(title: string, start: string, target: string): Absence {
	return { file: {} as TFile, title, resource: 'Alice', start: civil(start), target: civil(target) };
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

describe('a bar scheduled across an absence', () => {
	const AUGUST = away('Alice away', '2026-08-04', '2026-08-06');

	it('crosses a stretch its span runs through', () => {
		const span = { start: civil('2026-08-01'), target: civil('2026-08-10') };
		expect(crossedAbsences(span, [AUGUST]).map((one) => one.title)).toEqual(['Alice away']);
	});

	it('counts a shared boundary day as a crossing', () => {
		// Inclusive at both ends: a bar ending on the first day of an absence IS scheduled
		// across a day nobody should be scheduled across.
		expect(crossedAbsences({ start: civil('2026-07-20'), target: civil('2026-08-04') }, [AUGUST])).toHaveLength(1);
		expect(crossedAbsences({ start: civil('2026-08-06'), target: civil('2026-08-20') }, [AUGUST])).toHaveLength(1);
	});

	it('clears a span that ends before or begins after the stretch', () => {
		expect(crossedAbsences({ start: civil('2026-07-01'), target: civil('2026-08-03') }, [AUGUST])).toEqual([]);
		expect(crossedAbsences({ start: civil('2026-08-07'), target: civil('2026-08-20') }, [AUGUST])).toEqual([]);
	});

	it('judges a one-ended bar at the single day it draws', () => {
		// The days the bar DRAWS, which is `barGeometry`'s own borrowing — a backlog stating
		// targets and no starts is the ordinary case here, and treating the missing end as
		// unbounded would report a crossing on every stretch behind it.
		expect(crossedAbsences({ start: null, target: civil('2026-08-05') }, [AUGUST])).toHaveLength(1);
		expect(crossedAbsences({ start: null, target: civil('2026-08-20') }, [AUGUST])).toEqual([]);
		expect(crossedAbsences({ start: civil('2026-08-05'), target: null }, [AUGUST])).toHaveLength(1);
		expect(crossedAbsences({ start: civil('2026-07-01'), target: null }, [AUGUST])).toEqual([]);
	});

	it('returns only the stretches crossed, in the order given', () => {
		const july = away('Earlier', '2026-07-01', '2026-07-03');
		const later = away('Later', '2026-08-05', '2026-08-09');
		const crossed = crossedAbsences({ start: civil('2026-08-01'), target: civil('2026-08-10') }, [july, AUGUST, later]);
		expect(crossed.map((one) => one.title)).toEqual(['Alice away', 'Later']);
	});

	it('crosses nothing when the resource has no stretches', () => {
		expect(crossedAbsences({ start: civil('2026-08-01'), target: civil('2026-08-10') }, [])).toEqual([]);
	});
});

describe('how many stretches are still to come', () => {
	// Fixed rather than derived from the clock: this function TAKES today, which is the
	// whole reason it can be asked about a day the test chooses.
	const TODAY = civil('2026-08-14');

	it('counts one that has not ended — running or still ahead', () => {
		// One comparison, not two: a stretch whose target is today or later has either not
		// started or not finished, and there is no third case.
		expect(pendingAbsences([away('Running', '2026-08-10', '2026-08-20')], TODAY)).toBe(1);
		expect(pendingAbsences([away('Ahead', '2026-09-01', '2026-09-05')], TODAY)).toBe(1);
	});

	it('counts the day it ends, and not the day after', () => {
		// Inclusive at today, `crossedAbsences`' own boundary rule — one absence must not
		// mean two different things on one row.
		expect(pendingAbsences([away('Ends today', '2026-08-01', '2026-08-14')], TODAY)).toBe(1);
		expect(pendingAbsences([away('Ended yesterday', '2026-08-01', '2026-08-13')], TODAY)).toBe(0);
	});

	it('counts only the pending ones out of a mixed list', () => {
		const list = [
			away('Old', '2026-01-01', '2026-01-05'),
			away('Running', '2026-08-10', '2026-08-20'),
			away('Next', '2026-12-01', '2026-12-05'),
		];

		expect(pendingAbsences(list, TODAY)).toBe(2);
	});

	it('counts nothing for a resource with no stretches at all', () => {
		expect(pendingAbsences([], TODAY)).toBe(0);
	});
});
