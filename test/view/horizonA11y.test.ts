// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { cardByTitle } from '../helpers/board';
import { treeOf, useViewHarness } from '../helpers/view';
import { bucketByName, roadmapView } from '../helpers/roadmap';

useViewHarness();

/** What the horizon board says to a reader who cannot see it. */
const AXES = { horizonProperty: 'note.horizon', startProperty: 'note.start', targetProperty: 'note.due' };

function vault(): FakeVault {
	const v = new FakeVault();
	v.addFile('Placed.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
	v.addFile('Stray.md', { frontmatter: { type: 'Epic', order: 20, horizon: 'Someday', due: '2026-10-01' } });
	return v;
}

describe('horizon board accessibility', () => {
	it('says it is not declared in the group label and puts the tooltip on the stray mark', () => {
		// Obsidian's setTooltip writes `aria-label`, so a tooltip on the group would replace
		// its label — the mark is where the explanation goes.
		const { containerEl, view } = roadmapView(vault(), AXES);
		const stray = bucketByName(containerEl, 'Someday');
		expect(stray.getAttribute('aria-label')).toBe('Someday, not a declared horizon, 1 item');
		expect(stray.dataset.tooltip).toBeUndefined();
		expect(stray.querySelector<HTMLElement>('.pbl-bucket-stray')?.dataset.tooltip).toContain('not one of the declared horizons');
		view.setColumnCollapsed('horizons', 'Someday', true);
		expect(bucketByName(containerEl, 'Someday').getAttribute('aria-label')).toBe(
			'Someday, not a declared horizon, collapsed, 1 item',
		);
		expect(bucketByName(containerEl, 'Now').getAttribute('aria-label')).toBe('Now, 1 item');
	});

	it('describes the pane with its keyboard instructions, on the horizon axis only', () => {
		const { containerEl, view } = roadmapView(vault(), AXES);
		const tree = treeOf(containerEl);
		const id = tree.getAttribute('aria-describedby');
		expect(id).toBeTruthy();
		expect(document.getElementById(id!)?.textContent).toContain('Alt with left or right arrow moves the selected card one horizon');
		view.setAxisPick('dates');
		expect(treeOf(containerEl).hasAttribute('aria-describedby')).toBe(false);
	});

	it('names a card’s bucket as its description, not its label', () => {
		const { containerEl } = roadmapView(vault(), AXES);
		const card = cardByTitle(bucketByName(containerEl, 'Now'), 'Placed');
		expect(card.getAttribute('aria-description')).toBe('In Now');
		expect(card.hasAttribute('aria-label')).toBe(false);
	});

	it('turns the bucket New button’s fade off for reduced motion, at a specificity that wins', () => {
		// `roadmap.css` loads after `motion.css`, so the bare class would lose the tie.
		const motion = readFileSync('styles/motion.css', 'utf8');
		const block = motion.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition: none;/);
		expect(block?.[0]).toContain('.pbl-bucket-header .pbl-bucket-add');
		const roadmap = readFileSync('styles/roadmap.css', 'utf8');
		expect(roadmap).toMatch(/\.pbl-bucket-stray \{[^}]*color: var\(--text-muted\);/);
	});
});
