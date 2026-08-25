import { adoptCandidates, AdoptionCandidate, notePropertyId } from '../../domain/optionalProperties';
import { resolveReleaseSettings } from '../../domain/releaseOptions';
import type { ReleaseView } from './releaseView';

/**
 * The release view's own ✨, narrowed to what this view is allowed at all
 * (`docs/requirements/Creating a release from the release view.md`): **it binds, and it
 * touches no note.** An earlier draft also backfilled these keys onto every existing
 * release note, so Obsidian's picker could offer them straight away — ruled out because
 * backfilling is editing a note that already exists, which is exactly what Task 5's
 * narrowed write-boundary claim (`test/view/releaseNeverEdits.test.ts`) says this view
 * never does. The accepted cost is the one already taken for the membership key last
 * increment (`neverStubbed`, `domain/writePlan.ts`): the picker cannot offer `version`,
 * `targetDate`, `status` or `release` (membership) until a note carries them. What
 * supplies one is a value somebody STATED — the first `Set release`, or the first
 * **New release** whose version, date or status box was filled in. A blank box is written
 * nowhere (`createRelease`, `storage/createNote.ts`), for `neverStubbed`'s own reason read
 * from the other end: a blank the picker could offer is a value this view's own reader
 * reports as unreadable.
 *
 * Four keys, not the full eight `ReleaseSettings` reads. `typeProperty`, `parentProperty`
 * and `orderProperty` each ship a real `default:` in `getReleaseViewOptions`, so Bases'
 * own option resolution already supplies one without this action binding anything — same
 * for `releaseFolder`.
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
 */
const RELEASE_SUGGESTED_KEYS: AdoptionCandidate[] = [
	{ option: 'membershipProperty', suggested: 'release' },
	{ option: 'versionProperty', suggested: 'version' },
	{ option: 'targetDateProperty', suggested: 'target-date' },
	{ option: 'releaseStatusProperty', suggested: 'status' },
];

/**
 * Bind the suggested key for every one of the four above the reader has never touched,
 * and resolve `view.settings` fresh so the caller — `newRelease` in `newRelease.ts`, the
 * one function behind both `New release` presses — can immediately ask which fields are
 * now bound. That press is the whole of what reaches it: this view draws no ✨ button of
 * its own, so the action above is a step of creating a release rather than a control.
 *
 * `runEstimationInit` states an ORDER as a rule: decide the bindings, gate on the model
 * they would produce, and only then write — because a batch that changed the
 * configuration and then had every write refused would leave the view worse than it
 * found it. There is no such gate here: this action writes no note, so there is no batch
 * for a bad configuration to leave half-applied, and no model of its own to validate
 * against. What survives from that order is "decide before writing config" — `pending`
 * below is decided in full before the single loop that calls `config.set`.
 *
 * `taken` seeds from a FRESH resolve of the live config, not from `view.settings`: that
 * field is a snapshot from the last data update, so a key bound since then would read as
 * free here and get offered to a second option as well — `runEstimationInit`'s own
 * documented trap for the identical reason.
 *
 * It seeds from **all seven** of this view's keys, the three model mappings included, and
 * that is the whole of what stops this action corrupting a note. It seeded from the four
 * candidates alone until 2026-08-25, on the argument that no model mapping could collide
 * "since none of their suggested keys is `release`, `version`, `target-date` or `status`"
 * — which reasons about what those options SUGGEST when the collision is with what they
 * RESOLVE TO. A mapping is a free choice: `typeProperty: note.status` is legal, and with
 * `releaseStatusProperty` untouched this action then bound the status onto the very key
 * the type lives in. `createRelease` writes the type first and the status after it, both
 * through `setOwn`, so the release came out carrying a status and NO type — a note this
 * view cannot recognise as a release at all, reported to the reader as created. Found by
 * review on PR #203 and driven end to end in the test named for it below.
 *
 * Both siblings already seed this way and neither is a precedent that was missed so much
 * as one this file talked itself out of: `adoptableProperties` seeds from
 * `ownedProperties`, which carries parent, order and type, and `runEstimationInit` says in
 * its own comment that "binding a suggested key onto the property this view reads a type
 * from is exactly the collision it now refuses". The estimation view has a second line
 * behind that — it validates the settings its pending bindings WOULD produce and refuses
 * — and this view has none, since `ReleaseSettings` has no `configProblems` of its own. So
 * the seeding is not one guard of two here; it is the only one.
 *
 * On the shipped defaults nothing changes: the mappings resolve to `parent`, `order` and
 * `type`, none of which any candidate suggests.
 */
export async function runReleaseInit(view: ReleaseView): Promise<void> {
	const fresh = resolveReleaseSettings(view.config);
	const taken = new Set(
		[
			fresh.parentKey,
			fresh.orderKey,
			fresh.typeKey,
			fresh.membershipKey,
			fresh.versionKey,
			fresh.targetDateKey,
			fresh.statusKey,
		].filter((key) => key !== ''),
	);
	const pending = new Map<string, string>();
	for (const { option, suggested } of adoptCandidates(view.config, RELEASE_SUGGESTED_KEYS, taken)) {
		pending.set(option, notePropertyId(suggested));
	}
	for (const [option, value] of pending) view.config.set(option, value);
	view.settings = resolveReleaseSettings(view.config);
}
