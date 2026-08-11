import { describe, expect, it } from 'vitest';
import { typesSection } from '../../src/view/manual/typesSection';
import { ALL_TYPES, LEVELS } from '../../src/domain/typeVocabulary';

describe('the types section', () => {
	// The check behind "derived, not retyped": a type added to the vocabulary without an
	// explanation fails here rather than shipping as a gap in the manual.
	it('explains every type in the vocabulary', () => {
		const explained = typesSection().entries.filter((e) => e.badge).map((e) => e.badge?.text);
		expect(explained).toEqual(ALL_TYPES);
	});

	it('gives every type entry a non-empty explanation', () => {
		for (const entry of typesSection().entries.filter((e) => e.badge)) {
			// Assert the VALUE, not a property of it: `entry.text.length` throws before
			// `expect` runs when `text` is undefined (a type missing from `INTENT`), so the
			// diagnostic naming the type never has a chance to print. `toBeTruthy` reads
			// `entry.text` itself, so a missing explanation fails with the type named
			// rather than a TypeError and a stack trace.
			expect(entry.text, `${entry.badge?.text} has no explanation`).toBeTruthy();
		}
	});

	it('badges a ladder type by its rung and an extra type by its name', () => {
		const of = (name: string) => typesSection().entries.find((e) => e.badge?.text === name)?.badge?.cls;
		expect(of('Epic')).toBe(`pbl-lvl-${LEVELS.indexOf('Epic')}`);
		expect(of('Bug')).toBe('pbl-lvl-bug');
		expect(of('Milestone')).toBe('pbl-lvl-milestone');
	});

	// The entry published two claims the test catalog falsified: that Set type offers the
	// whole vocabulary outside a board, and that no drag is ever refused for what it would
	// type something as. Both are checked as TEXT because the text is what ships to a user —
	// the behaviour behind them is driven in `test/view/projectionMoves.test.ts` and
	// `test/view/testCatalog.test.ts`.
	//
	// The NARROWNESS is what this entry actually delivers, so it is checked rather than
	// trusted: the two rows a move can be refused for are named, and `Task` is stated as
	// offered in the catalog — the sentence "the plan's own levels are not offered there"
	// contradicted this section's own `Test case` entry ("Holds Tasks") two entries apart,
	// and `test/view/testCatalog.test.ts` pins `Task` as offered on a `Test case`.
	//
	// What it cannot reach: that every word of the statement is true. It asserts the
	// falsified sentences are gone and the narrow ones are present, no more.
	it('states the projection refusal, names the two rows it reaches, and drops both falsified claims', () => {
		const text = typesSection().entries.find((e) => e.term === 'Type is advisory, not enforced')?.text ?? '';
		expect(text).not.toContain('whole vocabulary');
		expect(text).not.toMatch(/no (drag|move) is ever refused/i);
		expect(text).toContain('leaving the projection it is drawn on');
		// The two rows, named — the whole of what "narrow" means here.
		expect(text).toContain('a Task, the rung both ladders share');
		expect(text).toContain('a note with no type at all');
		expect(text).toContain('Every other type keeps its own ladder wherever it lands');
		// And `Task` stated as offered in the catalog, not withheld with the plan's levels.
		expect(text).toContain('where Task is, on a row that hangs from a test');
	});

	it('is a pure read — calling it twice gives equal content', () => {
		expect(typesSection()).toEqual(typesSection());
	});
});
