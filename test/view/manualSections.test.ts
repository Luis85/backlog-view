import { describe, expect, it } from 'vitest';
import { manualSections } from '../../src/view/manual/sections';

describe('the manual', () => {
	it('has the six sections, types first', () => {
		expect(manualSections().map((s) => s.id)).toEqual([
			'types', 'moving', 'creating', 'finding', 'writes', 'setup',
		]);
	});

	it('gives every entry a term and an explanation', () => {
		for (const section of manualSections()) {
			expect(section.entries.length, `${section.id} is empty`).toBeGreaterThan(0);
			for (const entry of section.entries) {
				expect(entry.term.length, `${section.id}: an entry has no term`).toBeGreaterThan(0);
				expect(entry.text.length, `${section.id}/${entry.term}`).toBeGreaterThan(0);
			}
		}
	});

	it('uses no id twice, since a deep link addresses a section by id', () => {
		const ids = manualSections().map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	// `Help for moving and ranking` forbids BOTH claims, in opposite directions: no
	// refusal for type reasons, and no claim that nothing is refused at all. The section
	// has to name the states a move is genuinely unavailable in.
	it('names the states a move is unavailable in, and claims no type refusal', () => {
		const moving = manualSections().find((s) => s.id === 'moving');
		const prose = moving?.entries.map((e) => `${e.term} ${e.text}`).join(' ').toLowerCase() ?? '';
		expect(prose).toContain('quick filter');
		expect(prose).toContain('descendant');
		expect(prose).not.toContain('nothing is refused');
		expect(prose).toContain('focus-root row has no previous sibling');
	});

	// The entry's availability claims are an ENUMERATION, and this branch's dominant defect
	// is one item short. `rootDropTarget` and `outdentTarget` ask `keepsProjection`, so the
	// background drop and Outdent refuse a catalog `Task` or a typeless row — while the
	// entry said the strip and Indent worked "except throughout a focused view", one stated
	// exception and no others. Named here so a gate added to that set without a sentence
	// fails rather than shipping as a promise the code refuses.
	it('names the projection boundary among the states a move is unavailable in', () => {
		const moving = manualSections().find((s) => s.id === 'moving');
		const prose = moving?.entries.map((e) => `${e.term} ${e.text}`).join(' ') ?? '';
		// The WHOLE list, not a substring of it. `addParentLinkSection` is gated once and
		// guards two entries, so naming one of them left a folder-mode user whose `Use folder
		// position` had vanished with no rule to find — and a substring assertion locked the
		// omission in rather than catching it.
		expect(prose).toContain(
			'dropping it beside a row at the top level, a drop on the tree background, Outdent, and the two menu entries that remove the parent link, Clear parent link and Use folder position',
		);
		expect(prose).toContain('a Task, or a note with no type');
		// Narrow in the same breath, or the entry trades one falsification for its mirror.
		expect(prose).toContain('every other type keeps its own ladder wherever it lands');
	});

	// The toolbar's New button makes exactly one type; the chevron beside it carries
	// the vocabulary. `CREATING` previously claimed New alone "offers the whole
	// vocabulary", which is what the primary button's own single-type prompt refuses.
	it('splits the toolbar New button from its chevron, and claims no whole vocabulary from New alone', () => {
		const creating = manualSections().find((s) => s.id === 'creating');
		const prose = creating?.entries.map((e) => `${e.term} ${e.text}`).join(' ').toLowerCase() ?? '';
		expect(prose).toContain('chevron');
		expect(prose).not.toContain('new (no row at all) offers the whole vocabulary');
	});
});
