import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { ReleaseCriterion, ReleaseReadiness } from '../../domain/releaseReadiness';

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

export function drawReadiness(headerEl: HTMLElement, readiness: ReleaseReadiness): void {
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
	for (const criterion of readiness.criteria) drawChip(rowEl, criterion);
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

function drawChip(rowEl: HTMLElement, criterion: ReleaseCriterion): void {
	const name = CRITERION_NAME[criterion.key]();
	const chipEl = rowEl.createDiv({
		cls: `pbl-state-chip pbl-state-static pbl-rel-crit pbl-rel-crit-${verdictClass(criterion.verdict)}`,
		text: chipText(criterion, name),
	});
	chipEl.dataset.criterion = criterion.key;
	setTooltip(chipEl, name);
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

/**
 * The three figures joining the existing summary strip. The estimate progress is ONE figure
 * with its denominator named inside it (`9 of 15 pts (60%)`) rather than a sum and a second
 * percentage: two percentages beside the items bar read as competing and wrap the strip.
 *
 * All three read the same key, so all three are absent together — the count included. A
 * `2 unestimated` beside `Effort is not configured` contradicts itself.
 */
export function drawReadinessFigures(sumEl: HTMLElement, readiness: ReleaseReadiness): void {
	const total = readiness.estimatedEffort.value;
	const done = readiness.completedEffort.value;
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
	if (estimatedMembers > 0) drawEffort(sumEl, total, done);
	if (readiness.unestimated.value !== null) {
		sumEl.createSpan({
			cls: 'pbl-rel-figure',
			text: t('release.scope.unestimated', { count: readiness.unestimated.value }),
		});
	}
}

function drawEffort(sumEl: HTMLElement, total: number, done: number | null): void {
	// `done === null` is the estimate key bound with no workflow that can say done: there is
	// a real total and no progress through it, so the total is stated alone rather than
	// against a zero that would read as measured.
	if (done === null) {
		sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.effortEstimated', { total }) });
		return;
	}
	// A real total of zero has no percentage to compute, and dividing by it produces the
	// `NaN` that would be drawn as one. Zero is the only case left: negative estimates are
	// refused at the reader, so `0 <= done <= total` holds and the percentage cannot come out
	// negative or above 100.
	const pct = total === 0 ? 0 : Math.round((100 * done) / total);
	sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.effort', { done, total, pct }) });
}
