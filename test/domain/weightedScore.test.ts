import { describe, expect, it } from 'vitest';
import { computeTotal, currencyOf, modelFingerprint, parseStamp, round2, stampValue } from '../../src/domain/weightedScore';
import { buildEstimationModel } from '../../src/domain/estimationItems';
import { configured } from '../helpers/estimationModel';
import { FakeVault } from '../helpers/vault';
import { Indicator } from '../../src/domain/scoringModel';

// The shipped default model, fully bound — shared by every test below the same way
// `test/domain/scoringModel.test.ts` shares it, so every arithmetic test here argues
// from the "everything is fine" shape rather than assembling its own dimension list.
const model = configured();
// This file's tests are about `buildEstimationModel`'s own fields, not the indicator —
// `test/domain/indicator.test.ts` covers that — so every call here passes one with no
// operands, which computes to no figure at all.
const noIndicator: Indicator = { label: '', operands: [], divisor: null };

describe('computeTotal: the weighted mean, renormalized over what was answered', () => {
	it('computes the PRD worked example to 3.55', () => {
		const answers = new Map(
			Object.entries({
				'strategic-alignment': 5,
				'customer-value': 4,
				'business-impact': 4,
				reach: 3,
				'risk-reduction': 2,
				compliance: 1,
				'time-criticality': 4,
				enablement: 3,
			}),
		);
		expect(computeTotal(model, answers)?.total).toBe(3.55);
		expect(computeTotal(model, answers)?.coverage).toEqual({ answered: 8, enabled: 8 });
	});

	it('renormalizes a partial profile over the answered weights', () => {
		const answers = new Map<string, number | null>([
			['strategic-alignment', 5],
			['customer-value', 3],
		]);
		// proportions 1.0 and 0.5, weights 20/20 → 0.75 → 1 + 0.75*4 = 4
		expect(computeTotal(model, answers)?.total).toBe(4);
		expect(computeTotal(model, answers)?.coverage).toEqual({ answered: 2, enabled: 8 });
	});

	it('no answered dimension means no total at all', () => {
		expect(computeTotal(model, new Map())).toBeNull();
	});

	it('clamps an out-of-range value to the scale and reports the dimension', () => {
		const r = computeTotal(model, new Map([['reach', 9]]));
		expect(r?.total).toBe(5);
		expect(r?.clamped).toEqual(['reach']);
	});

	it('inverts a less-is-better dimension on its declared range', () => {
		const flipped = structuredClone(model);
		flipped.dimensions.find((d) => d.id === 'reach')!.lessIsBetter = true;
		// reach 5 → proportion 1 → inverted 0 → output floor
		expect(computeTotal(flipped, new Map([['reach', 5]]))?.total).toBe(1);
		expect(computeTotal(flipped, new Map([['reach', 1]]))?.total).toBe(5);
	});

	it('rounds once at two decimals', () => {
		// strategic-alignment 4 (p=0.75, w=20) + business-impact 3 (p=0.5, w=15):
		// (15 + 7.5) / 35 = 0.642857… → 1 + 0.642857…*4 = 3.571428… → 3.57
		const r = computeTotal(
			model,
			new Map([
				['strategic-alignment', 4],
				['business-impact', 3],
			]),
		);
		expect(r?.total).toBe(3.57);
	});
});

describe('round2', () => {
	it('rounds to two decimal places, once', () => {
		expect(round2(3.5714285714)).toBe(3.57);
		expect(round2(4)).toBe(4);
	});
});

describe('modelFingerprint: stable for the same model, and moved by every arithmetic input', () => {
	it('is stable for the same model and moves for every arithmetic input', () => {
		const base = modelFingerprint(model);
		expect(modelFingerprint(model)).toBe(base);
		const mutations: ((m: typeof model) => void)[] = [
			(m) => {
				m.dimensions[0].weight += 5;
				m.dimensions[1].weight -= 5;
			},
			(m) => {
				m.dimensions[0].key = 'other-property';
			},
			(m) => {
				m.dimensions[0].rubric = [...m.dimensions[0].rubric];
				m.dimensions[0].rubric[4] = 'Redefined';
			},
			(m) => {
				m.outputMax = 10;
			},
			(m) => {
				m.dimensions[0].lessIsBetter = true;
			},
			(m) => {
				m.dimensions[0].max = 6;
			},
			(m) => {
				m.dimensions[0].min = 0;
			},
			(m) => {
				m.dimensions = m.dimensions.slice(1);
			},
		];
		for (const mutate of mutations) {
			const copy = structuredClone(model);
			mutate(copy);
			expect(modelFingerprint(copy)).not.toBe(base);
		}
	});

	it('leaves confidence, effort and complexity out entirely — they never move it', () => {
		const copy = structuredClone(model);
		copy.confidence.key = 'note.something-else';
		copy.effort.rubric = [...copy.effort.rubric.slice(1), 'New sentence'];
		copy.complexity.min = 0;
		expect(modelFingerprint(copy)).toBe(modelFingerprint(model));
	});
});

describe('stampValue and parseStamp: the round trip a stored total is judged against', () => {
	it('formats as "answered/enabled fingerprint" and parses back the same three parts', () => {
		const coverage = { answered: 6, enabled: 8 };
		const stamp = stampValue(model, coverage);
		expect(stamp).toBe(`6/8 ${modelFingerprint(model)}`);
		expect(parseStamp(stamp)).toEqual({ answered: 6, enabled: 8, fingerprint: modelFingerprint(model) });
	});

	it('refuses anything not shaped like a stamp this module wrote', () => {
		expect(parseStamp('')).toBeNull();
		expect(parseStamp('8/8')).toBeNull();
		expect(parseStamp('8/8 ZZZZZZZZ')).toBeNull();
		expect(parseStamp('hand-written')).toBeNull();
	});
});

describe('currencyOf: what a stored total says about itself', () => {
	const answers = new Map(
		Object.entries({
			'strategic-alignment': 5,
			'customer-value': 4,
			'business-impact': 4,
			reach: 3,
			'risk-reduction': 2,
			compliance: 1,
			'time-criticality': 4,
			enablement: 3,
		}),
	);
	const result = computeTotal(model, answers)!;

	it('currency: current / stale-by-total / stale-by-coverage / foreign / handwritten / orphan / none', () => {
		// current: storedStamp = stampValue(model, result.coverage), storedTotal = result.total
		expect(
			currencyOf(model, { storedTotal: result.total, storedStamp: stampValue(model, result.coverage), result }),
		).toBe('current');

		// stale-by-total: storedTotal no longer matches a fresh compute
		expect(
			currencyOf(model, { storedTotal: result.total + 0.5, storedStamp: stampValue(model, result.coverage), result }),
		).toBe('stale');

		// stale-by-coverage: the stamp remembers 8/8, the note's current answers cover 7/8
		const partial = new Map(answers);
		partial.delete('enablement');
		const partialResult = computeTotal(model, partial)!;
		expect(partialResult.coverage).toEqual({ answered: 7, enabled: 8 });
		expect(
			currencyOf(model, {
				storedTotal: partialResult.total,
				storedStamp: stampValue(model, result.coverage), // a full-profile stamp, left behind
				result: partialResult,
			}),
		).toBe('stale');

		// foreign: valid shape, wrong fingerprint (a stamp minted from a different model)
		const otherModel = structuredClone(model);
		otherModel.outputMax = 10;
		expect(
			currencyOf(model, { storedTotal: result.total, storedStamp: stampValue(otherModel, result.coverage), result }),
		).toBe('foreign');

		// handwritten: a total is set, with no stamp beside it at all
		expect(currencyOf(model, { storedTotal: result.total, storedStamp: null, result })).toBe('handwritten');

		// orphan: a total is stored, but nothing computes any more (every answer is gone)
		expect(
			currencyOf(model, { storedTotal: result.total, storedStamp: stampValue(model, result.coverage), result: null }),
		).toBe('orphan');

		// none: nothing stored, nothing computed
		expect(currencyOf(model, { storedTotal: null, storedStamp: null, result: null })).toBe('none');
	});

	/**
	 * The other half of the pair rule, which `none` used to swallow whole: a stamp standing
	 * with no total beside it. Reported as `none`, the table drew a dash and neither action
	 * accepted the item, so the stray key could not be seen or removed — Codex, PR #168.
	 *
	 * Two cases and not one, because the ANSWERS decide which failure it is, and each is
	 * asserted against the ACTION it earns rather than only against the word: with no answers
	 * the stamp is all that is left and the cleanup takes it; with the answers still on the
	 * note the total is recomputable and the restamp puts it back. Reading both as `orphan` —
	 * the shape the review suggested — would offer the second one a cleanup that deletes the
	 * stamp and leaves the scores unattributed.
	 */
	it('a stamp with no total is surfaced, as whichever failure its answers make it', () => {
		const stamp = stampValue(model, result.coverage);

		// No answers left either: nothing to judge and nothing to recompute from.
		expect(currencyOf(model, { storedTotal: null, storedStamp: stamp, result: null })).toBe('orphan');

		// The answers are still there — the total alone was deleted, so it can be rewritten.
		expect(currencyOf(model, { storedTotal: null, storedStamp: stamp, result })).toBe('stale');

		// The control: with no stamp either, absence is still absence and nothing is reported.
		expect(currencyOf(model, { storedTotal: null, storedStamp: null, result })).toBe('none');
	});

	// Every fixture above is already a clean two-decimal number, so the `round2(storedTotal)`
	// comparison in `currencyOf` is never actually exercised by them — dropping that wrap would
	// leave every one of those assertions passing unchanged. These two pin the comparison
	// itself, against the SAME rule `docs/requirements/The scoring model is configuration.md`
	// states for the write side: round once, compare against the rounded number.
	it('a stored total that ROUNDS to the computed total reads current, even though the raw numbers differ', () => {
		const storedTotal = result.total + 0.004; // 3.554 → round2 → 3.55, same as result.total
		expect(round2(storedTotal)).toBe(result.total); // the fixture actually rounds back — not asserted on faith
		expect(storedTotal).not.toBe(result.total); // and the raw numbers really do differ
		expect(
			currencyOf(model, { storedTotal, storedStamp: stampValue(model, result.coverage), result }),
		).toBe('current');
	});

	it('a stored total whose difference SURVIVES rounding reads stale', () => {
		const storedTotal = result.total + 0.006; // 3.556 → round2 → 3.56, not result.total
		expect(round2(storedTotal)).not.toBe(result.total); // the fixture's difference is not a rounding artifact
		expect(
			currencyOf(model, { storedTotal, storedStamp: stampValue(model, result.coverage), result }),
		).toBe('stale');
	});

	it('an unparseable stamp reads foreign through currencyOf itself, not only through parseStamp', () => {
		expect(
			currencyOf(model, { storedTotal: result.total, storedStamp: 'hand-written', result }),
		).toBe('foreign');
	});

	it('reads a total with no stamp and no answers as hand-written, never as an orphan', () => {
		// `computeTotal` returns null at `answered === 0`, so "no answers" and "inputs gone"
		// arrive at this function as the same `result === null`. The STAMP is what tells them
		// apart: `docs/requirements/Business value estimation.md` — "an absent one means it
		// was written by hand or by something else". Asked in the other order, a number
		// somebody typed into the property editor read as `orphan` and the panel offered to
		// delete it.
		const model = configured();
		const currency = currencyOf(model, { storedTotal: 4, storedStamp: null, result: null });
		expect(currency).toBe('handwritten');
	});

	it('still reads a STAMPED total with no answers as an orphan', () => {
		// The other half of the same swap, so the fix cannot be read as "handwritten always
		// wins": a stamp vouching for inputs that are gone is exactly what `orphan` is for,
		// and `planOrphanCleanup` is offered on it.
		const model = configured();
		const currency = currencyOf(model, { storedTotal: 4, storedStamp: stampValue(model, { answered: 3, enabled: 8 }), result: null });
		expect(currency).toBe('orphan');
	});
});

describe('buildEstimationModel: one item per result, one getFileCache read per note', () => {
	it('reads answers, the stored total and stamp, and derives the result and its currency', () => {
		const vault = new FakeVault();
		vault.addFile('Full.md', {
			frontmatter: {
				'strategic-alignment': 5,
				'customer-value': 4,
				'business-impact': 4,
				reach: 3,
				'risk-reduction': 2,
				compliance: 1,
				'time-criticality': 4,
				enablement: 3,
			},
		});
		vault.addFile('Partial.md', { frontmatter: { 'strategic-alignment': 5, 'customer-value': 3 } });
		vault.addFile('Empty.md');

		const { items, byPath } = buildEstimationModel(vault.app, vault.entries(), model, noIndicator, 'type');

		expect(items).toHaveLength(3);
		expect(byPath.get('Full.md')?.result?.total).toBe(3.55);
		// Nothing is stored on any of these notes yet, so every one reads as 'none'.
		expect(byPath.get('Full.md')?.currency).toBe('none');
		expect(byPath.get('Partial.md')?.result?.total).toBe(4);
		expect(byPath.get('Partial.md')?.result?.coverage).toEqual({ answered: 2, enabled: 8 });
		expect(byPath.get('Empty.md')?.result).toBeNull();
		expect(byPath.get('Empty.md')?.currency).toBe('none');
	});

	it('reports a stored total current against a freshly computed one, and reads the fixed scales when bound', () => {
		const vault = new FakeVault();
		const scaled = configured({ confidenceProperty: 'note.confidence', effortProperty: 'note.effort' });
		const answers = new Map(
			Object.entries({
				'strategic-alignment': 5,
				'customer-value': 4,
				'business-impact': 4,
				reach: 3,
				'risk-reduction': 2,
				compliance: 1,
				'time-criticality': 4,
				enablement: 3,
			}),
		);
		const result = computeTotal(scaled, answers)!;
		vault.addFile('Current.md', {
			frontmatter: {
				...Object.fromEntries(answers),
				confidence: 4,
				effort: 2,
				'business-value': result.total,
				'business-value-model': stampValue(scaled, result.coverage),
			},
		});

		const { byPath } = buildEstimationModel(vault.app, vault.entries(), scaled, noIndicator, 'type');
		const item = byPath.get('Current.md')!;
		expect(item.currency).toBe('current');
		expect(item.confidence).toBe(4);
		expect(item.effort).toBe(2);
		expect(item.complexity).toBeNull(); // never bound by this model
	});

	it("collects only the model's own bound keys that the note actually carries", () => {
		const vault = new FakeVault();
		vault.addFile('One.md', { frontmatter: { 'strategic-alignment': 5, 'business-value': 3, unrelated: 'x' } });
		const { byPath } = buildEstimationModel(vault.app, vault.entries(), model, noIndicator, 'type');
		const ownKeys = byPath.get('One.md')!.ownKeys;
		expect(ownKeys.has('strategic-alignment')).toBe(true);
		expect(ownKeys.has('business-value')).toBe(true);
		expect(ownKeys.has('unrelated')).toBe(false);
		expect(ownKeys.has('customer-value')).toBe(false);
		expect(ownKeys.has('business-value-model')).toBe(false);
	});

	it('reads only markdown files and never double-counts a path', () => {
		const vault = new FakeVault();
		vault.addFile('Note.md', { frontmatter: { 'strategic-alignment': 5 } });
		vault.addFile('Attachment.png');
		const entries = vault.entries();
		const { items } = buildEstimationModel(vault.app, [...entries, entries[0]], model, noIndicator, 'type');
		expect(items).toHaveLength(1);
		expect(items[0].file.path).toBe('Note.md');
	});
});
