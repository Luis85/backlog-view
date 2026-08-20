import { describe, expect, it } from 'vitest';
import { typesSection } from '../../src/view/manual/typesSection';
import { ALL_TYPES, EXTRA_TYPES, LEVELS, MARKER_TYPES } from '../../src/domain/typeVocabulary';
import { en } from '../../src/i18n/en';

describe('the types section', () => {
	// The check behind "derived, not retyped": a type added to the vocabulary without an
	// explanation fails here rather than shipping as a gap in the manual.
	it('explains every type in the vocabulary', () => {
		const explained = typesSection().entries.filter((e) => e.badge).map((e) => e.badge?.text);
		expect(explained).toEqual(ALL_TYPES);
	});

	// The intro is one catalog key with every type name as a PARAMETER, and these two
	// state the halves of that separately because they fail for opposite reasons.
	//
	// A type name is data — matched in frontmatter, written to notes — so the rule from
	// the root guide is that it may never enter the catalog. This checks it at the
	// forbidden thing rather than by reading the sentence: whatever the paragraph is
	// reworded to, a vocabulary name appearing in the VALUE fails here.
	it('keeps every type name out of the catalog entry', () => {
		const intro = en['manual.typesIntro'];
		for (const name of ALL_TYPES) {
			expect(intro, `the catalog spells the type name ${name}`).not.toContain(name);
		}
	});

	// And the other half: the parameters actually carry the vocabulary through, so a type
	// added to any of the three lists is described without anyone editing English. The old
	// sentence spelled `an Epic, a Feature or a PBI` and would have gone silently stale.
	it('names the ladder, the extras and the markers from the vocabulary itself', () => {
		const intro = typesSection().intro;
		for (const name of [...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES]) {
			expect(intro, `the intro never names ${name}`).toContain(name);
		}
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
		// The whole list of withheld gestures. `addParentLinkSection` is gated once and
		// guards two entries, so the singular "a menu action that changes the parent link"
		// was one short — the same defect the moving section shipped, in a second file.
		expect(text).toContain('a drag, an outdent and the two menu entries that remove the parent link');
		// The two rows, named — the whole of what "narrow" means here.
		expect(text).toContain('a Task, the rung both ladders share');
		expect(text).toContain('a note with no type at all');
		expect(text).toContain('Every other type keeps its own ladder wherever it lands');
		// And `Task` stated as offered in the catalog, not withheld with the plan's levels.
		// Stated as a RULE rather than a list: measured on a catalog row, Set type offers
		// exactly `Task`, `Test suite` and `Test case`, so the catalog withholds eight types
		// and any list of them goes stale the next time one is declared. The exact sets are
		// pinned in `test/view/testCatalog.test.ts`.
		expect(text).toContain("nothing from the plan's side is offered in the test catalog — except Task");
	});

	it('is a pure read — calling it twice gives equal content', () => {
		expect(typesSection()).toEqual(typesSection());
	});
});
