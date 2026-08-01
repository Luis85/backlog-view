// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { ALL_TYPES, EXTRA_TYPES } from '../../src/domain/settings';
import { Menu, Notice } from '../helpers/obsidian-mock';
import { drag, fixture, flush, key, makeView, rowByTitle, rows, titlesOf, treeOf, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The stylesheet as shipped. Appearance cannot be tested here, but a rule that was
 * deliberately REMOVED can be kept out — otherwise it comes back unnoticed.
 */
const styles = readFileSync('styles.css', 'utf8');

describe('rendering', () => {
	it('styles every declared type — none falls through to bare text', () => {
		// `renderBadge` has no fallback for a declared type, because the vocabulary is
		// fixed and its two tables (level icons, extra-type styles) cover all of it. This
		// is what keeps that true across BOTH tables and the stylesheet: add a type
		// without an icon, or a colour class with no CSS rule, and this fails.
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('Feature.md', { frontmatter: { type: 'Feature' }, parentLink: 'Epic' });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI' }, parentLink: 'Feature' });
		vault.addFile('Task.md', { frontmatter: { type: 'Task' }, parentLink: 'PBI' });
		for (const type of EXTRA_TYPES) {
			vault.addFile(`${type}.md`, { frontmatter: { type }, parentLink: 'Epic' });
		}
		const { containerEl } = makeView(vault);

		const seen = new Set<string>();
		for (const type of ALL_TYPES) {
			const badge = rowByTitle(containerEl, type).querySelector<HTMLElement>('.pbl-badge');
			expect(badge?.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBeTruthy();
			const colour = [...(badge?.classList ?? [])].find((c) => c.startsWith('pbl-lvl-'));
			expect(colour).toBeDefined();
			expect(colour).not.toBe('pbl-lvl-unknown');
			// The class has to be one the shipped stylesheet actually paints, and no two
			// types may share it — a colour is how a rung is told apart at a glance.
			expect(styles).toContain(`.${colour} {`);
			expect(seen.has(colour ?? '')).toBe(false);
			seen.add(colour ?? '');
		}
	});

	it('gives each shipped extra type its own icon and badge colour', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic' } });
		vault.addFile('An issue.md', { frontmatter: { type: 'Issue' }, parentLink: 'Epic' });
		vault.addFile('A bug.md', { frontmatter: { type: 'Bug' }, parentLink: 'Epic' });
		// A type outside the vocabulary keeps its name and gets no icon at all — the
		// bare-text treatment for something this view knows nothing about.
		vault.addFile('A spike.md', { frontmatter: { type: 'Spike' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault);

		const badge = (title: string) => rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-badge');
		const icon = (title: string) =>
			rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon;

		expect(icon('An issue')).toBe('circle-alert');
		expect(icon('A bug')).toBe('bug');

		// Colours are their own rather than a slot after the ladder, and distinct from
		// each other and from every level (0-3).
		expect(badge('An issue')?.classList.contains('pbl-lvl-issue')).toBe(true);
		expect(badge('A bug')?.classList.contains('pbl-lvl-bug')).toBe(true);
		expect(badge('A spike')?.classList.contains('pbl-lvl-unknown')).toBe(true);
	});

	it('mutes a done row without striking its title through', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', status: 'Done' } });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		// Muting is the whole signal; the strike-through said it twice and made a
		// finished item harder to read.
		expect(rowByTitle(containerEl, 'Epic').classList.contains('pbl-done')).toBe(true);
		expect(styles).not.toContain('line-through');
	});

	it('renders the hierarchy with badges, depths and tree semantics', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(treeOf(containerEl).getAttribute('role')).toBe('tree');

		const epicRow = rowByTitle(containerEl, 'Epic A');
		expect(epicRow.getAttribute('aria-level')).toBe('1');
		expect(epicRow.getAttribute('aria-posinset')).toBe('1');
		expect(epicRow.getAttribute('aria-setsize')).toBe('2');
		expect(epicRow.style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(epicRow.querySelector('.pbl-badge')?.textContent).toBe('Epic');
		expect(epicRow.querySelector<HTMLElement>('.pbl-badge-icon')?.dataset.icon).toBe('crown');
		// The grip is a pointer affordance only — the row itself is draggable
		expect(epicRow.querySelector('.pbl-grip')?.getAttribute('aria-hidden')).toBe('true');

		const featureRow = rowByTitle(containerEl, 'Feature B1');
		expect(featureRow.getAttribute('aria-level')).toBe('2');
		expect(featureRow.getAttribute('aria-posinset')).toBe('1');
		expect(featureRow.getAttribute('aria-setsize')).toBe('2');
		expect(featureRow.style.getPropertyValue('--pbl-depth')).toBe('1');
		expect(featureRow.querySelector('.pbl-badge')?.textContent).toBe('Feature');

		expect(rowByTitle(containerEl, 'Epic B').getAttribute('aria-expanded')).toBe('true');
	});

	it('shows the empty state with a create button when nothing matches', () => {
		const { containerEl } = makeView(new FakeVault());
		expect(containerEl.querySelector('.pbl-empty')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-empty button')?.textContent).toContain('New Epic');
	});

	it('renders progress rollups and done styling when a state property is set', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic' });
		vault.addFile('F2.md', { frontmatter: { type: 'Feature', order: 20, status: 'Open' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const epicRow = rowByTitle(containerEl, 'Epic');
		expect(epicRow.querySelector('.pbl-progress-label')?.textContent).toBe('1/2');
		expect(epicRow.querySelector<HTMLElement>('.pbl-progress-fill')?.style.getPropertyValue('--pbl-progress')).toBe('50%');
		expect(epicRow.querySelector('.pbl-progress')?.classList.contains('pbl-complete')).toBe(false);
		expect(rowByTitle(containerEl, 'F1').classList.contains('pbl-done')).toBe(true);
		expect(rowByTitle(containerEl, 'F2').classList.contains('pbl-done')).toBe(false);
	});

	it('marks a fully done rollup as complete', () => {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('F1.md', { frontmatter: { type: 'Feature', order: 10, status: 'Done' }, parentLink: 'Epic' });
		const { containerEl } = makeView(vault, { stateProperty: 'note.status' });

		const progress = rowByTitle(containerEl, 'Epic').querySelector('.pbl-progress');
		expect(progress?.classList.contains('pbl-complete')).toBe(true);
	});

	it('re-roots on the focus level and labels the New button accordingly', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { focusLevel: 'Feature' });

		expect(titlesOf(containerEl)).toEqual(['Feature B1', 'Feature B2']);
		expect(rowByTitle(containerEl, 'Feature B1').style.getPropertyValue('--pbl-depth')).toBe('0');
		expect(containerEl.querySelector('.pbl-new-btn')?.textContent).toContain('New Feature');
	});

	it('picks the focus level from the toolbar', () => {
		const { containerEl, config } = makeView(fixture());

		const btn = containerEl.querySelector<HTMLElement>('.pbl-focus-btn');
		expect(btn?.textContent).toContain('All types');
		// Nothing is focused, so there is nothing to clear
		expect(containerEl.querySelector('.pbl-focus-clear')).toBeNull();

		btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.items.map((i) => i.titleText)).toEqual(['All types', 'Epic', 'Feature', 'PBI', 'Task', 'Issue', 'Bug']);
		expect(Menu.lastShown?.item('All types')?.checked).toBe(true);
		Menu.lastShown?.item('Feature')?.click();
		expect(config.setCalls.some((c) => c.key === 'focusLevel' && c.value === 'Feature')).toBe(true);
	});

	it('shows the active focus level with a one-click way back to all levels', () => {
		const { containerEl, config } = makeView(fixture(), { focusLevel: 'Feature' });

		const focusEl = containerEl.querySelector<HTMLElement>('.pbl-focus');
		expect(focusEl?.classList.contains('pbl-focus-active')).toBe(true);
		expect(focusEl?.querySelector('.pbl-focus-btn')?.textContent).toContain('Feature');
		containerEl.querySelector<HTMLElement>('.pbl-focus-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(Menu.lastShown?.item('Feature')?.checked).toBe(true);

		containerEl
			.querySelector<HTMLElement>('.pbl-focus-clear')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(config.setCalls.some((c) => c.key === 'focusLevel' && c.value === '')).toBe(true);
	});

	it('marks child groups with their parent depth for indent guides', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);

		const group = rowByTitle(containerEl, 'Feature B1').parentElement;
		expect(group?.classList.contains('pbl-children')).toBe(true);
		expect(group?.style.getPropertyValue('--pbl-depth')).toBe('0');
	});

	it('warns about corrupt configuration and blocks writes', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });

		expect(containerEl.querySelector('.pbl-config-warning')).not.toBeNull();

		const tree = treeOf(containerEl);
		key(tree, 'ArrowDown');
		key(tree, 'ArrowDown', { altKey: true });
		await flush();
		expect(vault.writeLog).toHaveLength(0);
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('blocks item creation while the configuration is corrupt', () => {
		const vault = fixture();
		const { containerEl } = makeView(vault, { orderProperty: 'note.parent' });
		const fileCount = vault.files.size;

		containerEl.querySelector<HTMLElement>('.pbl-new-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
		expect(vault.files.size).toBe(fileCount);
		expect(vault.writeLog).toHaveLength(0);
	});
});

describe('row columns', () => {
	function statedVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 10, status: 'Active' } });
		vault.addFile('A very long feature title indeed.md', {
			frontmatter: { type: 'Feature', order: 10, status: 'Done' },
			parentLink: 'Epic',
		});
		vault.addFile('Short.md', { frontmatter: { type: 'Feature', order: 20 }, parentLink: 'Epic' });
		return vault;
	}

	it('puts the state chip in a column of its own, after the flexible spacer', () => {
		const { containerEl } = makeView(statedVault(), { stateProperty: 'note.status' });

		for (const row of rows(containerEl)) {
			const col = row.querySelector('.pbl-state-col');
			expect(col).not.toBeNull();
			expect(col?.querySelector('.pbl-state-chip')).not.toBeNull();
			// The spacer absorbs the free space, so the column lands at a fixed offset
			expect(col?.previousElementSibling?.classList.contains('pbl-row-spacer')).toBe(true);
		}
	});

	it('gives every row a rollup column, even leaves, so the columns line up', () => {
		const { containerEl } = makeView(statedVault(), { stateProperty: 'note.status' });

		const epic = rowByTitle(containerEl, 'Epic');
		const leaf = rowByTitle(containerEl, 'Short');
		expect(epic.querySelector('.pbl-meta-col .pbl-progress-label')?.textContent).toBe('1/2');
		expect(leaf.querySelector('.pbl-meta-col')).not.toBeNull();
		expect(leaf.querySelector('.pbl-progress')).toBeNull();
		expect(epic.querySelector('.pbl-state-col')?.nextElementSibling).toBe(epic.querySelector('.pbl-meta-col'));
	});

	it('drops both columns when neither states nor counts are configured', () => {
		const { containerEl } = makeView(statedVault(), { showCounts: false });
		const epic = rowByTitle(containerEl, 'Epic');
		expect(epic.querySelector('.pbl-state-col')).toBeNull();
		expect(epic.querySelector('.pbl-meta-col')).toBeNull();
	});
});

describe('targeted subtree rendering', () => {
	it('collapses and expands without rebuilding the rest of the tree', () => {
		const { containerEl } = makeView(fixture());
		const epicA = rowByTitle(containerEl, 'Epic A');
		const epicB = rowByTitle(containerEl, 'Epic B');
		const chevron = epicB.querySelector<HTMLElement>('.pbl-chevron');

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B']);
		expect(epicB.getAttribute('aria-expanded')).toBe('false');
		expect(chevron?.classList.contains('pbl-expanded')).toBe(false);
		// Untouched rows keep their identity — the tree was not rebuilt
		expect(rowByTitle(containerEl, 'Epic A')).toBe(epicA);
		expect(rowByTitle(containerEl, 'Epic B')).toBe(epicB);

		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(titlesOf(containerEl)).toEqual(['Epic A', 'Epic B', 'Feature B1', 'Feature B2']);
		expect(epicB.getAttribute('aria-expanded')).toBe('true');
		expect(rowByTitle(containerEl, 'Epic A')).toBe(epicA);
	});

	it('keeps re-expanded children fully interactive', async () => {
		const vault = fixture();
		const { containerEl } = makeView(vault);
		const chevron = rowByTitle(containerEl, 'Epic B').querySelector<HTMLElement>('.pbl-chevron');
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// A rebuilt child row must still open, drag and rank like any other
		const b2 = rowByTitle(containerEl, 'Feature B2');
		b2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(vault.opened.map((o) => o.path)).toEqual(['Feature B2.md']);

		drag(b2, rowByTitle(containerEl, 'Feature B1'), 'before');
		await flush();
		// Ranked ahead of Feature B1 (order 10), a full spacing below it
		expect(vault.fm('Feature B2.md').order).toBe(0);
	});

	it('drops the collapsed subtree from the selection index', () => {
		const { view, containerEl } = makeView(fixture());
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Feature B1.md') as never);
		expect(tree.getAttribute('aria-activedescendant')).not.toBeNull();

		rowByTitle(containerEl, 'Epic B')
			.querySelector<HTMLElement>('.pbl-chevron')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The selected row is gone; nothing may point at a detached element
		expect(tree.getAttribute('aria-activedescendant')).toBeNull();
	});
});
