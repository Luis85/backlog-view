import { App, TFile } from 'obsidian';
import { BacklogItem, BacklogModel, inPlan } from './model';
import { ReleaseSettings } from './releaseOptions';
import { CivilDate, FieldReading, linkpathFromRawValue, ownValue, readSoleDate, readString, sameValue } from './noteFields';
import { isMarkerType, isReleaseType } from './itemTypes';
import { ownWorkflowKind, ownWorkflowReading, WorkflowKind } from './board';

/**
 * A figure with THREE answers, not two. `FieldReading` in `noteFields.ts` separates a
 * key that holds nothing (absent) from one holding something no reader will guess at
 * (invalid); this adds the third the register insists on — a key nobody bound at all.
 * "Unconfigured" is a column absent for every row and named once; "invalid" is one row
 * saying somebody wrote something there. Collapsing them reports a configuration mistake
 * as a data mistake, or the reverse.
 */
export interface ReleaseFigure<T> {
	value: T | null;
	invalid: boolean;
	unconfigured: boolean;
}

export interface ReleaseRow {
	item: BacklogItem;
	path: string;
	name: string;
	version: ReleaseFigure<string>;
	target: ReleaseFigure<CivilDate>;
	status: ReleaseFigure<string>;
	/**
	 * What this release is FOR, in the reader's own words — read from the release view's
	 * own `descriptionKey`, with `readLabel`'s three answers exactly as the version and the
	 * status have them: unconfigured (no key bound), invalid (a key holding something no
	 * reader will make a sentence of), or a value.
	 *
	 * A PROPERTY and not the note body — the reversal `ReleaseSettings.descriptionKey`
	 * records. What follows for this row is that a description is a FIGURE like the others
	 * and is drawn by the same rules: absent draws nothing, unreadable says so, and neither
	 * is a paragraph this view had to open the note to find.
	 */
	description: ReleaseFigure<string>;
	/**
	 * Notes whose OWN membership property names this release — never an ancestor, never a
	 * descendant. A FIGURE like the other three, not a bare number: with the membership key
	 * unbound every release would otherwise report a truthful-looking `0`, when the honest
	 * answer is that the count cannot be read at all. Same rule as every other unconfigured
	 * figure — the column is absent and named once, never zero in each row.
	 */
	members: ReleaseFigure<number>;
	/**
	 * Members whose own state is a done value — the numerator {@link members} is the
	 * denominator of. A FIGURE for the reason `members` is one: unconfigured WITHOUT a
	 * membership property (a done count with no membership has nothing to count over), and
	 * unconfigured whenever a workflow this release's members actually span cannot answer —
	 * see the gate's own comment at the assignment for what that means and why it moved.
	 *
	 * Read through `ownWorkflowReading`, never `item.done`: a member typed `Deliverable` or
	 * a test-catalog member answers through its OWN workflow, which `item.done` — the
	 * requirements reading alone — gets backwards.
	 *
	 * Counted in the same walk that counts `members`, so there is one traversal and one
	 * population. Progress is this over `members` and is computed nowhere else — the
	 * single-release screen reads the same row, which is what stops a band and a release
	 * header disagreeing about one release.
	 */
	done: ReleaseFigure<number>;
	/**
	 * Every workflow at least one member reads its state through — {@link ownWorkflowKind}
	 * per member, deduplicated, in the fixed order `WORKFLOW_ORDER` declares rather than
	 * encounter order, so the tooltip built from it reads the same regardless of which
	 * member the walk reached first. What the summary strip's tooltip names when this holds
	 * more than one entry: {@link done}'s numerator crosses `ownWorkflowReading`'s branches
	 * the moment a release holds a Deliverable or a test-catalog member beside ordinary
	 * work, and past that point no single property decided it — see
	 * `docs/requirements/Summing up a release.md`'s 2026-08-28 amendment, and
	 * `src/view/release/renderScope.ts` for where this is read. Counted over the same
	 * population `members` is, in the same walk — never a second traversal that could
	 * disagree about who is a member. Empty exactly when `members` is: no membership key,
	 * or no member.
	 */
	workflows: WorkflowKind[];
	/**
	 * The subset of {@link workflows} `workflowConfigured` refused — what {@link done}'s
	 * unconfigured branch NAMES rather than leaving as one generic sentence. A release
	 * spanning ordinary work and Deliverables with only the latter's key bound reports
	 * `['requirements']` here, so the summary strip can say which property is still
	 * missing instead of "Progress is not configured" about a release that is half
	 * configured. Computed by `missingWorkflows`, the SAME pass that decides {@link done}'s
	 * own gate, in `WORKFLOW_ORDER` — never re-derived from the render layer, which could
	 * disagree with the boolean beside it. Empty whenever {@link done} is configured, and
	 * empty too when no workflow has been counted yet (no members, or a release nobody has
	 * counted): that case has no failing WORKFLOW to name, only a plan-wide key nobody
	 * bound, and `done`'s own gate falls back to the plan's state key alone to decide it.
	 */
	unconfiguredWorkflows: WorkflowKind[];
	/**
	 * On the RELEASE note: the date it actually shipped. Read exactly as {@link target} is,
	 * with the same three answers — unset, unreadable, a date. It is what tells shipped from
	 * in flight AND what makes {@link slip} derivable: one binding, two figures. Picked over
	 * interpreting a status string or inferring shipped-ness from 100% progress, both of
	 * which are wrong in both directions.
	 */
	released: ReleaseFigure<CivilDate>;
	/**
	 * Released minus target, in days. **Derived, never read** — no note carries it.
	 *
	 * Null without EITHER date, and that is not the same as `0`: a zero slip means shipped on
	 * the day promised, where null means the question cannot be asked yet. Negative means
	 * early, which is a real answer rather than an error.
	 */
	slip: number | null;
	/** Has a released date. What the index GROUPS on, and never a state value. */
	shipped: boolean;
	/**
	 * The target has passed and nothing has shipped. A FACT, not a heuristic: false for a
	 * shipped release whatever its target (it is late, which {@link slip} says), false with
	 * no target, and false ON the target date itself — that day is not yet past.
	 */
	overdue: boolean;
	/**
	 * Target minus today, in whole days. **Sign convention**: positive means days
	 * REMAINING, negative means days OVERDUE, zero means the target is today. Null without
	 * a readable target.
	 *
	 * The renderer's own figure, derived here rather than there because `domain/` is the
	 * only layer allowed to know what day it is (`ReleaseIndexOptions.today`) and the
	 * render layer must not read a clock either.
	 */
	daysToTarget: number | null;
}

export interface ReleaseIndex {
	rows: ReleaseRow[];
	/**
	 * Items carrying a membership value this base could not turn into a membership — the
	 * RULE rather than a list of the ways, because {@link membershipTarget} owns the
	 * refusals and a second copy beside them drifts: this comment named three while the
	 * code made five, and then named a NARROWER rule than the code keeps. "Named no
	 * release this base holds" is false for two of the five — an `Iteration` carrying the
	 * property is refused before its link is ever resolved, and two values name two
	 * releases rather than none — so the sentence has to be about what came OUT of the
	 * reader, never about what the value said. Reported rather than dropped: they belong
	 * to no release, so they appear on no release's screen and this is the only place they
	 * can be seen.
	 */
	unresolved: BacklogItem[];
}

const UNCONFIGURED = { value: null, invalid: false, unconfigured: true } as const;

function figure<T>(reading: FieldReading<T>): ReleaseFigure<T> {
	return { value: reading.value, invalid: reading.invalid, unconfigured: false };
}

/**
 * A label read with [[Releases as their own type]] 3b's own rule: a configured key holding
 * SOMETHING that is not a usable label — an object, a list of them, **or an empty string,
 * which 3b names explicitly** — is unreadable rather than absent, "because somebody wrote
 * something there".
 *
 * `readString` alone cannot answer this: it returns null for an object and for `''` alike,
 * so hard-coding `invalid: false` beside it reports malformed data as an unset key. Worse
 * for a LIST, which it does not refuse at all — it recurses into the first element, so
 * `['0.8.0', '0.9.0']` reads as a clean `0.8.0` and the second value disappears, which is
 * why the array is refused BEFORE the shared reader rather than after it. Not
 * `readPlacement` either, which is the closest existing reader and deliberately calls an
 * empty value ABSENCE — right for a roadmap horizon, wrong for a version 3b says is a
 * refusal.
 */
function readLabel(raw: unknown): FieldReading<string> {
	if (raw === null || raw === undefined) return { value: null, invalid: false };
	if (Array.isArray(raw)) return { value: null, invalid: true };
	const text = readString(raw);
	return text === null ? { value: null, invalid: true } : { value: text, invalid: false };
}

/**
 * Every row a membership property may legally be READ from: the whole tree, minus the
 * context rows.
 *
 * NOT `model.results`, and this is the trap. `results` is the PLAN projection —
 * `projectionForest(focusRoots, inPlan, …)` — so `inPlan` has already dropped every
 * iteration and every test-catalog row before this module sees them. Scanning it would
 * make two of the four non-plan cases unreportable: an `Iteration` or a `Test case`
 * carrying the property by hand would be invisible rather than refused, which is the
 * silent drop [[Setting an item's release]] 1f exists to prevent. `byPath` is the whole
 * set `assignAll` built, so the eligibility guard in {@link membershipTarget} is what
 * refuses a row — never the population it was never shown.
 *
 * `outsideFilter` rows ARE excluded, and that is the context-row rule rather than an
 * exception to this one: a row the Base excluded is never a source of anything derived
 * from the results.
 */
function scannableRows(model: BacklogModel): BacklogItem[] {
	return [...model.byPath.values()].filter((item) => !item.outsideFilter);
}

/**
 * The rank the model already parsed — `item.order`, not a second read of the cache.
 *
 * `readItems.ts` sets `order` from the MAPPED order key, which is exactly the value this
 * sort wants. Re-reading it here would be redundant and, worse, would disagree:
 * `readNumber` uses `Number.parseFloat`, so `10 - first` is rank 10 everywhere else in the
 * plugin, while a `Number()` conversion makes it `NaN` and drops the release to the
 * undated tail. One value, parsed once, or the index orders releases differently from
 * every other screen.
 *
 * A release with no readable rank sorts after every release that has one, so the path
 * tie-break decides between them.
 */
function rank(item: BacklogItem): number {
	return item.order ?? Number.POSITIVE_INFINITY;
}

/**
 * The fixed order `ReleaseRow.workflows` lists its entries in — declared once so the
 * summary's tooltip reads the same words in the same order regardless of which member the
 * counting walk reached first, which a `Set`'s own iteration order (insertion order) would
 * not guarantee.
 */
const WORKFLOW_ORDER: WorkflowKind[] = ['requirements', 'deliverable', 'test'];

function sortedWorkflows(kinds: Set<WorkflowKind> | undefined): WorkflowKind[] {
	if (kinds === undefined) return [];
	return WORKFLOW_ORDER.filter((kind) => kinds.has(kind));
}

/**
 * One workflow's own half of the gate `ReleaseRow.done` reads, moved here by the
 * author's decision on 2026-08-28 (reversing what this spec twice recorded,
 * `docs/superpowers/specs/2026-08-28-release-detail-ux-design.md`). It used to be
 * `options.stateKey !== ''` alone — the plan's own state key, whatever the members
 * actually were — which made a release holding only Deliverables report "not
 * configured" about progress `ownWorkflowReading` could read perfectly well through its
 * own property.
 *
 * The gate is now the REPRESENTED WORKFLOWS: configured when every workflow this
 * release's members actually span can answer for ITSELF. Deliverable falls back to the
 * plan's own key exactly as `resolvedDeliverableStateKey` does for the VALUE it reads —
 * the same fallback, asked here of whether a key exists to fall back TO, rather than of
 * what it reads.
 */
function workflowConfigured(kind: WorkflowKind, options: ReleaseIndexOptions, stateConfigured: boolean): boolean {
	return kind === 'deliverable' ? !(options.stateKey === '' && !options.deliverableStateKey) : stateConfigured;
}

/**
 * {@link ReleaseRow.unconfiguredWorkflows}'s own computation, and the one place
 * `workflowConfigured` is asked per kind: the row builder below reads this once and
 * derives BOTH `done`'s gate and the names beside it from the same list, rather than
 * asking the per-kind question again to get a plain boolean.
 *
 * 'test' never appears in `kinds` (see `ReleaseRow.workflows`'s own comment on why), so
 * only two branches of `workflowConfigured` are reachable; a third would be untestable
 * dead code.
 *
 * Empty for `kinds === undefined` — no members counted yet, or a release nobody has
 * counted — which is NOT the same claim as "configured": that case has no represented
 * workflow to fail, so there is nothing here to name, and the row builder falls back to
 * `stateConfigured` on its own to decide whether `done` itself reads as configured. Read
 * that fallback there rather than here: keeping it out of this function is what stops an
 * empty return being misread as "therefore configured".
 */
function missingWorkflows(
	kinds: Set<WorkflowKind> | undefined,
	options: ReleaseIndexOptions,
	stateConfigured: boolean,
): WorkflowKind[] {
	if (kinds === undefined) return [];
	return WORKFLOW_ORDER.filter((kind) => kinds.has(kind) && !workflowConfigured(kind, options, stateConfigured));
}

/**
 * `done`'s own readiness — pulled out of the row builder purely to keep that arrow
 * function's complexity under lint's cap, not because the question is asked anywhere
 * else. Mirrors `missingWorkflows`'s own fallback: no workflow counted yet falls back to
 * `stateConfigured` alone; everywhere else, configured means no gap.
 *
 * **`kinds.size === 0` never actually fires.** The only way `kinds` is non-`undefined`
 * here is a prior `.add()` in the builder's own walk (see `workflowsByRelease`), so a
 * `Set` that exists already holds at least one kind — `kinds === undefined` alone carries
 * the whole "nothing counted yet" case, and the size check beside it is defensive rather
 * than a second live branch.
 */
function progressReady(kinds: Set<WorkflowKind> | undefined, gap: WorkflowKind[], stateConfigured: boolean): boolean {
	return kinds === undefined || kinds.size === 0 ? stateConfigured : gap.length === 0;
}

/** A civil date as a sortable integer; undated sorts last, never as the epoch. */
function dateKey(target: ReleaseFigure<CivilDate>): number {
	const d = target.value;
	if (d === null) return Number.POSITIVE_INFINITY;
	return d.year * 10000 + d.month * 100 + d.day;
}

/**
 * Whole days between two civil dates, `b - a`. Both are civil — year, month and day as the
 * notes spell them — so this converts through UTC midnight deliberately: `Date.UTC` has no
 * zone and no DST, which is what keeps a span the same number of days whoever reads it.
 * A local-time construction would give 23 or 25 hours across a DST boundary and round to
 * the wrong day.
 */
function daysBetween(a: CivilDate, b: CivilDate): number {
	const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
	return Math.round(ms / 86_400_000);
}

/**
 * The primary ordering key WITHIN one shipped group — ascending target for in flight,
 * descending released for shipped — zero when the group's own date ties, which is what
 * sends a pair on to the rank and path tie-breaks in the sort proper. Pulled out of the
 * comparator so that function reads as a short list of questions rather than one long
 * one; every hazard the two dates carry stays commented where the comparison happens.
 */
function withinGroupOrder(a: ReleaseRow, b: ReleaseRow): number {
	if (a.shipped) {
		// DESCENDING by released date, so the most recent shipped release heads its own
		// tail rather than being buried under every older one.
		//
		// Values compared, never their difference — but unlike the in-flight key below,
		// the NaN hazard that shape exists for CANNOT occur here, and that is worth
		// saying plainly rather than claiming the two keys share a reason they don't.
		// This branch runs only where `a.shipped` holds, and `shipped` means a readable
		// released date, so `dateKey(a.released)` can never be `+Infinity` on this branch
		// — `rb - ra` would be numerically safe today. It is written as a value
		// comparison anyway, to match its sibling and to stay correct if that
		// implication (`shipped` implies a readable `released`) ever stops holding, not
		// because the hazard is reachable now. No test distinguishes the two spellings
		// on this branch, and none honestly can: a shipped release with no released date
		// is exactly what `shipped`'s own definition forbids constructing.
		const ra = dateKey(a.released);
		const rb = dateKey(b.released);
		return ra === rb ? 0 : ra > rb ? -1 : 1;
	}
	// Values compared, never their difference — two undated releases make
	// `Infinity - Infinity`, which is `NaN`, and `sort` coerces a `NaN` result to `+0`:
	// the pair reads as EQUAL and silently keeps whatever order it arrived in. Worse
	// than the "sorts at random" this comment claimed until 2026-08-22, because random
	// would be noticed. `Infinity` itself is not the hazard: `sort` reads only the SIGN
	// of the result, so `Infinity - n` would order correctly. Both keys below use the
	// same shape, the second one for the further reason stated at it.
	const ta = dateKey(a.target);
	const tb = dateKey(b.target);
	return ta === tb ? 0 : ta < tb ? -1 : 1;
}

/**
 * Per-render inputs `releaseIndex` needs that neither {@link ReleaseSettings} nor
 * {@link BacklogModel} carries. An OBJECT rather than a positional parameter, deliberately:
 * a fourth positional argument reads as "and one more thing", while a bag says the caller
 * is handing over context the two typed inputs above don't carry.
 */
/**
 * The statuses `Set status` offers for one release: what this vault DECLARED, then what
 * its releases actually CARRY, then this release's own value if it is in neither.
 *
 * A UNION, where the plan's own `stateMenuValues` is an either/or — declared wins and
 * observed is ignored there. The difference follows from what each list is for. A workflow
 * declares its columns, so a state outside the declared list is a card the board cannot
 * draw; a release status is a label on one note, drawn as a chip wherever it appears, so a
 * value somebody has already written is a value this vault uses whether or not anybody
 * wrote it into the options. `horizonMenuValues` makes the same call for the same reason.
 *
 * Order is DECLARED first and in declared order, because that is the reader's own statement
 * of their process; observed values follow in first-seen row order, which is the index's
 * order and so stable between renders. `current` is appended rather than sorted in — a
 * value on this note that neither list holds is exactly what a hand-edit or a renamed
 * vocabulary leaves behind, and the menu has to be able to draw it checked.
 *
 * Deduplicated with `sameValue` (case-insensitive, `noteFields.ts`), which is the same
 * comparison the pick's own no-op rule uses — so a menu can never offer two entries that
 * would write the same value, and never one that is already checked twice.
 */
export function releaseStatusChoices(settings: ReleaseSettings, index: ReleaseIndex, current: string | null): string[] {
	const choices: string[] = [];
	const add = (value: string | null): void => {
		if (value === null || value.trim() === '') return;
		if (!choices.some((held) => sameValue(held, value))) choices.push(value);
	};
	for (const declared of settings.statusValues) add(declared);
	for (const row of index.rows) add(row.status.value);
	add(current);
	return choices;
}

/**
 * An option `Mark as released` cannot run without. A UNION rather than a string, so a
 * clause added to `closeOffer` cannot report an option the screen has no name for: the
 * label map in `view/release/releaseClose.ts` is keyed by this type, and a fifth member
 * added here without a label there is a compile error rather than an `undefined` drawn
 * into a sentence.
 */
export type CloseOption =
	| 'releaseStatusProperty'
	| 'releasedStatusValues'
	| 'releasedTransitionValue'
	| 'releasedDateProperty';

export interface CloseOffer {
	/** Option keys the reader must bind, in the order the panel lists them. Empty when
	 *  everything this action needs is configured. */
	missing: CloseOption[];
	/** A field this release holds a value for that no reader can parse, or null. The
	 *  screen names it so the reader repairs the NOTE rather than the configuration. */
	unreadable: 'status' | 'released' | null;
	/** True only when the action may be pressed: nothing missing, nothing unreadable,
	 *  the release not already out, and no date to overwrite. */
	offered: boolean;
}

/**
 * Whether `Mark as released` may be pressed on this release, and what to say when not.
 *
 * Answers the MISSING OPTIONS rather than a boolean, because withholding a button is only
 * half of what extension 3a asks for: the screen has to name the option to bind, and a
 * predicate that answered yes/no could not.
 *
 * Every field it reads carries three answers, and both are asked the same way:
 * unconfigured is a configuration problem the reader fixes in the options panel, invalid
 * is a NOTE problem the reader fixes in the note, and only a readable value is an input.
 * The released date is the sharper of the two — it must read as ABSENT, not merely as
 * readable, because a date already there is a record this action must never replace.
 */
export function closeOffer(release: ReleaseRow, settings: ReleaseSettings): CloseOffer {
	const missing: CloseOption[] = [];
	if (settings.statusKey === '') missing.push('releaseStatusProperty');
	if (settings.releasedValues.length === 0) missing.push('releasedStatusValues');
	// UNCONFIGURED covers two shapes, not one: never set, and set to a value this vault
	// does not count as released. The second reads as configured everywhere else and is
	// the more dangerous of the two, because the release can already CARRY that value —
	// `releaseClosureWrites` then plans nothing, the empty batch returns before
	// `applyRelease` reaches the gate, and a confirmed press writes nothing and says
	// nothing. `releaseNoteProblems` reports the same mismatch and would refuse loudly, but
	// only a NON-EMPTY batch ever gets there (found by review, Codex, PR #219).
	//
	// Named as the option to fix rather than left to the gate: the reader is told which of
	// the two values disagrees, where the gate could only say the configuration is wrong.
	const transitionUnusable =
		settings.releasedTransition === '' ||
		(settings.releasedValues.length > 0 &&
			!settings.releasedValues.some((v) => sameValue(v, settings.releasedTransition)));
	if (transitionUnusable) missing.push('releasedTransitionValue');
	if (settings.releasedDateKey === '') missing.push('releasedDateProperty');

	// A value no reader can parse is the note's problem, and this screen already refuses
	// to edit one: `drawStatus` draws a marker and no chip for exactly this. Writing over
	// what the control beside it will not touch would be the inconsistency, not the fix.
	const unreadable = release.status.invalid ? 'status' : release.released.invalid ? 'released' : null;

	const alreadyOut =
		release.status.value !== null && settings.releasedValues.some((v) => sameValue(v, release.status.value ?? ''));
	// ABSENT, not merely readable. A date already recorded is the half of this that cannot
	// be reconstructed, and recording one twice is what 1a withholds the action for.
	const dateFree = release.released.value === null && !release.released.invalid;

	return { missing, unreadable, offered: missing.length === 0 && unreadable === null && !alreadyOut && dateFree };
}

/**
 * Whether the two closing fields on the LIVE note still read as the row on screen says
 * they do — asked before the confirmation opens, and the answer to a hazard the write's
 * own compare-and-swap cannot see.
 *
 * `ReleaseRow` is built when Bases last handed this view its results. Obsidian's metadata
 * cache advances FIRST, so between that render and the press the note can already hold an
 * external edit: the screen still says `In progress`, and the raw value captured at the
 * press is the new one. Handing that raw value to the write as its expectation BLESSES the
 * change instead of catching it — the compare-and-swap only ever sees what happened after
 * the dialog opened (found by review, Codex, PR #219).
 *
 * Read through the same two readers the row itself was built with, never `===` on the raw
 * value: a note respelled `2026-9-1` to `2026-09-01`, or `status` retrimmed, is the same
 * answer to the reader and must not refuse an action.
 */
export function closingFieldsMoved(app: App, release: ReleaseRow, settings: ReleaseSettings): boolean {
	const fm = app.metadataCache.getFileCache(release.item.file)?.frontmatter;
	const status = settings.statusKey ? figure(readLabel(ownValue(fm, settings.statusKey))) : UNCONFIGURED;
	const released = settings.releasedDateKey
		? figure(readSoleDate(ownValue(fm, settings.releasedDateKey)))
		: UNCONFIGURED;
	return !sameFigure(status, release.status, sameValue) || !sameFigure(released, release.released, sameCivil);
}

/** Two readings of one field agree when they are the same KIND of answer and, where that
 *  is a value, the same value. `invalid` is part of it: a status that became unreadable
 *  while the row still shows the old one is exactly a move. */
function sameFigure<T>(live: ReleaseFigure<T>, drawn: ReleaseFigure<T>, same: (a: T, b: T) => boolean): boolean {
	if (live.unconfigured !== drawn.unconfigured || live.invalid !== drawn.invalid) return false;
	if (live.value === null || drawn.value === null) return live.value === drawn.value;
	return same(live.value, drawn.value);
}

const sameCivil = (a: CivilDate, b: CivilDate): boolean =>
	a.year === b.year && a.month === b.month && a.day === b.day;

export interface ReleaseIndexOptions {
	/**
	 * `BacklogSettings.stateKey` — the PLAN's own state key. Not one of `ReleaseSettings`'
	 * three model mappings, and not carried by `BacklogModel` either, so it has to arrive
	 * as an explicit input. See {@link ReleaseRow.done} for why this is the key that gates
	 * it rather than any of this view's own.
	 */
	stateKey: string;
	/**
	 * `BacklogSettings.deliverableStateKey`, raw — never the resolved
	 * `resolvedDeliverableStateKey` fallback, because the gate below has to ask "can THIS
	 * workflow answer on its own or through the key it shares" rather than read a value
	 * already decided. Author's decision, 2026-08-28: `done` used to gate on {@link stateKey}
	 * alone, which made a release holding only Deliverables report "not configured" about
	 * progress its own workflow could read perfectly well. See {@link ReleaseRow.done}.
	 *
	 * Optional, defaulting to `''` (no Deliverable workflow of its own): every existing
	 * caller of `releaseIndex` that has no reason to touch a Deliverable's own key is
	 * untouched by this field's arrival, and the gate reads its absence exactly as it
	 * reads an explicit `''`.
	 */
	deliverableStateKey?: string;
	/**
	 * Today, injected — `domain/` never reads a clock (see `src/domain/CLAUDE.md`). The
	 * view supplies it via `todayCivil()` (`noteFields.ts`). What {@link ReleaseRow.shipped},
	 * {@link ReleaseRow.overdue} and {@link ReleaseRow.daysToTarget} are computed against.
	 */
	today: CivilDate;
}

export function releaseIndex(
	app: App,
	model: BacklogModel,
	settings: ReleaseSettings,
	options: ReleaseIndexOptions,
): ReleaseIndex {
	// Counted rather than seeded: a release nothing points at simply has no entry, and
	// `?? 0` in the row below is what turns that into the zero it means. Seeding every
	// release with 0 first would say the same thing twice.
	const counts = new Map<string, number>();
	// Same shape, one per release, for the numerator `done` reads.
	const doneCounts = new Map<string, number>();
	// Same shape again, for `ReleaseRow.workflows` — a Set per release rather than a count,
	// since what this answers is WHICH kinds are represented, not how many of each.
	const workflowsByRelease = new Map<string, Set<WorkflowKind>>();
	// The empty-set fallback below — no workflow means nothing to ask, so the answer falls
	// back to the plan's own key exactly as the whole gate did before 2026-08-28.
	const stateConfigured = options.stateKey !== '';
	const unresolved: BacklogItem[] = [];
	// Built once per index and dead with it: `membershipTarget` runs per scannable row, so
	// asking `model.releases` itself made the last refusal a scan and the rebuild
	// O(members x releases). `ReadonlySet` because `.has` is the only thing ever asked of
	// it — the same reason `cardedPaths` (`view/childrenList.ts`) states for its own.
	const releasePaths: ReadonlySet<string> = new Set(model.releases.map((r) => r.file.path));

	for (const item of scannableRows(model)) {
		const named = membershipTarget(app, item, releasePaths, settings);
		if (named === null) continue;
		if (named === UNRESOLVED) {
			unresolved.push(item);
			continue;
		}
		counts.set(named, (counts.get(named) ?? 0) + 1);
		// `ownWorkflowReading`, never `item.done`: see {@link ReleaseRow.done}.
		if (ownWorkflowReading(item).done) doneCounts.set(named, (doneCounts.get(named) ?? 0) + 1);
		const kinds = workflowsByRelease.get(named) ?? new Set<WorkflowKind>();
		kinds.add(ownWorkflowKind(item));
		workflowsByRelease.set(named, kinds);
	}

	// The comparison key for "has the target passed", `today` itself never leaving this
	// function: a `ReleaseFigure` shape so `dateKey` — the one helper civil dates are
	// compared through — takes it exactly as it takes `target` and `released`.
	const todayKey = dateKey({ value: options.today, invalid: false, unconfigured: false });

	const rows = model.releases.map((item): ReleaseRow => {
		const fm = app.metadataCache.getFileCache(item.file)?.frontmatter;
		const target = settings.targetDateKey ? figure(readSoleDate(ownValue(fm, settings.targetDateKey))) : UNCONFIGURED;
		const released = settings.releasedDateKey
			? figure(readSoleDate(ownValue(fm, settings.releasedDateKey)))
			: UNCONFIGURED;
		const shipped = released.value !== null;
		// Read once and shared below (`done`'s gate, `unconfiguredWorkflows` itself), so the
		// boolean and the names explaining it cannot disagree about which workflows failed.
		const kinds = workflowsByRelease.get(item.file.path);
		const gap = missingWorkflows(kinds, options, stateConfigured);
		const ready = progressReady(kinds, gap, stateConfigured);
		return {
			item,
			path: item.file.path,
			name: item.file.basename,
			version: settings.versionKey ? figure(readLabel(ownValue(fm, settings.versionKey))) : UNCONFIGURED,
			target,
			status: settings.statusKey ? figure(readLabel(ownValue(fm, settings.statusKey))) : UNCONFIGURED,
			description: settings.descriptionKey ? figure(readLabel(ownValue(fm, settings.descriptionKey))) : UNCONFIGURED,
			members: settings.membershipKey
				? figure({ value: counts.get(item.file.path) ?? 0, invalid: false })
				: UNCONFIGURED,
			done:
				settings.membershipKey && ready
					? figure({ value: doneCounts.get(item.file.path) ?? 0, invalid: false })
					: UNCONFIGURED,
			workflows: sortedWorkflows(kinds),
			unconfiguredWorkflows: gap,
			released,
			slip: target.value !== null && released.value !== null ? daysBetween(target.value, released.value) : null,
			shipped,
			// Nothing shipped, and the target's key sorts before today's — never `< 0` on a
			// `daysBetween` call, which would read the SAME day (`0`) as not yet overdue by
			// the same reasoning `daysToTarget` states below, at the cost of constructing a
			// span only to throw its magnitude away.
			// No explicit `target.value !== null` guard: `dateKey` already answers
			// `+Infinity` for an unset date, which is never `< todayKey`, so an undated
			// release already reads as not overdue without naming that case here.
			overdue: !shipped && dateKey(target) < todayKey,
			daysToTarget: target.value !== null ? daysBetween(options.today, target.value) : null,
		};
	});

	rows.sort((a, b) => {
		// Shipped-ness leads. Grouping is where the HEADING falls (`renderIndex.ts`); this
		// is what the order IS, and the flat `rows` array stays the sorted one —
		// `releaseScope` and every existing caller read it.
		if (a.shipped !== b.shipped) return a.shipped ? 1 : -1;
		const withinGroup = withinGroupOrder(a, b);
		if (withinGroup !== 0) return withinGroup;
		// NOT `rank(a) - rank(b)` guarded by `Number.isFinite`: an unranked release is
		// `+Infinity`, and `Infinity - 10` is `Infinity`, which that guard rejects — so the
		// ranked release and the unranked one would fall through to the PATH tie-break
		// together, and a rank the vault states would decide nothing.
		if (rank(a.item) !== rank(b.item)) return rank(a.item) < rank(b.item) ? -1 : 1;
		// The final tie-break, and it is what makes the order STABLE across renders: two
		// releases sharing a date and a rank — or a vault with the order property unmapped,
		// where none of them has a rank at all — would otherwise sit in whatever order the
		// results arrived in.
		return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
	});

	return { rows, unresolved };
}

/**
 * Returned when a membership value exists but names no release this base holds.
 *
 * Module-private, with {@link membershipTarget}, until something outside this file reads
 * them: an export nothing imports is dead surface and `npm run analyze` says so.
 * {@link releaseScope} is the second consumer and it lives HERE, so it earns neither one
 * an `export` — the first thing that reads either from another module will.
 */
const UNRESOLVED = Symbol('unresolved membership');

/** What the live read below needs — one field `BacklogSettings` also spells. */
interface LiveKeys {
	typeKey: string;
}

/**
 * The type a note states RIGHT NOW, off the metadata cache rather than off the model —
 * for a note the caller has not opened.
 */
function liveTypeOf(app: App, file: TFile, keys: LiveKeys): string | null {
	return readString(ownValue(app.metadataCache.getFileCache(file)?.frontmatter, keys.typeKey));
}

/**
 * Whether a membership write names a TARGET the vault no longer calls a release. A plan
 * carries the `TFile` its picker was built from, and nothing between there and the write
 * asks what that note is now — retype it and the value spells a link to a note that is no
 * longer a release, this reader's own extension 1b, reported as an unresolved membership.
 * Found by review (Codex, PR #201): authorization at plan time is not authorization at
 * write time. A REMOVAL asks nothing — there is no target to be wrong about, and taking
 * the key off a note that may not hold it is the one gesture that must always be allowed.
 *
 * **The CARRIER is deliberately not asked here, and the guarantee is narrowed to say so.**
 * A live walk up the carrier's parent chain shipped beside this and was removed on
 * 2026-08-24: which ladder an item is on is a MODEL decision — `buildModel` chains
 * `ladderFor` off the parent **as loaded** — and the vault cannot answer it, because the
 * writer cannot see the Base's result set. With "Show parents outside the filter" off, a
 * returned `Task` whose `Test suite` parent the Base excluded has no parent in the model,
 * lands on the PLAN ladder, and is offered `Set release` correctly; the walk followed that
 * excluded parent through the vault anyway and refused the write the screen had just
 * offered, with nothing stale about it. What a type NAME can answer is still asked, by
 * `mayHoldField` through `refusesLiveType` (`storage/frontmatter.ts`) — a carrier retyped
 * to a marker or to a catalog rung. What is left uncovered is the reparent of a `Task` (or
 * a typeless note) under a catalog note between the pick and the write, recorded in
 * `docs/issues/A carrier reparented into the catalog keeps its release.md`.
 *
 * What is NOT asked here either is whether the target left the BASE: that is a question
 * about the write gate's contract rather than about the vault, it is shared with
 * `Set iteration`, and it is recorded in `docs/issues/A stale release or iteration target
 * can still be committed.md`.
 */
export function refusesLiveMembership(app: App, target: TFile | null | undefined, keys: LiveKeys): boolean {
	if (!target) return false;
	return !isReleaseType(liveTypeOf(app, target, keys));
}

/**
 * Which release this item names: a path, {@link UNRESOLVED}, or null for "names none".
 *
 * FIVE refusals, and each is a rule rather than a safeguard. Five counted by READING the
 * function: `grep -c 'return UNRESOLVED'` answers four, because the last one is the
 * ternary this function ends on and no grep for one spelling can see it.
 *
 *   - a value present but unreadable — an empty string, an object, a list of them.
 *     `readString` answers null to all three exactly as it answers null to a key the note
 *     does not carry, and collapsing them drops a hand-written mistake in silence: the
 *     note HAS the key, so somebody wrote something there. Only a missing key and an
 *     empty list mean "names none";
 *   - two values at once — [[The scope of a release as a tree]] 1c: membership is one
 *     value, and reading a list as membership of each would make every writer in this
 *     epic destructive;
 *   - **a carrier that is not plan work.** [[Setting an item's release]] 1f requires this
 *     of the READER, not only of the writer: a release property hand-written onto a
 *     `Milestone`, an `Iteration`, another `Release` or a test-catalog note does not put
 *     it in the scope, "because a release holds work and those notes are not work".
 *     Refusing at one end only would let a hand-edit do what the menu will not — and this
 *     increment builds no menu, so the reader is the only end there is. `isMarkerType` is
 *     not redundant beside `inPlan`: `inPlan` excludes the catalog and the iterations
 *     while ADMITTING a `Milestone`, which is right for the backlog tree and wrong here,
 *     and the marker predicate covers a fourth marker added later without anyone having to
 *     remember this call site. It named a `Release` beside the `Milestone` until
 *     2026-08-25, and that half died when `inPlan` began refusing a release outright
 *     (2026-08-24): the claim survives on the `Milestone` alone, which is the only admitted
 *     marker left for `isMarkerType` to be earning its place on;
 *   - a value naming no note at all — `getFirstLinkpathDest` resolved nothing, so the note
 *     names a release that is not in the vault. Unresolved and not "names none": the key
 *     holds text somebody wrote, and answering null here would file a broken link beside a
 *     note that never claimed a release;
 *   - a value naming a note that is not a release.
 *
 * **Obsidian's own resolution wins, and a resolved non-release is an answer, not a miss.**
 * `[[R]]` resolving to a note called `R` that is an Epic is extension 1b's case — the
 * value names something that is not a release, so it is unresolved and gets reported.
 * Reassigning it to a release called `R` in another folder would be the view inventing a
 * membership the vault does not spell. Nothing here looks past what `getFirstLinkpathDest`
 * answered, and a bare name needs no second reader: it is the spelling `resolveParent`
 * already tolerates by handing exactly this text to exactly this call.
 */
function membershipTarget(
	app: App,
	item: BacklogItem,
	releasePaths: ReadonlySet<string>,
	settings: ReleaseSettings,
): string | typeof UNRESOLVED | null {
	if (!settings.membershipKey) return null;
	const raw = ownValue(app.metadataCache.getFileCache(item.file)?.frontmatter, settings.membershipKey);
	if (raw === null || raw === undefined) return null;
	if (Array.isArray(raw)) {
		if (raw.length === 0) return null;
		if (raw.length > 1) return UNRESOLVED;
	}
	// A link is TEXT. `readString` coerces a number or a boolean to its string form, which
	// is wider than any other reader of a link-shaped key: `resolveParent` refuses a
	// non-string outright and so does `readLinkList`, which is what fills `releaseEntry`.
	// Left coerced, `release: 2.4` counted as a membership here while the menu saw none —
	// the two-ends disagreement extension 1f forbids, reached through the VALUE's type
	// rather than through its cardinality (Codex, PR #201). Refused rather than made
	// tolerant at the other end: a bare `2.4` is a spelling Obsidian resolves and a YAML
	// number is not one, and reporting it repairs from the menu, where a silent membership
	// could not be seen at all.
	const scalar: unknown = Array.isArray(raw) ? raw[0] : raw;
	if (typeof scalar !== 'string') return UNRESOLVED;
	// `readString` trims and answers null for a blank string, so this one test covers the
	// empty value 3b names as well as the shapes no reader will guess at.
	const text = readString(scalar);
	if (text === null) return UNRESOLVED;
	if (!inPlan(item) || isMarkerType(item.typeName)) return UNRESOLVED;
	const file = app.metadataCache.getFirstLinkpathDest(linkpathFromRawValue(text), item.file.path);
	if (file === null) return UNRESOLVED;
	return releasePaths.has(file.path) ? file.path : UNRESOLVED;
}

export interface ScopeRow {
	item: BacklogItem;
	/**
	 * Depth within THIS tree, not the backlog's: depth 0 is the topmost KEPT row, which is
	 * normally a CONTEXT ancestor rather than a member. Every row an ancestor chain passes
	 * through without keeping — a marker, an excluded row — costs a level, so the tree
	 * closes up around what it does not draw.
	 */
	depth: number;
	/** True for an ancestor drawn only to keep a member in its place. */
	context: boolean;
	/**
	 * Members at or below this row, and how many of them are done — the rollup the row
	 * draws, over THIS release's members rather than over the model's descendants.
	 *
	 * `item.descendantCount` and `item.doneDescendants` are the wrong pair for the same
	 * reason `item.subtreeDone` is: they count every non-marker descendant the BASE
	 * returned, consulting no membership, so a Feature with two members here and five
	 * items elsewhere would report `1/7` on a screen whose every other figure is over
	 * seven fewer notes.
	 *
	 * Zero on a row with no members below it, which is what makes a CONTEXT row's
	 * `memberTotal` the count of the members it is holding in place — and what keeps the
	 * row itself out of both numbers, since a context row is never counted anywhere on
	 * this screen. Each member's doneness is `ownWorkflowReading`'s, so a Deliverable
	 * answers by its own workflow.
	 */
	memberTotal: number;
	memberDone: number;
	/**
	 * Whether every MEMBER at or below this row is done — the predicate hiding uses, and
	 * deliberately not `item.subtreeDone`.
	 *
	 * That model field is `item.done && done === count` over every non-marker descendant
	 * the BASE returned, consulting no membership at all, so a done member whose only
	 * unfinished child belongs to another release (or to none) would never hide by it.
	 * This one asks the same question of this release's own population, which is the
	 * population every other figure on this screen is measured over.
	 *
	 * A CONTEXT row answers for its members alone: its own state is not this base's
	 * plan, so it can neither keep a finished subtree on screen nor take an unfinished
	 * one off it — the context-row rule, in the shape `assignAll` already keeps it.
	 */
	subtreeDone: boolean;
}

export interface ReleaseScope {
	release: ReleaseRow | null;
	rows: ScopeRow[];
	members: number;
}

/**
 * The scope of one release: its members, and the ancestors that hold them in place.
 *
 * **Membership never cascades, in either direction.** An ancestor is scaffolding — not a
 * member, not counted, and marked as context so its number-free row is not read as a
 * zero. Inheriting down would put in the release work nobody named; inferring up would
 * put in it an Epic whose other children ship later.
 *
 * A context ancestor is drawn regardless of its own state: hiding it would break the
 * member's place, and it is scaffolding rather than something the reader asked to see.
 *
 * **The index is a parameter rather than derived here.** Every caller with a release
 * picked has already built one — the view needs it for the row this screen is drawn from
 * and for the unresolved memberships it reports — and deriving a second scans every
 * scannable row again to find ONE row by path. Passing it also makes the two screens agree
 * by construction: the header's figures and the member count come from the same pass that
 * drew the index behind it.
 */
export function releaseScope(
	app: App,
	model: BacklogModel,
	settings: ReleaseSettings,
	index: ReleaseIndex,
	path: string,
): ReleaseScope {
	const release = index.rows.find((row) => row.path === path) ?? null;
	if (release === null) return { release: null, rows: [], members: 0 };

	const releasePaths: ReadonlySet<string> = new Set(model.releases.map((r) => r.file.path));
	const members = new Set<string>();
	// Members plus every ancestor that holds one in place — **except the two kinds walked
	// THROUGH rather than kept.**
	//
	// Two rules meet at the first of them and both say the same thing. `Releases as their
	// own type` 4a: an excluded release "never arrives as a context row" and "appears as no
	// row anywhere" — and because this plan keeps the hand-written parent edge, a member
	// filed under a release would otherwise drag that release in as a context ancestor,
	// excluded or not. And the model's own rule: `descendantCount` scores a marker 0 and
	// traverses through it, so a marker is never the thing that holds a row in place; the
	// real ancestor above it is.
	const keep = new Set<string>();
	for (const item of scannableRows(model)) {
		if (membershipTarget(app, item, releasePaths, settings) !== path) continue;
		members.add(item.file.path);
		keep.add(item.file.path);
		for (let up = item.parent; up !== null; up = up.parent) {
			// Both skips CONTINUE the walk upward rather than stopping it — an included
			// ancestor further up is still the member's rightful place.
			//
			// A MARKER, for the two reasons above, and because a release drawn inside another
			// release's scope is nonsense.
			//
			// An `outsideFilter` ancestor, because it is not in the results.
			// `showOutsideParents` DEFAULTS TO TRUE, so an excluded Epic between a member and
			// the top is loaded as a context row and would otherwise be rendered here — and
			// extension 2a says a member whose ancestor is missing from the results is drawn
			// at the top level, not under it. It is also the register's context-row rule
			// verbatim: such a row is never a source of anything derived from the results,
			// and being somebody's scaffolding in THIS projection is exactly that.
			if (isMarkerType(up.typeName) || up.outsideFilter) continue;
			keep.add(up.file.path);
		}
	}

	const rows: ScopeRow[] = [];
	// One pass, pre-order for `rows` (the tree's own drawing order) and post-order for the
	// rollup: a row's `memberTotal`/`memberDone` need every descendant visited before they
	// can be summed, so the row is pushed on the way DOWN — to keep `rows` in the order the
	// tree draws — and filled in on the way BACK UP, once its children's totals are known.
	// `rows` holds the same object the recursion mutates, never a second copy.
	const walk = (item: BacklogItem, depth: number): { total: number; done: number } => {
		// A row that is not kept is walked THROUGH, never stopped at. A member filed under a
		// marker — the hand-written parent edge this plan deliberately keeps — has that
		// marker as an ancestor, and a marker is never kept; returning here would drop the
		// MEMBER along with it while the header went on counting it, so the scope and the
		// index would disagree about one release. That is the one defect this module exists
		// to prevent. Descending without drawing it leaves the depth alone too, so the
		// member re-roots at the level the marker occupied.
		const kept = keep.has(item.file.path);
		const isMember = members.has(item.file.path);
		let row: ScopeRow | null = null;
		if (kept) {
			row = { item, depth, context: !isMember, memberTotal: 0, memberDone: 0, subtreeDone: false };
			rows.push(row);
		}
		let belowTotal = 0;
		let belowDone = 0;
		for (const child of item.children) {
			const sub = walk(child, kept ? depth + 1 : depth);
			belowTotal += sub.total;
			belowDone += sub.done;
		}
		// The row reports what is BELOW it, never itself — the same rule that makes a
		// context row's number exactly the members it is holding in place, stated once for
		// every row rather than as a context-only exception: a leaf member's own row has
		// nothing below it and draws no rollup, which is what keeps this screen from
		// putting a trivial `1/1` on every leaf.
		if (row) {
			row.memberTotal = belowTotal;
			row.memberDone = belowDone;
		}
		// This item's own membership, THEN everything below it — bubbled to the parent's
		// sum AND, right here, what `subtreeDone` reads. Deliberately not `row.memberTotal`
		// /`row.memberDone`, which exclude the row itself so a leaf draws no trivial `1/1`
		// rollup: hiding asks a different question than the rollup does — "is EVERY member
		// at or below this row done", the row's own membership included — and `total`/`done`
		// is that question's answer whether or not `row` exists, so a context row (never a
		// member itself) reads it exactly as it reads `memberTotal`/`memberDone`: only its
		// members below. One pass, one pair of numbers, two questions asked of it.
		const total = belowTotal + (isMember ? 1 : 0);
		const done = belowDone + (isMember && ownWorkflowReading(item).done ? 1 : 0);
		if (row) row.subtreeDone = total > 0 && done === total;
		return { total, done };
	};
	// From the model's REAL roots, not its rendered ones: a focus level set on the backlog
	// view must not decide what a release's scope contains. A member whose ancestor is
	// absent from the results is an orphan, which `linkAll` makes a root of that same list,
	// so the walk reaches it at depth 0 with no branch of its own.
	for (const root of model.realRoots) walk(root, 0);

	return { release, rows, members: members.size };
}
