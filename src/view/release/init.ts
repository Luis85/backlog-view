import { adoptCandidates, AdoptionCandidate, notePropertyId } from '../../domain/optionalProperties';
import { resolveReleaseSettings } from '../../domain/releaseOptions';
import type { ReleaseView } from './releaseView';

/**
 * The release view's own ✨, narrowed to what this view is allowed at all
 * (`docs/requirements/Creating a release from the release view.md`): **it binds, and it
 * touches no note.** An earlier draft also backfilled these three keys onto every
 * existing release note, so Obsidian's picker could offer them straight away — ruled out
 * because backfilling is editing a note that already exists, which is exactly what Task
 * 5's narrowed write-boundary claim (`test/view/releaseNeverEdits.test.ts`) says this view
 * never does. The accepted cost is the one already taken for the membership key last
 * increment (`neverStubbed`, `domain/writePlan.ts`): the picker cannot offer `version`,
 * `targetDate` or `status` until a release note carries them, which the first **New
 * release** supplies.
 *
 * Three keys, not the full eight `ReleaseSettings` reads. `typeProperty`, `parentProperty`
 * and `orderProperty` each ship a real `default:` in `getReleaseViewOptions`, so Bases'
 * own option resolution already supplies one without this action binding anything — same
 * for `releaseFolder`. `membershipProperty` is left alone on purpose: it names a property
 * on WORK ITEMS, not on the release note this action's own guarantee is about, and
 * `resolveReleaseSettings`'s own comment is explicit that a suggestion is not a binding
 * for it ("a membership key nobody bound must read as unconfigured").
 */
const RELEASE_SUGGESTED_KEYS: AdoptionCandidate[] = [
	{ option: 'versionProperty', suggested: 'version' },
	{ option: 'targetDateProperty', suggested: 'target-date' },
	{ option: 'releaseStatusProperty', suggested: 'status' },
];

/**
 * Bind the suggested key for every one of the three above the reader has never touched,
 * and resolve `view.settings` fresh so the caller — the ✨ control and the dialog alike,
 * `runEstimationInit`'s own "two entry points, one function" shape — can immediately ask
 * which fields are now bound.
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
 * documented trap for the identical reason. Seeding it with the three keys THIS action
 * could bind (rather than the wider `parentKey`/`orderKey`/`typeKey`, which no candidate
 * here can collide with, since none of their suggested keys is `version`, `target-date`
 * or `status`) is what stops an explicitly-configured `versionProperty` of `note.status`
 * from being handed a second name when `releaseStatusProperty` is still unset.
 */
export async function runReleaseInit(view: ReleaseView): Promise<void> {
	const fresh = resolveReleaseSettings(view.config);
	const taken = new Set([fresh.versionKey, fresh.targetDateKey, fresh.statusKey].filter((key) => key !== ''));
	const pending = new Map<string, string>();
	for (const { option, suggested } of adoptCandidates(view.config, RELEASE_SUGGESTED_KEYS, taken)) {
		pending.set(option, notePropertyId(suggested));
	}
	for (const [option, value] of pending) view.config.set(option, value);
	view.settings = resolveReleaseSettings(view.config);
}
