import { setTooltip } from 'obsidian';
import { formatNumber, t } from '../../i18n/t';
import { ReleaseCriterion, ReleaseReadiness, clearingWorkflows } from '../../domain/releaseReadiness';
import { WorkflowKind } from '../../domain/board';
import { ReleaseSettings } from '../../domain/releaseOptions';
import { BacklogSettings } from '../../domain/settings';

/**
 * The readiness chip row, and the figures that join the summary strip beside the bar
 * (`docs/requirements/Release readiness.md`).
 *
 * A second module rather than more of `renderScope.ts`, which is already the largest file in
 * this directory: this draws a different thing from a different model, and the 400-line cap
 * is a gate rather than a preference.
 *
 * **Nothing is derived here.** Every number and every verdict comes from
 * `domain/releaseReadiness.ts`, which computed them in one walk — a count written beside the
 * chip that reported it would be a second opinion about a number with one right answer,
 * which is the defect `Summing up a release` exists to prevent.
 */

/** Each criterion's own name, read into the chip AND the collapsed row's hidden list. */
const CRITERION_NAME: Record<ReleaseCriterion['key'], () => string> = {
	estimated: () => t('release.scope.readinessEstimated'),
	blocked: () => t('release.scope.readinessBlocked'),
	risk: () => t('release.scope.readinessRisk'),
};

export function drawReadiness(
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
	if (unconfigured.length === readiness.criteria.length) {
		drawCollapsed(rowEl, unconfigured);
		return;
	}
	for (const criterion of readiness.criteria) drawChip(rowEl, criterion, settings, planSettings);
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
 */
function drawChip(
	rowEl: HTMLElement,
	criterion: ReleaseCriterion,
	settings: ReleaseSettings,
	planSettings: BacklogSettings,
): void {
	const name = CRITERION_NAME[criterion.key]();
	const chipEl = rowEl.createDiv({
		cls: `pbl-state-chip pbl-state-static pbl-rel-crit pbl-rel-crit-${verdictClass(criterion.verdict)}`,
		text: chipText(criterion, name),
	});
	chipEl.dataset.criterion = criterion.key;
	const provenance = criterion.verdict === 'unconfigured' ? '' : criterionProvenance(criterion.key, settings, planSettings);
	setTooltip(chipEl, provenance === '' ? name : `${name}. ${provenance}`);
	// The verdict first, then what produced it. Only `satisfied` needs saying: every other
	// verdict is already in the chip's own visible text, and repeating it here would have a
	// screen reader read it twice.
	const spoken = satisfiedText(criterion, name);
	if (spoken !== '') chipEl.createSpan({ cls: 'pbl-sr-only', text: spoken });
	if (provenance !== '') chipEl.createSpan({ cls: 'pbl-sr-only', text: provenance });
}

/**
 * One sentence per criterion, because the three do not read the same SHAPE of input — see
 * the catalog entries' own comment. The property is spelled as the frontmatter KEY rather
 * than the config's `note.`-prefixed id, since a reader who acts on this goes and edits
 * frontmatter.
 */
/** A workflow kind's own translated name. All THREE, unlike `renderScope.ts`'s pair: a
 *  catalog note cannot be a release member, but it can be a member's prerequisite. */
function workflowName(kind: WorkflowKind): string {
	if (kind === 'deliverable') return t('release.scope.workflowDeliverables');
	if (kind === 'test') return t('release.scope.workflowTests');
	return t('release.scope.workflowRequirements');
}

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
 *  second, so it cannot be forgotten on one of the first's three exits. */
export function drawReadinessFigures(
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
): void {
	drawEffortFigures(sumEl, readiness, settings);
	drawCapacity(sumEl, readiness, settings);
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
		// The estimate key itself is unbound, so none of the three figures answers.
		sumEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.scope.effortUnconfigured') });
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
function drawCapacity(sumEl: HTMLElement, readiness: ReleaseReadiness, settings: ReleaseSettings): void {
	// The SAME count `drawEffortFigures` reads, computed once and passed to both, so the two
	// can never disagree about whether this release has been estimated at all.
	const estimatedMembers = readiness.criteria.find((criterion) => criterion.key === 'estimated')?.cleared ?? 0;
	drawCapacityFigures(sumEl, readiness, settings, estimatedMembers);
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
	sumEl: HTMLElement,
	readiness: ReleaseReadiness,
	settings: ReleaseSettings,
	estimatedMembers: number,
): void {
	const capacity = readiness.capacity;
	// The capacity's own state is named even with no commitment to compare it against —
	// extension 2b's "both halves are named" — but a comparison needs both numbers.
	if (capacity.unconfigured) note(sumEl, t('release.scope.capacityUnconfigured'));
	else if (capacity.invalid) note(sumEl, t('release.scope.capacityUnreadable'));
	else if (capacity.value === null) note(sumEl, t('release.scope.capacityAbsent'));
	// **The unit is checked BEFORE the commitment, and that order is the requirement.**
	// Extension 3a makes an unset unit a missing MAPPING, reported like an unbound key — so
	// it is reported whether or not there is a commitment to label. Behind the commitment
	// return it went unreported exactly when the effort sum was itself unreadable, which is
	// a reader with two unbound mappings being told about one.
	const unit = settings.capacityUnit;
	if (unit === '') {
		note(sumEl, t('release.scope.capacityNoUnit'));
		return;
	}
	const commitment = readiness.estimatedEffort.value;
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
	if (commitment === null) {
		alone();
		return;
	}
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
	const over = commitment - capacity.value;
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
