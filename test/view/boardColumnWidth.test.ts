import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bodyOf } from '../helpers/cssVars';

/**
 * Board columns share the pane's width instead of sitting at a fixed 260px, the same
 * shape `.pbl-bucket` already takes on the horizon axis — and both board-shaped
 * projections get it, because the requirements board and the Deliverables board render
 * the same `.pbl-board-col`.
 *
 * Text, and its reach is exactly that: jsdom computes no layout, so nothing here measures
 * a rendered column. `npm run harness` at a wide and a narrow viewport is what looks, and
 * a live vault is what confirms the theme's own spacing around it.
 */
describe('the board columns use the room they have', () => {
	const css = readFileSync(new URL('../../styles/board.css', import.meta.url), 'utf8');

	const ruleBody = (selector: string) => bodyOf(css, selector, 'styles/board.css');

	it('grows the columns, with an explicit floor rather than flex-basis alone', () => {
		const body = ruleBody('.pbl-board-col');

		expect(body, 'the columns are fixed-width and waste a wide pane').toMatch(/flex:\s*1 1 260px/);
		// flex-basis is not a floor once shrinking is enabled: without this the columns
		// compress to nothing instead of the row falling back to the tree's own scroller.
		expect(body, 'nothing stops a column shrinking past its stated minimum').toMatch(/min-width:\s*260px/);
	});

	it('lets a folded header clip its own rotated name rather than overflow', () => {
		// Text, and its reach is exactly that — but the pair below is load-bearing and was
		// found MISSING by measuring the rendered page, not by reading it. Rotated, the
		// name grows along the column's height, and a flex item will not shrink below its
		// content: at a 220px pane a long state value ran 145px past the column's bottom
		// and left the count outside the box, which is the one thing a folded column
		// promises to keep showing. Both terms are needed and neither works alone.
		const body = ruleBody('.pbl-board-collapsed .pbl-board-col-header');

		expect(body, 'the folded header cannot shrink below its rotated name').toMatch(/min-height:\s*0/);
		expect(body, 'nothing clips what the shrink leaves over').toMatch(/overflow:\s*hidden/);
	});

	it('leaves the empty no-state column, and a folded one, the same narrow strip', () => {
		// ONE rule for both, so a fold and the empty no-state column cannot drift to
		// different widths — the selector list is half the assertion.
		expect(css).toContain('.pbl-board-strip,\n.pbl-board-collapsed {');
		const body = ruleBody('.pbl-board-collapsed');

		expect(body, 'the strip no longer overrides the growing column').toMatch(/flex:\s*0 0 44px/);
		// Inherited from `.pbl-board-col`, the 260px floor would blow the strip up to a
		// full column — a permanently empty stage taking a stage's room.
		expect(body, "the column's floor is still standing on the strip").toMatch(/min-width:\s*0/);
	});
});
