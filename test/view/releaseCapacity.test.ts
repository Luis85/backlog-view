// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../helpers/release';
import { useViewHarness } from '../helpers/view';
import { formatNumber, t } from '../../src/i18n/t';
import { FakeVault } from '../helpers/vault';

/**
 * The capacity comparison on the summary strip. Asserted by MESSAGE KEY rather than by
 * wording — `docs/requirements/Tests do not read English.md` — so a copy edit is not a red
 * build and the second CI locale leg is not asserting English.
 */
describe('capacity against commitment on the strip', () => {
	useViewHarness();

	function capacityVault(capacity: unknown): FakeVault {
		const vault = scopeVault();
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 52 });
		if (capacity !== undefined) vault.setFrontmatter('R.md', { type: 'Release', capacity });
		return vault;
	}

	const CONFIGURED = {
		...RELEASE_CONFIG,
		estimateProperty: 'note.effort',
		capacityProperty: 'note.capacity',
		capacityUnit: 'pts',
	};

	function stripText(capacity: unknown, config: Record<string, unknown> = CONFIGURED): string {
		const { view, containerEl } = makeReleaseView(capacityVault(capacity), config);
		view.pick('R.md');
		return containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
	}

	it('names all four numbers and the unit when over-committed', () => {
		expect(stripText(40)).toContain(
			t('release.scope.capacityOver', { commitment: 52, capacity: 40, unit: 'pts', pct: 130, over: 12 }),
		);
	});

	it('says what is left when under-committed', () => {
		expect(stripText(60)).toContain(
			t('release.scope.capacityUnder', { commitment: 52, capacity: 60, unit: 'pts', pct: 87, left: 8 }),
		);
	});

	it('withholds the percentage when the ratio overflows, and says why', () => {
		// A positive capacity is not enough on its own — the guard is on the RESULT.
		const text = stripText(Number.MIN_VALUE);
		expect(text).toContain(t('release.scope.capacityPctOverflow'));
		expect(text).not.toContain('Infinity');
		expect(text).not.toContain('NaN');
		// NOT `not.toContain('%')`: the strip carries the progress percentage and the effort
		// figure's own, so that assertion fails however correctly this figure behaves. What
		// must be absent is a capacity sentence carrying a percentage at all.
		expect(text).not.toContain(t('release.scope.capacityOver', { commitment: 52, capacity: 0, unit: 'pts', pct: 0, over: 52 }));
	});

	it('withholds the percentage at zero capacity, and says why', () => {
		const text = stripText(0);
		expect(text).toContain(t('release.scope.capacityNoPct', { commitment: 52, capacity: 0, unit: 'pts', over: 52 }));
		expect(text).toContain(t('release.scope.capacityZero'));
	});

	it('reports a negative capacity as unreadable rather than comparing against it', () => {
		const text = stripText(-5);
		expect(text).toContain(t('release.scope.committed', { commitment: 52, unit: 'pts' }));
		expect(text).toContain(t('release.scope.capacityUnreadable'));
		expect(text).not.toContain('-5');
	});

	it('tells an unbound key from a note that declares nothing', () => {
		expect(stripText(40, { ...CONFIGURED, capacityProperty: '' })).toContain(
			t('release.scope.capacityUnconfigured'),
		);
		expect(stripText(undefined)).toContain(t('release.scope.capacityAbsent'));
	});

	it('draws no comparison at all with no unit set', () => {
		const text = stripText(40, { ...CONFIGURED, capacityUnit: '' });
		expect(text).toContain(t('release.scope.capacityNoUnit'));
		expect(text).not.toContain(t('release.scope.capacityOver', { commitment: 52, capacity: 40, unit: '', pct: 130, over: 12 }));
	});

	it('draws no comparison for a release nobody has estimated', () => {
		// The sum is a real `0` there — absence presented as a measurement is the defect the
		// effort figure beside this one already refuses.
		const vault = capacityVault(40);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]' });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).not.toContain(t('release.scope.capacityUnder', { commitment: 0, capacity: 40, unit: 'pts', pct: 0, left: 40 }));
	});

	it('still compares a release whose members all estimate zero', () => {
		// `0` is a valid estimate: the guard reads the COUNT of estimated members, never the
		// sum, so a genuinely zero commitment is a comparison and not an absence.
		const vault = capacityVault(40);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 0 });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
			t('release.scope.capacityUnder', { commitment: 0, capacity: 40, unit: 'pts', pct: 0, left: 40 }),
		);
	});

	it('draws a readable capacity even with no commitment to set it against', () => {
		// A valid capacity has no state note, so returning early showed nothing at all for a
		// release whose capacity is perfectly readable and whose estimate key is unbound.
		const text = stripText(40, { ...CONFIGURED, estimateProperty: '' });
		expect(text).toContain(t('release.scope.capacityAlone', { capacity: 40, unit: 'pts' }));
	});

	it('reports a missing unit even with no commitment to label', () => {
		// Two unbound mappings, two notes. Behind the commitment return the reader was told
		// about one of them.
		const text = stripText(40, { ...CONFIGURED, estimateProperty: '', capacityUnit: '' });
		expect(text).toContain(t('release.scope.capacityNoUnit'));
	});

	it('names a double count even when no comparison can be drawn', () => {
		// It counts estimates: neither the capacity nor the unit is an input to it.
		const vault = capacityVault(40);
		vault.setFrontmatter('E.md', { type: 'Epic', order: 1, release: '[[R]]', effort: 20 });
		const { view, containerEl } = makeReleaseView(vault, { ...CONFIGURED, capacityUnit: '' });
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
			t('release.scope.doubleCount', { count: 1 }),
		);
	});

	it('names the capacity property on every path with a bound key', () => {
		// The unreadable state needs it MOST: it is the one telling the reader to go and fix
		// a value, and it says nothing about where.
		for (const capacity of [40, 0, -5, undefined]) {
			const { view, containerEl } = makeReleaseView(capacityVault(capacity), CONFIGURED);
			view.pick('R.md');
			expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
				t('release.scope.provenanceCapacity', { property: 'capacity', unit: 'pts' }),
			);
		}
	});

	it('drops the unit clause rather than reading a blank one out', () => {
		const text = stripText(40, { ...CONFIGURED, capacityUnit: '' });
		expect(text).toContain(t('release.scope.provenanceCapacityNoUnit', { property: 'capacity' }));
		expect(text).not.toContain(t('release.scope.provenanceCapacity', { property: 'capacity', unit: '' }));
	});

	it('names no property where the key itself is unbound', () => {
		const text = stripText(40, { ...CONFIGURED, capacityProperty: '' });
		expect(text).not.toContain(t('release.scope.provenanceCapacity', { property: '', unit: 'pts' }));
	});

	it('keeps the precise digits of a typed capacity and commitment', () => {
		// `t()`'s default number formatter caps at three fraction digits — fine for a count
		// this plugin computes, wrong for a capacity and an estimate someone TYPED. Both
		// numbers here carry six, so a fallback to the default formatter renders `0 of 0`
		// rather than the real values, which is what `formatNumber(value, true)` refuses.
		const vault = capacityVault(8.123456);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 12.654321 });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(12.654321, true),
				capacity: formatNumber(8.123456, true),
				unit: 'pts',
				pct: 156,
				over: formatNumber(4.530865, true),
			}),
		);
		expect(text).not.toContain('0 of 0');
	});

	it('reads an exactly-filled release as exactly filled, not as a float remainder over', () => {
		// `0.1 + 0.2` is `0.30000000000000004`, never exactly `0.3` — so a release estimated
		// at 0.1 and 0.2 against a capacity of 0.3 is honestly exactly full, and the raw
		// subtraction is a few ULPs of noise rather than a real overage. The default
		// formatter's three-digit cap hid this before the precise one existed; unnormalized,
		// the precise one prints it.
		const vault = capacityVault(0.3);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 0.1 });
		vault.setFrontmatter('F2.md', { type: 'Feature', parent: 'E', order: 2, release: '[[R]]', effort: 0.2 });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(0.1 + 0.2, true),
				capacity: formatNumber(0.3, true),
				unit: 'pts',
				pct: 100,
				over: formatNumber(0, true),
			}),
		);
		// Not merely "the right sentence is present": an unnormalized noise value would print
		// in exponential form, which this guards against directly.
		expect(text).not.toMatch(/[eE][+-]\d/);
	});

	it('keeps a real difference at a tiny magnitude rather than normalizing it away', () => {
		// A SINGLE estimate is never summed with anything -- zero additions happened, so zero
		// noise could have accumulated, and the tolerance is exactly zero regardless of how
		// small the two operands are. F2 keeps `capacityVault`'s own no-effort default, so
		// `commitment` is this one typed value and not a sum.
		//
		// `over` is asserted rounded to 12 significant digits, matching what the renderer
		// itself does to the raw subtraction (`9.999999999999991e-12` -> `1e-11`): that
		// rounding is a second, separate artifact from the additions tolerance above it, and
		// it is not what this test is about — see the dedicated subtraction-noise test below.
		const commitment = 1.1e-10;
		const capacity = 1e-10;
		const vault = capacityVault(capacity);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: commitment });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(commitment, true),
				capacity: formatNumber(capacity, true),
				unit: 'pts',
				pct: 110,
				over: formatNumber(Number((commitment - capacity).toPrecision(12)), true),
			}),
		);
	});

	it("rounds a single subtraction's own float garbage out of the difference", () => {
		// A SINGLE estimate performs no ADDITION, so the additions tolerance above is exactly
		// zero and cannot touch this — `52.1 - 40` is `12.100000000000001`, garbage from the
		// SUBTRACTION itself rather than from summing several typed estimates. `capacity` and
		// `commitment` still show their full typed precision; only the derived `over` is
		// rounded.
		const capacity = 40;
		const commitment = 52.1;
		const vault = capacityVault(capacity);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: commitment });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(commitment, true),
				capacity: formatNumber(capacity, true),
				unit: 'pts',
				pct: 130,
				over: formatNumber(12.1, true),
			}),
		);
		expect(text).not.toContain('12.100000000000001');
	});

	it('reports a real difference at the top of the range too, rather than a fixed multiple over-collapsing it', () => {
		// This is the case that fails if the tolerance is scaled by a fixed number of ULPs
		// instead of by the additions actually performed: `2` here is comparable in size to
		// what a constant multiple of `Number.EPSILON * capacity` would let through as noise,
		// but a SINGLE estimate performed no addition at all, so the true tolerance is zero
		// and this difference is exact.
		const capacity = 10000000000000000;
		const commitment = 10000000000000002;
		const vault = capacityVault(capacity);
		vault.setFrontmatter('F1.md', { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: commitment });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		const text = containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(commitment, true),
				capacity: formatNumber(capacity, true),
				unit: 'pts',
				pct: 100,
				over: formatNumber(commitment - capacity, true),
			}),
		);
	});

	it('names a possible double count beside the figure, and only when there is one', () => {
		const vault = capacityVault(40);
		vault.setFrontmatter('E.md', { type: 'Epic', order: 1, release: '[[R]]', effort: 20 });
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		expect(containerEl.querySelector('.pbl-rel-summary')?.textContent).toContain(
			t('release.scope.doubleCount', { count: 1 }),
		);
		expect(stripText(40)).not.toContain(t('release.scope.doubleCount', { count: 0 }));
	});
});
