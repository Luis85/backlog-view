import { describe, expect, it } from 'vitest';
import { BacklogItem, buildModel } from '../../src/domain/model';
import { computeHorizonWrites, computeInitWrites, computeScheduleWrites } from '../../src/domain/writePlan';
import { PlacementEnd } from '../../src/domain/itemTypes';
import { BacklogSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';
import { settingsWith } from '../helpers/settings';

/**
 * The roadmap's placement writes, planned: what setting a horizon, scheduling and
 * unscheduling WOULD write, and what the backfill does about the keys that are
 * missing. Everything here is pure — nothing in this file touches a vault.
 */

/** Both axes configured, the way a roadmap view would have them. */
const AXES: BacklogSettings = settingsWith({ horizonKey: 'horizon',
	startKey: 'start',
	targetKey: 'due', });

function build(files: Record<string, Record<string, unknown>>, settings = AXES) {
	const vault = new FakeVault();
	for (const [path, frontmatter] of Object.entries(files)) vault.addFile(path, { frontmatter });
	const model = buildModel(vault.app, vault.entries(), settings);
	const get = (title: string): BacklogItem => {
		const item = model.items.find((i) => i.title === title);
		if (!item) throw new Error(`missing fixture item ${title}`);
		return item;
	};
	return { vault, model, get };
}

describe('computeHorizonWrites', () => {
	it('writes the picked value into the horizon property', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10 } });

		const writes = computeHorizonWrites(get('A'), 'Next');

		expect(writes).toHaveLength(1);
		expect(writes[0].axis).toEqual({ horizon: 'Next' });
		// The one write and nothing else: a placement is not a reason to touch the rank.
		expect(writes[0].order).toBeUndefined();
		expect(writes[0].typeName).toBeUndefined();
	});

	it('plans nothing when the item already holds that horizon, whatever its casing', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10, horizon: 'Now' } });

		// Case-insensitive, the same matching that put the card in that bucket — so a
		// re-pick cannot consume the caller's one undo slot.
		expect(computeHorizonWrites(get('A'), 'now')).toEqual([]);
	});

	it('replaces a value the reader refuses', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10, horizon: { nested: true } } });

		expect(get('A').horizon.invalid).toBe(true);
		expect(computeHorizonWrites(get('A'), 'Now')[0].axis).toEqual({ horizon: 'Now' });
	});

	it('removes the key rather than blanking it, and only when the note carries one', () => {
		const { get } = build({
			'Placed.md': { type: 'Epic', order: 10, horizon: 'Later' },
			'Blank.md': { type: 'Epic', order: 20, horizon: '' },
			'Untriaged.md': { type: 'Epic', order: 30 },
		});

		expect(computeHorizonWrites(get('Placed'), null)[0].axis).toEqual({ horizon: null });
		// Present but empty reads as untriaged and is still a key to take away.
		expect(computeHorizonWrites(get('Blank'), null)[0].axis).toEqual({ horizon: null });
		// Nothing to remove: an item with no key is already untriaged.
		expect(computeHorizonWrites(get('Untriaged'), null)).toEqual([]);
	});
});

describe('computeScheduleWrites', () => {
	const BOTH: PlacementEnd[] = ['start', 'target'];

	it('writes both ends in ONE write, so a span is one undo', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10 } });

		const writes = computeScheduleWrites(get('A'), { start: '2026-08-03', target: '2026-08-14' }, BOTH);

		expect(writes).toHaveLength(1);
		expect(writes[0].axis).toEqual({ start: '2026-08-03', target: '2026-08-14', ends: BOTH });
	});

	it('states what was asked for, and claims nothing about what the note holds', () => {
		// The planner sees a model that can be a refresh behind the note, so it is no
		// longer allowed an opinion about whether a write is needed — not for a date the
		// note appears to state, and not for the spelling it states it in. It proposes;
		// the writer, the only module that can see the note, decides.
		const { get } = build({ 'A.md': { type: 'Epic', order: 10, start: '2026-8-3' } });

		const writes = computeScheduleWrites(get('A'), { start: '2026-08-03' }, BOTH);

		expect(writes[0].axis).toEqual({ start: '2026-08-03', ends: BOTH });
	});

	it('carries a null for every end the placement allows, key present or not', () => {
		// `ownKeys` is a model-time reading too. An unschedule planned while a bar had
		// one end would omit the other end's null, and an editor who added that date
		// mid-drag would find the item still scheduled after an action that said it
		// would clear it — a removal that half-happened.
		const { get } = build({ 'Half.md': { type: 'Epic', order: 20, start: '2026-08-03' } });

		const writes = computeScheduleWrites(get('Half'), { start: null, target: null }, BOTH);

		expect(writes[0].axis).toEqual({ start: null, target: null, ends: BOTH });
	});

	it('names only the ends its placement allows', () => {
		// The type narrowing is the caller's — a marker answers for its target alone —
		// and the planner honours it rather than restating it.
		const { get } = build({ 'A.md': { type: 'Epic', order: 10 } });

		const writes = computeScheduleWrites(get('A'), { start: '2026-08-03', target: '2026-08-14' }, ['target']);

		expect(writes[0].axis).toEqual({ target: '2026-08-14', ends: ['target'] });
	});

	it('carries the baseline a relative gesture measured against', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10, start: '2026-08-03' } });

		const writes = computeScheduleWrites(get('A'), { start: '2026-08-04' }, BOTH, { start: '2026-08-03' });

		expect(writes[0].axis).toEqual({ start: '2026-08-04', ends: BOTH, from: { start: '2026-08-03' } });
	});

	it('plans nothing when the plan names no end at all', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10, start: '2026-08-03' } });

		expect(computeScheduleWrites(get('A'), {}, BOTH)).toEqual([]);
	});

	it('never guesses at a date it cannot read', () => {
		// The entry refuses an unreadable date before it gets here; this is the backstop
		// that keeps the rule true of the planner too. A question about the REQUEST,
		// which is the one thing here that is not about the note.
		const { get } = build({ 'A.md': { type: 'Epic', order: 10 } });

		expect(computeScheduleWrites(get('A'), { start: 'next tuesday' }, BOTH)).toEqual([]);
	});

	it('writes an end whose value on disk is unreadable', () => {
		const { get } = build({ 'A.md': { type: 'Epic', order: 10, start: 'someday' } });

		expect(computeScheduleWrites(get('A'), { start: '2026-08-03' }, BOTH)[0].axis).toEqual({
			start: '2026-08-03',
			ends: BOTH,
		});
	});
});

describe('computeInitWrites and the optional keys', () => {
	it('stubs the configured axis keys, so nothing gains a placement', () => {
		const { model, get } = build({ 'A.md': { type: 'Epic', order: 10 } });

		const writes = computeInitWrites(model, AXES);

		expect(writes).toHaveLength(1);
		expect(writes[0].stubs).toEqual(['horizon', 'start', 'target']);
		// The whole point of an empty value: the item is still untriaged and still
		// unscheduled, so the roadmap does not move when the button is pressed.
		expect(writes[0].axis).toBeUndefined();
		expect(get('A').horizon.value).toBeNull();
	});

	it('stubs the state and the stamps too — every property a feature needs', () => {
		const settings = { ...AXES, stateKey: 'status', startedDateKey: 'started', finishedDateKey: 'finished' };
		const { model } = build({ 'A.md': { type: 'Epic', order: 10 } }, settings);

		// The gap this fills is the same one on every optional property: a key no note
		// carries is one Obsidian's own editor cannot show and its picker cannot offer.
		expect(computeInitWrites(model, settings)[0].stubs).toEqual([
			'state',
			'startedDate',
			'finishedDate',
			'horizon',
			'start',
			'target',
		]);
	});

	it('fills only the keys the note lacks', () => {
		const { model } = build({ 'A.md': { type: 'Epic', order: 10, horizon: 'Now', start: '2026-08-03' } });

		expect(computeInitWrites(model, AXES)[0].stubs).toEqual(['target']);
	});

	it('plans nothing for a note that carries every configured key', () => {
		const { model } = build({ 'A.md': { type: 'Epic', order: 10, horizon: 'Now', start: '', due: '' } });

		// Present-but-empty is a key the note carries: the backfill fills gaps in the
		// schema, and there is no gap left here.
		expect(computeInitWrites(model, AXES)).toEqual([]);
	});

	it('creates no horizon key while the bucket axis is unconfigured', () => {
		// Property named, values cleared: the axis the roadmap declines to draw and the
		// row menu declines to set. Creating its key would be the one write left on an
		// axis nothing else acknowledges.
		const settings = { ...AXES, horizonValues: [] };
		const { model } = build({ 'A.md': { type: 'Epic', order: 10 } }, settings);

		expect(computeInitWrites(model, settings)[0].stubs).toEqual(['start', 'target']);
	});

	it('never writes a key no property names', () => {
		const settings = settingsWith({ horizonKey: 'horizon' });
		const { model } = build({ 'A.md': { type: 'Epic', order: 10 } }, settings);

		expect(computeInitWrites(model, settings)[0].stubs).toEqual(['horizon']);
	});

	it('leaves a context row alone', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		// The Epic is loaded as context: it is an ancestor the filter did not return.
		const entries = vault.entries().filter((e) => e.file.path === 'PBI.md');
		const model = buildModel(vault.app, entries, AXES);

		const writes = computeInitWrites(model, AXES);

		expect(writes.map((w) => w.file.path)).toEqual(['PBI.md']);
	});
});
