// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { useViewHarness } from '../helpers/view';
import { roadmapView, rowFor, timelineRows } from '../helpers/roadmap';

/**
 * The arrow layer on the dated axis — `renderDependencyArrows` in
 * `src/view/render/timeline.ts`, drawing exactly the edges `dependencyArrows`
 * (`src/domain/dependencies.ts`, Task 1) hands it. Which pairs have an edge at all is
 * that module's own suite (`test/domain/dependencyArrows.test.ts`); this asks only
 * whether the layer draws one element per edge, marks a conflict on both ends, adds
 * nothing focusable, and writes nothing — `docs/requirements/Arrows between bars.md`.
 */

useViewHarness();

const DATES = { startProperty: 'note.start', targetProperty: 'note.due', dependsOnProperty: 'note.dependsOn' };

function arrows(containerEl: HTMLElement): HTMLElement[] {
	return Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-dependency-arrow'));
}

describe('one element per edge', () => {
	it('draws exactly the edges dependencyArrows returns, not one per pair of rows', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-09-01', due: '2026-09-05' } });
		vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 40, start: '2026-09-10', due: '2026-09-20' } });
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(4);
		expect(arrows(containerEl)).toHaveLength(1);
	});

	it('draws nothing when dependencyArrows returns no edge at all — a shelved prerequisite has no bar', () => {
		// Which pairs have an edge is Task 1's own rule (`dependencyArrows`, covering the
		// Base filter, broken edges and no-bar ends alike) and this suite does not
		// re-test it — only that an empty edge list costs the layer nothing to draw.
		const vault = new FakeVault();
		vault.addFile('Undated.md', { frontmatter: { type: 'PBI', order: 10 } }); // shelved: no bar
		vault.addFile('Waiter.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Undated', start: '2026-08-10', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(1);
		expect(arrows(containerEl)).toHaveLength(0);
	});

	it('draws nothing for an edge whose dependent lies wholly outside the drawn window', () => {
		// The window clamps around today once the plan spans more than MAX_TIMELINE_DAYS
		// (`timelineWindow`); a bar centuries out still renders (as an outside mark) but
		// `dependencyAnchor` reports it has nothing of itself in view — the render-time
		// half of 1a no domain edge list can see.
		const vault = new FakeVault();
		vault.addFile('Anchor.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('Far.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Anchor', start: '2200-01-01', due: '2200-01-05' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(timelineRows(containerEl)).toHaveLength(2);
		expect(arrows(containerEl)).toHaveLength(0);
	});
});

describe('a conflict is marked on the arrow and the dependent row, and only those', () => {
	it('marks exactly the conflicting edge and its dependent, leaving the other pair unmarked', () => {
		const vault = new FakeVault();
		vault.addFile('Prereq1.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('Clear.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'Prereq1', start: '2026-08-15', due: '2026-08-20' },
		});
		vault.addFile('Prereq2.md', { frontmatter: { type: 'PBI', order: 30, start: '2026-08-01', due: '2026-08-10' } });
		vault.addFile('Overlap.md', {
			frontmatter: { type: 'PBI', order: 40, dependsOn: 'Prereq2', start: '2026-08-05', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(2);
		expect(arrows(containerEl).filter((a) => a.hasClass('pbl-dependency-arrow-conflict'))).toHaveLength(1);
		expect(rowFor(containerEl, 'Clear')?.hasClass('pbl-row-conflict')).toBe(false);
		expect(rowFor(containerEl, 'Overlap')?.hasClass('pbl-row-conflict')).toBe(true);
	});
});

describe('nothing about the layer is focusable or written', () => {
	it('adds no tabindex and leaves the pane at one selection stop per row', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		const { containerEl } = roadmapView(vault, { ...DATES });

		expect(arrows(containerEl)).toHaveLength(1);
		expect(arrows(containerEl).every((a) => !a.hasAttribute('tabindex'))).toBe(true);
		expect(arrows(containerEl).every((a) => a.getAttribute('aria-hidden') === 'true')).toBe(true);
		// One selection stop per row, unchanged by the arrow layer: still one id'd row
		// per bar, nothing else added to the roving-selection surface.
		expect(containerEl.querySelectorAll('[role="option"]')).toHaveLength(timelineRows(containerEl).length);
	});

	it('writes nothing at all while rendering with the dependency key bound', () => {
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10, start: '2026-08-01', due: '2026-08-05' } });
		vault.addFile('B.md', {
			frontmatter: { type: 'PBI', order: 20, dependsOn: 'A', start: '2026-08-10', due: '2026-08-20' },
		});
		roadmapView(vault, { ...DATES });

		expect(vault.writeLog).toEqual([]);
	});
});
