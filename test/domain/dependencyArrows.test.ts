import { describe, expect, it } from 'vitest';
import { DatedAxis, deriveBars } from '../../src/domain/bars';
import { dependencyArrows } from '../../src/domain/dependencies';
import { buildModel } from '../../src/domain/model';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * Which prerequisite edges have two bars to draw between, which of those contradict
 * their own dates, and which SHELVED dependents contradict a prerequisite by the start
 * they state — from `Arrows between bars`' Extensions, main flow steps 1-2 and 2b. Driven
 * through `buildModel` + `deriveBars`, the same way `dependencies.test.ts` drives
 * resolution, because the rules here are about what the whole pipeline produces, not
 * about `dependencyArrows` in isolation.
 */

const settings = settingsWith({ dependsOnKey: 'dependsOn', startKey: 'start', targetKey: 'target' });

function datedAxis(vault: FakeVault): DatedAxis {
	const model = buildModel(vault.app, vault.entries(), settings);
	return deriveBars(model.items, false);
}

/** Titles, so a test reads as the sentence it is checking. */
function edges(axis: DatedAxis): Array<{ from: string; to: string; conflict: boolean }> {
	return dependencyArrows(axis.bars, axis.shelf).arrows.map((a) => ({
		from: a.from.item.title,
		to: a.to.item.title,
		conflict: a.conflict,
	}));
}

/** Paths of shelved dependents 2b marks in conflict — no arrow, so no `edges()` entry. */
function shelfConflicts(axis: DatedAxis): string[] {
	const conflicts = dependencyArrows(axis.bars, axis.shelf).conflicts;
	return axis.shelf.filter((card) => conflicts.has(card.item.file.path)).map((card) => card.item.file.path);
}

/** Which of ONE dependent's own prerequisites conflict — the widened, per-prerequisite shape (item 2). */
function conflictingPrereqs(axis: DatedAxis, dependent: string): string[] {
	return [...(dependencyArrows(axis.bars, axis.shelf).conflicts.get(dependent) ?? [])];
}

describe('which edges draw', () => {
	it('draws nothing when the prerequisite has no bar (1a)', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } }); // dateless: shelved
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-01', target: '2026-08-10' },
		});

		expect(edges(datedAxis(vault))).toEqual([]);
	});

	it('draws nothing when the dependent has no bar (1b)', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } }); // dateless: shelved

		expect(edges(datedAxis(vault))).toEqual([]);
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

		expect(edges(deriveBars(model.items, false))).toEqual([]);
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

		expect(edges(deriveBars(model.items, false))).toEqual([]);
	});

	it('takes part like anything else for a milestone (1e), whose two ends are the same day', () => {
		const vault = new FakeVault();
		vault.addFile('Ship.md', { frontmatter: { type: 'Milestone', order: 10, target: '2026-08-10' } });
		vault.addFile('Followup.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Ship', start: '2026-08-10', target: '2026-08-20' },
		});

		expect(edges(datedAxis(vault))).toEqual([{ from: 'Ship', to: 'Followup', conflict: true }]);
	});

	it('draws an ordinary edge with two bars and no conflict', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-15', target: '2026-08-20' },
		});

		expect(edges(datedAxis(vault))).toEqual([{ from: 'A', to: 'B', conflict: false }]);
	});
});

describe('conflict — dependent.start <= prerequisite.end', () => {
	function conflictOf(startB: string): boolean {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: startB, target: '2026-08-20' },
		});
		return edges(datedAxis(vault))[0]?.conflict ?? false;
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
		const axis = deriveBars(model.items, false);
		const parentBar = axis.bars.find((b) => b.item.title === 'Parent');
		expect(parentBar?.inferredStart).toBe(true); // rolled up, and irrelevant to the comparison

		expect(edges(axis)).toEqual([{ from: 'Parent', to: 'Waiter', conflict: true }]);
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
		const axis = deriveBars(model.items, false);
		const parentBar = axis.bars.find((b) => b.item.title === 'Parent');
		expect(parentBar?.inferredEnd).toBe(true);

		expect(edges(axis)).toEqual([{ from: 'Parent', to: 'Waiter', conflict: false }]);
	});

	it('rests only on dates the two notes state (2a): an absent prerequisite end does not conflict', () => {
		const vault = new FakeVault();
		// A prerequisite with only a start stated: an open end, never a date to compare.
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-05', target: '2026-08-20' },
		});
		const axis = datedAxis(vault);
		expect(axis.bars.find((b) => b.item.title === 'A')?.span.target).toBeNull();

		expect(edges(axis)).toEqual([{ from: 'A', to: 'B', conflict: false }]);
	});

	it('an absent dependent start does not conflict, and still draws — an open end (1g) is not a shelved dependent (2b)', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
		// A dependent with only a target stated: an open start, and still a bar.
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', target: '2026-08-20' } });
		const axis = datedAxis(vault);
		expect(axis.bars.find((b) => b.item.title === 'B')?.span.start).toBeNull();

		expect(edges(axis)).toEqual([{ from: 'A', to: 'B', conflict: false }]);
	});

	describe('a shelved dependent (2b): judged by the start it states, never by having shelved', () => {
		it('is exempt with no dates at all — unplanned is not late', () => {
			const vault = new FakeVault();
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
			vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: 'A' } }); // no dates: shelved

			const axis = datedAxis(vault);
			expect(axis.bars.find((b) => b.item.title === 'B')).toBeUndefined();
			expect(axis.shelf.find((c) => c.item.title === 'B')?.reason).toBeNull();
			expect(edges(axis)).toEqual([]);
			expect(shelfConflicts(axis)).toEqual([]);
		});

		it('is exempt with a start the reader refuses', () => {
			const vault = new FakeVault();
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
			vault.addFile('B.md', {
				frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: 'not-a-date', target: '2026-08-20' },
			});

			const axis = datedAxis(vault);
			expect(axis.shelf.find((c) => c.item.title === 'B')?.reason).toBe('Unreadable start date');
			expect(shelfConflicts(axis)).toEqual([]);
		});

		it('is in conflict with a stated, readable start when shelved for an unreadable target, if the prerequisite runs past it', () => {
			const vault = new FakeVault();
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
			vault.addFile('B.md', {
				frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-05', target: 'not-a-date' },
			});

			const axis = datedAxis(vault);
			expect(axis.shelf.find((c) => c.item.title === 'B')?.reason).toBe('Unreadable target date');
			expect(edges(axis)).toEqual([]); // still no arrow: B has no bar
			expect(shelfConflicts(axis)).toEqual(['B.md']);
		});

		it('identifies exactly WHICH shelved prerequisite conflicts, not merely that one does', () => {
			// A boolean `.some()` could only say "B has a conflict"; a dependent waiting on
			// several things has to name which one, the same rule main flow step 3 states
			// for a dated row — here for a shelved one instead (2b).
			const vault = new FakeVault();
			vault.addFile('Clear.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-07-01', target: '2026-07-05' } });
			vault.addFile('Late.md', { frontmatter: { type: 'PBI', order: 20, start: '2026-08-01', target: '2026-08-20' } });
			vault.addFile('B.md', {
				frontmatter: {
					type: 'PBI',
					order: 30,
					dependsOn: ['Clear', 'Late'],
					start: '2026-08-10',
					target: 'not-a-date',
				},
			});

			const axis = datedAxis(vault);
			expect(conflictingPrereqs(axis, 'B.md')).toEqual(['Late.md']);
		});

		it('is not in conflict with the same stated start once the prerequisite no longer runs past it', () => {
			const vault = new FakeVault();
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
			vault.addFile('B.md', {
				frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-11', target: 'not-a-date' },
			});

			const axis = datedAxis(vault);
			expect(axis.shelf.find((c) => c.item.title === 'B')?.reason).toBe('Unreadable target date');
			expect(shelfConflicts(axis)).toEqual([]);
		});

		it('is in conflict with a stated, readable start when shelved for a target before the start', () => {
			const vault = new FakeVault();
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
			vault.addFile('B.md', {
				frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-05', target: '2026-08-01' },
			});

			const axis = datedAxis(vault);
			expect(axis.shelf.find((c) => c.item.title === 'B')?.reason).toBe('Target date precedes the start date');
			expect(shelfConflicts(axis)).toEqual(['B.md']);
		});

		it('a shelved MARKER contributes no start here, however its frontmatter is spelled (1e)', () => {
			const vault = new FakeVault();
			vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', target: '2026-08-10' } });
			// No target: the marker shelves (reason null). Its stray start, read as an
			// ordinary dependent's, would run before the prerequisite's own end and
			// wrongly flag a conflict — which is exactly what must not happen (1e, 2b).
			vault.addFile('B.md', {
				frontmatter: { type: 'Milestone', order: 20, dependsOn: 'A', start: '2026-08-01' },
			});

			const axis = datedAxis(vault);
			const shelved = axis.shelf.find((c) => c.item.title === 'B');
			expect(shelved?.reason).toBeNull();
			expect(shelfConflicts(axis)).toEqual([]);
		});
	});
});
