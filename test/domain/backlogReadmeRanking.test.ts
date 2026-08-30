import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { backlogReadmeContent } from '../../src/domain/backlogReadme';
import { ORDER_SPACING } from '../../src/domain/writePlan';
import { en } from '../../src/i18n/en';

/**
 * What the generated README teaches about `order`.
 *
 * Split from `backlogReadme.test.ts` by subject rather than by size: this section is
 * the one place the document tells a reader how to write a value the plugin's own
 * arithmetic then has to live with, so a false sentence here builds a vault that
 * refuses drops rather than merely misleading someone.
 *
 * Every case asks the STATE the prose is in, never its wording. Under ADR 0032 the old
 * advice — a number scoped to one parent, ties harmless, a group renumbered when a move
 * needs room — went false while the tests over it went on passing, which is exactly how
 * the same three claims survived in the shipped manual.
 */
describe('what the generated README says about ranking', () => {
	const readme = (orderKey = 'order'): string => backlogReadmeContent(settingsWith({ orderKey }), [], 'test');

	it('states the ranking step the planner actually uses', () => {
		expect(readme()).toContain(`${ORDER_SPACING} apart`);
	});

	it('names the tie-break the model actually applies', () => {
		expect(readme()).toContain('the order the base itself returned them in');
		expect(readme()).not.toContain('settled by file name');
	});

	it('teaches one global rank rather than a rank among siblings', () => {
		const content = readme('rank');
		// The scope, both ways round: what the number ranks, and what it does not.
		expect(content).toContain('every note this view returns');
		expect(content).not.toMatch(/rank(s an item)? among the notes (that share|sharing) its parent/);
		// A move writes one note, so no sentence may promise a group is renumbered for room.
		expect(content).not.toMatch(/renumber(s|ing)? (a|the) group only when/);
		// A tie is now a dead end for a placement, so the advice may not be the old one —
		// distinct among SIBLINGS, with numbers free to repeat across parents, is precisely
		// the vault `midpoint` reports `tied` over.
		expect(content).not.toContain('give siblings distinct numbers');
		expect(content).toMatch(/refuses the move/);
	});

	/**
	 * The remedies a reader is sent to must be the palette's own names — a retyped one
	 * sends them looking for a command that is not there. Read from the catalog for the
	 * same reason the property names are read from the settings.
	 */
	it('names the two rank commands exactly as the palette does', () => {
		expect(readme()).toContain(en['command.seedRanks']);
		expect(readme()).toContain(en['command.respaceRanks']);
	});
});
