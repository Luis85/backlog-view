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
		// These two carry the whole check: without the guard the comparison draws its
		// percentage as `Infinity%`. NOT `not.toContain('%')`, which fails however correctly
		// this figure behaves — the strip carries the progress percentage and the effort
		// figure's own.
		expect(text).not.toContain('Infinity');
		expect(text).not.toContain('NaN');
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

	it('says nothing about the unit when no capacity key is bound', () => {
		// Every existing vault after an upgrade: two unbound keys must not report three
		// refusals. The unbound key is still named — the capacity half is always named — but
		// a unit for a feature nobody has enabled labels nothing and so says nothing.
		const text = stripText(40, { ...CONFIGURED, capacityProperty: '', capacityUnit: '' });
		expect(text).toContain(t('release.scope.capacityUnconfigured'));
		expect(text).not.toContain(t('release.scope.capacityNoUnit'));
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
		// And the capacity is still NAMED on the way out — the missing half is the commitment,
		// not this one. Asserted at this exit rather than only at the unbound estimate key's,
		// because this is the one a configured vault reaches.
		expect(text).toContain(t('release.scope.capacityAlone', { capacity: 40, unit: 'pts' }));
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

	/**
	 * The six demonstrated cases of `Commitment against declared capacity`'s arithmetic, one
	 * test each. Two of them — the `1e-16` shortfall and the `1000000000001` overage — are
	 * what the tolerance and the twelve-significant-digit rounding this feature used to carry
	 * each got wrong, and they are the acceptance criteria for replacing both with exact
	 * decimal arithmetic (`src/domain/decimal.ts`). The other four are the cases those
	 * heuristics got right and must keep getting right.
	 */
	function estimatedStrip(capacity: number, efforts: number[]): string {
		const vault = capacityVault(capacity);
		efforts.forEach((effort, index) => {
			vault.setFrontmatter(`F${index + 1}.md`, {
				type: 'Feature',
				parent: 'E',
				order: index + 1,
				release: '[[R]]',
				effort,
			});
		});
		const { view, containerEl } = makeReleaseView(vault, CONFIGURED);
		view.pick('R.md');
		return containerEl.querySelector('.pbl-rel-summary')?.textContent ?? '';
	}

	it('reads an exactly-filled release as exactly filled, not as a float remainder over', () => {
		// `0.1 + 0.2` is `0.30000000000000004` and the raw subtraction from `0.3` is
		// `5.55e-17`, which the precise formatter this figure uses would print in full. Summed
		// as decimals there is no remainder to hide: the total IS `0.3` and the difference is
		// exactly zero.
		const text = estimatedStrip(0.3, [0.1, 0.2]);
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(0.3, true),
				capacity: formatNumber(0.3, true),
				unit: 'pts',
				pct: 100,
				over: formatNumber(0, true),
			}),
		);
		// Not merely "the right sentence is present": a float remainder prints in exponential
		// form, which this guards against directly.
		expect(text).not.toMatch(/[eE][+-]\d/);
	});

	it('draws the commitment itself as the number the notes add up to', () => {
		// The self-contradiction the exact sum removes, and a separate claim from the
		// difference above it: the strip drew `0.30000000000000004` committed against `0.3`
		// declared and `0 over` in one sentence. The COMMITMENT is what this asserts, so it
		// fails on a renderer that normalized only the derived difference.
		const text = estimatedStrip(0.3, [0.1, 0.2]);
		expect(text).not.toContain('0.30000000000000004');
	});

	it('takes a single subtraction exactly rather than carrying its float garbage', () => {
		// `52.1 - 40` is `12.100000000000001` — garbage from the SUBTRACTION rather than from
		// summing anything, so no tolerance over the addition count could ever reach it, and
		// the rounding that did reach it is what got the case below wrong. `capacity` and
		// `commitment` still show their full typed precision.
		const text = estimatedStrip(40, [52.1]);
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(52.1, true),
				capacity: formatNumber(40, true),
				unit: 'pts',
				pct: 130,
				over: formatNumber(12.1, true),
			}),
		);
		expect(text).not.toContain('12.100000000000001');
	});

	it('reports a real difference at the top of the range rather than collapsing it into slack', () => {
		// A difference of `2` at `1e16` is the size a tolerance scaled off the operands would
		// swallow. It is exact, and it survives.
		const text = estimatedStrip(10000000000000000, [10000000000000002]);
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(10000000000000002, true),
				capacity: formatNumber(10000000000000000, true),
				unit: 'pts',
				pct: 100,
				over: formatNumber(2, true),
			}),
		);
	});

	it('reports a shortfall the additions tolerance used to zero away', () => {
		// **An acceptance criterion.** `0.5 + 0.4999999999999999` is `0.9999999999999999`, one
		// part in ten thousand trillion short of a capacity of `1`. The tolerance this feature
		// carried scaled `Number.EPSILON` by the operands and by the one addition performed,
		// which is larger than this real shortfall — so the strip said the release was exactly
		// full. It is not: it is under, and the figure says by how much.
		const text = estimatedStrip(1, [0.5, 0.4999999999999999]);
		expect(text).toContain(
			t('release.scope.capacityUnder', {
				commitment: formatNumber(0.9999999999999999, true),
				capacity: formatNumber(1, true),
				unit: 'pts',
				pct: 100,
				left: formatNumber(1e-16, true),
			}),
		);
	});

	it('reports an overage the twelve-digit rounding used to get off by one', () => {
		// **An acceptance criterion.** `1000000000002 - 1` is `1000000000001`, a value a double
		// holds exactly. Rounding the derived difference to twelve significant digits made it
		// `1000000000000` — a wrong number, drawn with the confidence of a right one.
		const text = estimatedStrip(1, [1000000000002]);
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(1000000000002, true),
				capacity: formatNumber(1, true),
				unit: 'pts',
				pct: 100000000000200,
				over: formatNumber(1000000000001, true),
			}),
		);
		expect(text).not.toContain(formatNumber(1000000000000, true));
	});

	it('reports one over when the exact total is past what a double can hold', () => {
		// **The seam, end to end.** No double lies between `1e21` and `1e21 + 1`, so a
		// commitment summed to a NUMBER in `domain/` arrives here already rounded and
		// subtracts to zero — a release one over its capacity drawn as exactly filled. The
		// exact decimal crosses instead, so the difference is taken before the rounding is.
		// The two numbers DISPLAY identically, which is honest: display rounds, arithmetic
		// does not.
		const text = estimatedStrip(1e21, [1e21, 1]);
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(1e21, true),
				capacity: formatNumber(1e21, true),
				unit: 'pts',
				pct: 100,
				over: formatNumber(1, true),
			}),
		);
		expect(text).not.toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(1e21, true),
				capacity: formatNumber(1e21, true),
				unit: 'pts',
				pct: 100,
				over: formatNumber(0, true),
			}),
		);
	});

	it('keeps a real difference at a tiny magnitude rather than normalizing it away', () => {
		// `1.1e-10 - 1e-10` is `9.999999999999991e-12` by the operator and exactly `1e-11` as
		// decimals. Neither the tolerance nor the rounding could produce that answer: the
		// former left the garbage digits, the latter rounded them to `1e-11` by luck of the
		// twelfth digit rather than by arithmetic.
		const text = estimatedStrip(1e-10, [1.1e-10]);
		expect(text).toContain(
			t('release.scope.capacityOver', {
				commitment: formatNumber(1.1e-10, true),
				capacity: formatNumber(1e-10, true),
				unit: 'pts',
				pct: 110,
				over: formatNumber(1e-11, true),
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
