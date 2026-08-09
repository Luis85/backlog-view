// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { ItemSuggestModal } from '../../src/ui/itemSuggest';

installObsidianDom();

/**
 * The picker's own surface — what a row READS as, which is the half a test driving the
 * menu never touches: the harness picks by text and never renders one.
 */
describe('the item suggester', () => {
	const choices = [
		{ label: 'Ship the thing', detail: 'work/Ship the thing.md', value: 1 },
		{ label: 'No detail', value: 2 },
	];
	const modal = () =>
		new ItemSuggestModal({} as never, { placeholder: 'Pick one', choices, onChoose: () => undefined });

	it('searches the detail as well as the label', () => {
		// A title is not always the word someone remembers; a path often is.
		expect(modal().getItemText(choices[0])).toBe('Ship the thing work/Ship the thing.md');
		expect(modal().getItemText(choices[1])).toBe('No detail');
	});

	it('draws the detail as a second line, and omits it entirely when there is none', () => {
		const withDetail = document.createElement('div');
		modal().renderSuggestion({ item: choices[0], match: { score: 0, matches: [] } }, withDetail);
		const without = document.createElement('div');
		modal().renderSuggestion({ item: choices[1], match: { score: 0, matches: [] } }, without);

		expect([...withDetail.children].map((el) => el.textContent)).toEqual([
			'Ship the thing',
			'work/Ship the thing.md',
		]);
		// An empty second line would leave a row taller than its neighbours for nothing.
		expect([...without.children].map((el) => el.textContent)).toEqual(['No detail']);
	});
});
