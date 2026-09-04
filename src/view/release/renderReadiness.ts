import { setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { formatNumber, t } from '../../i18n/t';
import { ReleaseCriterion, ReleaseReadiness, clearingWorkflows } from '../../domain/releaseReadiness';
import { WorkflowKind } from '../../domain/board';
import { exactDifference, toNumber } from '../../domain/decimal';
import { ReleaseSettings } from '../../domain/releaseOptions';
import { ReleaseRow } from '../../domain/releases';
import { BacklogSettings } from '../../domain/settings';
import { drawFixNote, editCapacityUnit, editRiskValues } from './readinessFix';
import { editReleaseCapacity } from './releaseEdits';

/**
 * The readiness chip row, and the figures that join the summary strip beside the bar
 * (`docs/requirements/Release readiness.md`).
 *
 * A second module rather than more of `renderScope.ts`, which is already the largest file in
 * this directory: this draws a different thing from a different model, and the 400-line cap
 * is a gate rather than a preference.
 *
 * **Every count and every verdict comes from `domain/releaseReadiness.ts`**, which computed
 * them in one walk — a count written beside the chip that reported it would be a second
 * opinion about a number with one right answer, which is the defect `Summing up a release`
 * exists to prevent.
 *
 * **The COMPARISON is the one thing derived here**, and deliberately so
 * (`docs/requirements/Commitment against declared capacity.md`): the difference between the
 * commitment and the capacity, and the two percentages beside it. The difference is taken
 * from `estimatedEffortExact`, the decimal that crosses the seam, so the rounding happens
 * once and at the end — moving it into `domain/` would re-open the seam it was written to
 * close. Nothing else is: no sum, no count, no verdict.
 */

/** Each criterion's own name, read into the chip AND the collapsed row's hidden list. */
const CRITERION_NAME: Record<ReleaseCriterion['key'], () => string> = {
	estimated: () => t('release.scope.readinessEstimated'),
	blocked: () => t('release.scope.readinessBlocked'),
	risk: () => t('release.scope.readinessRisk'),
};

/** Exported for `scopeToolbar.ts`'s own clear-filter control, which names the narrowed
 *  criterion in its sentence and must read the identical table this row draws its chips
 *  from — a second copy here would be a second opinion about what a criterion is called. */
export function criterionName(key: ReleaseCriterion['key']): string {
	return CRITERION_NAME[key]();
}

export function drawReadiness(
	view: ReleaseView,
	headerEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): void {
	// Withheld whole for a release with no members, `drawSummary`'s own rule: three verdicts
	// beside an empty state that already says the release is empty says it twice and worse.
	//
	// **The MEMBER COUNT, never the verdicts.** An unconfigured criterion reads
	// `unconfigured` whether the release holds fifty members or none, so "every verdict is
	// empty" is false for an empty release the moment one criterion is unconfigured — and
	// true for no release where any criterion is.
	if (readiness.members === 0) return;
	const rowEl = headerEl.createDiv({ cls: 'pbl-rel-ready' });
	const unconfigured = readiness.criteria.filter((c) => c.verdict === 'unconfigured');
	if (unconfigured.length === readiness.criteria.length) drawCollapsed(rowEl, unconfigured);
	else for (const criterion of readiness.criteria) drawChip(view, rowEl, criterion, settings, planSettings);
	// **Beside whichever shape drew the risk criterion**, collapsed or its own chip — the
	// collapsed count already carries the risk criterion's own name into its
	// `.pbl-sr-only` span (`drawCollapsed`), so this button is additional rather than a
	// replacement either way. Drawn only where the KEY is bound: with no key at all there
	// is no vocabulary here to write, and binding `riskProperty` is the fix that state
	// needs first — this dialog cannot write a property, only the two lists beside it.
	if (settings.riskKey !== '' && (settings.criticalRiskValues.length === 0 || settings.addressedRiskValues.length === 0)) {
		drawFixNote(view, rowEl, t('release.scope.riskValuesTitle'), { kind: 'run', run: () => editRiskValues(view) }, 'pbl-rel-riskvalues-fix');
	}
}

/**
 * Every criterion unconfigured: ONE chip. Three chips saying nothing three times is noise on
 * exactly the vault that most needs signal — a first run, where ✨ has bound the keys and
 * nobody has written the vocabularies yet. The readiness note requires an unconfigured
 * criterion to be LISTED rather than silent, so the names ride the chip itself.
 *
 * **Not the tooltip alone.** This chip is a static, unfocusable `div`, so `setTooltip`
 * reaches a pointer and nobody else — the identical objection this module answers for an
 * unsatisfied chip by putting its criterion in the visible text. Here the count is the whole
 * point of the collapse, so the names ride a `.pbl-sr-only` span instead: `drawSummary`'s own
 * provenance sentence uses exactly this mechanism, and for exactly this reason
 * (`aria-describedby` is not reliably exposed on a role-less, unfocusable host, and an
 * `aria-label` would REPLACE the count the chip draws).
 */
function drawCollapsed(rowEl: HTMLElement, unconfigured: ReleaseCriterion[]): void {
	const chipEl = rowEl.createDiv({
		cls: 'pbl-state-chip pbl-state-static pbl-rel-crit pbl-rel-crit-unset',
		text: t('release.scope.readinessNoneConfigured', { count: unconfigured.length }),
	});
	const names = unconfigured.map((criterion) => CRITERION_NAME[criterion.key]()).join(', ');
	setTooltip(chipEl, names);
	chipEl.createSpan({ cls: 'pbl-sr-only', text: names });
}

/**
 * **The chip says WHICH property decided it**, which is main flow step 5 of
 * `docs/requirements/Summing up a release.md` — "every figure names its property and
 * vocabulary where there is one" — and which this row shipped without: the tooltip repeated
 * the criterion name the chip already draws, so two vaults binding different properties drew
 * identical chips. Found by a review bot on the pull request that added the row.
 *
 * **Hidden text AND the tooltip, from one string.** `setTooltip` on a static unfocusable div
 * reaches a pointer alone — the objection {@link drawCollapsed} already answers this way, and
 * `drawSummary`'s progress provenance before it. An `aria-label` is refused for that
 * function's reason: it would REPLACE the count the chip draws, trading one gap for a worse
 * one. Nothing is added to the chip's visible width, which also keeps the row's wrapping
 * exactly where it was measured.
 *
 * An unconfigured criterion gets NO provenance: there is no property to name, and a sentence
 * naming an empty one is the "unconfigured reads as nothing" defect this increment is about.
 *
 * **A `<button>` rather than a `<div>` exactly where narrowing would show something** (Task
 * 11): `outstandingPaths` is the SAME field the count came from (Task 9's own guarantee), so
 * testing it here can never disagree with the chip's own text — a satisfied, empty or
 * unconfigured criterion has nothing to narrow TO (the whole tree, or nothing at all), and a
 * control offering either is a control that lies. `pbl-state-static` is therefore dropped
 * from a narrowable chip's own classes: that class is what makes every OTHER chip here inert
 * to hover and focus, and a real control needs neither withheld from it.
 */
function drawChip(
	view: ReleaseView,
	rowEl: HTMLElement,
	criterion: ReleaseCriterion,
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): void {
	const name = CRITERION_NAME[criterion.key]();
	const narrowable = criterion.outstandingPaths !== null && criterion.outstandingPaths.length > 0;
	const cls = `pbl-state-chip pbl-rel-crit pbl-rel-crit-${verdictClass(criterion.verdict)}`;
	const text = chipText(criterion, name);
	const chipEl: HTMLElement = narrowable
		? rowEl.createEl('button', {
				cls,
				text,
				attr: { type: 'button', 'aria-pressed': String(view.criterionFilter === criterion.key) },
			})
		: rowEl.createDiv({ cls, text });
	// A class rather than baked into the string above: the linked lint rule that catches a
	// SENTENCE built from a ternary between two literals reaches this too, and its own
	// remedy for a class name is exactly this.
	if (!narrowable) chipEl.addClass('pbl-state-static');
	chipEl.dataset.criterion = criterion.key;
	if (narrowable) {
		chipEl.addEventListener('click', () => {
			view.setCriterionFilter(view.criterionFilter === criterion.key ? null : criterion.key);
		});
	}
	const provenance = criterion.verdict === 'unconfigured' ? '' : criterionProvenance(criterion.key, settings, planSettings);
	setTooltip(chipEl, provenance === '' ? name : `${name}. ${provenance}`);
	// The verdict first, then what produced it. Only `satisfied` needs saying: every other
	// verdict is already in the chip's own visible text, and repeating it here would have a
	// screen reader read it twice.
	const spoken = satisfiedText(criterion, name);
	if (spoken !== '') chipEl.createSpan({ cls: 'pbl-sr-only', text: spoken });
	if (provenance !== '') chipEl.createSpan({ cls: 'pbl-sr-only', text: provenance });
}

/** A workflow kind's own translated name. All THREE, unlike `renderScope.ts`'s pair: a
 *  catalog note cannot be a release member, but it can be a member's prerequisite. */
function workflowName(kind: WorkflowKind): string {
	if (kind === 'deliverable') return t('release.scope.workflowDeliverables');
	if (kind === 'test') return t('release.scope.workflowTests');
	return t('release.scope.workflowRequirements');
}

/**
 * One sentence per criterion, because the three do not read the same SHAPE of input — see
 * the catalog entries' own comment. The property is spelled as the frontmatter KEY rather
 * than the config's `note.`-prefixed id, since a reader who acts on this goes and edits
 * frontmatter.
 */
function criterionProvenance(
	key: ReleaseCriterion['key'],
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): string {
	if (key === 'estimated') return t('release.scope.provenanceEstimate', { property: settings.estimateKey });
	if (key === 'blocked') {
		// **The WORKFLOWS, never one key.** Each prerequisite is cleared by its OWN workflow
		// (`ownWorkflowKind` in `blockedCriterion`), so a Deliverable prerequisite is decided
		// by the deliverable done values — this sentence named `stateKey` alone until a review
		// bot pointed out it was wrong for exactly that vault. Naming the workflows instead is
		// `Summing up a release`'s own escape for a population spanning several of them, which
		// the progress figure beside this already takes.
		return t('release.scope.provenanceDependsOn', {
			property: settings.dependsOnKey,
			workflows: clearingWorkflows(planSettings).map(workflowName),
		});
	}
	// **Both vocabularies unconditionally, and no empty-list branch beside them.** A risk
	// criterion with either list empty is UNCONFIGURED (`releaseReadiness.ts`'s own rule,
	// three conditions ORed), and an unconfigured criterion is returned above without
	// provenance — so a "no addressed values" sentence here would be a guard against a state
	// the domain refuses to produce. It was written, and the test for it failed by drawing
	// nothing at all; that is the evidence, and the branch is gone rather than reachable-
	// looking. A verdict cannot be reconciled from the critical list alone anyway: a member
	// holding an addressed value clears, and the critical list does not say why.
	return t('release.scope.provenanceRisk', {
		property: settings.riskKey,
		critical: settings.criticalRiskValues,
		addressed: settings.addressedRiskValues,
	});
}

/**
 * A satisfied chip draws the bare name and carries its verdict in the border colour alone,
 * which states nothing to a screen reader and nothing to a reader who cannot tell the colours
 * apart — against the acceptance criterion that each criterion STATES satisfied. Empty for
 * every other verdict, whose own words are already in {@link chipText}.
 */
function satisfiedText(criterion: ReleaseCriterion, name: string): string {
	if (criterion.verdict !== 'satisfied' || criterion.cleared === null || criterion.outstanding === null) return '';
	return t('release.scope.readinessSatisfied', {
		criterion: name,
		cleared: criterion.cleared,
		count: criterion.cleared + criterion.outstanding,
	});
}

function chipText(criterion: ReleaseCriterion, name: string): string {
	if (criterion.verdict === 'unconfigured') return t('release.scope.readinessUnconfigured', { criterion: name });
	if (criterion.outstanding === null || criterion.cleared === null) return name;
	if (criterion.verdict === 'satisfied') return name;
	// "Satisfied, partly and not are a count, not a judgement" — so a criterion that is not
	// satisfied says HOW MANY, which is the number somebody acts on. It also says WHICH: two
	// unsatisfied criteria both reading "2 of 5 outstanding" are indistinguishable, and the
	// tooltip that would tell them apart is on a static unfocusable div and reaches a pointer
	// alone.
	const count = criterion.cleared + criterion.outstanding;
	// The unreadable ones are STATED rather than folded into the total — extension 5a. Zero
	// of them takes the shorter sentence, so an ordinary release does not carry a ", 0
	// unreadable" nobody needs.
	if (criterion.unreadable !== null && criterion.unreadable > 0) {
		return t('release.scope.readinessPartlyUnreadable', {
			criterion: name,
			outstanding: criterion.outstanding,
			count,
			unreadable: criterion.unreadable,
		});
	}
	return t('release.scope.readinessPartly', { criterion: name, outstanding: criterion.outstanding, count });
}

/** A `Verdict` is domain vocabulary; this is the stylesheet's. Kept apart deliberately —
 *  a class name is not a value the plugin persists, and a verdict is not a colour. */
function verdictClass(verdict: ReleaseCriterion['verdict']): string {
	if (verdict === 'satisfied') return 'ok';
	if (verdict === 'partly') return 'part';
	if (verdict === 'not') return 'no';
	return 'unset';
}

/** The effort figures, then the capacity comparison beside them. ONE call site for the
 *  second, so it cannot be forgotten on one of the first's three exits. `view` is threaded
 *  through to the red states that name an unbound key of their own or open a dialog — see
 *  `readinessFix.ts` — and reaches no further than the branch that draws one. `release` is
 *  threaded the same way, for the capacity dialog and the unreadable capacity's own `open`
 *  remedy, both of which need the release note itself rather than only its settings. */
export function drawReadinessFigures(
	view: ReleaseView,
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
	release: ReleaseRow,
): void {
	drawEffortFigures(view, sumEl, readiness, settings);
	drawCapacity(view, sumEl, readiness, settings, release);
}

/**
 * The three figures joining the existing summary strip. The estimate progress is ONE figure
 * with its denominator named inside it (`9 of 15 pts (60%)`) rather than a sum and a second
 * percentage: two percentages beside the items bar read as competing and wrap the strip.
 *
 * All three read the same key, so all three are absent together — the count included. A
 * `2 unestimated` beside `Effort is not configured` contradicts itself.
 */
function drawEffortFigures(
	view: ReleaseView,
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
): void {
	const total = readiness.estimatedEffort.value;
	const done = readiness.completedEffort.value;
	// Named before the unconfigured branch below, and NOT folded into it: an overflowed sum
	// has a bound key and answering members, so "not configured" would send the reader to the
	// wrong place. `unestimated` still draws — that count did not overflow.
	if (readiness.estimatedEffort.invalid) {
		sumEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.scope.effortUnreadable') });
		drawUnestimated(sumEl, readiness);
		// The provenance too, and this branch skipped it until a review bot noticed: the one
		// state where a reader most needs to know WHICH property to go and fix was the one
		// state that did not say so.
		drawEstimateProvenance(sumEl, settings);
		return;
	}
	if (total === null) {
		// The estimate key itself is unbound, so none of the three figures answers — and
		// the property is `estimateProperty`, this screen's own option, so the note draws
		// as the button that binds it (`readinessFix.ts`).
		drawFixNote(view, sumEl, t('release.scope.effortUnconfigured'), { kind: 'bind', option: 'estimateProperty' });
		return;
	}
	// A release whose every member is unestimated has nothing to sum, which is a different
	// statement from a total of zero — extension 4a. **Decided from the COUNT of estimated
	// members, never from the sum**: `0` is a valid estimate, so a release whose members all
	// estimate zero would otherwise be drawn exactly like one nobody has estimated at all.
	const estimatedMembers = readiness.criteria.find((criterion) => criterion.key === 'estimated')?.cleared ?? 0;
	// **Named, never silent.** This branch drew nothing at all until a review bot read the
	// comment above against the code under it: "nothing to sum" was asserted in prose while
	// the figure was simply omitted, which is the absent-and-unnamed defect every other case
	// in this module exists to prevent — and the repository's own "a comment that states a
	// rule is not a check".
	if (estimatedMembers > 0) drawEffort(sumEl, total, done, settings.capacityUnit);
	else sumEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.scope.effortNothingToSum') });
	drawUnestimated(sumEl, readiness);
	drawEstimateProvenance(sumEl, settings);
}

/**
 * Step 5 again, for the figures rather than the chips. All three read ONE key, which is why
 * one sentence covers them — the reason `estimateKey` is one option and not three. Hidden
 * text only: `drawSummary` already owns the strip's tooltip for the progress figure, and
 * overwriting it would trade this provenance for that one.
 *
 * A function rather than a line, because there are two paths out of
 * {@link drawReadinessFigures} and one of them forgot it.
 */
function drawEstimateProvenance(sumEl: HTMLElement, settings: ReleaseSettings): void {
	sumEl.createSpan({ cls: 'pbl-sr-only', text: t('release.scope.provenanceEstimate', { property: settings.estimateKey }) });
}

/** The unestimated count, drawn by both the ordinary path and the overflowed one — that
 *  count is a number of MEMBERS and cannot overflow, so an unreadable total does not take
 *  it down with it. */
function drawUnestimated(sumEl: HTMLElement, readiness: ReleaseReadiness): void {
	if (readiness.unestimated.value === null) return;
	sumEl.createSpan({
		cls: 'pbl-rel-figure',
		text: t('release.scope.unestimated', { count: readiness.unestimated.value }),
	});
}

function drawEffort(sumEl: HTMLElement, total: number, done: number | null, unit: string): void {
	// `done === null` is the estimate key bound with no workflow that can say done: there is
	// a real total and no progress through it, so the total is stated alone rather than
	// against a zero that would read as measured.
	if (done === null) {
		// PRECISE, both branches: `total` is a sum of estimates someone TYPED, not a count
		// this plugin computed — `formatNumber`'s own distinction — so the default formatter's
		// three-fraction-digit cap would round a fractional estimate away.
		const text = unit === ''
			? t('release.scope.effortEstimatedNoUnit', { total: formatNumber(total, true) })
			: t('release.scope.effortEstimated', { total: formatNumber(total, true), unit });
		sumEl.createSpan({ cls: 'pbl-rel-figure', text });
		return;
	}
	// A real total of zero has no percentage to compute, and dividing by it produces the
	// `NaN` that would be drawn as one. Zero is the only case left: negative estimates are
	// refused at the reader, so `0 <= done <= total` holds and the percentage cannot come out
	// negative or above 100.
	// **Divide BEFORE multiplying.** `100 * done` overflows to `Infinity` for a `done` near
	// `Number.MAX_VALUE` even though `done` and `total` are both finite and the aggregate
	// guard in `effortFigures` passed — a second overflow door behind the first, which drew
	// `∞%`. `done / total` is bounded by 1 (estimates are non-negative and `done <= total`),
	// so the multiplication after it cannot overflow.
	const pct = total === 0 ? 0 : Math.round(100 * (done / total));
	// `pct` stays a plain number: it is computed and rounded to an integer, not typed in, so
	// the default formatter is the right one — `done` and `total` are precise for the same
	// reason as the branch above.
	const text = unit === ''
		? t('release.scope.effortNoUnit', { done: formatNumber(done, true), total: formatNumber(total, true), pct })
		: t('release.scope.effort', { done: formatNumber(done, true), total: formatNumber(total, true), pct, unit });
	sumEl.createSpan({ cls: 'pbl-rel-figure', text });
}

/**
 * The capacity comparison — `docs/requirements/Commitment against declared capacity.md`.
 *
 * **The commitment is `estimatedEffort` and is never re-summed here.** That figure and the
 * `estimated` criterion are one walk in `releaseReadiness.ts`; a second sum in the renderer
 * is the drift that module exists to prevent.
 */
function drawCapacity(
	view: ReleaseView,
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
	release: ReleaseRow,
): void {
	// The SAME count `drawEffortFigures` reads, computed once and passed to both, so the two
	// can never disagree about whether this release has been estimated at all.
	const estimatedMembers = readiness.criteria.find((criterion) => criterion.key === 'estimated')?.cleared ?? 0;
	drawCapacityFigures({ view, release }, sumEl, readiness, settings, estimatedMembers);
	// **Outside the comparison, and drawn once.** The double count is a count of ESTIMATES:
	// it does not read the capacity, it does not read the unit, and it answers on every path
	// where the comparison cannot be drawn at all. Inside those branches it was suppressed
	// for reasons that have nothing to do with it — an unset unit, an overflowed effort sum.
	drawDoubleCount(sumEl, readiness);
	// **Every path with a bound key, not just the one that draws a percentage.** The
	// provenance is what tells the reader WHICH frontmatter key to go and repair, so the
	// unreadable state is the one that needs it most and the one five early returns would
	// skip. Omitted only where the key itself is unbound — there is no property to name.
	// This is `drawEstimateProvenance`'s own lesson, which a review bot had to teach once
	// already on the path above.
	if (settings.capacityKey === '') return;
	const property = settings.capacityKey;
	sumEl.createSpan({
		cls: 'pbl-sr-only',
		text:
			settings.capacityUnit === ''
				? t('release.scope.provenanceCapacityNoUnit', { property })
				: t('release.scope.provenanceCapacity', { property, unit: settings.capacityUnit }),
	});
}

function drawCapacityFigures(
	ctx: { view: ReleaseView; release: ReleaseRow },
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
	estimatedMembers: number,
): void {
	const capacity = readiness.capacity;
	// The capacity's own state is named even with no commitment to compare it against —
	// extension 2b's "both halves are named" — but a comparison needs both numbers.
	// Unconfigured names `capacityProperty`, this screen's own option, so the note draws
	// as the button that binds it (`readinessFix.ts`). The other two are read-only refusals
	// about a bound key's own content, and both are buttons now too (Task 3): unreadable
	// opens the note — a dialog cannot tell the reader's "leave it empty" from "it already
	// is" on a value it never offered to type — and absent opens the number dialog itself,
	// carrying its own selector (`pbl-rel-capacity-fix`) so the dialog's focus restore can
	// find the exact button that opened it among the strip's other fix buttons.
	if (capacity.unconfigured) {
		drawFixNote(ctx.view, sumEl, t('release.scope.capacityUnconfigured'), { kind: 'bind', option: 'capacityProperty' });
	} else if (capacity.invalid) {
		drawFixNote(ctx.view, sumEl, t('release.scope.capacityUnreadable'), { kind: 'open', file: ctx.release.item.file });
	} else if (capacity.value === null) {
		drawFixNote(
			ctx.view,
			sumEl,
			t('release.scope.capacityAbsent'),
			{ kind: 'run', run: () => editReleaseCapacity(ctx.view, ctx.release, null) },
			'pbl-rel-capacity-fix',
		);
	}
	// **The unit is checked BEFORE the commitment, and that order is the requirement.**
	// Extension 3a makes an unset unit a missing MAPPING, reported like an unbound key — so
	// it is reported whether or not there is a commitment to label. Behind the commitment
	// return it went unreported exactly when the effort sum was itself unreadable, which is
	// a reader with two unbound mappings being told about one.
	const unit = settings.capacityUnit;
	if (unit === '') {
		// **Only once the key is bound.** An unset unit is a missing mapping worth reporting,
		// but with no capacity property there is nothing to label and so nothing to say — and
		// the unconfigured note above has already said the one thing that is true. Reported
		// unconditionally it put THREE refusals on the strip for two unbound keys, beside the
		// effort's own, on every vault that has never configured this: `drawCollapsed`'s rule
		// one screen up, read here.
		//
		// A missing MAPPING rather than a note to open or a property to bind — the unit is a
		// `.base` option with no key of its own — so its remedy is the dialog that writes it
		// (`readinessFix.ts`), carrying its own selector for the reason the capacity fix's
		// does: a dialog's focus restore needs the exact button that opened it.
		if (settings.capacityKey !== '') {
			drawFixNote(ctx.view, sumEl, t('release.scope.capacityNoUnit'), { kind: 'run', run: () => editCapacityUnit(ctx.view) }, 'pbl-rel-unit-fix');
		}
		return;
	}
	// **The EXACT commitment, and it is the only null this branch asks about.** It is null in
	// exactly the two states `estimatedEffort.value` is — no estimate key, or a total no double
	// can hold — so reading the figure's own null beside it would be a second opinion about one
	// fact. What the exact one buys is the comparison below: the sum `[1e21, 1]` rounds to
	// `1e21` as a double, so a release one over its capacity subtracted to zero when the
	// rounding happened in `domain/` before this got to subtract.
	const exact = readiness.estimatedEffortExact;
	// **A readable capacity is drawn even with nothing to compare it against.** This
	// function's own rule two branches up is that the capacity half is named whatever the
	// other half does — and a VALID capacity has no state note, so returning here showed
	// nothing at all for a release whose capacity is perfectly readable and whose estimate
	// key happens to be unbound. Naming the number is what "the missing half is named"
	// means from this side.
	const alone = (): void => {
		// PRECISE: a capacity is typed into the release note by hand — nothing in this plugin
		// writes one, which is why extension 1b judges it on read — so it is exactly the shape
		// `formatNumber`'s own doc names as wrong for the default three-fraction-digit cap.
		if (capacity.value !== null) figure(sumEl, t('release.scope.capacityAlone', { capacity: formatNumber(capacity.value, true), unit }));
	};
	// The effort figures beside this one already said why there is no total.
	if (exact === null) {
		alone();
		return;
	}
	// The figure's own `value` is this same decimal rounded, so the two cannot disagree about
	// what is drawn — and only this one is subtracted from.
	const commitment = toNumber(exact);
	// **A release nobody has estimated sums to zero, and that zero is not a measurement.**
	// `effortFigures` starts its total at 0 and adds nothing, so `estimatedEffort` is a real
	// `0` rather than a null — which would draw `0 of 40 pts committed (0%, 40 left)` and
	// report a completely unsized release as having its whole capacity free. Decided from
	// the COUNT of estimated members, never from the sum, for the reason `drawEffortFigures`
	// states one function above: `0` is a valid estimate, so a release whose members all
	// estimate zero is a genuine zero commitment and still compares.
	if (estimatedMembers === 0) {
		alone();
		return;
	}
	// PRECISE from here on: the commitment is a sum of estimates someone TYPED, and the
	// capacity is a value someone typed directly — neither is a count this plugin computed,
	// so both go through the formatter that does not round a fraction away. `over`/`left` are
	// the same two typed values subtracted, not a separate measurement, and carry the same
	// treatment; `pct` stays plain, since it is computed and already rounded to an integer.
	if (capacity.value === null) {
		figure(sumEl, t('release.scope.committed', { commitment: formatNumber(commitment, true), unit }));
		return;
	}
	// **Subtracted EXACTLY, never with `-`** (`domain/decimal.ts`). Both operands are decimals
	// somebody typed — the capacity directly, the commitment as the exact sum of the estimates
	// — and the bare operator loses that in its own right: `52.1 - 40` is `12.100000000000001`,
	// which the precise formatter this figure uses prints in full. An exact sum upstream is
	// therefore not enough on its own, and neither half can be dropped for the other. There is
	// no tolerance and no INTERMEDIATE rounding any more — the difference is taken in decimal
	// and rounded to a double once, at the end — and that is the point: a tolerance and a
	// twelve-digit rounding were both tried, and each was wrong about a difference the other
	// got right, a `1e-16` shortfall zeroed as noise and `1000000000001` over rounded to
	// `1000000000000`.
	const over = exactDifference(exact, capacity.value);
	if (capacity.value === 0) {
		figure(
			sumEl,
			t('release.scope.capacityNoPct', {
				commitment: formatNumber(commitment, true),
				capacity: formatNumber(capacity.value, true),
				unit,
				over: formatNumber(over, true),
			}),
		);
		note(sumEl, t('release.scope.capacityZero'));
		return;
	}
	// **Divide BEFORE multiplying, and check the result** — `drawEffort`'s own reason, plus
	// one this figure adds: a capacity below 1 with a huge commitment overflows the ratio
	// itself, and `∞%` is a percentage nobody can act on.
	const pct = Math.round(100 * (commitment / capacity.value));
	if (!Number.isFinite(pct)) {
		// The capacity IS a number and IS positive — it is the ratio that overflowed — so
		// this is not `capacityUnreadable`, which would send the reader to fix a value that
		// is fine. Same three figures as the zero case, a different reason for the fourth.
		figure(
			sumEl,
			t('release.scope.capacityNoPct', {
				commitment: formatNumber(commitment, true),
				capacity: formatNumber(capacity.value, true),
				unit,
				over: formatNumber(over, true),
			}),
		);
		note(sumEl, t('release.scope.capacityPctOverflow'));
		return;
	}
	// **The bar is the comparison; the sentence is the numbers.** Eight sibling spans of
	// jargon is what this replaced, and the reason is that a ratio is the one thing a reader
	// takes in without reading — the summary strip's own progress bar, one line up, making
	// the identical trade.
	//
	// **The arithmetic does not move.** `over` is still `exactDifference` over the exact
	// commitment, `pct` is still divided before it is multiplied, and both were decided
	// above: this branch draws them and derives nothing.
	const barEl = sumEl.createDiv({ cls: 'pbl-rel-cap' + (over > 0 ? ' pbl-rel-cap-over' : '') });
	// CLAMPED, because a bar wider than its track is a layout bug rather than a reading: past
	// 100% the number beside it is what says how far over, and the class is what says that at
	// a glance.
	barEl.createDiv({ cls: 'pbl-rel-cap-fill' }).setCssProps({ '--pbl-rel-cap': `${Math.min(100, pct)}%` });
	figure(
		sumEl,
		over >= 0
			? t('release.scope.capacityOver', {
					commitment: formatNumber(commitment, true),
					capacity: formatNumber(capacity.value, true),
					unit,
					pct,
					over: formatNumber(over, true),
				})
			: t('release.scope.capacityUnder', {
					commitment: formatNumber(commitment, true),
					capacity: formatNumber(capacity.value, true),
					unit,
					pct,
					left: formatNumber(-over, true),
				}),
	);
}

/** Absent rather than present and empty — extension 4a. */
function drawDoubleCount(sumEl: HTMLElement, readiness: ReleaseReadiness): void {
	const count = readiness.doubleCounted.value;
	if (count === null || count === 0) return;
	figure(sumEl, t('release.scope.doubleCount', { count }));
}

function figure(sumEl: HTMLElement, text: string): void {
	sumEl.createSpan({ cls: 'pbl-rel-figure', text });
}

function note(sumEl: HTMLElement, text: string): void {
	sumEl.createSpan({ cls: 'pbl-rel-unreadable', text });
}
