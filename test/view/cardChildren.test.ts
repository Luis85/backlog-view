// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardVault, cardByTitle, makeBoard } from '../helpers/board';
import { useViewHarness } from '../helpers/view';
import { FakeVault } from '../helpers/vault';
import { childrenLabel, listedChildren } from '../../src/view/render/cardChildren';

useViewHarness();

/** The disclosure's toggle, or null when the card drew none. */
function disclosure(card: HTMLElement): HTMLButtonElement | null {
	return card.querySelector<HTMLButtonElement>('.pbl-card-kids-toggle');
}

function kidTitles(card: HTMLElement): string[] {
	return Array.from(card.querySelectorAll<HTMLElement>('.pbl-card-kid-title')).map(
		(el) => el.textContent ?? '',
	);
}

/** `boardVault` plus a grandchild, so "direct children only" has something to exclude. */
function nestedVault(): FakeVault {
	const vault = boardVault();
	vault.addFile('Task B1a.md', { frontmatter: { type: 'Task', order: 10 }, parentLink: 'Feature B1' });
	return vault;
}

describe('children on the card', () => {
	it('names the visible direct children, by their shared type', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic B'))?.textContent).toContain('2 features');
	});

	it('draws nothing on a card with no children', () => {
		const { containerEl } = makeBoard(boardVault());
		expect(disclosure(cardByTitle(containerEl, 'Epic A'))).toBeNull();
	});

	it('opens collapsed, and lists the children once expanded', () => {
		const { containerEl } = makeBoard(boardVault());
		const card = cardByTitle(containerEl, 'Epic B');
		expect(kidTitles(card)).toEqual([]);
		expect(disclosure(card)?.getAttribute('aria-expanded')).toBe('false');

		disclosure(card)?.click();

		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
		expect(disclosure(card)?.getAttribute('aria-expanded')).toBe('true');
	});

	it('lists direct children only — a grandchild is not on the epic', () => {
		const { containerEl } = makeBoard(nestedVault());
		const card = cardByTitle(containerEl, 'Epic B');
		disclosure(card)?.click();
		expect(kidTitles(card)).toEqual(['Feature B1', 'Feature B2']);
	});

	// `listedChildren` and `childrenLabel` are exported so the card menu (a later
	// increment) can build the same list and the same name without re-deriving either
	// — driven directly here, against a real model, rather than only through the DOM.
	it('answers directly: the visible children and the label built from them', () => {
		const { view } = makeBoard(boardVault());
		const epicB = view.model?.byPath.get('Epic B.md');
		if (!epicB) throw new Error('Epic B.md not in model');
		const children = listedChildren(view, epicB);
		expect(children.map((c) => c.title)).toEqual(['Feature B1', 'Feature B2']);
		expect(childrenLabel(children)).toBe('2 features');
	});
});
