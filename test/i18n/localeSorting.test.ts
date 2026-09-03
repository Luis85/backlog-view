import { describe, expect, it } from 'vitest';
import { backlogReadmeContent } from '../../src/domain/backlogReadme';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap } from '../../src/domain/roadmap';
import { organizeShelf } from '../../src/domain/shelf';
import { computeDropWrites, computeStateWrites } from '../../src/domain/writePlan';
import { withLocale } from '../helpers/locale';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * The guarantee `docs/requirements/Locale-aware sorting and formatting.md` states, asked
 * of the code rather than written in a comment beside it: **collation is presentation
 * only.** A list a reader looks at is sorted in the reader's own alphabet; no note
 * property, no rank and no persisted key follows the collator.
 *
 * **That sentence is narrower than "no bytes reach the vault in a locale order", and the
 * narrowing is a finding rather than a hedge.** `Generate README` writes a document whose
 * state table IS locale-ordered — `readmeStates` takes `stateMenuValues`, which hands back
 * `observedStates` verbatim when no workflow is declared, and `observedStates` is sorted
 * by `compareText`. Two collaborators in different locales regenerating one backlog's
 * README therefore produce a reorder diff. That was decided to be RIGHT rather than fixed:
 * a reader's own README in the reader's own alphabet is what the collation is for, and the
 * table carries no key, no property and no rank. It is pinned below so it is a decision
 * somebody can find rather than an accident somebody re-derives.
 *
 * Swedish and English are the pair, because they disagree about one letter and about
 * nothing else: `Ö` sorts after `Z` in Swedish and beside `O` in English. So each list
 * below is asked for TWICE and the two answers must differ — asserting one locale's order
 * alone would pass just as well if no collator were involved at all — while the ranks and
 * the plans beside them must not move.
 *
 * The second half is the half with teeth. The state and tag vocabularies are sorted FOR
 * THE MENU, and what a pick writes is the value the user chose, never the position the
 * locale sorted it into; `order` is a fractional rank and `entryIndex` is the Bases result
 * order, and neither is a comparison of text at all.
 *
 * What the second half DRIVES is narrower again, and the note says so too: two plans, the
 * state write and the drop. Nothing here drives the horizon or board moves, the tag deltas
 * or the label writers — none of those takes a sorted list as an argument, which is a
 * structural statement rather than a test.
 */

const SWEDISH = 'sv';
const ENGLISH = 'en';

/** The same answer asked for in both locales — `[Swedish, English]`. */
function inBothLocales<T>(body: () => T): [T, T] {
	return [withLocale(SWEDISH, body), withLocale(ENGLISH, body)];
}

const settings = settingsWith({ stateKey: 'status', tagsKey: 'tags', horizonKey: 'horizon', horizonValues: ['Now'] });

/**
 * Three names whose order is the whole experiment: `Öl` sits between `Apfel` and `Zebra`
 * in English and after both in Swedish. Every note is an `Epic` with a rank of its own and
 * no horizon, so all three reach the shelf and all three are siblings at the top level.
 */
function vaultOfThree(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Apfel.md', { frontmatter: { type: 'Epic', order: 10, status: 'Apfel', tags: ['apfel'] } });
	vault.addFile('Zebra.md', { frontmatter: { type: 'Epic', order: 20, status: 'Zebra', tags: ['zebra'] } });
	vault.addFile('Öl.md', { frontmatter: { type: 'Epic', order: 30, status: 'Öl', tags: ['öl'] } });
	return vault;
}

function modelOf(vault: FakeVault) {
	return buildModel(vault.app, vault.entries(), settings);
}

describe('a locale-sorted list is sorted in the reader\'s own alphabet', () => {
	it('orders the state vocabulary the menu offers', () => {
		const [sv, en] = inBothLocales(() => modelOf(vaultOfThree()).observedStates);

		expect(sv).toEqual(['Apfel', 'Zebra', 'Öl']);
		expect(en).toEqual(['Apfel', 'Öl', 'Zebra']);
	});

	it('orders the tag vocabulary the tag menus offer', () => {
		const [sv, en] = inBothLocales(() => modelOf(vaultOfThree()).observedTags);

		expect(sv).toEqual(['apfel', 'zebra', 'öl']);
		expect(en).toEqual(['apfel', 'öl', 'zebra']);
	});

	it('orders the shelf\'s cards when the reader sorts them by title', () => {
		const titles = () => {
			const shelf = buildRoadmap(modelOf(vaultOfThree()), settings, () => true, 'horizons').shelf;
			return organizeShelf(shelf, 'title', new Set()).flatMap((g) => g.cards.map((c) => c.item.title));
		};
		const [sv, en] = inBothLocales(titles);

		expect(sv).toEqual(['Apfel', 'Zebra', 'Öl']);
		expect(en).toEqual(['Apfel', 'Öl', 'Zebra']);
	});

	it('orders the resource roster the assignee menu offers', () => {
		const roster = () => {
			const vault = new FakeVault();
			for (const name of ['Zebra', 'Öl', 'Apfel']) vault.addFile(`${name}.md`, { frontmatter: { type: 'Resource' } });
			return modelOf(vault).resources.map((r) => r.title);
		};
		const [sv, en] = inBothLocales(roster);

		expect(sv).toEqual(['Apfel', 'Zebra', 'Öl']);
		expect(en).toEqual(['Apfel', 'Öl', 'Zebra']);
	});
});

describe('and no rank, no result position and no planned write follows it', () => {
	it('leaves every rank and every Bases result position byte-identical', () => {
		const ranks = () =>
			JSON.stringify(modelOf(vaultOfThree()).results.map((i) => [i.file.path, i.order, i.entryIndex]));
		const [sv, en] = inBothLocales(ranks);

		expect(sv).toBe(en);
	});

	it('writes the state value the reader picked, never the position the locale sorted it into', () => {
		// The menu offers `Öl` second in English and third in Swedish. What a pick plans is
		// the value, so the two plans are one plan.
		const planned = () => {
			const model = modelOf(vaultOfThree());
			const item = model.results.find((i) => i.title === 'Apfel');
			if (!item) throw new Error('fixture incomplete');
			return JSON.stringify(computeStateWrites(item, 'Öl', settings, '2026-09-02').map((w) => ({ ...w, file: w.file.path })));
		};
		const [sv, en] = inBothLocales(planned);

		expect(sv).toBe(en);
		expect(JSON.parse(sv)[0].state).toBe('Öl');
	});

	it('plans the same rank for a drop wherever the collator would have put the siblings', () => {
		const planned = () => {
			const model = modelOf(vaultOfThree());
			const [dragged, ...peers] = model.results;
			// `peers` is the intent — where the user aimed — and `model.ranked` is the
			// population the number comes out of, which is the whole of ADR 0034. Both are
			// built the same way in either locale, so a collator that reached the ranking
			// would show up as a different order in one of them.
			return JSON.stringify(
				computeDropWrites(dragged, { parent: null, peers, insertIndex: peers.length }, model.ranked).map((w) => ({
					...w,
					file: w.file.path,
				})),
			);
		};
		const [sv, en] = inBothLocales(planned);

		expect(sv).toBe(en);
	});
});

describe('and the one document that does follow it, which is a decision rather than a leak', () => {
	it('writes the backlog README\'s state table in the reader\'s own alphabet', () => {
		const observed = () => modelOf(vaultOfThree()).observedStates;
		const [sv, en] = inBothLocales(() => backlogReadmeContent(settings, observed(), 'Backlog.base — Tree'));
		// The state table, addressed by its own heading rather than by the shape of a row:
		// the type table above it is three cells wide too.
		const statesOf = (doc: string) =>
			doc
				.split('## Workflow states')[1]
				.split('\n## ')[0]
				.split('\n')
				.filter((line) => line.startsWith('| `'))
				.map((row) => row.split('`')[1]);

		// `Done` is the value `stateMenuValues` appends so marking work done stays reachable;
		// it is not observed, so it is not collated with the three that are.
		expect(statesOf(sv)).toEqual(['Apfel', 'Zebra', 'Öl', 'Done']);
		expect(statesOf(en)).toEqual(['Apfel', 'Öl', 'Zebra', 'Done']);
	});
});
