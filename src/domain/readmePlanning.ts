import { andList, code } from './readmeText';
import { hasDateAxis, hasHorizonAxis } from './roadmap';
import { placementEnds, schemaEnds } from './itemTypes';
import { MARKER_TYPES } from './typeVocabulary';
import { BacklogSettings } from './settings';

/**
 * What the generated README says about the **plan** — the horizon buckets, the two date
 * properties, which types those place and which they do not, and who writes any of it.
 *
 * Its own module rather than a fourth section inside `backlogReadme.ts` because that file
 * reached its 400-line cap and this is the seam with one subject: every other section
 * there describes the note's own shape — its type, its rank, its state, where it is filed
 * — and this one describes a projection's reading of it. The split is what the cap is for.
 *
 * Everything here is derived from the SETTINGS and from the placement rules, never from a
 * spelled list of types: the document is written into the user's vault and read as a
 * contract, so a sentence that named `MARKER_TYPES` where it meant "the markers this view
 * places" published a falsehood the day a third marker was declared.
 */

/**
 * Who writes the planning keys, named only where each can fire — the menu offers per
 * axis, so a horizon-only view has no Schedule and a dated one no Set horizon. Three are
 * not edits to an existing placement at all: **New** inside a bucket writes the horizon
 * into the note it creates, **Set iteration** copies the iteration's own dates onto the
 * note in the same write that joins it (only where an iteration property AND a date axis
 * are both configured — `computeIterationWrites` plans no date otherwise), and the
 * backfill leaves the keys empty without placing anything — the two ways a date appears
 * that a reader cannot trace to a placement.
 */
function planningWriters(settings: BacklogSettings): string {
	const actions = [
		...(hasHorizonAxis(settings) ? ['Set horizon and Clear horizon'] : []),
		...(hasDateAxis(settings) ? ['Schedule and Unschedule'] : []),
	];
	const horizons = hasHorizonAxis(settings);
	const joinsDates = settings.iterationKey !== '' && hasDateAxis(settings);
	const writers = [
		`the view's own placement ${actions.length > 1 ? 'actions' : 'action'} — ${actions.join(', ')}, ` +
			'each writing or removing exactly the keys named here' +
			(horizons ? ', and the drag that does the same thing: a card moved into a bucket or onto the shelf' : ''),
		...(horizons
			? ['**New** inside a horizon on the roadmap, which writes that horizon into the note it creates, in the same write that creates it']
			: []),
		...(joinsDates
			? ["**Set iteration**, which copies the iteration's own dates onto the note in the same write that joins it"]
			: []),
		`**Assign missing properties**, which adds the keys *empty* to items that lack them and places nothing${assignException(settings)}`,
	];
	return `${writers.slice(0, -1).join('; ')}; and ${writers[writers.length - 1]}`;
}

/**
 * The backfill's one exception to "empty on every note that lacks it".
 *
 * Asked of `schemaEnds`, never of `placementEnds` with the live flag: this is a question
 * about which keys a note of that type CARRIES, and a display option must not decide
 * whether a property exists. `Iteration` is a span and keeps both ends whatever
 * `iterationBars` says, so it is not excepted; `Milestone` is the one type the schema
 * narrows today, and deriving the list means the sentence follows the rule rather than a
 * name somebody typed.
 *
 * Gated on `startKey`, the withheld key: with none configured ✨ never stubs a start on
 * anything, marker or not, so there is nothing here to except.
 */
function assignException(settings: BacklogSettings): string {
	if (!settings.startKey) return '';
	const narrowed = MARKER_TYPES.filter((type) => {
		const ends = schemaEnds(type);
		return ends.length > 0 && !ends.includes('start');
	});
	if (narrowed.length === 0) return '';
	return ` — except that a ${andList(narrowed.map(code))} never gets a start added: it is a point by type and reads only a target`;
}

export function planningSection(settings: BacklogSettings): string[] {
	const lines: string[] = [];
	if (hasHorizonAxis(settings)) {
		lines.push(
			`${code(settings.horizonKey)} places an item in a planning horizon: ` +
				`${settings.horizonValues.map(code).join(', ')}. A value outside that list is not ` +
				'lost and not guessed at — it gets a horizon of its own, after the declared ones, ' +
				'the same way a state nobody declared still gets a column. What is set aside is an ' +
				'item with no value at all, or one written in a way the reader cannot make a ' +
				'horizon of.',
		);
	}
	// Either key alone is a configured axis — a milestone-only roadmap is coherent, and
	// `configuredAxes` says so — and a view with one would otherwise get no section at all.
	const dateKeys = [settings.startKey, settings.targetKey].filter(Boolean);
	if (dateKeys.length === 2) {
		lines.push(
			`${code(settings.startKey)} and ${code(settings.targetKey)} are the planned dates, ` +
				`written ${code('YYYY-MM-DD')}. An item stating only one of the two is drawn as a point ` +
				'on that date; a target earlier than its start is set aside rather than drawn backwards.',
		);
	} else if (dateKeys.length === 1) {
		lines.push(
			`${code(dateKeys[0])} is the planned date, written ${code('YYYY-MM-DD')}. It is the only ` +
				'date property configured here, so every item that states one is drawn as a ' +
				'point in time rather than as a span.',
		);
	}
	// Both sentences above describe a point reached by how many dates an item STATES, and a
	// marker is a point by TYPE — so they are wrong for one wherever the target key is not
	// the one configured. A `Milestone` handed the start property states a date this view
	// will never place it by, and the entry that would correct that is withheld for the same
	// reason, so the document would be promising a placement the projection contradicts.
	// Say which key a marker actually reads, in the one voice this file has.
	//
	// Named from the PLACEMENT rule and never from `MARKER_TYPES`, because the two are not
	// the same set and this file is written into the user's vault. Both sentences below say
	// a marker's date is the **target** property, which is `placementEnds` answering
	// `['target']` — true of a `Milestone` always, of an `Iteration` only while
	// `iterationBars` is off, and of a `Release` never, since it speaks no end at all. The
	// classification was what was listed here, so declaring a third marker published two
	// false sentences to every reader at once.
	const points = MARKER_TYPES.filter((type) => {
		const ends = placementEnds(type, settings.iterationBars);
		return ends.length === 1 && ends[0] === 'target';
	});
	if (dateKeys.length > 0 && settings.targetKey === '') {
		lines.push(
			`A **marker** (${andList(points.map(code))}) is the exception, and this view cannot ` +
				`place one: a marker's date is the **target** property, and the only date property ` +
				`here is ${code(settings.startKey)}. One waits, unplaced, until a target property is ` +
				'picked — and Schedule is withheld from it rather than opened onto a date its own type ' +
				'ignores.',
		);
	} else if (dateKeys.length === 2) {
		lines.push(
			`A **marker** (${andList(points.map(code))}) is the exception: it is a point by ` +
				`**type** rather than by how many dates it states, so it reads ${code(settings.targetKey)} ` +
				`alone. A ${code(settings.startKey)} on one is ignored — never rewritten, and never removed.`,
		);
	}
	// The other half of the same derivation, and it is the half that had to be SAID rather
	// than merely stopped being wrong. Dropping a type out of the marker sentence above
	// removed a falsehood; it left the generic prose at the top of this section telling a
	// reader that the horizon places "an item" and that every item stating the date is
	// drawn. Someone following that for a type this very document lists gets no card, no
	// chip and no menu entry, with nothing explaining it.
	//
	// A type that speaks NO placement end is on neither axis: `placementEnds` answering
	// nothing is what withholds Schedule (`canSchedule`), and the same types are the ones
	// `computeHorizonWrites` refuses — which is why the sentence can refuse both at once,
	// and why the list is derived rather than spelled. It says what IS, and promises no
	// date property to come: where a release does get a position is a decision this
	// increment has not taken, and a README that hinted at one would be documenting it.
	//
	// WHICH axes it names is built from the same two predicates every sentence above is,
	// and that is not tidiness: fixed text saying "these dates or a horizon" points at
	// dates a horizon-only base does not configure, and names a horizon a dated base has
	// no axis for — prose asserting something the configuration does not support, which is
	// the defect this whole paragraph was added to fix, reintroduced one size smaller.
	// `axes` is non-empty exactly when `lines` is: both are `hasHorizonAxis` or a date key.
	const unplaced = MARKER_TYPES.filter((type) => placementEnds(type, settings.iterationBars).length === 0);
	const axes = [...(dateKeys.length > 0 ? ['these dates'] : []), ...(hasHorizonAxis(settings) ? ['a horizon'] : [])];
	if (lines.length > 0 && unplaced.length > 0) {
		lines.push(
			`${andList(unplaced.map(code))} ${unplaced.length > 1 ? 'are' : 'is'} outside all of that: a ` +
				`note of that type is not placed by ${axes.join(' or ')}, so it draws no card on the ` +
				`roadmap and is offered no control that would give it one. That is what the **type** ` +
				`means, not a property left unset — there is nothing to fill in.`,
		);
	}
	if (lines.length > 0) {
		lines.push(
			`These are a **plan**, and the only things that write them are you, ${planningWriters(settings)}. ` +
				'Nothing writes them as a side effect of a move in the **hierarchy**, a state change ' +
				'or a rename.',
		);
	}
	return lines.length > 0 ? ['## Planning', '', ...lines.flatMap((l) => [l, ''])].slice(0, -1) : [];
}
