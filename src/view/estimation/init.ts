import { BasesViewConfig, Notice } from 'obsidian';
import { SUGGESTED_KEYS } from '../../domain/defaultModel';
import { buildEstimationModel } from '../../domain/estimationItems';
import { resolveEstimationSettings } from '../../domain/estimationSettings';
import { adoptCandidates, notePropertyId } from '../../domain/optionalProperties';
import { boundKeys, modelProblems } from '../../domain/scoringModel';
import { list, t } from '../../i18n/t';
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
	// BOTH questions are asked of the LIVE config, and that is the rule rather than a
	// spelling: which keys are taken, from the model this config resolves to right now,
	// and which options were ever touched, from the same config — the generic adoption
	// rule (`adoptCandidates`, `domain/optionalProperties.ts`, shared with the backlog's
	// own `adoptableProperties`), over this view's own key list rather than the backlog's.
	// `view.settings` is a SNAPSHOT taken at the last data update, so a property bound
	// since then reads as free here and its key is offered to a second slot as well — the
	// exact mix `adoptCandidates` documents, caught by the collision check and refused
	// whole, so the button did nothing and blamed the configuration.
	// `config.get(option) !== undefined` is deliberate, not a resolved key: cleared and
	// never-set resolve to the same '' key, and only never-set may adopt a suggestion —
	// turning a property off is a decision this action must not overrule.
	const taken = new Set(boundKeys(resolveEstimationSettings(view.config).model));
	const pending = new Map<string, string>();
	for (const { option, suggested } of adoptCandidates(view.config, SUGGESTED_KEYS, taken)) {
		pending.set(option, notePropertyId(suggested));
	}
	const model = resolveEstimationSettings(withPending(view.config, pending)).model;
	const problems = modelProblems(model);
	// Said rather than left silent: the guided empty state is still what is on screen, so
	// with nothing bound and nothing written there would be no surface reporting anything
	// and the button would simply look dead. `runInit`'s own shape.
	if (problems.length > 0) {
		// Every problem, because `renderProblems` already lists every problem — reporting
		// one made a two-fault configuration a round trip per fault. Joined by `list()` in
		// the CATALOG's locale, never by a separator here: list joining is grammar.
		new Notice(t('estimation.problems.blocked', { problems: list(problems) }));
		return;
	}
	// THE THIRD REFUSAL, asked here for the same reason the two above it are: this action's
	// two halves are one guarantee (`docs/requirements/Binding the estimation
	// properties.md`), and `applySafely` can refuse the whole backfill because another view
	// holds the lock — which would leave 13 properties bound and nothing stubbed.
	//
	// A SYNCHRONOUS check is sufficient and not a narrowed race: there is no `await`
	// between here and `applySafely`, and the lock is taken synchronously on entry to
	// `runExclusively`, so run-to-completion means no other view can take it in between.
	if (view.gate.writing) {
		new Notice(t('estimation.init.busy'));
		return;
	}
	for (const [option, value] of pending) view.config.set(option, value);
	// Settings AND model, not a full DOM render: the table this would draw is about to be
	// thrown away the instant the batch below lands, so building it is pure waste — but
	// the gate reads both before that batch runs. `writeProblems` reads `view.settings`,
	// and the outside-filter refusal reads `view.model` (`byPath.has`, unset on a note the
	// batch is about to touch reads as "outside this base" and refuses the whole write) —
	// a render() rebuilds both together, so skipping it silently broke the second one
	// until a watched-red run caught an empty vault.fm() where a stub belonged.
	view.settings = resolveEstimationSettings(view.config);
	view.model = buildEstimationModel(view.app, view.data?.data ?? [], model);
	const keys = boundKeys(model);
	// Every file gets the identical 13-set array — hoisted once rather than rebuilt per
	// file, since nothing in `applyPropertyWrites` mutates a write's `sets` in place.
	const sets = keys.map((key) => ({ key, value: '', ifMissing: true }));
	const writes = (view.data?.data ?? []).filter((e) => e.file?.extension === 'md').map((e) => ({ file: e.file, sets }));
	await view.applySafely(writes);
	// The batch's own deferred-update flush already rebuilt this view when one landed
	// mid-batch (the ordinary case against a real vault); render only when it did not.
	if (!view.gate.flushedLastBatch) view.render();
}
