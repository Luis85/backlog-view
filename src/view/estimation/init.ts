import { BasesViewConfig, Notice } from 'obsidian';
import { SUGGESTED_KEYS } from '../../domain/defaultModel';
import { resolveEstimationSettings } from '../../domain/estimationSettings';
import { notePropertyId } from '../../domain/optionalProperties';
import { boundKeys, modelProblems } from '../../domain/scoringModel';
import { t } from '../../i18n/t';
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
 * The model the bindings below WOULD produce, resolved without setting any of them: the
 * gate has to run before the configuration is touched, and `resolveEstimationSettings`
 * reads a config rather than a plain record. Only the two readers it uses are answered —
 * `configReaders` asks `get` and `getAsPropertyId` and nothing else — and a pending value
 * is already a property id, which is what both of them would return for a bound option.
 */
function withPending(config: BasesViewConfig, pending: Map<string, string>): BasesViewConfig {
	return {
		get: (key: string) => pending.get(key) ?? config.get(key),
		getAsPropertyId: (key: string) => pending.get(key) ?? config.getAsPropertyId(key),
	} as never;
}

/**
 * The button's whole action, and the ORDER is the rule rather than the implementation:
 * decide the bindings, gate on the model they would produce, and only then write them.
 * Binding can leave the model invalid on its own terms — a cleared value property beside
 * a freshly-bound stamp fails the pair check — and an action that changed the
 * configuration and then had every write refused leaves the view worse than it found it,
 * which is the root `CLAUDE.md`'s rule for `runInit`. Running the loop first inverted it:
 * twelve properties bound, nothing stubbed, and the guided empty state replaced by a
 * config warning about a state the button itself had just created.
 */
export async function runEstimationInit(view: EstimationView): Promise<void> {
	// Keys already spoken for come from the RESOLVED settings (which keys are taken);
	// which options were ever touched is asked of the config — adoptableProperties' own
	// split (`domain/optionalProperties.ts`), over this view's own key list rather than
	// the backlog's. `config.get(option) !== undefined` is deliberate, not `settings`:
	// cleared and never-set resolve to the same '' key, and only never-set may adopt a
	// suggestion — turning a property off is a decision this action must not overrule.
	const taken = new Set(boundKeys(view.settings.model));
	const pending = new Map<string, string>();
	for (const { option, suggested } of SUGGESTED_KEYS) {
		if (view.config.get(option) !== undefined || taken.has(suggested)) continue;
		taken.add(suggested);
		pending.set(option, notePropertyId(suggested));
	}
	const model = resolveEstimationSettings(withPending(view.config, pending)).model;
	const problems = modelProblems(model);
	// Said rather than left silent: the guided empty state is still what is on screen, so
	// with nothing bound and nothing written there would be no surface reporting anything
	// and the button would simply look dead.
	if (problems.length > 0) return void new Notice(t('estimation.problems.blocked', { problem: problems[0] }));
	for (const [option, value] of pending) view.config.set(option, value);
	view.refresh(); // the just-bound model is what the table renders from
	const keys = boundKeys(model);
	const writes = (view.data?.data ?? [])
		.filter((e) => e.file?.extension === 'md')
		.map((e) => ({ file: e.file, sets: keys.map((key) => ({ key, value: '', ifMissing: true })) }));
	await view.applySafely(writes);
}
