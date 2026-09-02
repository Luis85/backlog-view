import { App } from 'obsidian';
import { ownValue } from './noteFields';
import { ownWorkflowKind, ownWorkflowReading, WorkflowKind, workflowStateInfo } from './board';
import { ReleaseFigure, ReleaseScope } from './releases';
import { ReleaseSettings } from './releaseOptions';
import { BacklogSettings } from './settings';
import { BacklogItem } from './model';

/**
 * A release's readiness, and the figures that ARE its criteria counted.
 *
 * **One walk, one predicate per number.** `docs/requirements/Summing up a release.md` says
 * the blocked and risk figures "use the predicates [[Release readiness]] declares rather
 * than a second set beside them", and this module is the only place either is written: a
 * criterion and the figure beside it are the same question asked twice, so they are
 * computed together and can never disagree.
 *
 * **The population is `scope.members`** — the notes whose OWN property names this release —
 * read off the rows `releaseScope` already resolved rather than a second walk of the model.
 * A context ancestor is scaffolding: it is in no denominator, no sum and no count. That is
 * the context-row rule, and `test/domain/releaseReadiness.test.ts` asks it of every figure.
 *
 * **Nothing here writes, and nothing here reads a clock.**
 */

export type Verdict = 'satisfied' | 'partly' | 'not' | 'unconfigured' | 'empty';

export interface ReleaseCriterion {
	key: 'estimated' | 'blocked' | 'risk';
	verdict: Verdict;
	/** Members clearing it. Null when unconfigured. */
	cleared: number | null;
	/** Members not clearing it, each counted ONCE however many values it holds. */
	outstanding: number | null;
	/**
	 * Members the criterion could not read at all — extension 5a's "both numbers are
	 * stated". An unanswered item is not a passing one, so these are inside `outstanding`
	 * as well as reported here.
	 */
	unreadable: number | null;
}

export interface ReleaseReadiness {
	/**
	 * How many members every figure here was computed over — `scope.members` counted once,
	 * so the renderer can ask whether the release is EMPTY without inferring it from the
	 * verdicts. It cannot be inferred: a criterion nobody configured reads `unconfigured`
	 * whether the release holds fifty members or none, so "every verdict is empty" is false
	 * for an empty release the moment one criterion is unconfigured.
	 */
	members: number;
	criteria: ReleaseCriterion[];
	unestimated: ReleaseFigure<number>;
	estimatedEffort: ReleaseFigure<number>;
	completedEffort: ReleaseFigure<number>;
	blocked: ReleaseFigure<number>;
	criticalRisks: ReleaseFigure<number>;
}

const UNCONFIGURED: ReleaseFigure<number> = { value: null, invalid: false, unconfigured: true };

function counted(value: number): ReleaseFigure<number> {
	return { value, invalid: false, unconfigured: false };
}

function unconfiguredCriterion(key: ReleaseCriterion['key']): ReleaseCriterion {
	return { key, verdict: 'unconfigured', cleared: null, outstanding: null, unreadable: null };
}

/**
 * Satisfied, partly and not are a COUNT, not a judgement — the readiness note's own words.
 * All of them clear it and it is satisfied; none do and it is not; anything between is
 * partly. An empty release satisfies nothing: with no members there is nothing to check,
 * which is a different statement from a pass.
 */
function verdictOf(cleared: number, outstanding: number): Verdict {
	if (cleared + outstanding === 0) return 'empty';
	if (outstanding === 0) return 'satisfied';
	if (cleared === 0) return 'not';
	return 'partly';
}

/** The three workflows a member — or a prerequisite — can read its done state through. */
const WORKFLOW_KINDS: WorkflowKind[] = ['requirements', 'deliverable', 'test'];

/**
 * **A key is half of a workflow; the other half is which values clear it** — the same rule
 * the risk criterion keeps, read here for the state vocabulary. A bound `stateKey` with an
 * empty `doneValues` clears nothing, so `ownWorkflowReading(...).done` is false for every
 * item: a figure gated on the key alone reports a measured-looking zero, and a criterion
 * gated on it reports every member of every release as blocked.
 *
 * **Only the KEY half is reachable from the view, and the sentence above is written wider
 * than what a test can drive.** `resolveSettings` replaces an empty `doneValues` with
 * `DEFAULT_DONE_VALUES` — deliberately, since the done set and the state exclusions must be
 * built from one list — and `resolveSecondaryWorkflow` does the same for a secondary
 * vocabulary, so no `.base` can produce a bound key with nothing clearing it. The length
 * test is kept for callers that build a `BacklogSettings` directly rather than through the
 * resolver, which is every unit test here and anything reaching this function later; it is
 * a guard against a configuration the resolver currently forbids, not one seen in a vault.
 * Raised by a review bot against the plan, and confirmed at `settingsResolve.ts`'s
 * `effectiveDoneValues` before it was taken.
 */
function workflowClears(kind: WorkflowKind, planSettings: BacklogSettings): boolean {
	const info = workflowStateInfo(kind, planSettings);
	return info.key !== '' && info.doneValues.length > 0;
}

/**
 * **An estimate clears its criterion by being a number** — the predicate
 * `docs/requirements/Release readiness.md` states and `A definition of ready` will reuse,
 * which is why {@link isEstimated} is exported rather than inlined. `TBD`, an empty string
 * and anything non-finite are the missing estimate wearing a value, and a criterion that
 * accepted them would report a release as fully estimated on the strength of somebody's
 * placeholder.
 *
 * **NOT `readNumber`, and that is the correction of this draft.** `noteFields.ts`'s shared
 * reader parses a string with `Number.parseFloat`, which takes a numeric PREFIX: `'5 TBD'`
 * reads as 5 and `'8 points'` as 8, so the two spellings a placeholder actually turns up in
 * would both be counted and summed. That is the exact reading this predicate says it
 * refuses. Raised by a review bot and reproduced before it was taken.
 *
 * A quoted numeric scalar is still an estimate — a frontmatter `effort: '5'` is a number
 * somebody typed as a string, and refusing it would call an estimated item unestimated — so
 * the test is that the WHOLE trimmed string is a finite number. `Number('')` is `0`, which
 * is why the empty check comes first rather than being left to `Number.isFinite`.
 *
 * `readNumber` stays untouched: it is shared with readers this increment does not own, and
 * narrowing it here would change figures nothing in this plan has looked at.
 */
export function estimateValue(raw: unknown): number | null {
	const parsed = finiteFrom(raw);
	// **Never negative.** `Capacity against commitment` already refuses a negative capacity
	// "since no unit this feature names can be less than none", and an effort estimate is the
	// same quantity from the other side. Allowing one lets estimates CANCEL: a completed 5
	// against an unfinished -5 totals zero, and the strip drew `5 of 0 pts (0%)` — a
	// contradiction, with negative and above-100 percentages available from the same door.
	// Refusing it at the reader closes the whole class rather than guarding each figure, and
	// leaves `0 <= completed <= estimated` true by construction.
	return parsed === null || parsed < 0 ? null : parsed;
}

function finiteFrom(raw: unknown): number | null {
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (trimmed === '') return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The criterion's own half of {@link estimateValue}. One predicate and one reader, so the
 * sum and the verdict can never disagree about which members are estimated — a criterion
 * calling `'5 TBD'` unestimated while the total beside it added 5 is the drift this pairing
 * exists to prevent.
 */
export function isEstimated(raw: unknown): boolean {
	return estimateValue(raw) !== null;
}

export function releaseReadiness(
	app: App,
	scope: ReleaseScope,
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): ReleaseReadiness {
	const members = scope.rows.filter((row) => !row.context).map((row) => row.item);
	// Each criterion is computed once and reused: the figure beside it IS its outstanding
	// count, so a second call here would be the second walk this module exists to avoid.
	const blocked = blockedCriterion(members, settings, planSettings);
	return {
		members: members.length,
		criteria: [estimateCriterion(app, members, settings), blocked],
		...effortFigures(app, members, settings, planSettings),
		blocked: figureFrom(blocked),
		criticalRisks: UNCONFIGURED,
	};
}

/** The figure beside a criterion IS its outstanding count — never a second walk. */
function figureFrom(criterion: ReleaseCriterion): ReleaseFigure<number> {
	return criterion.outstanding === null ? UNCONFIGURED : counted(criterion.outstanding);
}

/**
 * **What clears a prerequisite is this view's own already-bound state key and its done
 * values**, not a sixth and seventh option. `docs/requirements/Release readiness.md` asks
 * each criterion to declare its own key and clearing values; this view's `stateKey` already
 * IS its own — the rule protects against borrowing the key from the view that WRITES it,
 * which this does not do. A separate "cleared at" list is a later slice, for the day a vault
 * clears a dependency short of done.
 *
 * With no edge key bound the criterion is unconfigured, and so it is with no state key: an
 * edge says what a thing waits for and nothing about whether the wait is over, so an edge
 * key alone answers half a question. The readiness note says so in its own words. **The edge
 * key guard is load-bearing rather than defensive**: with `dependsOnProperty` unbound every
 * member carries no entries at all, so without it every release would read as satisfied.
 *
 * **The edges are the MODEL's, never re-read here.** `item.prerequisites` and
 * `item.brokenPrerequisites` are `resolveDependencies`' own output (`domain/dependencies.ts`),
 * and reading the raw links again would build a second, disagreeing graph: that resolver
 * deliberately rejects an unresolvable entry, an item naming ITSELF, and any entry inside a
 * cycle, all into `broken`. A hand-rolled reader resolves a self-reference happily and then
 * calls the member cleared because the target it found is done — which is the release
 * reporting nothing outstanding on exactly the items whose dependencies are malformed.
 * Raised by a review bot against this plan's first draft and confirmed at
 * `domain/dependencies.ts`'s `settle`.
 *
 * That this reads the RELEASE view's own key rather than the backlog view's is not luck:
 * `resolveSettings` maps every `PROPERTY_TABLE` row's option to its settings key
 * generically (`domain/settingsResolve.ts`), and `releaseView.ts` builds its model with
 * `resolveSettings(this.config)` — this view's own config. Declaring `dependsOnProperty` is
 * therefore what points the model's resolution at the key this criterion reads. The two
 * cannot drift, because there is only one.
 *
 * **No edges is RESOLVED** — the readiness note's stated exception. An empty list is removed
 * rather than stored, so an item that waits for nothing has no value where this looks;
 * counting that as unreadable would leave a release of independent work unable to satisfy
 * this criterion at all.
 *
 * A broken entry IS unreadable: the wait cannot be shown to be over. It costs the member its
 * criterion and is reported separately (extension 5a).
 */
function blockedCriterion(
	members: BacklogItem[],
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): ReleaseCriterion {
	// Unconfigured when there is no edge key, and equally when NO workflow could say a
	// prerequisite is done: with nothing clearing anything, "every member blocked" is a
	// configuration mistake reported as a finding about the release.
	const anyWorkflow = WORKFLOW_KINDS.some((kind) => workflowClears(kind, planSettings));
	if (settings.dependsOnKey === '' || !anyWorkflow) return unconfiguredCriterion('blocked');
	let cleared = 0;
	let outstanding = 0;
	let unreadable = 0;
	for (const item of members) {
		// Counted ONCE per member however many entries it holds — the acceptance criterion.
		const broken = item.brokenPrerequisites.length > 0;
		// A prerequisite whose OWN workflow is unconfigured is unreadable, not unfinished:
		// `ownWorkflowReading(...).done` is false for every item under an unbound key or an
		// empty done list, so counting it as waiting would report a prerequisite in an
		// unconfigured workflow as blocking rather than as unanswerable.
		const unread = item.prerequisites.some((p) => !workflowClears(ownWorkflowKind(p), planSettings));
		const waiting = item.prerequisites.some(
			(p) => workflowClears(ownWorkflowKind(p), planSettings) && !ownWorkflowReading(p).done,
		);
		if (broken || unread) unreadable += 1;
		if (broken || unread || waiting) outstanding += 1;
		else cleared += 1;
	}
	return { key: 'blocked', verdict: verdictOf(cleared, outstanding), cleared, outstanding, unreadable };
}

function estimateCriterion(app: App, members: BacklogItem[], settings: ReleaseSettings): ReleaseCriterion {
	if (settings.estimateKey === '') return unconfiguredCriterion('estimated');
	const cleared = members.filter((item) => isEstimated(estimateOf(app, item, settings))).length;
	const outstanding = members.length - cleared;
	// `unreadable` is 0 rather than null: this criterion reads a QUANTITY, so a member with
	// nothing where it looks is unestimated — a stated answer — rather than one the
	// criterion could not read. The vocabulary criteria are where 5a has work to do.
	return { key: 'estimated', verdict: verdictOf(cleared, outstanding), cleared, outstanding, unreadable: 0 };
}

/**
 * **Three figures, two different configurations.** The estimated total and the unestimated
 * count read the ESTIMATE key alone, so they answer wherever that key is bound. The
 * COMPLETED total additionally needs a workflow that can say what done means, and without
 * one `ownWorkflowReading(item).done` is false for every member — which would produce a
 * completed effort of zero that looks measured and is not, drawn as `0 of 15 pts (0%)`.
 * `ReleaseRow.done` already refuses to report that as a zero (`Summing up a release`
 * extension 2c), and this figure must refuse it for the same reason. Raised by a review bot
 * against a draft that made all three answer together.
 *
 * The test is over the OWN workflows of the members whose estimate is actually in the sum.
 * One of those whose kind cannot clear is enough, because a partial sum reported as a whole
 * is the same false precision in smaller print — but an UNESTIMATED member contributes to
 * neither total, so its unknown done state cannot change either one, and letting it withhold
 * a fully computable figure would hide a real answer for no reason. A draft tested every
 * member; a review bot narrowed it.
 */
function effortFigures(
	app: App,
	members: BacklogItem[],
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): Pick<ReleaseReadiness, 'unestimated' | 'estimatedEffort' | 'completedEffort'> {
	if (settings.estimateKey === '') {
		// All three read the SAME key, so all three are unconfigured together. Drawing a
		// count beside "not configured" contradicts itself — caught in the harness before
		// this module existed, and `Summing up a release` extension 2a is amended to say so.
		return { unestimated: UNCONFIGURED, estimatedEffort: UNCONFIGURED, completedEffort: UNCONFIGURED };
	}
	// Read every estimate first, so the readability test below sees exactly the members whose
	// value reaches a total — never one whose estimate is missing anyway.
	const weighed = members.map((item) => ({ item, value: estimateValue(estimateOf(app, item, settings)) }));
	const missing = weighed.filter((entry) => entry.value === null).length;
	const counting = weighed.filter((entry): entry is { item: BacklogItem; value: number } => entry.value !== null);
	const doneReadable = counting.every((entry) => workflowClears(ownWorkflowKind(entry.item), planSettings));
	let estimated = 0;
	let completed = 0;
	for (const entry of counting) {
		estimated += entry.value;
		// The member's OWN workflow, so a Deliverable answers by its own — the reader the
		// progress bar above this already uses.
		if (doneReadable && ownWorkflowReading(entry.item).done) completed += entry.value;
	}
	// ponytail: a member whose descendant in the same release also carries an estimate is
	// double counted here. Naming those members is `Capacity against commitment`'s own
	// figure (`docs/requirements/Capacity against commitment.md`), and it is the next
	// increment; until it lands this total is wrong in a vault whose parent estimates are
	// aggregates.
	return {
		unestimated: counted(missing),
		estimatedEffort: counted(estimated),
		completedEffort: doneReadable ? counted(completed) : UNCONFIGURED,
	};
}

function estimateOf(app: App, item: BacklogItem, settings: ReleaseSettings): unknown {
	return ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.estimateKey);
}
