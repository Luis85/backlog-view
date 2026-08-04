import { describe, expect, it } from 'vitest';
import { applyWrites } from '../../src/storage/frontmatter';
import { resolveSettings } from '../../src/domain/settings';
import { FakeVault, FakeViewConfig } from '../helpers/vault';

/**
 * The dated axis's write-time rules — split out of `frontmatter.test.ts` (the
 * `test/` lint budget forces a split by subject rather than letting one source
 * file's suite grow without bound): the value's own shape survives a merge, and
 * the writer's own decisions against the live note — the no-op, the reversed-pair
 * refusal, the live-type refusal, and what it reports having moved between.
 */

describe('the axis write keeps the value’s own shape', () => {
	it('replaces the date and leaves the time and offset the note carries', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01T09:00+02:00' } });
		const settings = resolveSettings(new FakeViewConfig({ startProperty: 'note.start' }));

		await applyWrites(vault.app, settings, [{ file, axis: { start: '2026-08-05' } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-05T09:00+02:00');
	});

	it('keeps a shape the note gained AFTER the model was built', async () => {
		// The case a model-carried suffix could not see and would silently overwrite:
		// the plan was made against a plain date, and by the time it lands the note
		// carries a time somebody else set. A planner-level test cannot reach this.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01' } });
		const settings = resolveSettings(new FakeViewConfig({ startProperty: 'note.start' }));
		vault.fm('Item.md').start = '2026-08-01T14:30:00';

		await applyWrites(vault.app, settings, [{ file, axis: { start: '2026-08-05' } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-05T14:30:00');
	});

	it('writes a plain date where the note has no time to keep, and never invents one', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: {} });
		const settings = resolveSettings(new FakeViewConfig({ targetProperty: 'note.target' }));

		await applyWrites(vault.app, settings, [{ file, axis: { target: '2026-08-05' } }]);

		expect(vault.fm('Item.md').target).toBe('2026-08-05');
	});

	it('takes no shape from a datetime whose DATE the reader refuses', async () => {
		// Shaped like a datetime and still refused — February has no thirtieth — so a
		// pattern-only test would carry `T09:00+02:00` onto the correction. Watched
		// failing with the `readDate` gate removed: the regex matches either way.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: '2026-02-30T09:00+02:00' } });
		const settings = resolveSettings(new FakeViewConfig({ targetProperty: 'note.target' }));

		await applyWrites(vault.app, settings, [{ file, axis: { target: '2026-08-05' } }]);

		expect(vault.fm('Item.md').target).toBe('2026-08-05');
	});

	it('takes no shape from a value the reader refuses', async () => {
		// `soon` is not a date with a time attached; replacing it is a correction, and
		// carrying its text forward would write `2026-08-05soon`.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: 'soon' } });
		const settings = resolveSettings(new FakeViewConfig({ targetProperty: 'note.target' }));

		await applyWrites(vault.app, settings, [{ file, axis: { target: '2026-08-05' } }]);

		expect(vault.fm('Item.md').target).toBe('2026-08-05');
	});

	it('keeps the list a datetime arrived in, replacing only the entry it read', async () => {
		// The container is part of the shape: `readDate` unwraps ANY non-empty list by
		// reading its first entry, so a merge that only understood strings would answer
		// with a bare scalar — dropping the time, the list, and every entry after the
		// first in one move. Both halves of that claim are asserted below.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', {
			frontmatter: { start: ['2026-08-01T09:00+02:00', 'note'] },
		});
		const settings = resolveSettings(new FakeViewConfig({ startProperty: 'note.start' }));

		await applyWrites(vault.app, settings, [{ file, axis: { start: '2026-08-05' } }]);

		expect(vault.fm('Item.md').start).toEqual(['2026-08-05T09:00+02:00', 'note']);
	});
});

describe('the writer decides a date against the live note', () => {
	function dateSettings() {
		return resolveSettings(new FakeViewConfig({ startProperty: 'note.start', targetProperty: 'note.target' }));
	}

	it('writes a request the MODEL thought redundant but the note does not', async () => {
		// The row said 1 August, the note says 2 August, and the user re-confirms what
		// the screen showed. Deciding in the planner discards this as unchanged and the
		// note keeps something else — the user's request dropped before the writer
		// could see it was needed.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01' } });
		vault.fm('Item.md').start = '2026-08-02';

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(outcome.changed).toBe(true);
	});

	it('reports no change — and consumes no undo — for a date the note already states', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-8-1' } });
		const inverses: unknown[] = [];

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }], undefined, (i) => inverses.push(i));

		// Compared as civil DATES, not as text: re-confirming a date the note already
		// states must not tidy `2026-8-1` into `2026-08-01`. The comparison moved here
		// with the decision — it is a question about the spelling on disk.
		expect(vault.fm('Item.md').start).toBe('2026-8-1');
		expect(outcome.changed).toBe(false);
		expect(inverses).toHaveLength(0);
	});

	it('reports the dates it moved BETWEEN, from the values it actually saw', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-02', target: '2026-08-20' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-01', ends: ['start', 'target'] } }]);

		expect(outcome.dates?.before).toEqual({
			start: { value: { year: 2026, month: 8, day: 2 }, invalid: false },
			target: { value: { year: 2026, month: 8, day: 20 }, invalid: false },
		});
		expect(outcome.dates?.after).toEqual({
			start: { value: { year: 2026, month: 8, day: 1 }, invalid: false },
			target: { value: { year: 2026, month: 8, day: 20 }, invalid: false },
		});
	});

	it('tells an unreadable start from an absent one, on the BEFORE side of a real cleanup', async () => {
		// `axisSpan` used to answer this with a bare value, so a note holding `soon` —
		// unreadable, not absent — read identically to one with no key at all. The
		// removal below is a real, undo-consuming write, and reporting it as "still
		// nothing" both sides is the same collapse `placementLabel` stopped making for
		// the horizon axis.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: 'soon' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: null, target: null, ends: ['start', 'target'] } },
		]);

		expect(outcome.dates?.before).toEqual({
			start: { value: null, invalid: true },
			target: { value: null, invalid: false },
		});
		expect(outcome.dates?.after).toEqual({
			start: { value: null, invalid: false },
			target: { value: null, invalid: false },
		});
	});

	it('refuses the whole batch when the effective pair would be reversed', async () => {
		// A one-end write is planned against a span the render showed; a target changed
		// by another editor mid-drag can turn a legal start into a reversed pair. The
		// guarantee is about what lands on DISK, so it is checked where disk is — and
		// refused whole rather than re-clamped to a date the user never pointed at.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01', target: '2026-08-20' } });
		vault.fm('Item.md').target = '2026-08-03';

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-10', ends: ['start', 'target'] } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(outcome.changed).toBe(false);
	});

	it('never invents a reversal for a placement with no pair', async () => {
		// A marker's start is deliberately ignored AND preserved, so a stale start
		// later than the requested target would make the writer refuse every marker
		// drop — a validation inventing a conflict out of a value the projection never
		// drew. The check asks the same question the plan asks, of the LIVE type.
		const vault = new FakeVault();
		const file = vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', start: '2026-12-01', target: '2026-09-30' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { target: '2026-10-15', ends: ['target'] } }]);

		expect(vault.fm('Ship.md').target).toBe('2026-10-15');
		expect(vault.fm('Ship.md').start).toBe('2026-12-01');
		expect(outcome.changed).toBe(true);
	});

	it('reports only the ends the live placement answers for', async () => {
		// The same stale start, in the REPORT rather than the check. The timeline draws
		// and edits a marker as one point, so a target slide that reported the pair
		// would be announced as a range — the source described in a vocabulary the
		// destination is not, which is the split `placementLabel` and `targetLabel`
		// already exist to prevent.
		const vault = new FakeVault();
		const file = vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', start: '2026-07-01', target: '2026-09-30' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { target: '2026-10-15', ends: ['target'] } }]);

		expect(outcome.dates?.before).toEqual({
			start: { value: null, invalid: false },
			target: { value: { year: 2026, month: 9, day: 30 }, invalid: false },
		});
		expect(outcome.dates?.after).toEqual({
			start: { value: null, invalid: false },
			target: { value: { year: 2026, month: 10, day: 15 }, invalid: false },
		});
	});

	it('refuses a batch whose planned shape is not the shape the note now has', async () => {
		// An external edit turned an ordinary item into a marker while a modal was
		// open. Applying the half that still fits would commit a plan the user made
		// about a different thing, so the batch is refused whole — `applySafely`
		// already refuses whole for the same reason.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { type: 'PBI', start: '2026-08-01', target: '2026-08-20' } });
		vault.fm('Item.md').type = 'Milestone';

		const outcome = await applyWrites(vault.app, dateSettings(), [{ file, axis: { start: '2026-08-05', target: '2026-08-25', ends: ['start', 'target'] } }]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(vault.fm('Item.md').target).toBe('2026-08-20');
		expect(outcome.changed).toBe(false);
	});
});

describe('the writer refuses a relative gesture whose baseline has gone stale', () => {
	function dateSettings() {
		return resolveSettings(new FakeViewConfig({ startProperty: 'note.start', targetProperty: 'note.target' }));
	}

	it('refuses a slide whose baseline the note no longer states', async () => {
		// Another editor moved the start from the 1st to the 5th mid-drag; submitting
		// "one day on from the 1st" would walk their edit backwards if it landed.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-05', target: '2026-08-20' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: '2026-08-06', ends: ['start', 'target'], from: { start: '2026-08-01' } } },
		]);

		expect(vault.fm('Item.md').start).toBe('2026-08-05');
		expect(outcome.changed).toBe(false);
	});

	it('applies a slide whose baseline still matches the live note', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { start: '2026-08-01', target: '2026-08-20' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: '2026-08-02', ends: ['start', 'target'], from: { start: '2026-08-01' } } },
		]);

		expect(vault.fm('Item.md').start).toBe('2026-08-02');
		expect(outcome.changed).toBe(true);
	});

	it('refuses an open-end grip whose end gained a value since the drag began', async () => {
		// The baseline states the OPEN end's own expectation: nothing there. A value
		// that arrived since is exactly the conflict this catches.
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: '2026-08-20' } });
		vault.fm('Item.md').start = '2026-08-01';

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: '2026-08-10', ends: ['start', 'target'], from: { start: null } } },
		]);

		expect(vault.fm('Item.md').start).toBe('2026-08-01');
		expect(outcome.changed).toBe(false);
	});

	it('refuses an open-end grip whose end holds a value the reader refuses', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: '2026-08-20' } });
		vault.fm('Item.md').start = 'soon';

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: '2026-08-10', ends: ['start', 'target'], from: { start: null } } },
		]);

		expect(vault.fm('Item.md').start).toBe('soon');
		expect(outcome.changed).toBe(false);
	});

	it('applies an open-end grip whose end is still exactly as absent as the gesture began it', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: '2026-08-20' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: '2026-08-10', ends: ['start', 'target'], from: { start: null } } },
		]);

		expect(vault.fm('Item.md').start).toBe('2026-08-10');
		expect(outcome.changed).toBe(true);
	});

	it('refuses when the baseline’s end has gone from stated to absent', async () => {
		const vault = new FakeVault();
		const file = vault.addFile('Item.md', { frontmatter: { target: '2026-08-20' } });

		const outcome = await applyWrites(vault.app, dateSettings(), [
			{ file, axis: { start: '2026-08-10', ends: ['start', 'target'], from: { start: '2026-08-01' } } },
		]);

		expect('start' in vault.fm('Item.md')).toBe(false);
		expect(outcome.changed).toBe(false);
	});
});
