import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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

	function ruleBody(selector: string): string {
		const start = css.indexOf(`${selector} {`);
		expect(start, `${selector} is not in the stylesheet`).toBeGreaterThan(-1);
		return css.slice(start, css.indexOf('}', start));
	}

	it('grows the columns, with an explicit floor rather than flex-basis alone', () => {
		const body = ruleBody('.pbl-board-col');

		expect(body, 'the columns are fixed-width and waste a wide pane').toMatch(/flex:\s*1 1 260px/);
		// flex-basis is not a floor once shrinking is enabled: without this the columns
		// compress to nothing instead of the row falling back to the tree's own scroller.
		expect(body, 'nothing stops a column shrinking past its stated minimum').toMatch(/min-width:\s*260px/);
	});

	it('leaves the empty no-state column its narrow strip', () => {
		const body = ruleBody('.pbl-board-strip');

		expect(body, 'the strip no longer overrides the growing column').toMatch(/flex:\s*0 0 44px/);
		// Inherited from `.pbl-board-col`, the 260px floor would blow the strip up to a
		// full column — a permanently empty stage taking a stage's room.
		expect(body, "the column's floor is still standing on the strip").toMatch(/min-width:\s*0/);
	});
});
