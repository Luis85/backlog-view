import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

const settings = defaultSettings();

describe('date evidence rolls up the tree', () => {
	const dated = { ...settings, startKey: 'start', targetKey: 'due' };

	it('gathers the earliest start and the latest target from below, never from self', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-01-01', due: '2026-12-31' } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-03-01', due: '2026-04-01' }, parentLink: 'Epic' });
		vault.addFile('B.md', { frontmatter: { type: 'Feature', order: 20, start: '2026-02-01', due: '2026-06-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), dated);
		const epic = model.roots[0];

		// The epic's OWN dates are not evidence for itself — they are what evidence fills in for.
		expect(epic.descendantStart).toEqual({ year: 2026, month: 2, day: 1 });
		expect(epic.descendantTarget).toEqual({ year: 2026, month: 6, day: 1 });
		expect(epic.children[0].descendantStart).toBeNull();
		expect(epic.children[0].descendantTarget).toBeNull();
	});

	it('gathers through every level, not just immediate children', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Story.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-05-01', due: '2026-05-20' }, parentLink: 'Feature' });

		const model = buildModel(vault.app, vault.entries(), dated);

		expect(model.roots[0].descendantStart).toEqual({ year: 2026, month: 5, day: 1 });
		expect(model.roots[0].descendantTarget).toEqual({ year: 2026, month: 5, day: 20 });
	});

	it('keeps the kinds apart — a start is never evidence of a target', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-03-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), dated);

		expect(model.roots[0].descendantStart).toEqual({ year: 2026, month: 3, day: 1 });
		expect(model.roots[0].descendantTarget).toBeNull();
	});

	it('is not evidence when the reader refuses the value — a typo stays a typo', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: 'next tuesday', due: '2026-04-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), dated);

		expect(model.roots[0].descendantStart).toBeNull();
		expect(model.roots[0].descendantTarget).toEqual({ year: 2026, month: 4, day: 1 });
	});

	it('reads nothing when no date property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('A.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-03-01' }, parentLink: 'Epic' });

		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.roots[0].descendantStart).toBeNull();
	});
});
