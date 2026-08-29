import { TFile } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { Absence, absencesConfigured, absenceTitle, awayWeeks, crossedAbsences, daysLost, packLanes } from '../../src/domain/absences';
import { CivilDate, readDate } from '../../src/domain/noteFields';
import { ABSENCE_TYPE, ALL_TYPES, typeFolderKey } from '../../src/domain/typeVocabulary';
import { folderForType } from '../../src/domain/itemTypes';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsFrom, settingsWith } from '../helpers/settings';
import { ALICE_AWAY, ALICE_AWAY_PATH, absenceVault } from '../helpers/resources';
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
	return { file: {} as TFile, title, resource: { file: null, raw: 'Alice' }, start: civil(start), target: civil(target) };
}

describe('an absence is never a work item', () => {
	it('is dropped before it becomes an item, and its facts kept beside them', () => {
		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor());

		// Not an item, not a result, not reachable by path — the exclusion is the type's,
		// and it happens before a `RawItem` is built rather than by failing a later test.
		expect(model.items.map((i) => i.title)).toEqual(['Work']);
		expect(model.byPath.has(ALICE_AWAY_PATH)).toBe(false);
		expect(model.absences.map((a) => a.title)).toEqual([ALICE_AWAY]);
		// A link now, resolved to the roster's own note — never the bare text a plain
		// string comparison used to settle for.
		expect(model.absences[0].resource.file?.basename).toBe('Alice');
	});

	it('is dropped with hierarchyOnly off, where every note becomes an item', () => {
		// The polarity that distinguishes this from every other declared type: the scope
		// prune is what drops an unsupported note, and it does not run at all here.
		const vault = absenceVault();
		const model = buildModel(vault.app, vault.entries(), settingsFor({ hierarchyOnly: false }));

		expect(model.items.map((i) => i.title)).toEqual(['Work']);
		expect(model.absences).toHaveLength(1);
	});

	it('keeps nothing at all for a note the Base never returned', () => {
		// The context-row rule, at the one collection an absence lands in: an `outsideFilter`
		// note is never a source of anything derived from the results — no band, no stretch
		// and no count. Stated at the KEEPING rather than at the path that reaches it, since
		// `loadOutsideParents` is only today's way in: any future caller handing `addItem` a
		// note with no entry trips this.
		const vault = new FakeVault();
		vault.addFile('Alice.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
			parentLink: 'Away',
		});
		// Its resource is on no result at all and on no roster note either, so nothing
		// could place its stretch anywhere even were it kept.
		vault.addFile('Away.md', {
			frontmatter: { type: 'Absence', assignee: 'Quinn', start: '2026-08-04', due: '2026-08-06' },
		});
		const settings = settingsFor();
		const entries = vault.entries().filter((entry) => entry.file.path === 'Work.md' || entry.file.path === 'Alice.md');
		const model = buildModel(vault.app, entries, settings);
		const roadmap = buildRoadmap(model, settings, () => true, 'resources');

		expect(model.absences).toEqual([]);
		expect(roadmap.lanes.map((lane) => lane.name)).toEqual(['Alice']);
		expect(roadmap.lanes[0].absences).toEqual([]);
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
		expect(model.byPath.has(ALICE_AWAY_PATH)).toBe(false);
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

describe('packing drawn boxes into sub-lanes', () => {
	/** A box in the shape `spanBox` produces — the drawer's own numbers, named by their ends. */
	const box = (left: number, right: number): { left: number; right: number } => ({ left, right });

	it('puts boxes that do not overlap on one line', () => {
		expect(packLanes([box(0, 10), box(20, 30)])).toEqual([0, 0]);
	});

	it('lets two that merely TOUCH share a line', () => {
		// Ends are exclusive, so a box starting exactly where the last one stopped fits beside
		// it. That is the pixel reading of the day rule it replaces, where two stretches sharing
		// a DAY could not: 1–5 and 5–9 are one day apart and their boxes overlap by that day.
		expect(packLanes([box(0, 10), box(10, 20)])).toEqual([0, 0]);
		expect(packLanes([box(0, 10), box(9, 20)])).toEqual([0, 1]);
	});

	it('opens a third line only when three mutually overlap', () => {
		expect(packLanes([box(0, 30), box(10, 40), box(20, 50)])).toEqual([0, 1, 2]);
	});

	it('reuses the first line with room rather than the emptiest', () => {
		// Greedy first-fit, so a long box does not push everything after it downward.
		expect(packLanes([box(0, 100), box(10, 30), box(40, 60)])).toEqual([0, 1, 1]);
	});

	it('separates boxes that share no day but overlap all the same', () => {
		// The whole reason this packs boxes rather than dates. Two one-day stretches on
		// consecutive days at quarter zoom: 2px apart, 4px wide because `MIN_BAR_PX` floors
		// them. The days never touch and the marks half-cover one another.
		expect(packLanes([box(0, 4), box(2, 6)])).toEqual([0, 1]);
		// And the same for two clamped to one edge, which is the other place days and pixels
		// disagree: identical boxes, whatever their dates said.
		expect(packLanes([box(500, 504), box(500, 504)])).toEqual([0, 1]);
	});

	it('spends no line on two clamped past OPPOSITE edges, which never touched', () => {
		expect(packLanes([box(0, 4), box(500, 504)])).toEqual([0, 0]);
	});

	it('packs nothing into nothing', () => {
		expect(packLanes([])).toEqual([]);
	});
});

describe('how many of a bar’s days an absence takes', () => {
	const AUG = away('Alice away', '2026-08-04', '2026-08-06');

	it('counts nothing for a span that crosses nothing', () => {
		expect(daysLost({ start: civil('2026-08-10'), target: civil('2026-08-20') }, [AUG])).toBe(0);
		expect(daysLost({ start: civil('2026-08-01'), target: civil('2026-08-20') }, [])).toBe(0);
	});

	it('counts only the days the two actually share', () => {
		// The bar runs 1–5, the stretch 4–6: two shared days, not the stretch's three.
		expect(daysLost({ start: civil('2026-08-01'), target: civil('2026-08-05') }, [AUG])).toBe(2);
	});

	it('counts the whole span when the stretch covers it', () => {
		expect(daysLost({ start: civil('2026-08-05'), target: civil('2026-08-06') }, [AUG])).toBe(2);
	});

	it('counts a day shared by two stretches ONCE', () => {
		// The union, never the sum — two overlapping stretches do not cost a day twice.
		const also = away('Also', '2026-08-05', '2026-08-08');
		expect(daysLost({ start: civil('2026-08-01'), target: civil('2026-08-10') }, [AUG, also])).toBe(5);
	});

	it('judges a one-ended bar at the single day it draws', () => {
		expect(daysLost({ start: null, target: civil('2026-08-05') }, [AUG])).toBe(1);
		expect(daysLost({ start: null, target: civil('2026-08-20') }, [AUG])).toBe(0);
	});

	it('judges the mirror one-ended bar — a start with no target — the same way', () => {
		// `to` falls back to `start` exactly as `from` falls back to `target` above.
		expect(daysLost({ start: civil('2026-08-05'), target: null }, [AUG])).toBe(1);
		expect(daysLost({ start: civil('2026-08-20'), target: null }, [AUG])).toBe(0);
	});
});

describe('how long a resource is away', () => {
	const TODAY = civil('2026-08-14');

	it('rounds part of a week up, since a partial week is still time lost', () => {
		expect(awayWeeks([away('One day', '2026-08-20', '2026-08-20')], TODAY)).toBe(1);
		expect(awayWeeks([away('Seven', '2026-08-20', '2026-08-26')], TODAY)).toBe(1);
		expect(awayWeeks([away('Eight', '2026-08-20', '2026-08-27')], TODAY)).toBe(2);
	});

	it('leaves out a stretch that has already ended, and keeps one still running', () => {
		// The filter `pendingAbsences` used to be, now the only thing left of it.
		expect(awayWeeks([away('Over', '2026-08-01', '2026-08-13')], TODAY)).toBe(0);
		// A stretch ending today has ONE day left, not the fortnight it has run for.
		expect(awayWeeks([away('Ends today', '2026-08-01', '2026-08-14')], TODAY)).toBe(1);
	});

	it('counts the REMAINDER of a running stretch, never the whole of it', () => {
		// What the pill says is how long this resource is still away, so a stretch already
		// under way contributes only the days left of it. Counted whole it reports a month for
		// someone back on Sunday, and then drops to nothing overnight — the number is loudest
		// exactly where it is least true. `isPending` decides WHETHER a stretch counts and this
		// clamp decides FROM WHEN, which is one rule asked at both ends of the same day.
		expect(awayWeeks([away('Four weeks, two days left', '2026-07-20', '2026-08-15')], TODAY)).toBe(1);
		// Wholly ahead — nothing to clamp, so the whole stretch counts.
		expect(awayWeeks([away('Not started', '2026-08-20', '2026-09-16')], TODAY)).toBe(4);
	});

	it('counts a day two stretches share once', () => {
		const overlapping = [away('A', '2026-08-20', '2026-08-26'), away('B', '2026-08-24', '2026-08-30')];
		// Eleven days together, not fourteen — two weeks, not two-and-a-bit rounded to three.
		expect(awayWeeks(overlapping, TODAY)).toBe(2);
	});

	it('is nothing for a resource with no stretches at all', () => {
		expect(awayWeeks([], TODAY)).toBe(0);
	});
});

describe('what an absence note is called', () => {
	it('names the resource and both ends, so two over different days read apart', () => {
		// Both dates, so one resource's two stretches are told apart by the name itself:
		// `Alice away 1` and `Alice away 2` say nothing apart, and a filename is read in the
		// explorer, in search and in a link, where no row is there to supply the dates. Not
		// "never collides" — the same days derive the same name, which is why `uniqueNotePath`
		// still has a suffix and a rename still has to know its own path.
		expect(absenceTitle({ start: '2026-08-04', target: '2026-08-06' }, 'Alice')).toBe(
			'Alice away 2026-08-04 → 2026-08-06',
		);
	});

	it('is the one producer, so both acts derive the same name from the same facts', () => {
		// Stated as the property rather than trusted: the create path and the edit path each
		// call this, which is what stops them disagreeing about what an absence is called.
		const facts = { start: '2026-09-01', target: '2026-09-04' };

		expect(absenceTitle(facts, 'Bob')).toBe(absenceTitle({ ...facts }, 'Bob'));
		expect(absenceTitle(facts, 'Bob')).toBe('Bob away 2026-09-01 → 2026-09-04');
	});

	it('names whatever the caller passes as the label, never a resource of its own', () => {
		// The label used to be derived from `facts.resource` here; now it is not a fact about
		// the absence at all (Task 6 follow-up) — it is the caller's own collision-aware name,
		// the same one `namedTargets` gives two `Resource` notes sharing a basename in different
		// folders. Passing a DIFFERENT label for the same two dates derives a different name,
		// which is the whole point: two same-named resources must not share a note name.
		expect(absenceTitle({ start: '2026-09-01', target: '2026-09-04' }, 'Team/Bob')).toBe(
			'Team/Bob away 2026-09-01 → 2026-09-04',
		);
		expect(absenceTitle({ start: '2026-09-01', target: '2026-09-04' }, 'Support/Bob')).toBe(
			'Support/Bob away 2026-09-01 → 2026-09-04',
		);
	});
});
