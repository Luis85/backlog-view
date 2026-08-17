import { SUGGESTED_KEYS } from '../../domain/defaultModel';
import { notePropertyId } from '../../domain/optionalProperties';
import { boundKeys, modelProblems } from '../../domain/scoringModel';
import type { EstimationView } from './estimationView';

/**
 * The estimation view's own ✨: bind every suggested key nobody has touched, then stub
 * the bound keys onto every result — the backlog's `runInit` shape
 * (`interactions/structure.ts`), narrowed to THIS view's own table (`SUGGESTED_KEYS`)
 * and its own gate (`EstimationView.applySafely`) rather than reused directly: that
 * function reaches `BacklogViewHost` and `computeInitWrites`, neither of which knows
 * this model exists. The two halves are one action for the same reason as there: a key
 * nothing names cannot be created on a note, and a property no note carries cannot be
 * bound by Bases' own picker.
 *
 * `boundKeys` itself lives in `domain/scoringModel.ts`, not here: `estimationItems.ts`
 * already computed the identical list under its own name (`ownKeys`'s presence test), and
 * a second copy over the same pure `ScoringModel` shape was a clone `npm run analyze`
 * caught the day it was written — the fix is the shared function, not a suppression.
 *
 * `import type` only against `EstimationView`, `renderTable.ts`'s own shape —
 * `estimationView.ts` calls `runEstimationInit`, so a value import back here would be
 * the two-file cycle `src/view/CLAUDE.md` keeps `host.ts` free of runtime code to avoid.
 */

/**
 * The button's whole action. Gated on the model's own problems exactly where `runInit`
 * gates them (the root `CLAUDE.md`'s rule): binding can leave the model invalid on its
 * own terms — a cleared value property beside a freshly-bound stamp fails the pair
 * check — and an invalid model must never be stubbed onto notes; the config warning is
 * already the surface reporting it.
 */
export async function runEstimationInit(view: EstimationView): Promise<void> {
	// Keys already spoken for come from the RESOLVED settings (which keys are taken);
	// which options were ever touched is asked of the config — adoptableProperties' own
	// split (`domain/optionalProperties.ts`), over this view's own key list rather than
	// the backlog's. `config.get(option) !== undefined` is deliberate, not `settings`:
	// cleared and never-set resolve to the same '' key, and only never-set may adopt a
	// suggestion — turning a property off is a decision this action must not overrule.
	const taken = new Set(boundKeys(view.settings.model));
	for (const { option, suggested } of SUGGESTED_KEYS) {
		if (view.config.get(option) !== undefined || taken.has(suggested)) continue;
		taken.add(suggested);
		view.config.set(option, notePropertyId(suggested));
	}
	view.refresh(); // resolve the just-bound model before planning the stubs
	if (modelProblems(view.settings.model).length > 0) return; // the warning surface is on screen
	const keys = boundKeys(view.settings.model);
	const writes = (view.data?.data ?? [])
		.filter((e) => e.file?.extension === 'md')
		.map((e) => ({ file: e.file, sets: keys.map((key) => ({ key, value: '', ifMissing: true })) }));
	await view.applySafely(writes);
}
