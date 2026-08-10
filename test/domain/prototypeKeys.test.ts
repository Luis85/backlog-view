import { describe, expect, it } from 'vitest';
import { BacklogSettings } from '../../src/domain/settings';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import { buildRoadmap, horizonSource, placementLabel, SHELF_LABEL } from '../../src/domain/roadmap';
import { FakeVault } from '../helpers/vault';

/** A view whose configured keys are all names `Object.prototype` already owns. */
function axisSettings(overrides: Partial<BacklogSettings> = {}): BacklogSettings {
	return settingsWith({ horizonKey: 'toString', startKey: '', targetKey: '', ...overrides });
}

function names(items: { title: string }[]): string[] {
	return items.map((i) => i.title);
}

describe('a horizon property named off Object.prototype', () => {
	/**
	 * `toString` is a legal frontmatter key. On a note that does not own it, a bare
	 * `fm[key]` yields the inherited FUNCTION, which the axis readers — which exist to
	 * tell absent from unreadable — classify as refused. Every note in the vault would
	 * shelve as unreadable rather than as not yet planned.
	 */
	it('reads as absent on a note that does not own the key', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const item = model.results[0];

		expect(item.horizon.invalid).toBe(false);
		expect(item.horizon.value).toBeNull();
		expect(item.ownKeys.horizon).toBe(false);

		const roadmap = buildRoadmap(model, settings, () => true, 'horizons');
		expect(roadmap.shelf).toHaveLength(1);
		// null reason is plain absence — work not yet triaged, not a value we refused.
		expect(roadmap.shelf[0].reason).toBeNull();
		expect(placementLabel(roadmap, horizonSource(item))).toBe(SHELF_LABEL);
	});

	it('still reads the value on a note that genuinely owns the key', () => {
		const settings = axisSettings();
		const vault = new FakeVault();
		// `defaultSettings().horizonValues` is populated, so 'Now' is a declared bucket.
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10, toString: 'Now' } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const item = model.results[0];

		expect(item.horizon.value).toBe('Now');
		expect(item.horizon.invalid).toBe(false);
		expect(item.ownKeys.horizon).toBe(true);
	});

	/** The dated axis shares the call site, so it is fixed by the same line. */
	it('leaves a date axis unplaced rather than refused', () => {
		const settings = axisSettings({ horizonKey: '', startKey: 'toString', targetKey: 'valueOf' });
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'Epic', order: 10 } });

		const model = buildModel(vault.app, vault.entries(), settings);
		const item = model.results[0];

		expect(item.plannedStart.invalid).toBe(false);
		expect(item.plannedTarget.invalid).toBe(false);
	});
});

describe('a parent property named off Object.prototype', () => {
	/**
	 * `parentKey in fm` walks the prototype chain, so `toString` reads as present on
	 * every note — each one an explicit "pinned to top level" root. That admits notes
	 * with no type and no parent to the hierarchy, and suppresses folder inference.
	 */
	it('does not enrol every note in the vault as a pinned root', () => {
		const settings = settingsWith({ parentKey: 'toString' });
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Meeting.md', { frontmatter: { topic: 'standup' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.results)).toEqual(['Epic']);
		expect(model.ignoredCount).toBe(1);
	});

	it('still reads a note that genuinely owns the key', () => {
		const settings = settingsWith({ parentKey: 'toString' });
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Child.md', { frontmatter: { type: 'Feature', order: 10, toString: '[[Epic]]' } });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(names(model.roots)).toEqual(['Epic']);
		expect(names(model.roots[0].children)).toEqual(['Child']);
	});
});
