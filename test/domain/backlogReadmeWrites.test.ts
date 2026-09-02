import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { backlogReadmeContent } from '../../src/domain/backlogReadme';

/**
 * What the generated README says WRITES a note — the placement actions, the backfill, the
 * stamps a state change leaves — split from `backlogReadme.test.ts` when that file reached
 * the suite's line cap.
 *
 * The split is by what the document is DESCRIBING, not by line count. Everything left in
 * that file asks what the README says the backlog IS: the type ladder, which property
 * carries what, the state vocabulary, how a value is escaped into a table, and what enrols
 * a note at all. Everything here asks what it says CHANGES one, which is the half that
 * goes wrong differently — a sentence naming an action this view does not offer, or
 * omitting one it does, sends an outside editor to write a key by hand that the view was
 * going to write for them.
 */

/** Which view generated the document — the identity its marker carries. */
const SOURCE = 'work/Product Backlog.base › Backlog';
const readme = (settings: BacklogSettings, observed: string[] = []): string =>
	backlogReadmeContent(settings, observed, SOURCE);

describe('what backlogReadmeContent says writes a note', () => {
	it('does not call the planning properties read-only, because the row menu writes them', () => {
		const content = readme(settingsWith({ startKey: 'start', targetKey: 'due' }), []);
		expect(content).toContain('Schedule and Unschedule');
		expect(content).not.toContain('writes neither');
	});

	it('names only the placement actions this view offers', () => {
		// The row menu gates the two groups on the two axis predicates, so a document that
		// listed both would send a dated view looking for a Set horizon it does not have.
		const dated = readme(settingsWith({ startKey: 'start', targetKey: 'due', horizonKey: '' }), []);
		expect(dated).toContain('placement action — Schedule and Unschedule');
		expect(dated).not.toContain('Set horizon');
		const horizons = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: '', targetKey: '' }));
		expect(horizons).toContain('placement action — Set horizon and Clear horizon');
		expect(horizons).not.toContain('Unschedule');
		const both = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: 'start', targetKey: 'due' }));
		expect(both).toContain('placement actions — Set horizon and Clear horizon, Schedule and Unschedule');
	});

	it('names the roadmap drag among the things that write a horizon', () => {
		// performHorizonMove applies computeHorizonWrites, so a card dropped into a bucket
		// writes the key — and "nothing writes them as a side effect of a move" was read as
		// covering the roadmap's primary interaction.
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }));
		expect(content).toContain('a card moved into a bucket or onto the shelf');
		expect(content).toContain('a move in the **hierarchy**');
	});

	it('names a stamp key nothing can stamp, because the backfill still creates it', () => {
		// startedStates empty is the default: missingKeyStubs stubs every configured key, so
		// omitting the row left the view creating one the document never mentions.
		const inert = readme(settingsWith({ stateKey: 'status', startedDateKey: 'started', startedStates: [] }));
		expect(inert).toContain('| `started` | Yours to fill |');
		expect(inert).toContain('which nothing in this view stamps');
		// And with no state property at all, the finish is in the same position.
		const noState = readme(settingsWith({ stateKey: '', finishedDateKey: 'finished' }));
		expect(noState).toContain('| `finished` | Yours to fill |');
	});

	it('names the backfill among the things that write a stamp key', () => {
		// missingKeyStubs covers the stamp fields too: the keys appear empty, with no state
		// transition anywhere, and the rule said a state change is what writes them.
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Done'], startedStates: ['Todo'], startedDateKey: 'started' }),
		);
		expect(content).toContain('the one way one appears without a state change');
	});

	it('names the backfill among the things that write a planning key', () => {
		// computeInitWrites adds the axis keys EMPTY to items that lack them, so a claim
		// that only the user and the placement actions write them leaves a reader unable to
		// explain a key the view created.
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'] }));
		expect(content).toContain('**Assign missing properties**');
		const line = content.split('\n').find((l) => l.includes('**Assign missing properties**'));
		expect(line).toContain('adds the keys *empty* to items that lack them and places nothing');
		// A horizon-only view has no target property at all, so there is nothing the
		// backfill withholds from a Milestone here — the START narrowing is what is absent.
		expect(line).not.toContain('never gets a start added');
	});

	it('names Milestone, not the marker category, in the backfill exception, whichever date key is configured', () => {
		// schemaEnds narrows a Milestone alone: an Iteration is a span and keeps both ends
		// whatever iterationBars says, so spelling the marker CATEGORY here would tell the
		// reader an Iteration loses its start too, which the backfill does not do. Gated on
		// startKey, the withheld key — present whether or not targetKey also is.
		const exceptionLine = (over: Partial<BacklogSettings>) =>
			readme(settingsWith(over)).split('\n').find((l) => l.includes('**Assign missing properties**'));
		const both = exceptionLine({ startKey: 'start', targetKey: 'due' });
		expect(both).toContain('except that a `Milestone` never gets a start added');
		expect(both).not.toContain('Iteration');
		expect(exceptionLine({ startKey: 'start', targetKey: '' })).toContain('never gets a start added');
	});

	it('does not narrow the backfill when no start property is configured', () => {
		// With no startKey, ✨ never stubs a start on anything, marker or not — there is
		// nothing the type withholds here, so the START narrowing is absent. Covers both a
		// target-only view and (above) a horizon-only one with neither date key. The
		// RELEASE refusal beside it is not gated on a date key — `readmePlanning.test.ts`.
		const targetOnly = settingsWith({ startKey: '', targetKey: 'due' });
		const line = readme(targetOnly).split('\n').find((l) => l.includes('**Assign missing properties**'));
		expect(line).not.toContain('never gets a start added');
	});

	it('names Set iteration among the things that write a planning key, when it can copy dates', () => {
		// computeIterationWrites rides the iteration's own start/target onto the item in the
		// same write that joins it — a second write path, beside the backfill, that leaves
		// the keys holding a date the reader cannot trace to Schedule, Set horizon or a drag.
		const content = readme(settingsWith({ startKey: 'start', targetKey: 'due', iterationKey: 'sprint' }));
		expect(content).toContain('**Set iteration**');
		expect(content).toContain("copies the iteration's own dates");
	});

	it('does not name Set iteration when no date axis is configured', () => {
		// With neither start nor target key, `timeframeOf` has no ends to state, so joining
		// an iteration still writes the link and never a date — nothing here fires.
		const content = readme(
			settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: '', targetKey: '', iterationKey: 'sprint' }),
		);
		expect(content).not.toContain('Set iteration');
	});

	it('does not name Set iteration when no iteration property is configured', () => {
		// `computeIterationWrites` returns `[]` outright when `settings.iterationKey` is
		// unset, whatever the date axis looks like — listing the entry here would send a
		// reader looking for a menu action this view never offers.
		const content = readme(settingsWith({ startKey: 'start', targetKey: 'due', iterationKey: '' }));
		expect(content).not.toContain('Set iteration');
	});

	it('names creating in a bucket among the things that write a horizon', () => {
		// The roadmap's buckets carry a New button, and `createBacklogItem` puts the
		// bucket's value in the frontmatter it writes — a planning key on a note nobody
		// ever placed, which a list of writers made only of the placement actions and the
		// backfill leaves a reader unable to explain.
		const content = readme(settingsWith({ horizonKey: 'horizon', horizonValues: ['Now'], startKey: '', targetKey: '' }));
		expect(content).toContain('**New** inside a horizon on the roadmap');
		expect(content).toContain('in the same write that creates it');
	});

	it('does not claim creation writes a date, in a view with no horizons', () => {
		// Only a bucket creates in place: the dated axis is read-only, and nothing puts a
		// planned date on a note the view creates.
		const dated = readme(settingsWith({ horizonKey: '', startKey: 'start', targetKey: 'due' }));
		expect(dated).toContain('Schedule and Unschedule');
		expect(dated).not.toContain('**New** inside a horizon');
	});

	it('says the stamps follow what the view was asked to do, not the property', () => {
		// computeStateWrites runs from the view's own state interactions: editing the
		// frontmatter elsewhere stamps nothing, and a reader promised history would wait
		// for dates that never arrive.
		const content = readme(
			settingsWith({ stateKey: 'status', states: ['Todo', 'Doing', 'Done'], startedStates: ['Doing'], startedDateKey: 'started', finishedDateKey: 'finished' }),
		);
		expect(content).toContain('changed **in the view**');
		expect(content).toContain('Editing the state property directly, here or in any other editor, stamps nothing');
	});

	it('names the dates a state change stamps, and says a state change is what writes them', () => {
		// The view writes these two itself, so a contract that omitted them would leave an
		// outside editor two unexplained keys and would make its own "only the properties
		// above are written" rule false.
		const stamping = readme(
			settingsWith({
				stateKey: 'status',
				states: ['Todo', 'Active', 'Done'],
				startedStates: ['Active'],
				startedDateKey: 'started',
				finishedDateKey: 'finished',
			}),
			[],
		);
		expect(stamping).toContain('| `started` | Stamped by the view |');
		expect(stamping).toContain('| `finished` | Stamped by the view |');
		expect(stamping).toContain('written for you, by a state change');
		expect(stamping).toContain('only into an empty property');
		expect(stamping).toContain('leaving one removes it again');
		// And WHICH states start the clock. Done values are named in the table; started
		// ones are named nowhere else, so writing `Active` would put a date on a note for
		// reasons the document never gave.
		expect(stamping).toContain('Work counts as **started** at `Active`');
	});

	it('names a started state the workflow does not offer', () => {
		// The stamp matches the configured list, not the table — the same asymmetry the
		// done values have, and the same silence if it goes unsaid.
		const content = readme(
			settingsWith({
				stateKey: 'status',
				states: ['Todo', 'Done'],
				startedStates: ['Doing'],
				startedDateKey: 'started',
			}),
			[],
		);
		expect(content).toContain('Work counts as **started** at `Doing`');
		expect(content).toContain('is not offered as a state here, and still counts');
	});

	it('does not claim a state change writes a stamp key nothing can stamp', () => {
		// The key is still NAMED — the backfill creates it — but the rule that says a state
		// change writes it must not fire for a stamp no state can reach.
		const noStartedStates = readme(
			settingsWith({ stateKey: 'status', startedStates: [], startedDateKey: 'started', finishedDateKey: 'finished' }),
			[],
		);
		expect(noStartedStates).toContain('| `started` | Yours to fill |');
		expect(noStartedStates).toContain('| `finished` | Stamped by the view |');
		expect(noStartedStates).not.toContain('only into an empty property');

		const noState = readme(
			settingsWith({ stateKey: '', startedStates: ['Active'], startedDateKey: 'started', finishedDateKey: 'finished' }),
			[],
		);
		expect(noState).toContain('| `started` | Yours to fill |');
		expect(noState).toContain('| `finished` | Yours to fill |');
		expect(noState).not.toContain('written for you, by a state change');
	});

});
