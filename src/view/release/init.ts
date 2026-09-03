import { adoptCandidates, AdoptionCandidate, notePropertyId } from '../../domain/optionalProperties';
import {
	declaredPropertyKeys,
	releasedValuesOf,
	resolveReleaseSettings,
	SHARED_STATUS_OPTIONS,
} from '../../domain/releaseOptions';
import { DEFAULT_RELEASED_VALUES } from '../../domain/settings';
import { BasesViewConfig } from 'obsidian';
import type { ReleaseView } from './releaseView';

/**
 * The release view's own ✨, narrowed to what this view is allowed at all
 * (`docs/requirements/Creating a release from the release view.md`): **it binds, and it
 * touches no note.** An earlier draft also backfilled these keys onto every existing
 * release note, so Obsidian's picker could offer them straight away — ruled out because
 * backfilling is editing a note that already exists, which is exactly what Task 5's
 * narrowed write-boundary claim (`test/view/releaseNeverEdits.test.ts`) says this view
 * never does. The accepted cost is the one already taken for the membership key last
 * increment (`neverStubbed`, `domain/rankBackfill.ts`): the picker cannot offer `version`,
 * `targetDate`, `status` or `release` (membership) until a note carries them. What
 * supplies one is a value somebody STATED — the first `Set release`, or the first
 * **New release** whose version, date or status box was filled in. A blank box is written
 * nowhere (`createRelease`, `storage/createNote.ts`), for `neverStubbed`'s own reason read
 * from the other end: a blank the picker could offer is a value this view's own reader
 * reports as unreadable.
 *
 * The keys ABOVE and not every key `ReleaseSettings` reads, and the list is what "makes
 * every feature available" actually means here — a press that leaves a feature of this view
 * unconfigured is a press that reported success and did half the job.
 *
 * **Counted nowhere**, which is `initControl.ts`'s own decision one file over, taken there
 * after its count went stale twice in two days. This sentence read "SIX keys" above a
 * SEVEN-entry list until 2026-08-30 — `descriptionProperty` joined on 2026-08-29 and the
 * number did not follow. A count of the thing directly beneath it earns nothing a reader
 * cannot get by looking, and goes wrong the moment a row is added.
 *
 * `typeProperty`, `parentProperty` and `orderProperty` each ship a real `default:` in
 * `getReleaseViewOptions`, so Bases' own option resolution already supplies one without
 * this action binding anything — same for `releaseFolder`.
 *
 * `deliverableStateProperty` is deliberately NOT here, and its absence is the same
 * decision the backlog view's own table records at `PROPERTY_TABLE.deliverableState`: a
 * Deliverable with no key of its own reads the requirements workflow's through
 * `resolvedDeliverableStateKey`, which is sharing a property by the fallback this codebase
 * already trusts rather than by writing one key into two options.
 *
 * `stateProperty` and `releasedDateProperty` joined on 2026-08-29, and the first of the two
 * is why {@link SHARED_STATUS_OPTIONS} exists. Without a state key bound, `ReleaseRow.done`
 * is unconfigured for every release: no band shows progress, no scope row shows a rollup,
 * the hide-done toggle is withheld and the summary strip says so instead of measuring — the
 * whole progress half of this view, missing after a ✨ that said it had bound everything.
 * Without a released-date key, [[Marking a release as released]]'s own figure is
 * unconfigured the same way. `descriptionProperty` joined them the same day for the same
 * reason read once more ([[Editing a release from its own screen]]): with no key bound the
 * scope header draws no description line at all, so the field the reader was told they
 * could fill is on no screen.
 *
 * `releaseStatusValues` is NOT a candidate and could not be: it is a text option holding a
 * vocabulary rather than a property, and there is no key to hand out — what a vault calls
 * its own release statuses is its own to write, and `releaseStatusChoices` reads what the
 * releases already carry so the menu works with the box empty.
 *
 * `membershipProperty` DOES belong here, though `resolveReleaseSettings`'s own comment
 * ("a suggestion is not a binding") reads at first as forbidding exactly this. That
 * comment is about the RESOLVER's own silent read on every data update; this is an
 * explicit action the reader pressed, the same distinction `resolveReleaseSettings`
 * itself now states beside `membershipKey`. Leaving it out defeats the whole point of
 * pressing ✨: without a membership key bound, the release index can only ever show every
 * release with zero members, which is the one thing this view exists to report. Its
 * suggested key is `release` — read off `PROPERTY_TABLE`'s own `release` row in
 * `domain/optionalProperties.ts`, the BACKLOG view's own suggestion for the same concept
 * (its `releaseProperty` option), so a vault that presses ✨ in both views lands on one
 * property rather than two.
 *
 * The three readiness keys joined on 2026-09-01, for `stateProperty`'s own reason read once
 * more: without them every criterion on the scope screen reads as unconfigured and the whole
 * readiness half of this view is missing after a ✨ that said it had bound everything.
 * `effort` is `estimationOptions.ts`'s own suggestion for the same concept and `dependsOn`
 * and `risk` are `PROPERTY_TABLE`'s, so a vault pressing ✨ in two views lands on one
 * property rather than two.
 *
 * `criticalRiskValues` and `addressedRiskValues` are NOT candidates and could not be, for
 * `releaseStatusValues`' own reason: they are text options holding a vocabulary rather than
 * properties, and there is no key to hand out. A press therefore leaves the risk criterion
 * unconfigured, which the chip says in words rather than passing silently — the honest
 * outcome, and the one the collapse rule in `renderReadiness.ts` is shaped around.
 */
export const RELEASE_SUGGESTED_KEYS: AdoptionCandidate[] = [
	{ option: 'membershipProperty', suggested: 'release' },
	{ option: 'versionProperty', suggested: 'version' },
	{ option: 'targetDateProperty', suggested: 'target-date' },
	{ option: 'releaseStatusProperty', suggested: 'status' },
	{ option: 'stateProperty', suggested: 'status' },
	{ option: 'releasedDateProperty', suggested: 'released' },
	{ option: 'descriptionProperty', suggested: 'description' },
	{ option: 'estimateProperty', suggested: 'effort' },
	// `capacityUnit` is bound too, in {@link RELEASE_SUGGESTED_VALUES} beside the other text
	// options — not here, because it names no property. This key alone used to bind without
	// it, on the argument that there is no honest literal for a unit a team has not stated: a
	// guessed one labels somebody else's numbers until they notice and change it. The product
	// owner weighed that against a press that cannot finish enabling the feature it exists to
	// turn on, and decided a press that always finishes wins — so it defaults to `points`, the
	// option's own placeholder, same as every other bound-but-guessable text box here.
	{ option: 'capacityProperty', suggested: 'capacity' },
	{ option: 'dependsOnProperty', suggested: 'dependsOn' },
	{ option: 'riskProperty', suggested: 'risk' },
];

/** An option ✨ binds that names no property, and how to decide its value at bind time. */
export interface ValueCandidate {
	option: string;
	value: (config: BasesViewConfig) => string;
}

/**
 * The four the closing actions and the capacity comparison need and {@link
 * RELEASE_SUGGESTED_KEYS} cannot carry: a folder, a value list, a dropdown over that list
 * and a unit string. They reach none of `adoptCandidates`' machinery because they name no
 * property — there is no key for `taken` to guard and no collision to report. What they
 * share with the property candidates above is the ONE rule that applies to them, applied
 * in {@link runReleaseInit}: an option the reader has touched is never overwritten, and
 * cleared is not untouched.
 *
 * **`releaseNotesFolder` binds `docs/release-notes`**, which is the string
 * `releaseOptions.ts` also spells as that option's placeholder. Two literals, and nothing
 * checks they agree — the claim here is only that ✨ picks what the option already offers
 * to type, not that the two are coupled. Not derived from `defaultTypeFolder(RELEASE_TYPE)`
 * (`docs/releases`): the placeholder already says `docs/release-notes`, and a second answer
 * beside it is drift.
 *
 * **`releasedStatusValues` must NOT bind a placeholder**, and this is the trap. Its
 * placeholder is `t('release.option.releasedValuesHint')` — the string `Released,
 * Archived`, in the translation catalog. Binding it would make ✨ write the CATALOG's
 * language into the `.base`, so a reader on a German Obsidian binds German status words,
 * stamps them onto release notes, and hands over a vault whose releases an English
 * reader's view reports as not-released. Its answer is {@link DEFAULT_RELEASED_VALUES},
 * which is domain data for exactly that reason — but only where the reader has stated
 * nothing to seed from; see the invariant below.
 *
 * **The vocabulary and the transition must agree, whichever the reader set first.**
 * `releaseNoteProblems` refuses a transition that is not one of the released values, and
 * `closeOffer` withholds BOTH closing actions for the same mismatch, so two independent
 * answers here are two statements that must agree. The list is ORDERED and swept in order,
 * and each half reads the other: an unset transition takes the FIRST of whatever list the
 * config holds after the row above has run, and an unset vocabulary is seeded FROM a
 * non-empty transition the reader already set rather than from the default beside it.
 * Both directions, because only one of them held until 2026-08-30 — a view carrying
 * `releasedTransitionValue: Shipped` and no vocabulary was bound `Released`, and the press
 * reported success on a configuration that withheld the very actions it exists to enable
 * (found by review, Codex, PR #221).
 *
 * ONE seeded pair still cannot agree, and the guarantee is written no wider than that: a
 * transition holding a COMMA names no single value, since `list` splits the vocabulary on
 * exactly that character — so no list this press can write contains it. `releaseNoteProblems`
 * reports it and the reader repairs the box; a seed cannot. Padding IS repaired, and not
 * here — `resolveReleaseSettings` trims the transition, so what this reads is already the
 * value `closeOffer` will compare.
 *
 * **`capacityUnit` binds `points`, the option's own placeholder in `getReleaseViewOptions`.**
 * It has no reader value to prefer the way the transition prefers the vocabulary — there is
 * nothing else in the config that states a unit — so it takes the plain-constant shape
 * `releaseNotesFolder` does, and the one rule every candidate in this list already carries
 * ({@link wouldBindValue}) is what keeps it from overwriting a unit the reader typed: that
 * guard reads `config.get` before computing anything, so a touched box — set OR cleared —
 * is left alone regardless of which candidate it belongs to.
 */
export const RELEASE_SUGGESTED_VALUES: ValueCandidate[] = [
	{ option: 'releaseNotesFolder', value: () => 'docs/release-notes' },
	{
		option: 'releasedStatusValues',
		// The reader's own transition wins over the shipped default: a vocabulary that
		// omitted it is the one configuration this press can produce that withholds every
		// closing action. `resolveReleaseSettings` rather than `config.get`, so the value
		// compared here is read through the reader `closeOffer` itself will use.
		value: (config) =>
			resolveReleaseSettings(config).releasedTransition || DEFAULT_RELEASED_VALUES.join(', '),
	},
	{ option: 'releasedTransitionValue', value: (config) => releasedValuesOf(config)[0] ?? '' },
	{ option: 'capacityUnit', value: () => 'points' },
];

/**
 * Whether a press would actually bind {@link candidate} — untouched, and a non-empty
 * computed value — the same test {@link runReleaseInit}'s own sweep applies to decide
 * whether to write. Exported so `initControl.ts`'s `anythingToBind` asks the identical
 * question rather than a second copy of it: the property half of that offer already
 * reads `adoptableReleaseKeys` rather than restating `adoptCandidates`' rule, and a
 * value candidate reaching none of that machinery is not a reason to state its own rule
 * twice either.
 */
export function wouldBindValue(config: BasesViewConfig, candidate: ValueCandidate): boolean {
	return config.get(candidate.option) === undefined && candidate.value(config) !== '';
}

/**
 * Which of `candidates` a press would actually bind — the one question the ACTION and the
 * control's own offer (`initControl.ts`'s `anythingToBind`) both ask, so what the ✨
 * promises and what it does cannot come apart.
 *
 * **The seed is every key this view's own options already name**, read off the declaration
 * (`declaredPropertyKeys`), and that is the whole of what stops this action corrupting a
 * note. It seeded from the four candidates alone until 2026-08-25, on the argument that no
 * model mapping could collide "since none of their suggested keys is `release`, `version`,
 * `target-date` or `status`" — which reasons about what those options SUGGEST when the
 * collision is with what they RESOLVE TO. A mapping is a free choice: `typeProperty:
 * note.status` is legal, and with `releaseStatusProperty` untouched this action then bound
 * the status onto the very key the type lives in. `createRelease` writes the type first and
 * the status after it, both through `setOwn`, so the release came out carrying a status and
 * NO type — a note this view cannot recognise as a release at all, reported to the reader as
 * created. Found by review on PR #203 and driven end to end in `test/view/release/init.test.ts`.
 * A hand-written seed list is what that rule failed to keep three times, so the set is READ
 * OFF the option declaration and a tenth option is seeded by being declared.
 *
 * `ReleaseSettings` has no `configProblems` of its own, so this is not one guard of two here;
 * it is the only one.
 *
 * **{@link SHARED_STATUS_OPTIONS} is the one exemption**, and it is asked candidate by
 * candidate rather than by widening the shared set: those options may name one property, so
 * each of them is offered against a seed the OTHERS' keys are absent from, and two of them
 * adopting `status` in the same press is the intended outcome rather than a collision.
 * `adoptCandidates` mutates its `taken` as it goes, which is what a plain second sweep would
 * have used to refuse the second of the two — hence one call apiece.
 *
 * Every other candidate is one sweep, in declaration order, so a candidate still cannot take
 * a key an earlier one in the same press has claimed.
 */
export function adoptableReleaseKeys(config: BasesViewConfig, candidates: AdoptionCandidate[]): AdoptionCandidate[] {
	// A FRESH read of the live config, never `view.settings`: that field is a snapshot from
	// the last data update, so a key bound since then would read as free here and get offered
	// to a second option as well — `runEstimationInit`'s own documented trap for the identical
	// reason.
	const taken = new Set(declaredPropertyKeys(config).filter((key) => key !== ''));
	const shares = (candidate: AdoptionCandidate): boolean => SHARED_STATUS_OPTIONS.includes(candidate.option);
	// Sequenced rather than written as one array literal: `adoptCandidates` MUTATES `taken`,
	// so the seed below has to be built from what it claimed — a literal would have made that
	// depend on the evaluation order of its own elements.
	const adopted = adoptCandidates(config, candidates.filter((candidate) => !shares(candidate)), taken);
	// What blocks one of the exempt three: a key any OTHER option owns, plus whatever this
	// press has just claimed. Asked as "does a non-shared option hold it" and never as "is it
	// held by a shared one" — the second reads the same on the shipped defaults and is wrong
	// the moment BOTH kinds hold one key (found by review, PR #211: with
	// `versionProperty: note.status` and `stateProperty: note.status`, subtracting the shared
	// options' keys freed `status`, ✨ bound the release status onto it, and the collision
	// report that landed the same day then blocked every write in the view).
	const blocked = new Set([
		...declaredPropertyKeys(config, (option) => !SHARED_STATUS_OPTIONS.includes(option)).filter((key) => key !== ''),
		...adopted.map((candidate) => candidate.suggested),
	]);
	// One call per exempt candidate, each against its OWN copy: `adoptCandidates` adds a
	// suggestion to `taken` as it takes it, which is exactly how a shared sweep would refuse
	// the second of two options that are allowed to name one property.
	const status = candidates.filter(shares).flatMap((c) => adoptCandidates(config, [c], new Set(blocked)));
	return [...adopted, ...status];
}

/**
 * Bind the suggested key for every candidate above the reader has never touched, and
 * resolve `view.settings` fresh so the caller can immediately ask which fields are now
 * bound. Three callers reach it, all through `bindAndReport` in `newRelease.ts`: both
 * `New release` presses, and the standalone ✨ (`initControl.ts`) that draws no dialog of
 * its own and exists only to run this and say what it did. All three pass no `only`
 * today — it exists for a fourth kind of caller, a red note on the scope screen that
 * binds the ONE option its own sentence names, and every candidate otherwise.
 *
 * The return is whether anything was actually written, decided from the writes
 * themselves rather than from a before/after read of the config: `boundKeys` in
 * `newRelease.ts` exists because `declaredPropertyKeys` alone cannot see a bound
 * folder, and asking that same question here a second way would be two answers to it.
 *
 * `runEstimationInit` states an ORDER as a rule: decide the bindings, gate on the model
 * they would produce, and only then write — because a batch that changed the
 * configuration and then had every write refused would leave the view worse than it
 * found it. There is no such gate here: this action writes no note, so there is no batch
 * for a bad configuration to leave half-applied, and no model of its own to validate
 * against. What survives from that order is "decide before writing config" — `pending`
 * below is decided in full before the single loop that calls `config.set`.
 *
 * WHICH keys are free is {@link adoptableReleaseKeys}' question and not this function's,
 * so the guard and the offer behind the control cannot come apart; every collision this
 * action has shipped is recorded there.
 *
 * On the shipped defaults nothing changes for the three model mappings: they resolve to
 * `parent`, `order` and `type`, none of which any candidate suggests.
 */
export async function runReleaseInit(view: ReleaseView, only?: string[]): Promise<boolean> {
	// The filter narrows the CANDIDATE LIST, never the sweep, for the shape the sweep
	// requires: `adoptableReleaseKeys` mutates a `taken` set as it finds each candidate
	// free, so narrowing its OUTPUT instead would let a key this press is not binding
	// still reserve itself against one it is, the moment two candidates ever suggest the
	// same key outside `SHARED_STATUS_OPTIONS`'s own exemption. No pair in
	// `RELEASE_SUGGESTED_KEYS` does that today, so nothing in this suite can tell the two
	// orderings apart — this is the shape the sweep's own contract asks for, not a
	// difference this suite observes. `initControl.ts`'s own `fixes` narrowing makes the
	// identical choice for the offer, for the identical reason.
	const wanted = (option: string): boolean => only === undefined || only.includes(option);
	const keys = RELEASE_SUGGESTED_KEYS.filter((candidate) => wanted(candidate.option));
	const values = RELEASE_SUGGESTED_VALUES.filter((candidate) => wanted(candidate.option));

	const pending = new Map<string, string>();
	for (const { option, suggested } of adoptableReleaseKeys(view.config, keys)) {
		pending.set(option, notePropertyId(suggested));
	}
	for (const [option, value] of pending) view.config.set(option, value);
	let bound = pending.size > 0;
	// The second sweep, in order: each candidate reads the config as the one before it
	// left it, which is what lets the transition pick from a vocabulary this same press
	// may have just supplied. `wouldBindValue` is the one guard — an option the reader has
	// touched is never overwritten, and an empty computed value binds nothing (a
	// transition with no list to choose from is not a value, and writing `''` would
	// report as touched to the next press).
	for (const candidate of values) {
		if (wouldBindValue(view.config, candidate)) {
			view.config.set(candidate.option, candidate.value(view.config));
			bound = true;
		}
	}
	view.settings = resolveReleaseSettings(view.config);
	return bound;
}
