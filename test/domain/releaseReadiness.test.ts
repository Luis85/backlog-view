import { describe, expect, it } from 'vitest';
import { estimateValue, isEstimated, releaseReadiness } from '../../src/domain/releaseReadiness';
import { buildModel } from '../../src/domain/model';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { CivilDate } from '../../src/domain/noteFields';
import { FakeVault } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';

/** This suite is not about `today`, so a fixed value stands in for it. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

function readinessOf(
	vault: FakeVault,
	path: string,
	overrides: Partial<Parameters<typeof releaseSettingsWith>[0]> = {},
	planOverrides: {
		stateKey?: string;
		dependsOnKey?: string;
		doneValues?: string[];
		deliverableStateKey?: string;
	} = {},
) {
	const plan = settingsWith({ stateKey: 'status', doneValues: ['Done'], ...planOverrides });
	const settings = releaseSettingsWith({
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		membershipKey: 'release',
		...overrides,
	});
	// `plan.dependsOnKey` is what `readItems` reads the edges with, and in the real view it
	// comes from this view's OWN `dependsOnProperty` through `resolveSettings` — so the
	// fixture binds it here the same way rather than leaving `item.prerequisites` empty.
	const model = buildModel(vault.app, vault.entries(), plan);
	const index = releaseIndex(vault.app, model, settings, { stateKey: plan.stateKey, today: TODAY });
	const scope = releaseScope(vault.app, model, settings, index, path);
	return releaseReadiness(vault.app, scope, settings, plan);
}

/** Three members: 6 done, 9 not done, and one carrying no estimate at all. */
function effortVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', effort: 6, status: 'Done' },
	});
	vault.addFile('M2.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', effort: 9, status: 'Doing' },
	});
	vault.addFile('M3.md', { frontmatter: { type: 'PBI', parent: 'E', order: 3, release: '[[R]]' } });
	return vault;
}

/** The same three members, under an Epic that is NOT in the release and carries an estimate
 *  of its own. It is scaffolding: it must reach no sum and no count. */
function contextEffortVault(): FakeVault {
	const vault = effortVault();
	vault.addFile('E.md', { frontmatter: { type: 'Epic', effort: 100, status: 'Done' } });
	return vault;
}

/** One member estimated `6`, one carrying the placeholder `'5 TBD'`. */
function placeholderEffortVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', effort: 6, status: 'Done' },
	});
	vault.addFile('M2.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', effort: '5 TBD', status: 'Doing' },
	});
	return vault;
}

/**
 * Two estimated `Deliverable`s reading a bound `dstatus`, plus an UNESTIMATED `PBI` whose
 * own workflow — the requirements one — has no key bound at all: the member whose unreadable
 * workflow must not withhold a figure it contributes nothing to.
 *
 * The two kinds are this way round on purpose. `resolvedDeliverableStateKey` FALLS BACK to
 * `stateKey`, so "a vault binding no `deliverableStateProperty`" is not an unreadable
 * workflow — it is the requirements one under another name, and a fixture built that way
 * passes with the invariant broken. Only the requirements kind can be made unreadable, so it
 * is the unestimated member here and the deliverable one carries the estimates.
 */
function mixedWorkflowVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('D1.md', {
		frontmatter: { type: 'Deliverable', parent: 'E', order: 1, release: '[[R]]', effort: 6, dstatus: 'Done' },
	});
	vault.addFile('D2.md', {
		frontmatter: { type: 'Deliverable', parent: 'E', order: 2, release: '[[R]]', effort: 9, dstatus: 'Doing' },
	});
	vault.addFile('M3.md', { frontmatter: { type: 'PBI', parent: 'E', order: 3, release: '[[R]]' } });
	return vault;
}

/** A release nobody has filled. Not a release that is done. */
function emptyReleaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	return vault;
}

describe('the estimate predicate', () => {
	// A placeholder wearing a value is the missing estimate, whatever it says. This is the
	// same predicate `A definition of ready` will read, which is why it is exported rather
	// than inlined: two copies is how they come to disagree.
	it('clears on a finite number and on nothing else', () => {
		expect(isEstimated(5)).toBe(true);
		expect(isEstimated(0)).toBe(true);
		expect(isEstimated(2.5)).toBe(true);
		expect(isEstimated('TBD')).toBe(false);
		// A numeric PREFIX is a placeholder, not an estimate. `noteFields.ts`'s shared
		// `readNumber` parses both of these to a number, which is why this predicate does
		// not use it — the two spellings a placeholder actually turns up in.
		expect(isEstimated('5 TBD')).toBe(false);
		expect(isEstimated('8 points')).toBe(false);
		// A quoted numeric scalar is still an estimate: somebody typed a number as a string.
		expect(isEstimated('5')).toBe(true);
		expect(isEstimated('  7  ')).toBe(true);
		// A negative effort is not an estimate: it lets totals CANCEL, which produced
		// `5 of 0 pts (0%)`. `Capacity against commitment` refuses a negative capacity for
		// the same reason — no unit here can be less than none.
		expect(isEstimated(-1)).toBe(false);
		expect(isEstimated('-3')).toBe(false);
		expect(isEstimated('')).toBe(false);
		expect(isEstimated(null)).toBe(false);
		expect(isEstimated(undefined)).toBe(false);
		expect(isEstimated(NaN)).toBe(false);
		expect(isEstimated(Infinity)).toBe(false);
		expect(isEstimated(-Infinity)).toBe(false);
		expect(isEstimated({})).toBe(false);
		expect(isEstimated([])).toBe(false);
	});

	// The reader the sums add, asserted beside the predicate that gates them: one is the
	// other's `!== null`, so a value the predicate clears and the reader returns differently
	// is the drift the pairing exists to prevent.
	it('returns the number the sums will add, and null wherever the predicate refuses', () => {
		expect(estimateValue(5)).toBe(5);
		expect(estimateValue('  7  ')).toBe(7);
		expect(estimateValue(0)).toBe(0);
		expect(estimateValue('5 TBD')).toBeNull();
		expect(estimateValue(-1)).toBeNull();
	});
});

describe('the effort figures', () => {
	it('sums each member once, and counts the unestimated separately', () => {
		// Three members: 6 (done), 9 (not done), and one with no estimate at all.
		const readiness = readinessOf(effortVault(), 'R.md', { estimateKey: 'effort' });
		expect(readiness.estimatedEffort).toEqual({ value: 15, invalid: false, unconfigured: false });
		expect(readiness.completedEffort).toEqual({ value: 6, invalid: false, unconfigured: false });
		expect(readiness.unestimated).toEqual({ value: 1, invalid: false, unconfigured: false });
	});

	it('reports every estimate figure as unconfigured, never zero, with no key bound', () => {
		const readiness = readinessOf(effortVault(), 'R.md', {});
		for (const figure of [readiness.estimatedEffort, readiness.completedEffort, readiness.unestimated]) {
			expect(figure).toEqual({ value: null, invalid: false, unconfigured: true });
		}
		// The count reads the same key as the sums: a screen showing "2 unestimated" beside
		// "effort: not configured" contradicts itself, which is what the harness mock caught.
		expect(readiness.criteria.find((c) => c.key === 'estimated')?.verdict).toBe('unconfigured');
	});

	it('reports completed effort as unconfigured when no workflow can say done', () => {
		// The estimated total and the unestimated count read the estimate key alone and still
		// answer. The COMPLETED total needs a workflow, and without one every member reads as
		// not done — a zero that looks measured and is not.
		//
		// An UNBOUND state key, not an emptied `doneValues`: `settingsWith` re-derives the
		// resolver's own "neither done list is ever empty" rule, so `doneValues: []` comes
		// back as the default and models a vault nobody could configure. This is the half of
		// `workflowClears`'s guard a fixture can reach — see `test/helpers/settings.ts`.
		const readiness = readinessOf(effortVault(), 'R.md', { estimateKey: 'effort' }, { stateKey: '' });
		expect(readiness.estimatedEffort).toEqual({ value: 15, invalid: false, unconfigured: false });
		expect(readiness.unestimated).toEqual({ value: 1, invalid: false, unconfigured: false });
		expect(readiness.completedEffort).toEqual({ value: null, invalid: false, unconfigured: true });
	});

	it('still measures completed effort when only an UNESTIMATED member has no workflow', () => {
		// That member reaches neither total, so its unknown done state cannot change either
		// one — withholding a fully computable figure over it would hide a real answer.
		const readiness = readinessOf(
			mixedWorkflowVault(),
			'R.md',
			{ estimateKey: 'effort' },
			{ stateKey: '', deliverableStateKey: 'dstatus' },
		);
		expect(readiness.estimatedEffort).toEqual({ value: 15, invalid: false, unconfigured: false });
		expect(readiness.completedEffort).toEqual({ value: 6, invalid: false, unconfigured: false });
	});

	it('does not sum a placeholder wearing a number', () => {
		// `effort: '5 TBD'` is unestimated, so it joins the count and reaches neither sum —
		// the criterion and the total reading one predicate rather than two.
		const readiness = readinessOf(placeholderEffortVault(), 'R.md', { estimateKey: 'effort' });
		expect(readiness.estimatedEffort.value).toBe(6);
		expect(readiness.unestimated.value).toBe(1);
	});

	it('counts no context ancestor in any figure', () => {
		// The same vault with an Epic above the members that is NOT in the release. It
		// carries an estimate, and it must reach no sum and no count.
		const withContext = readinessOf(contextEffortVault(), 'R.md', { estimateKey: 'effort' });
		const without = readinessOf(effortVault(), 'R.md', { estimateKey: 'effort' });
		expect(withContext.estimatedEffort).toEqual(without.estimatedEffort);
		expect(withContext.completedEffort).toEqual(without.completedEffort);
		expect(withContext.unestimated).toEqual(without.unestimated);
	});

	it('says an empty release has nothing to check rather than that it is satisfied', () => {
		const readiness = readinessOf(emptyReleaseVault(), 'R.md', { estimateKey: 'effort' });
		expect(readiness.criteria.find((c) => c.key === 'estimated')?.verdict).toBe('empty');
	});
});

/**
 * Two members, and the prerequisites they name are deliberately NOT in the release: the
 * criterion counts MEMBERS, so a prerequisite that is also a member would answer for
 * itself as well and blur which number came from where.
 *
 * `M1` waits on three unfinished notes — one blocked member, not three — and `M2` waits on
 * one that is done.
 */
function blockedVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	for (const name of ['P1', 'P2', 'P3']) {
		vault.addFile(`${name}.md`, { frontmatter: { type: 'PBI', parent: 'E', order: 1, status: 'Doing' } });
	}
	vault.addFile('P4.md', { frontmatter: { type: 'PBI', parent: 'E', order: 2, status: 'Done' } });
	vault.addFile('M1.md', {
		frontmatter: {
			type: 'PBI',
			parent: 'E',
			order: 3,
			release: '[[R]]',
			status: 'Doing',
			dependsOn: ['[[P1]]', '[[P2]]', '[[P3]]'],
		},
	});
	vault.addFile('M2.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 4, release: '[[R]]', status: 'Doing', dependsOn: '[[P4]]' },
	});
	return vault;
}

/** Two members carrying no `dependsOn` key at all — a release of independent work. */
function independentVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', status: 'Doing' },
	});
	vault.addFile('M2.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', status: 'Done' },
	});
	return vault;
}

/** One member whose `dependsOn` names a note the model does not hold. */
function unreadablePrereqVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', status: 'Doing', dependsOn: '[[Gone]]' },
	});
	return vault;
}

/**
 * A member whose prerequisite belongs to a workflow this vault never configured.
 *
 * The KINDS are the other way round from the task's sketch, and for the reason
 * `mixedWorkflowVault` above already states: `resolvedDeliverableStateKey` FALLS BACK to
 * `stateKey`, so "a vault that never configured the Deliverable workflow" is not an
 * unreadable workflow — it is the requirements one under another name. Only the
 * requirements kind can be made unreadable, so the PREREQUISITE is the PBI here and the
 * member is the Deliverable. The branch is the same one: a prerequisite whose own workflow
 * cannot say done is unreadable, not unfinished.
 *
 * `P1` is done under the key nothing reads, so a criterion asking the wrong workflow would
 * call the member cleared.
 */
function deliverablePrereqVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('P1.md', { frontmatter: { type: 'PBI', parent: 'E', order: 1, status: 'Done' } });
	vault.addFile('D1.md', {
		frontmatter: {
			type: 'Deliverable',
			parent: 'E',
			order: 2,
			release: '[[R]]',
			dstatus: 'Doing',
			dependsOn: '[[P1]]',
		},
	});
	return vault;
}

/**
 * Three members whose dependencies are malformed and whose targets are all DONE: one
 * naming itself, and two naming each other. `resolveDependencies` puts every one of those
 * entries in `brokenPrerequisites`, so all three are unreadable — a criterion re-reading
 * the raw links would resolve each target happily, find it done, and report the release
 * as clear on exactly the items whose dependencies are broken.
 */
function selfAndCycleVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('S.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', status: 'Done', dependsOn: '[[S]]' },
	});
	vault.addFile('C1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', status: 'Done', dependsOn: '[[C2]]' },
	});
	vault.addFile('C2.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 3, release: '[[R]]', status: 'Done', dependsOn: '[[C1]]' },
	});
	return vault;
}

/**
 * The edge key bound on BOTH bags: the release settings decide whether the criterion is
 * configured, and the plan settings are what `readItems` reads the entries with.
 */
function blockedReadiness(vault: FakeVault) {
	return readinessOf(vault, 'R.md', { dependsOnKey: 'dependsOn' }, { dependsOnKey: 'dependsOn' });
}

describe('the blocked predicate', () => {
	it('counts a member with three unmet prerequisites once, not three times', () => {
		const readiness = blockedReadiness(blockedVault());
		expect(readiness.blocked).toEqual({ value: 1, invalid: false, unconfigured: false });
	});

	it('treats no edges as resolved', () => {
		// An empty edge list is REMOVED rather than stored, so an item that waits for
		// nothing has no value where this criterion looks. The blanket "unreadable is not
		// cleared" rule would leave a release full of independent work unable to satisfy
		// this criterion at all — which is the readiness note's own stated exception.
		const readiness = blockedReadiness(independentVault());
		expect(readiness.blocked).toEqual({ value: 0, invalid: false, unconfigured: false });
		expect(readiness.criteria.find((c) => c.key === 'blocked')?.verdict).toBe('satisfied');
	});

	it('counts a prerequisite it cannot read as outstanding, and reports it separately', () => {
		// A prerequisite outside the base, or a broken link: the wait cannot be shown to be
		// over, so the member does not clear — and 5a wants the number said out loud rather
		// than folded into the others.
		const criterion = blockedReadiness(unreadablePrereqVault()).criteria.find((c) => c.key === 'blocked');
		expect(criterion?.outstanding).toBe(1);
		expect(criterion?.unreadable).toBe(1);
	});

	it('is unconfigured, never zero, with no edge key', () => {
		expect(readinessOf(blockedVault(), 'R.md', {}).blocked).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
		// Without this guard every member reads as having no prerequisites, so an unbound
		// edge key would report every release as satisfied rather than as unconfigured.
		// An edge says what a thing waits for and nothing about whether the wait is over,
		// so with no state key bound this criterion is exactly as unconfigured as one with
		// no property at all.
		const noState = readinessOf(
			blockedVault(),
			'R.md',
			{ dependsOnKey: 'dependsOn' },
			{ stateKey: '', dependsOnKey: 'dependsOn' },
		);
		expect(noState.blocked.unconfigured).toBe(true);
		// The OTHER half of that guard — a key bound and nothing clearing it — has no fixture
		// here, and `test/helpers/settings.ts` is why: `settingsWith` re-derives the
		// resolver's own "neither done list is ever empty" rule, so `doneValues: []` comes
		// back as the default. Asserted with a bound key and an emptied list, this test fails
		// on a vault nobody could configure rather than on the guard. The guard stays: it
		// reads `workflowClears`, whose two halves are one question, and the effort figures
		// above record the identical gap.
	});

	it('counts a prerequisite in a workflow nothing configured as unreadable', () => {
		// A prerequisite whose own workflow cannot say done is unreadable, not unfinished —
		// the same distinction, one workflow along. Only the requirements workflow can be
		// left unreadable while another still clears, so it is the PREREQUISITE's here.
		const criterion = readinessOf(
			deliverablePrereqVault(),
			'R.md',
			{ dependsOnKey: 'dependsOn' },
			{ stateKey: '', deliverableStateKey: 'dstatus', dependsOnKey: 'dependsOn' },
		).criteria.find((c) => c.key === 'blocked');
		expect(criterion?.unreadable).toBe(1);
		expect(criterion?.cleared).toBe(0);
	});

	it('counts a self-reference and a cycle as unreadable, never as cleared by a done target', () => {
		// `resolveDependencies` puts both in `brokenPrerequisites` on purpose. Re-reading the
		// raw links here would resolve a self-reference happily and then call the member
		// cleared because the target it found is done — a release reporting nothing
		// outstanding on exactly the items whose dependencies are malformed. Three members,
		// three broken lists: the self-namer, and BOTH ends of the cycle.
		const criterion = blockedReadiness(selfAndCycleVault()).criteria.find((c) => c.key === 'blocked');
		expect(criterion?.unreadable).toBe(3);
		expect(criterion?.cleared).toBe(0);
	});
});

/** One member carrying three risk values, one of them critical and unaddressed. */
function multiRiskVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', risk: ['Low', 'High', 'Medium'] },
	});
	return vault;
}

/** One member at `Low`, one carrying no risk key at all. Neither is an outstanding
 *  CRITICAL risk, so both clear. */
function lowAndBlankRiskVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', { frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', risk: 'Low' } });
	vault.addFile('M2.md', { frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]' } });
	return vault;
}

/** `Critical` and `Mitigated` in the ONE list — a member carrying several values is
 *  exactly the case the counted-once assertion is about. */
function addressedRiskVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', risk: ['Critical', 'Mitigated'] },
	});
	return vault;
}

/** A member whose risk property holds a value no reader can interpret. */
function malformedRiskVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', risk: { level: 'Critical' } },
	});
	return vault;
}

/** A PARTLY readable list: the `Low` survives, the object does not. */
function mixedRiskVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('R.md', { frontmatter: { type: 'Release', version: '1.0.0' } });
	vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
	vault.addFile('M1.md', {
		frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', risk: ['Low', { level: 'Critical' }] },
	});
	return vault;
}

/** The members of `multiRiskVault`, under a `Critical` Epic that is NOT in the release. */
function contextRiskVault(): FakeVault {
	const vault = multiRiskVault();
	vault.addFile('E.md', { frontmatter: { type: 'Epic', risk: 'Critical' } });
	return vault;
}

describe('the critical risk predicate', () => {
	const RISK = { riskKey: 'risk', criticalRiskValues: ['High', 'Critical'], addressedRiskValues: ['Mitigated'] };

	it('counts a member with three risk values at most once', () => {
		const readiness = readinessOf(multiRiskVault(), 'R.md', RISK);
		expect(readiness.criticalRisks).toEqual({ value: 1, invalid: false, unconfigured: false });
	});

	it('clears on a non-critical value AND on no value at all', () => {
		// Absence is an answer here, and this is the exception most likely to be got
		// backwards. The criterion asks whether CRITICAL risks are addressed: a `Low` is not
		// an outstanding critical risk, and neither is a missing value. Reading it as
		// "addressed or nothing" fails a release for every ordinary low and medium risk in
		// it, and demands a synthetic value on risk-free items besides.
		const readiness = readinessOf(lowAndBlankRiskVault(), 'R.md', RISK);
		expect(readiness.criticalRisks).toEqual({ value: 0, invalid: false, unconfigured: false });
		expect(readiness.criteria.find((c) => c.key === 'risk')?.verdict).toBe('satisfied');
	});

	it('clears a critical value that is addressed', () => {
		const readiness = readinessOf(addressedRiskVault(), 'R.md', RISK);
		expect(readiness.criticalRisks.value).toBe(0);
	});

	it('is unconfigured with no key, and unconfigured with a key but an empty vocabulary', () => {
		// A key is half of a criterion; the other half is which values clear it. A key bound
		// with no value list is unconfigured, not empty — the same answer as no key at all,
		// and for the same reason.
		expect(readinessOf(multiRiskVault(), 'R.md', {}).criticalRisks.unconfigured).toBe(true);
		expect(readinessOf(multiRiskVault(), 'R.md', { riskKey: 'risk' }).criticalRisks.unconfigured).toBe(true);
		// BOTH lists, in both directions: this criterion reads two vocabularies, and either
		// one missing leaves it unable to answer. With no way to say a risk has been dealt
		// with, "3 of 3 outstanding" is an unfinished configuration reported as a finding
		// about the release.
		expect(
			readinessOf(multiRiskVault(), 'R.md', { riskKey: 'risk', criticalRiskValues: ['High'] })
				.criticalRisks.unconfigured,
		).toBe(true);
		expect(
			readinessOf(multiRiskVault(), 'R.md', { riskKey: 'risk', addressedRiskValues: ['Mitigated'] })
				.criticalRisks.unconfigured,
		).toBe(true);
	});

	it('counts a malformed risk value as unreadable, never as absent', () => {
		// Absence clears this criterion; a value the reader cannot interpret must not. A
		// filter that dropped unreadable entries left an empty list indistinguishable from
		// no list, so malformed critical-risk data made a release look ready.
		const criterion = readinessOf(malformedRiskVault(), 'R.md', RISK).criteria.find((c) => c.key === 'risk');
		expect(criterion?.unreadable).toBe(1);
		expect(criterion?.outstanding).toBe(1);
	});

	it('counts a PARTLY readable risk list as unreadable', () => {
		// `['Low', { level: 'Critical' }]` keeps its `Low`, so counting only the survivors
		// clears the member on the strength of the half of the list that happened to parse —
		// while the entry nobody could read might be the unaddressed critical risk.
		const criterion = readinessOf(mixedRiskVault(), 'R.md', RISK).criteria.find((c) => c.key === 'risk');
		expect(criterion?.unreadable).toBe(1);
		expect(criterion?.cleared).toBe(0);
	});

	it('counts no context ancestor, whatever risk it carries', () => {
		const withContext = readinessOf(contextRiskVault(), 'R.md', RISK);
		expect(withContext.criticalRisks).toEqual(readinessOf(multiRiskVault(), 'R.md', RISK).criticalRisks);
	});

	it('refuses a total that overflowed, rather than drawing an infinite one', () => {
		// Every estimate here is individually finite, so `estimateValue` accepts each one —
		// and their SUM is not. `Infinity` reaches the strip as an infinite total and a `NaN`
		// percentage, which is the "a figure that looks measured and is not" defect this
		// module exists to prevent, arriving through the one door the per-value reader cannot
		// close. Raised by a review bot.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 1, release: '[[R]]', effort: 1e308 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 2, release: '[[R]]', effort: 1e308 } });
		const readiness = readinessOf(vault, 'R.md', { estimateKey: 'effort' });
		expect(readiness.estimatedEffort.invalid).toBe(true);
		expect(readiness.estimatedEffort.value).toBeNull();
		expect(readiness.completedEffort.invalid).toBe(true);
		// The COUNT of unestimated members is still readable: nothing overflowed there.
		expect(readiness.unestimated.value).toBe(0);
	});

	it('counts a prerequisite value it cannot read as unreadable, never as cleared', () => {
		// `readLinkList` drops a non-string entry SILENTLY, so a malformed `dependsOn` leaves
		// both `prerequisites` and `brokenPrerequisites` empty — indistinguishable, to this
		// criterion, from a member that declares no dependencies at all. "No edges is
		// resolved" then reports a member whose dependency data is garbage as CLEARED, which
		// is the criterion promising a verdict it could not compute. Raised by a review bot.
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Good.md', { frontmatter: { type: 'PBI', order: 1, release: '[[R]]' } });
		vault.addFile('Bad.md', { frontmatter: { type: 'PBI', order: 2, release: '[[R]]', dependsOn: 123 } });
		// A list whose readable half alone would clear it — the harder case, and the same
		// rule the risk criterion keeps for a partly readable list.
		vault.addFile('Half.md', {
			frontmatter: { type: 'PBI', order: 3, release: '[[R]]', dependsOn: ['[[Good]]', { note: 'x' }] },
		});
		const criterion = blockedReadiness(vault).criteria.find((c) => c.key === 'blocked');
		expect(criterion?.unreadable).toBe(2);
		// `Good.md` declares nothing and still clears: absence is not malformation.
		expect(criterion?.cleared).toBe(1);
		expect(criterion?.outstanding).toBe(2);
	});
});
