// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { flush, itemAt, key, makeView, treeOf, useViewHarness } from '../helpers/view';
import { bucketByName, bucketCountOf, shelfOf } from '../helpers/roadmap';

useViewHarness();

/**
 * The horizon board for stakeholders: a header that says where the work sits, progress per
 * bucket counted over the plan rather than the screen, and Present, which takes the
 * editing chrome away for a meeting without making the board read-only.
 */
const OPTIONS = {
	horizonProperty: 'note.horizon',
	stateProperty: 'note.status',
	stateValues: 'New, Doing, Done',
	doneValues: 'Done',
	assigneeProperty: 'note.assignee',
};

/** Now holds one of each state, one of them under a Done parent the Base excluded. */
function horizonsVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Context.md', { frontmatter: { type: 'Epic', order: 1, status: 'Done', horizon: 'Now' } });
	vault.addFile('Finished.md', {
		frontmatter: { type: 'Epic', order: 10, status: 'Done', horizon: 'Now' },
		parentLink: 'Context',
	});
	vault.addFile('Working.md', { frontmatter: { type: 'Epic', order: 20, status: 'Doing', horizon: 'Now' } });
	vault.addFile('Waiting.md', { frontmatter: { type: 'Epic', order: 30, status: 'New', horizon: 'Now' } });
	vault.addFile('Soon.md', { frontmatter: { type: 'Epic', order: 40, status: 'New', horizon: 'Next' } });
	vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 50, status: 'New' } });
	return vault;
}

function horizons(vault = horizonsVault(), opts: { hideCompleted?: boolean } = {}) {
	const harness = makeView(vault, OPTIONS, { base: 'Plan.base', collapsed: true, except: ['Context.md'], ...opts });
	harness.view.setProjection('roadmap');
	harness.view.setShelfCollapsed(false);
	return harness;
}

const headerOf = (root: HTMLElement) => root.querySelector<HTMLElement>('.pbl-horizon-header');
const summaryOf = (root: HTMLElement) =>
	Array.from(root.querySelectorAll('.pbl-horizon-summary > span:not(.pbl-iteration-sep)')).map((s) => s.textContent);
const progressOf = (root: HTMLElement, bucket: string) =>
	bucketByName(root, bucket).querySelector('.pbl-bucket-progress')?.textContent ?? null;
const modeButton = (root: HTMLElement, name: string) =>
	Array.from(root.querySelectorAll<HTMLButtonElement>('.pbl-horizon-header .pbl-iteration-mode button')).find(
		(b) => b.textContent === name,
	);

describe('the horizons header', () => {
	it('names the board under a kicker', () => {
		const { containerEl } = horizons();
		expect(headerOf(containerEl)?.querySelector('.pbl-iteration-kicker')?.textContent).toBe('Roadmap');
		expect(headerOf(containerEl)?.querySelector('h2')?.textContent).toBe('Horizons');
	});

	it('counts each bucket and what is not yet placed, never a context row', () => {
		// `Context` is Done, in Now and excluded: counted, Now would read 4.
		expect(summaryOf(horizons().containerEl)).toEqual(['Now 3', 'Next 1', 'Later 0', '1 not yet placed']);
	});

	it('says nothing about the shelf when everything is placed', () => {
		const vault = horizonsVault();
		vault.addFile('Untriaged.md', { frontmatter: { type: 'Epic', order: 50, status: 'New', horizon: 'Later' } });
		expect(summaryOf(horizons(vault).containerEl)).toEqual(['Now 3', 'Next 1', 'Later 1']);
	});

	it('is drawn on the horizon axis only', () => {
		const vault = horizonsVault();
		const harness = makeView(vault, { ...OPTIONS, startProperty: 'note.start' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		harness.view.setAxisPick('dates');
		expect(headerOf(harness.containerEl)).toBeNull();
	});
});

describe('progress per bucket', () => {
	it('says how much of each bucket is done, results only', () => {
		const { containerEl } = horizons();
		expect(progressOf(containerEl, 'Now')).toBe('1 of 3 done');
		expect(progressOf(containerEl, 'Next')).toBe('0 of 1 done');
		// An empty bucket has nothing to be part-way through.
		expect(progressOf(containerEl, 'Later')).toBeNull();
	});

	it('counts the finished work the completed toggle is hiding', () => {
		const { containerEl } = horizons(horizonsVault(), { hideCompleted: true });
		// The toggle drew: Finished is off the screen, and the bucket's count says so.
		expect(bucketCountOf(bucketByName(containerEl, 'Now'))).toBe('2');
		expect(progressOf(containerEl, 'Now')).toBe('1 of 3 done');
	});
});

describe('present or plan', () => {
	it('hides the shelf and the New buttons in Present, and still counts what is unplaced', () => {
		const { view, containerEl } = horizons();
		expect(shelfOf(containerEl)).not.toBeNull();
		expect(containerEl.querySelector('.pbl-bucket-add')).not.toBeNull();

		modeButton(containerEl, 'Present')?.click();
		expect(view.horizonPresent).toBe(true);
		expect(shelfOf(containerEl)).toBeNull();
		expect(containerEl.querySelector('.pbl-bucket-add')).toBeNull();
		// The invitation chips leave by the frame's class (`styles/horizonHeader.css`).
		expect(containerEl.querySelector('.pbl-roadmap')?.hasClass('pbl-roadmap-present')).toBe(true);
		expect(summaryOf(containerEl)).toContain('1 not yet placed');
		expect(modeButton(containerEl, 'Present')?.getAttribute('aria-pressed')).toBe('true');
		expect(modeButton(containerEl, 'Plan')?.getAttribute('aria-pressed')).toBe('false');
		// The render replaced the button that was pressed; focus follows to its replacement.
		expect(containerEl.ownerDocument.activeElement).toBe(modeButton(containerEl, 'Present'));

		modeButton(containerEl, 'Plan')?.click();
		expect(shelfOf(containerEl)).not.toBeNull();
		expect(containerEl.querySelector('.pbl-roadmap')?.hasClass('pbl-roadmap-present')).toBe(false);
	});

	it('reopens Present when the last session chose it, without writing the .base', () => {
		const vault = horizonsVault();
		const first = horizons(vault);
		first.view.setHorizonPresent(true);
		first.view.onunload();
		expect(first.config.setCalls).toEqual([]);

		document.body.empty();
		const second = horizons(vault);
		expect(second.view.horizonPresent).toBe(true);
		expect(shelfOf(second.containerEl)).toBeNull();
	});

	it('hides but never locks: Alt+arrow still moves a card', async () => {
		const vault = horizonsVault();
		const { view, containerEl } = horizons(vault);
		view.setHorizonPresent(true);
		view.selectItem(itemAt(view, 'Soon.md'));
		key(treeOf(containerEl), 'ArrowLeft', { altKey: true });
		await flush();
		expect(vault.fm('Soon.md')['horizon']).toBe('Now');
	});
});
