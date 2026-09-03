import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { backlogReadmeContent } from '../../src/domain/backlogReadme';
import { ORDER_SPACING } from '../../src/domain/rankArithmetic';
import { en } from '../../src/i18n/en';

/**
 * What the generated README teaches about `order`.
 *
 * Split from `backlogReadme.test.ts` by subject rather than by size: this section is
 * the one place the document tells a reader how to write a value the plugin's own
 * arithmetic then has to live with, so a false sentence here builds a vault that
 * refuses drops rather than merely misleading someone.
 *
 * Every case asks the STATE the prose is in, never its wording. Under ADR 0034 the old
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
	 * `inRankOrder` keeps a focused list in TREE order while any of its rows carries no
	 * rank or two share one — so the paragraph above it, true of a sibling group, is false
	 * of the one screen this backlog's owner ranks a single type on. This document is
	 * written INTO the vault, which makes an unqualified sentence here the plugin teaching
	 * its reader a rule the plugin then refuses.
	 *
	 * State rather than wording, like the rest of this file: the two halves have to BOTH be
	 * present, and the focused half has to say tree order rather than merely mentioning a
	 * focus level.
	 */
	it('qualifies the missing-order rule for a focused view', () => {
		const content = readme();
		expect(content).toContain('sorts after the ranked ones');
		expect(content).toMatch(/focused on a single type/);
		expect(content).toMatch(/keeps the order the tree draws/);
	});

	/**
	 * The fallback is wider than the refusal, and saying "the view refuses the move" flat
	 * teaches the reader to expect a refusal they will not get: with two rows tied, dropping
	 * one of THEM settles the tie, the list sorts on the numbers and the row lands where it
	 * was dropped — measured. A document that over-promises a refusal sends someone to a
	 * command they did not need, which is the same defect as under-promising one.
	 */
	it('does not promise a refusal the view does not make', () => {
		const content = readme();
		expect(content).toMatch(/refused only where/);
		expect(content).toMatch(/settles it/);
		// The flat claim, in the shape it shipped in.
		expect(content).not.toContain('the view refuses the move and says which');
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
