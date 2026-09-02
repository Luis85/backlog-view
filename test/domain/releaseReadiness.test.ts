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
