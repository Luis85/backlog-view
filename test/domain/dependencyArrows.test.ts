import { describe, expect, it } from 'vitest';
import { deriveBars, TimelineBar } from '../../src/domain/bars';
import { dependencyArrows } from '../../src/domain/dependencies';
import { buildModel } from '../../src/domain/model';
import { defaultSettings } from '../../src/domain/settings';
import { FakeVault } from '../helpers/vault';

/**
 * Which prerequisite edges have two bars to draw between, and which of those contradict
 * their own dates — from `Arrows between bars`' Extensions. Driven through `buildModel` +
 * `deriveBars`, the same way `dependencies.test.ts` drives resolution, because the rules
 * here are about what the whole pipeline produces, not about `dependencyArrows` in
 * isolation.
 */

const settings = { ...defaultSettings(), dependsOnKey: 'dependsOn', startKey: 'start', targetKey: 'target' };

function barsFor(vault: FakeVault): TimelineBar[] {
	const model = buildModel(vault.app, vault.entries(), settings);
	return deriveBars(model.items).bars;
}

/** Titles, so a test reads as the sentence it is checking. */
function edges(bars: TimelineBar[]): Array<{ from: string; to: string; conflict: boolean }> {
	return dependencyArrows(bars).map((a) => ({ from: a.from.item.title, to: a.to.item.title, conflict: a.conflict }));
}

describe('which edges draw', () => {
	it('draws nothing when the prerequisite has no bar (1a)', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } }); // dateless: shelved
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-01', target: '2026-08-10' },
		});

		expect(edges(barsFor(vault))).toEqual([]);
	});

	it('draws nothing when the dependent has no bar (1b)', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } }); // dateless: shelved

		expect(edges(barsFor(vault))).toEqual([]);
	});

	it('draws nothing across the Base filter — needs no special case, since a context row never gets a bar (1c)', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, start: '2026-08-01', target: '2026-08-31' } });
		vault.addFile('Inside.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Epic', start: '2026-09-01', target: '2026-09-10' },
			parentLink: 'Epic',
		});
		// The epic is context: loaded as an ancestor, not returned by the base.
		const model = buildModel(
			vault.app,
			vault.entries().filter((entry) => entry.file.path !== 'Epic.md'),
			settings,
		);
		expect(model.byPath.get('Epic.md')?.outsideFilter).toBe(true);
		// The resolved edge is real — Waiter's row still states it (step 3, Task 3's concern).
		expect(model.byPath.get('Waiter.md')?.prerequisites.map((p) => p.title)).toEqual(['Epic']);

		expect(edges(deriveBars(model.items).bars)).toEqual([]);
	});

	it('draws nothing for an edge the model already marked broken (1d)', () => {
		const vault = new FakeVault();
		// A self-naming cycle: both notes dated, both broken.
		vault.addFile('A.md', {
			frontmatter: { type: 'PBI', order: 10, dependsOn: 'B', start: '2026-08-01', target: '2026-08-10' },
		});
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-11', target: '2026-08-20' },
		});
		const model = buildModel(vault.app, vault.entries(), settings);
		expect(model.byPath.get('A.md')?.brokenPrerequisites).toEqual(['B']);

		expect(edges(deriveBars(model.items).bars)).toEqual([]);
	});

	it('takes part like anything else for a milestone (1e), whose two ends are the same day', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, target: '2026-08-10' } });
		vault.addFile('Followup.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Ship', start: '2026-08-10', target: '2026-08-20' },
		});

		expect(edges(barsFor(vault))).toEqual([{ from: 'Ship', to: 'Followup', conflict: true }]);
	});

	it('draws an ordinary edge with two bars and no conflict', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-15', target: '2026-08-20' },
		});

		expect(edges(barsFor(vault))).toEqual([{ from: 'A', to: 'B', conflict: false }]);
	});
});

describe('conflict — dependent.start <= prerequisite.end', () => {
	function conflictOf(startB: string): boolean {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: startB, target: '2026-08-20' },
		});
		return edges(barsFor(vault))[0]?.conflict ?? false;
	}

	it('is a conflict when the dependent starts the same day the prerequisite ends', () => {
		expect(conflictOf('2026-08-10')).toBe(true);
	});

	it('is not a conflict when the dependent starts one day later', () => {
		expect(conflictOf('2026-08-11')).toBe(false);
	});

	it('rests only on dates the two notes state (2a): a stated target and a rolled-up start still conflicts', () => {
		const vault = new FakeVault();
		// Parent's own target is stated; its start comes only from the Child's evidence.
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, target: '2026-08-10' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-07-01' }, parentLink: 'Parent' });
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Parent', start: '2026-08-10', target: '2026-08-20' },
		});
		const model = buildModel(vault.app, vault.entries(), settings);
		const parent = model.byPath.get('Parent.md');
		expect(parent?.plannedTarget.value).not.toBeNull(); // stated
		const parentBar = deriveBars(model.items).bars.find((b) => b.item.title === 'Parent');
		expect(parentBar?.inferredStart).toBe(true); // rolled up, and irrelevant to the comparison

		expect(edges(deriveBars(model.items).bars)).toEqual([{ from: 'Parent', to: 'Waiter', conflict: true }]);
	});

	it('rests only on dates the two notes state (2a): a rolled-up prerequisite end does not conflict', () => {
		const vault = new FakeVault();
		// Parent's own start is stated; its target comes only from the Child's evidence.
		vault.addFile('Parent.md', { frontmatter: { type: 'Feature', order: 10, start: '2026-08-01' } });
		vault.addFile('Child.md', { frontmatter: { type: 'PBI', order: 10, target: '2026-08-10' }, parentLink: 'Parent' });
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Parent', start: '2026-08-10', target: '2026-08-20' },
		});
		const model = buildModel(vault.app, vault.entries(), settings);
		const parentBar = deriveBars(model.items).bars.find((b) => b.item.title === 'Parent');
		expect(parentBar?.inferredEnd).toBe(true);

		expect(edges(deriveBars(model.items).bars)).toEqual([{ from: 'Parent', to: 'Waiter', conflict: false }]);
	});

	it('rests only on dates the two notes state (2a): an absent prerequisite end does not conflict', () => {
		const vault = new FakeVault();
		// A prerequisite with only a start stated: an open end, never a date to compare.
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-05', target: '2026-08-20' },
		});
		const bars = barsFor(vault);
		expect(bars.find((b) => b.item.title === 'A')?.span.target).toBeNull();

		expect(edges(bars)).toEqual([{ from: 'A', to: 'B', conflict: false }]);
	});

	it('an absent dependent start does not conflict, and still draws — an open end (1g) is not a shelved dependent (2b)', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		// A dependent with only a target stated: an open start, and still a bar.
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', target: '2026-08-20' } });
		const bars = barsFor(vault);
		expect(bars.find((b) => b.item.title === 'B')?.span.start).toBeNull();

		expect(edges(bars)).toEqual([{ from: 'A', to: 'B', conflict: false }]);
	});

	it('a shelved dependent is never in conflict (2b) — it has no bar and no arrow at all', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } }); // no dates at all: shelved

		const bars = barsFor(vault);
		expect(bars.find((b) => b.item.title === 'B')).toBeUndefined();
		expect(edges(bars)).toEqual([]);
	});
});
