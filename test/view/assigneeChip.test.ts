// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault, FakeViewConfig } from '../helpers/vault';
import { ProductBacklogView } from '../../src/view/backlogView';
import { clickExpandAll, makeView, rowByTitle, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The assignee chip's third state — a value the note carries that names nobody in this
 * base's roster — beside the ordinary set/unset pair every other label chip has. See
 * `LABEL_CHIPS.assignee.broken` (`src/view/render/chips.ts`): the question is roster
 * MEMBERSHIP, never link resolution, so a link that resolves to an ordinary work item is
 * exactly as broken here as one that resolves to nothing at all — both name nobody this
 * base can offer.
 */
const ASSIGNEE = { assigneeProperty: 'note.assignee' };
const VISIBLE = { order: ['note.assignee'] };

function chipOf(containerEl: HTMLElement, title: string): HTMLElement | null {
	return rowByTitle(containerEl, title).querySelector<HTMLElement>('.pbl-assignee-chip');
}

describe('the assignee chip´s broken state', () => {
	it('reads as an ordinary, valid assignment when the link resolves to a roster resource', () => {
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: '[[Alex]]' } });
		const { containerEl } = makeView(vault, ASSIGNEE, VISIBLE);

		const chip = chipOf(containerEl, 'Epic A');
		expect(chip?.classList.contains('pbl-assignee-broken')).toBe(false);
		expect(chip?.textContent).toContain('Alex');
		expect(chip?.dataset.tooltip).toBe('Change assignee');
	});

	// `[[Epic B]]` is the brief's own example: a link that resolves to a REAL note, just
	// not a Resource this base's roster carries. Answering from resolution alone would
	// draw this as a valid pick — exactly the defect three surfaces disagreed over
	// before the roster-membership rule (PR #207).
	it('marks a link that resolves to an ordinary item, not a resource, as broken', () => {
		const vault = new FakeVault();
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20 } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: '[[Epic B]]' } });
		const { containerEl } = makeView(vault, ASSIGNEE, VISIBLE);

		const chip = chipOf(containerEl, 'Epic A');
		expect(chip?.classList.contains('pbl-assignee-broken')).toBe(true);
		expect(chip?.textContent).toContain('Epic B');
		expect(chip?.dataset.tooltip).toBe('This names no resource in this base.');
	});

	it('marks a plain name left over from before resources were notes as broken too', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: 'Sarah' } });
		const { containerEl } = makeView(vault, ASSIGNEE, VISIBLE);

		const chip = chipOf(containerEl, 'Epic A');
		expect(chip?.classList.contains('pbl-assignee-broken')).toBe(true);
		expect(chip?.textContent).toContain('Sarah');
	});

	it('gives a context row\'s own valid assignee the ordinary static tooltip, not the broken one', () => {
		// The other context-row test in `assignee.test.ts` names somebody plain-text who
		// resolves to nothing, which (correctly) reads as broken under the roster-membership
		// rule — so this is the one place a context row's assignee is a roster MEMBER,
		// which is the only way `staticTip` (as opposed to `brokenTip`) is ever reached.
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Retired.md', { frontmatter: { type: 'Epic', order: 40, assignee: '[[Alex]]' } });
		vault.addFile('Feature R1.md', { frontmatter: { type: 'Feature', order: 10 }, parentLink: 'Retired' });
		const containerEl = document.body.createDiv();
		const view = new ProductBacklogView({} as never, containerEl);
		const anyView = view as unknown as Record<string, unknown>;
		anyView.app = vault.app;
		const config = new FakeViewConfig(ASSIGNEE);
		config.order = ['note.assignee'];
		anyView.config = config;
		anyView.data = { data: vault.entries().filter((e) => e.file.path !== 'Retired.md') };
		view.onDataUpdated();
		clickExpandAll(containerEl);

		const shown = chipOf(containerEl, 'Retired');
		expect(shown?.classList.contains('pbl-assignee-broken')).toBe(false);
		expect(shown?.dataset.tooltip).toBe("Not in this base's filter — assignee can't be changed here");
	});

	it('does not mark the unset chip as broken — there is no value to resolve', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		const { containerEl } = makeView(vault, ASSIGNEE, VISIBLE);

		const chip = chipOf(containerEl, 'Epic A');
		expect(chip?.classList.contains('pbl-assignee-broken')).toBe(false);
		expect(chip?.classList.contains('pbl-assignee-unset')).toBe(true);
	});

	// `assigneeName(item)` alone draws the resolved note's basename, so two roster
	// resources named `Alex` in different folders drew one indistinguishable chip —
	// the fourth instance of a collision `namedTargets` (`interactions/labels.ts`) exists
	// to close, missed here until external review (fix round 1, PR #207).
	it("disambiguates the chip's label when two roster resources share a basename", () => {
		const vault = new FakeVault();
		vault.addFile('Team/Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Support/Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, assignee: '[[Team/Alex]]' } });
		vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, assignee: '[[Support/Alex]]' } });
		const { containerEl } = makeView(vault, ASSIGNEE, VISIBLE);

		const chipA = chipOf(containerEl, 'Epic A');
		const chipB = chipOf(containerEl, 'Epic B');
		expect(chipA?.textContent).not.toBe(chipB?.textContent);
		expect(chipA?.textContent).toContain('Team/Alex');
		expect(chipB?.textContent).toContain('Support/Alex');
		// Neither reads as broken — both resolve to roster members, only sharing a name.
		expect(chipA?.classList.contains('pbl-assignee-broken')).toBe(false);
		expect(chipB?.classList.contains('pbl-assignee-broken')).toBe(false);
	});
});
