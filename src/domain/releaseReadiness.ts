import { App } from 'obsidian';
import { ownValue, readString, sameValue } from './noteFields';
import { Decimal, exactSum, toNumber } from './decimal';
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
	/**
	 * The same total as {@link estimatedEffort}, exactly — the decimal the estimates sum to
	 * rather than the double that sum rounds to. **The number is for display and this is for
	 * arithmetic**: they disagree wherever the exact sum has more digits than a double holds,
	 * and `[1e21, 1]` is the smallest release where that costs a whole unit. Anything that
	 * SUBTRACTS from the commitment must take this one, or the difference is decided by a
	 * rounding that happened before the comparison did.
	 *
	 * `null` exactly when `estimatedEffort.value` is — no key bound, or a total no double can
	 * hold — so a reader narrowing one has narrowed both and no second check can disagree with
	 * the first.
	 */
	estimatedEffortExact: Decimal | null;
	completedEffort: ReleaseFigure<number>;
	blocked: ReleaseFigure<number>;
	criticalRisks: ReleaseFigure<number>;
	/**
	 * What the release note itself declares it can take, in the view's own unit.
	 *
	 * Four readings, not three: unconfigured is no key bound, `invalid` is a bound key
	 * holding something no reader will make a number of — **a negative among them**, since
	 * nothing in this plugin writes a capacity and extension 1b therefore judges one on
	 * READ — and value-null-with-neither-flag is a bound key the note is silent at. The last
	 * two are drawn differently because they send the reader to different places: one is a
	 * property to bind, the other a number to type.
	 */
	capacity: ReleaseFigure<number>;
	/**
	 * Members carrying an estimate while a DESCENDANT member in the same release carries
	 * one — a possible double count, NAMED and never resolved. Only the vault knows whether
	 * its parent estimates are aggregates, and a view that guessed would be silently wrong
	 * in whichever direction it guessed.
	 *
	 * **The direction is the contract, not a detail.** This counts the estimate that may
	 * already CONTAIN the others, so one estimated Epic over two estimated PBIs is one, not
	 * two. The reverse reading agrees on a chain and disagrees on a fan, which is why it
	 * survived a test suite once already.
	 */
	doubleCounted: ReleaseFigure<number>;
}

const UNCONFIGURED: ReleaseFigure<number> = { value: null, invalid: false, unconfigured: true };

function counted(value: number): ReleaseFigure<number> {
	return { value, invalid: false, unconfigured: false };
}

/**
 * A figure whose inputs were all readable and whose ANSWER is not. One shape, one caller:
 * the effort sums, where individually finite estimates can add up past `Number.MAX_VALUE`.
 * `invalid` rather than `unconfigured`, because the key IS bound and the members DID answer
 * — "go and fix a value" is a different instruction from "go and bind a property".
 */
const OVERFLOWED: ReleaseFigure<number> = { value: null, invalid: true, unconfigured: false };

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
 * The workflows that can clear a prerequisite in this vault — the same test `blockedCriterion`
 * applies per prerequisite through `ownWorkflowKind`, asked of the configuration instead so a
 * renderer can SAY what the criterion will consult. Exported because the alternative was the
 * view naming `stateKey` alone, which is wrong for any prerequisite that is not ordinary work.
 */
export function clearingWorkflows(planSettings: BacklogSettings): WorkflowKind[] {
	return WORKFLOW_KINDS.filter((kind) => workflowClears(kind, planSettings));
}

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
	const blocked = blockedCriterion(app, members, settings, planSettings);
	const risk = riskCriterion(app, members, settings);
	return {
		members: members.length,
		criteria: [estimateCriterion(app, members, settings), blocked, risk],
		...effortFigures(app, members, settings, planSettings),
		blocked: figureFrom(blocked),
		criticalRisks: figureFrom(risk),
		capacity: capacityFigure(app, scope, settings),
		doubleCounted: doubleCountFigure(app, scope, settings),
	};
}

/**
 * The release's own declared capacity. `estimateValue` is the reader on purpose: it already
 * refuses a non-finite value and a negative one, and its own comment names this feature as
 * the reason it refuses negatives — so "an unreadable capacity and an unreadable estimate
 * are the same judgement" is true by construction rather than by two readers agreeing.
 */
function capacityFigure(app: App, scope: ReleaseScope, settings: ReleaseSettings): ReleaseFigure<number> {
	if (settings.capacityKey === '') return UNCONFIGURED;
	const item = scope.release?.item;
	if (item === undefined) return UNCONFIGURED;
	const raw: unknown = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.capacityKey);
	if (raw === null || raw === undefined) return { value: null, invalid: false, unconfigured: false };
	const value = estimateValue(raw);
	return value === null ? { value: null, invalid: true, unconfigured: false } : counted(value);
}

/**
 * One pass over the rows the scope tree already drew, carrying the depths of the estimated
 * member ancestors still open. `rows` is depth-ordered, so an ancestor is open exactly while
 * rows deeper than it keep arriving.
 *
 * **Context rows close nothing and open nothing.** An excluded note is not a member, so its
 * own estimate is no part of this release and a member below it is not double counted by it
 * — the context-row rule, asked of this figure like every other.
 */
function doubleCountFigure(app: App, scope: ReleaseScope, settings: ReleaseSettings): ReleaseFigure<number> {
	if (settings.estimateKey === '') return UNCONFIGURED;
	// One entry per estimated member still open, and `covers` is what makes this count the
	// ANCESTOR: it is set when an estimated member arrives BELOW this one, and read when the
	// subtree closes. Counting at the arrival instead counts the descendant, which is the
	// reversed predicate — right on a chain, wrong on a fan.
	const open: { depth: number; covers: boolean }[] = [];
	let total = 0;
	const close = (depth: number): void => {
		while (open.length > 0 && open[open.length - 1].depth >= depth) {
			if (open.pop()?.covers === true) total += 1;
		}
	};
	for (const row of scope.rows) {
		close(row.depth);
		if (row.context) continue;
		if (!isEstimated(estimateOf(app, row.item, settings))) continue;
		// EVERY open estimate may already contain this one, not just the nearest: an Epic
		// whose grandchild is estimated is covering an estimate too — but that is a fact
		// about `covers`'s own INVARIANT, not something this arrival has to re-establish by
		// writing every entry. Each entry is pushed `covers: false`, and the arrival that
		// pushed it is the same arrival that would have marked every entry already open at
		// that moment — so every entry below the top is already `true` by the time a LATER
		// arrival gets here, and only the top can still be `false`. Marking just the top is
		// therefore the same result as marking all of them, in O(1) rather than O(open.length)
		// — the walk this module's own header claims is a single pass over the rows, not
		// quadratic in a chain's depth.
		const top = open[open.length - 1];
		if (top !== undefined) top.covers = true;
		open.push({ depth: row.depth, covers: false });
	}
	// The last subtree has no row after it to close it.
	close(-1);
	return counted(total);
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
	app: App,
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
		// `dropped` is the entries the READER threw away before the model ever saw them:
		// `readLinkList` skips a non-string silently, so `dependsOn: 123` and a list holding
		// an object leave both lists empty and would otherwise take the "no edges is
		// resolved" path — a member whose dependency data is garbage reported as cleared.
		// Same rule the risk criterion keeps for a partly readable list, and the same reason.
		const dropped = unreadableEntries(app, item, settings);
		const broken = dropped > 0 || item.brokenPrerequisites.length > 0;
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
): Pick<ReleaseReadiness, 'unestimated' | 'estimatedEffort' | 'estimatedEffortExact' | 'completedEffort'> {
	if (settings.estimateKey === '') {
		// All three read the SAME key, so all three are unconfigured together. Drawing a
		// count beside "not configured" contradicts itself — caught in the harness before
		// this module existed, and `Summing up a release` extension 2a is amended to say so.
		return {
			unestimated: UNCONFIGURED,
			estimatedEffort: UNCONFIGURED,
			estimatedEffortExact: null,
			completedEffort: UNCONFIGURED,
		};
	}
	// Read every estimate first, so the readability test below sees exactly the members whose
	// value reaches a total — never one whose estimate is missing anyway.
	const weighed = members.map((item) => ({ item, value: estimateValue(estimateOf(app, item, settings)) }));
	const missing = weighed.filter((entry) => entry.value === null).length;
	const counting = weighed.filter((entry): entry is { item: BacklogItem; value: number } => entry.value !== null);
	const doneReadable = counting.every((entry) => workflowClears(ownWorkflowKind(entry.item), planSettings));
	// **Summed EXACTLY, never with `+=`** (`domain/decimal.ts`). Each estimate is a decimal
	// somebody typed, and a running float total answers `0.30000000000000004` for `0.1` and
	// `0.2` — a commitment the strip then draws beside a capacity of `0.3` and a difference of
	// zero, contradicting itself in one sentence. Two terms are collected in one pass rather
	// than two filters, because the done reading is the expensive half.
	const all: number[] = [];
	const done: number[] = [];
	for (const entry of counting) {
		all.push(entry.value);
		// The member's OWN workflow, so a Deliverable answers by its own — the reader the
		// progress bar above this already uses.
		if (doneReadable && ownWorkflowReading(entry.item).done) done.push(entry.value);
	}
	// The exact sum is kept as well as rounded: `estimated` is what the strip DRAWS, and the
	// decimal beside it is what the capacity comparison subtracts from — see this field's own
	// comment on {@link ReleaseReadiness.estimatedEffortExact}.
	const exact = exactSum(all);
	const estimated = toNumber(exact);
	const completed = toNumber(exactSum(done));
	// **A finite estimate can still overflow a finite TOTAL.** `estimateValue` refuses a
	// non-finite value, which closes that door per member and not for their sum: two members
	// at `1e308` are each accepted and add to `Infinity`, which reaches the strip as an
	// infinite total and a `NaN` percentage — the exact "looks measured and is not" defect
	// this module exists to prevent, through the one door a per-value reader cannot close.
	// Raised by a review bot. Tested at `estimated` alone: every estimate is non-negative, so
	// `completed <= estimated` and a finite total cannot carry an infinite completion.
	if (!Number.isFinite(estimated)) {
		// The exact decimal goes with it: it exists here (two finite estimates summing past
		// `Number.MAX_VALUE` have a perfectly good decimal sum), and keeping it would leave a
		// comparison reachable for a total this figure has already declared unreadable.
		return {
			unestimated: counted(missing),
			estimatedEffort: OVERFLOWED,
			estimatedEffortExact: null,
			completedEffort: OVERFLOWED,
		};
	}
	// A member whose descendant in the same release also carries an estimate is double
	// counted here. `doubleCountFigure` NAMES how many members that is; it does not correct
	// this total, because only the vault knows whether a parent's estimate is an aggregate
	// — `docs/requirements/Capacity against commitment.md` asks for the count named rather
	// than guessed away, so this total stays wrong in exactly the vaults it warns about.
	return {
		unestimated: counted(missing),
		estimatedEffort: counted(estimated),
		estimatedEffortExact: exact,
		completedEffort: doneReadable ? counted(completed) : UNCONFIGURED,
	};
}

/**
 * How many entries this member's prerequisite property holds that a link reader cannot read
 * at all — `readLinkList` skips a non-string silently, so these reach no list and would
 * otherwise leave a garbage `dependsOn` looking like no dependencies.
 *
 * **Counted at the REFUSAL, never inferred from a total.** This compared the declared count
 * against the model's two lists until a review bot pointed out what that infers wrongly:
 * `settle` collapses duplicate resolved entries on purpose, so `dependsOn: [A, A]` yields one
 * prerequisite from two values and the difference marked a perfectly readable member
 * unreadable. Asking which values the reader REFUSES has no such coupling — it is the same
 * test `readLinkList` itself applies, and it stays correct however the model dedupes.
 *
 * The raw value is re-read here rather than a signal being threaded out of `readLinkList`,
 * which is shared with the parent link and every other link reader: widening that return
 * type would change what four other callers see to answer a question only this criterion
 * asks. `null`, `undefined` and a blank string are ABSENT rather than malformed — a member
 * declaring nothing clears, which is the "no edges is resolved" rule this must not break.
 */
function unreadableEntries(app: App, item: BacklogItem, settings: ReleaseSettings): number {
	const raw: unknown = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.dependsOnKey);
	if (raw === undefined || raw === null) return 0;
	const values: unknown[] = Array.isArray(raw) ? raw : [raw];
	return values.filter((value) => value !== null && value !== undefined && typeof value !== 'string').length;
}

function estimateOf(app: App, item: BacklogItem, settings: ReleaseSettings): unknown {
	return ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.estimateKey);
}

/**
 * **Absence is an answer here**, and this is the exception this criterion is most often got
 * backwards. It asks whether CRITICAL risks are addressed, so a member clears it by being
 * **not critical, or addressed** — a `Low` is not an outstanding critical risk, and neither
 * is a missing value. Reading it as "addressed or nothing" fails a release for every
 * ordinary low and medium risk in it, and demands a synthetic value on risk-free items
 * besides, which is the plugin inventing data to satisfy its own check. Only a critical
 * value that is not among the addressed ones costs the criterion an item, which is what the
 * criterion's own name says.
 *
 * **A key is half of a criterion; the other half is which values clear it** — and this
 * criterion reads TWO vocabularies, so a key bound with either list empty is unconfigured,
 * the same answer as no key at all. `docs/requirements/Release readiness.md` names both:
 * critical risks "names which risk values are critical AND which values count as addressed".
 * An earlier draft of this comment argued that an empty addressed list is a true reading
 * rather than a missing one — that a vault with no word for "addressed" simply has every
 * critical value outstanding. It contradicted this criterion's own test, and the test is the
 * one that matches the register: with no way to say a risk has been dealt with, "3 of 3
 * outstanding" is a configuration nobody finished, reported as a finding about the release.
 *
 * **Absence and unreadability are different answers, and the filter used to collapse them.**
 * A member with NOTHING where this looks clears the criterion — that is the exception above.
 * A member whose risk property holds an object, or a list of them, has a value the reader
 * cannot interpret: dropping those entries leaves an empty list indistinguishable from an
 * absent one, so malformed critical-risk data would make a release look ready. A present but
 * unreadable value costs the member the criterion and is reported in `unreadable`, which is
 * what 5a asks. Raised by a review bot against a draft that filtered and forgot.
 */
function riskCriterion(app: App, members: BacklogItem[], settings: ReleaseSettings): ReleaseCriterion {
	// BOTH vocabularies, not just the critical one — see this function's own docblock.
	if (
		settings.riskKey === '' ||
		settings.criticalRiskValues.length === 0 ||
		settings.addressedRiskValues.length === 0
	) {
		return unconfiguredCriterion('risk');
	}
	let cleared = 0;
	let outstanding = 0;
	let unreadable = 0;
	for (const item of members) {
		const reading = riskValuesOf(app, item, settings);
		if (reading.unreadable) {
			// A value the reader cannot interpret is not an absent one — see the docblock.
			unreadable += 1;
			outstanding += 1;
			continue;
		}
		// Counted ONCE per member however many values it holds — the acceptance criterion.
		const values = reading.values;
		const exposed = values.some(
			(value) =>
				settings.criticalRiskValues.some((critical) => sameValue(value, critical)) &&
				!values.some((held) => settings.addressedRiskValues.some((ok) => sameValue(held, ok))),
		);
		if (exposed) outstanding += 1;
		else cleared += 1;
	}
	return { key: 'risk', verdict: verdictOf(cleared, outstanding), cleared, outstanding, unreadable };
}

/**
 * A member's risk values, and whether the property held something this reader refuses.
 * `undefined` and `null` are ABSENCE and read as no values with `unreadable` false; anything
 * else that yields no readable string — an object, a list of them, an empty string — is a
 * value somebody wrote that this reader cannot use.
 */
function riskValuesOf(
	app: App,
	item: BacklogItem,
	settings: ReleaseSettings,
): { values: string[]; unreadable: boolean } {
	const raw = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.riskKey);
	if (raw === undefined || raw === null) return { values: [], unreadable: false };
	const entries: unknown[] = Array.isArray(raw) ? raw : [raw];
	const values: string[] = [];
	// **ANY rejected entry, not only a list where every entry was rejected.** A mixed list
	// like `['Low', { level: 'Critical' }]` keeps its `Low` and would otherwise read as a
	// clean, clearing value while the entry nobody could read might be the unaddressed
	// critical risk. Counting the survivors is the version that reports a release ready on
	// the strength of the half of a list that happened to parse.
	let rejected = false;
	for (const entry of entries) {
		const text = readString(entry);
		if (text === null) rejected = true;
		else values.push(text);
	}
	// An empty LIST is absence, not a refusal: `risk: []` says the same thing as no key, the
	// reading `dependsOn` already takes for an edge list nothing wrote. An empty STRING is
	// not — `readString` refuses it, so it arrives here as a rejected entry, which is the
	// register's own rule for a value somebody wrote and no reader will guess at.
	return { values, unreadable: rejected };
}
