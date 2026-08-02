// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { FakeVault } from '../helpers/vault';
import { flush, key, makeView, rowByTitle, treeOf, useViewHarness } from '../helpers/view';
import { boardDrag } from '../helpers/dnd';
import { BOARD_WORKFLOW, cardByTitle, columnByName, makeBoard } from '../helpers/board';
import { todayStamp } from '../../src/domain/noteFields';

useViewHarness();

/**
 * The stamps, driven through the real inputs rather than the planner. What these
 * guard is the WIRING: that every path a user can change a state by carries its dates
 * with it, and that one undo takes both back. The rules themselves — write-once, the
 * done boundary, the local date — are the domain and storage suites' subject.
 *
 * `todayStamp()` is the expectation rather than a frozen string: freezing the clock
 * needs fake timers, and fake timers stop the real `setTimeout` these writes are
 * flushed with.
 */

/** The board workflow, plus both stamp properties and one state counting as started. */
const STAMPING = {
	...BOARD_WORKFLOW,
	startedDateProperty: 'note.started',
	finishedDateProperty: 'note.finished',
	startedStates: 'Active',
};

function stampVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10, status: 'New' } });
	vault.addFile('Epic B.md', { frontmatter: { type: 'Epic', order: 20, status: 'Active' } });
	return vault;
}

describe('stamps ride every input that changes a state', () => {
	it('a drag onto a started column', async () => {
		const vault = stampVault();
		const { containerEl } = makeBoard(vault, STAMPING);

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Active'));
		await flush();

		expect(vault.fm('Epic A.md')['started']).toBe(todayStamp());
	});

	it('an Alt+arrow across the done boundary', async () => {
		const vault = stampVault();
		const { containerEl } = makeBoard(vault, STAMPING);
		cardByTitle(containerEl, 'Epic B').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		key(treeOf(containerEl), 'ArrowRight', { altKey: true });
		await flush();

		expect(vault.fm('Epic B.md')['status']).toBe('Done');
		expect(vault.fm('Epic B.md')['finished']).toBe(todayStamp());
	});

	it('the board’s card menu', async () => {
		const vault = stampVault();
		const { containerEl } = makeBoard(vault, STAMPING);

		cardByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Active')?.click();
		await flush();

		expect(vault.fm('Epic A.md')['started']).toBe(todayStamp());
	});

	it('the TREE’s Set state, which is the path that does not go through the board', async () => {
		const vault = stampVault();
		const { containerEl } = makeView(vault, STAMPING);

		rowByTitle(containerEl, 'Epic A').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
		Menu.lastShown?.item('Set state')?.submenu?.item('Active')?.click();
		await flush();

		// A history with holes in it, where which hole depends on the projection the user
		// happened to be looking at, is worse than no history.
		expect(vault.fm('Epic A.md')['status']).toBe('Active');
		expect(vault.fm('Epic A.md')['started']).toBe(todayStamp());
	});
});

describe('stamps and the undo slot', () => {
	it('one undo takes back the state and its dates together', async () => {
		const vault = stampVault();
		const { containerEl } = makeBoard(vault, STAMPING);
		const tree = treeOf(containerEl);

		boardDrag(cardByTitle(containerEl, 'Epic B'), columnByName(containerEl, 'Done'));
		await flush();
		expect(vault.fm('Epic B.md')['finished']).toBe(todayStamp());

		key(tree, 'z', { ctrlKey: true });
		await flush();

		expect(vault.fm('Epic B.md')['status']).toBe('Active');
		expect('finished' in vault.fm('Epic B.md')).toBe(false);
	});

	it('reopening a finished item clears the finish it no longer has', async () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', {
			frontmatter: { type: 'Epic', order: 10, status: 'Done', finished: '2026-07-01', started: '2026-01-15' },
		});
		const { containerEl } = makeBoard(vault, STAMPING);

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Active'));
		await flush();

		expect('finished' in vault.fm('Epic A.md')).toBe(false);
		// And the original start survives the round trip: the earliest start is the one
		// the measure needs, so rework must not reset it.
		expect(vault.fm('Epic A.md')['started']).toBe('2026-01-15');
	});

	it('writes nothing anywhere until the properties are named', async () => {
		const vault = stampVault();
		const { containerEl } = makeBoard(vault);

		boardDrag(cardByTitle(containerEl, 'Epic A'), columnByName(containerEl, 'Active'));
		await flush();

		expect(vault.fm('Epic A.md')).toEqual({ type: 'Epic', order: 10, status: 'Active' });
	});
});
