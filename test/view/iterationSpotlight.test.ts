// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { assembleStyles } from '../../scripts/styles-assemble.mjs';
import { FakeVault } from '../helpers/vault';
import { makeView, refresh, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * Walking the board one person at a time: a chip per person in the header, and pressing
 * one dims every card that is not theirs. Session state — it survives a data update and
 * not a new view.
 */
const OPTIONS = {
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	iterationProperty: 'note.iteration',
	iterationOpenStates: 'New',
	iterationResolvedStates: 'Done',
	assigneeProperty: 'note.assignee',
};

const SPRINT = 'Sprint 12.md';
const IN = '[[Sprint 12]]';

/** Bo holds two cards, Ada one, one is nobody's; `Feature` is excluded and Ada's. */
function sprintVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
	vault.addFile('Feature.md', { frontmatter: { type: 'Feature', order: 5, status: 'Doing', assignee: 'Ada' } });
	vault.addFile('A1.md', { frontmatter: { type: 'PBI', order: 10, status: 'New', iteration: IN, assignee: 'Bo' } });
	vault.addFile('A2.md', { frontmatter: { type: 'PBI', order: 20, status: 'Doing', iteration: IN, assignee: 'Bo' } });
	vault.addFile('B1.md', {
		frontmatter: { type: 'PBI', order: 30, status: 'New', iteration: IN, assignee: 'Ada' },
		parentLink: 'Feature',
	});
	vault.addFile('N1.md', { frontmatter: { type: 'PBI', order: 40, status: 'Done', iteration: IN } });
	return vault;
}

function onSprint(vault = sprintVault(), except: string[] = []) {
	const harness = makeView(vault, OPTIONS, { base: 'Plan.base', except });
	harness.view.setProjection('iteration');
	harness.view.setBoardScope(SPRINT);
	return harness;
}

const chips = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLButtonElement>('.pbl-iteration-people button.pbl-iteration-person'));
const chip = (root: HTMLElement, name: string) => {
	const found = chips(root).find((b) => b.querySelector('.pbl-iteration-person-name')?.textContent === name);
	if (!found) throw new Error(`chip not found: ${name}`);
	return found;
};
const card = (root: HTMLElement, path: string) => {
	const found = root.querySelector<HTMLElement>(`.pbl-card[data-path="${path}"]`);
	if (!found) throw new Error(`card not found: ${path}`);
	return found;
};
const dimmed = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>('.pbl-card.pbl-spot-dim')).map((c) => c.dataset.path);
const counts = (root: HTMLElement) =>
	Array.from(root.querySelectorAll('.pbl-board-col-count')).map((c) => c.textContent);

describe('the person spotlight', () => {
	it('lists the people by name with their counts, Unassigned last', () => {
		const { containerEl } = onSprint();
		const row = containerEl.querySelector('.pbl-iteration-header .pbl-iteration-people');
		expect(row?.querySelector('.pbl-iteration-people-label')?.textContent).toBe('Walk the board');
		expect(
			chips(containerEl).map((b) => [
				b.querySelector('.pbl-iteration-avatar')?.textContent,
				b.querySelector('.pbl-iteration-person-name')?.textContent,
				b.querySelector('.pbl-iteration-count')?.textContent,
			]),
		).toEqual([
			['A', 'Ada', '1'],
			['B', 'Bo', '2'],
			['?', 'Unassigned', '1'],
		]);
		for (const b of chips(containerEl)) {
			expect(b.getAttribute('aria-pressed')).toBe('false');
			expect(b.tabIndex).toBe(0);
		}
	});

	it('draws no people row for an empty sprint', () => {
		const vault = new FakeVault();
		vault.addFile(SPRINT, { frontmatter: { type: 'Iteration', order: 10 } });
		vault.addFile('Other.md', { frontmatter: { type: 'PBI', order: 10, status: 'New' } });
		expect(onSprint(vault).containerEl.querySelector('.pbl-iteration-people')).toBeNull();
	});

	it('draws no people row, and dims nothing, with no assignee property', () => {
		const { assigneeProperty: _unused, ...unassigned } = OPTIONS;
		const harness = makeView(sprintVault(), unassigned, { base: 'Plan.base' });
		harness.view.setProjection('iteration');
		// A spotlight left over from before the property was unset is cleared, not applied —
		// even the Unassigned key, which every card would otherwise match.
		harness.view.setSpotlight('');
		harness.view.setBoardScope(SPRINT);
		expect(harness.containerEl.querySelector('.pbl-iteration-people')).toBeNull();
		expect(harness.view.spotlight).toBeNull();
		expect(harness.containerEl.querySelectorAll('.pbl-spot-dim')).toHaveLength(0);
	});

	it("dims every card but the person's, and a second press clears it", () => {
		const { view, containerEl } = onSprint();
		const before = counts(containerEl);
		const bo = chip(containerEl, 'Bo');
		bo.focus();
		bo.click();
		expect(view.spotlight).toBe('Bo');
		expect(dimmed(containerEl).sort()).toEqual(['B1.md', 'N1.md']);
		expect(bo.getAttribute('aria-pressed')).toBe('true');
		expect(chip(containerEl, 'Ada').getAttribute('aria-pressed')).toBe('false');
		// Obsidian's tooltip is the chip's accessible name, so it names the person when
		// pressed as well — never "Show everyone" alone.
		expect(bo.dataset.tooltip).toBe('Showing Bo; press to show everyone');
		expect(chip(containerEl, 'Ada').dataset.tooltip).toBe("Show Ada's cards; dim the rest");
		// Updated in place: the chip pressed is still the one in the document, holding focus.
		expect(bo.isConnected).toBe(true);
		expect(containerEl.ownerDocument.activeElement).toBe(bo);
		// The dim is visual only: no column count moves.
		expect(counts(containerEl)).toEqual(before);

		bo.click();
		expect(view.spotlight).toBeNull();
		expect(dimmed(containerEl)).toEqual([]);
		expect(bo.getAttribute('aria-pressed')).toBe('false');
	});

	it('spotlights the Unassigned group', () => {
		const { containerEl } = onSprint();
		chip(containerEl, 'Unassigned').click();
		expect(chip(containerEl, 'Unassigned').dataset.tooltip).toBe('Showing Unassigned; press to show everyone');
		expect(dimmed(containerEl).sort()).toEqual(['A1.md', 'A2.md', 'B1.md']);
	});

	it('clears on Escape from the pressed chip', () => {
		const { view, containerEl } = onSprint();
		const ada = chip(containerEl, 'Ada');
		ada.click();
		ada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(view.spotlight).toBeNull();
		expect(dimmed(containerEl)).toEqual([]);
		expect(ada.getAttribute('aria-pressed')).toBe('false');
	});

	it('never dims a context card', () => {
		const { containerEl } = onSprint(sprintVault(), ['Feature.md']);
		expect(card(containerEl, 'Feature.md').classList.contains('pbl-card-context')).toBe(true);
		chip(containerEl, 'Bo').click();
		expect(card(containerEl, 'Feature.md').classList.contains('pbl-spot-dim')).toBe(false);
	});

	it('survives a data update, and the redrawn chip is pressed', () => {
		const vault = sprintVault();
		const { view, containerEl } = onSprint(vault);
		chip(containerEl, 'Bo').click();
		refresh(view, vault);
		expect(view.spotlight).toBe('Bo');
		expect(dimmed(containerEl).sort()).toEqual(['B1.md', 'N1.md']);
		expect(chip(containerEl, 'Bo').getAttribute('aria-pressed')).toBe('true');
	});

	it("clears when the person's last card leaves the sprint", () => {
		const vault = sprintVault();
		const { view, containerEl } = onSprint(vault);
		chip(containerEl, 'Ada').click();
		vault.addFile('B1.md', {
			frontmatter: { type: 'PBI', order: 30, status: 'New', iteration: '[[Elsewhere]]', assignee: 'Ada' },
			parentLink: 'Feature',
		});
		refresh(view, vault);
		expect(view.spotlight).toBeNull();
		expect(dimmed(containerEl)).toEqual([]);
		expect(chips(containerEl).some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
	});

	it('carries across a switch of sprint, and clears where its person holds nothing', () => {
		const vault = sprintVault();
		vault.addFile('Sprint 13.md', { frontmatter: { type: 'Iteration', order: 20 } });
		vault.addFile('C1.md', { frontmatter: { type: 'PBI', order: 50, status: 'New', iteration: '[[Sprint 13]]', assignee: 'Bo' } });
		vault.addFile('C2.md', { frontmatter: { type: 'PBI', order: 60, status: 'New', iteration: '[[Sprint 13]]', assignee: 'Cy' } });
		const { view, containerEl } = onSprint(vault);
		chip(containerEl, 'Bo').click();
		view.setBoardScope('Sprint 13.md');
		expect(view.spotlight).toBe('Bo');
		expect(chip(containerEl, 'Bo').getAttribute('aria-pressed')).toBe('true');
		expect(dimmed(containerEl)).toEqual(['C2.md']);

		view.setBoardScope(SPRINT);
		chip(containerEl, 'Ada').click();
		view.setBoardScope('Sprint 13.md');
		expect(view.spotlight).toBeNull();
		expect(dimmed(containerEl)).toEqual([]);
	});

	it('is not restored by a new view', () => {
		const vault = sprintVault();
		chip(onSprint(vault).containerEl, 'Bo').click();
		const second = onSprint(vault);
		expect(second.view.spotlight).toBeNull();
		expect(dimmed(second.containerEl)).toEqual([]);
	});

	it('keeps the selected card at full opacity while it is dimmed', () => {
		const sheet = document.head.createEl('style', { text: assembleStyles() });
		const opacityOf = (cls: string): string => {
			const el = document.body.createDiv({ cls });
			const value = getComputedStyle(el).opacity;
			el.remove();
			return value;
		};
		// The selection ring is drawn on the card itself, so a faded card fades its ring.
		expect(opacityOf('pbl-card pbl-spot-dim')).toBe('0.3');
		expect(opacityOf('pbl-card pbl-spot-dim pbl-selected')).toBe('1');
		sheet.remove();
	});
});
