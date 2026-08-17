import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The declarations of one rule, addressed by its selector LIST — pass the whole list,
 * newlines and all, for a grouped rule. Exact rather than a prefix match, which is
 * load-bearing now that two rules in `roadmap.css` open on `.pbl-roadmap .pbl-shelf,`
 * and differ in nothing but which bands follow it.
 */
function bodyOf(css: string, selector: string, file: string): string {
	const at = css.indexOf(`\n${selector} {`);
	if (at === -1) throw new Error(`no rule for ${selector} in ${file}`);
	const open = css.indexOf('{', at);
	return css.slice(open + 1, css.indexOf('}', open));
}

/**
 * The horizon axis's layout rests on declarations whose absence does not fail a render —
 * it fails a READER, weeks later, with a pane that jumps or a shelf below the viewport.
 * jsdom computes no layout, so like `timelineBoxing.test.ts` these are text checks over
 * the stylesheet: they see the declaration in its rule, they cannot see a later override,
 * and they cannot tell you what the pane looks like. The numbers behind each rule are in
 * `docs/bugs/The horizon board sized itself from whichever cards had rendered.md`; the
 * look is the browser harness's to answer (`npm run harness -- ?view=roadmap`).
 */
describe('the horizon board boxes that must not size from card content', () => {
	const css = readFileSync(new URL('../../styles/roadmap.css', import.meta.url), 'utf8');
	const boardCss = readFileSync(new URL('../../styles/board.css', import.meta.url), 'utf8');
	const ruleBody = (selector: string) => bodyOf(css, selector, 'styles/roadmap.css');
	/** The bands beside the axis, as their two rules address them. */
	const SCROLLING_BANDS = '.pbl-roadmap .pbl-shelf,\n.pbl-roadmap .pbl-roadmap-context,\n.pbl-roadmap .pbl-board-advisory';
	const CAPPED_BANDS = '.pbl-roadmap .pbl-shelf,\n.pbl-roadmap .pbl-roadmap-context';

	it('keeps card content out of a bucket, and so out of the frame, width', () => {
		// The frame is `min-width: max-content` for the pinned strips, so without inline-size
		// containment every bucket's width is its widest card's unwrapped content — and under
		// `content-visibility: auto` that changes with WHICH cards have rendered: one page
		// measured 1746px, 2165px and 1817px wide for the same content. The declaration is
		// what makes "buckets share the room equally, down to the 280px floor" true at all.
		expect(ruleBody('.pbl-bucket')).toContain('contain: inline-size;');
	});

	it('caps a bucket at the band, so its cards scroll instead of growing it', () => {
		// The board column's own pair: a stretched flex item will not shrink below its
		// content without the cap, so `.pbl-bucket-cards`' `overflow-y: auto` never engaged
		// and a 100-card bucket was a 10000px bucket with the shelf below all of it.
		// Declared once for both, in `styles/board.css`, beside the headers, names and counts
		// the column and the bucket already share — so this has to name the GROUP as well as
		// the declaration, or it would pass on a rule the bucket had dropped out of.
		expect(bodyOf(boardCss, '.pbl-board-col,\n.pbl-bucket', 'styles/board.css')).toContain('max-height: 100%;');
	});

	it('gives the horizon frame the pane, so the shelf stays on screen', () => {
		expect(ruleBody('.pbl-roadmap-mode:not(.pbl-roadmap-dates) .pbl-roadmap')).toContain('height: 100%;');
	});

	it('lets the buckets band flex rather than take its tallest bucket', () => {
		expect(ruleBody('.pbl-roadmap-buckets')).toContain('flex: 1 1 auto;');
	});

	it('makes every band beside the axis scroll itself', () => {
		// A squeezed band scrolls rather than clipping — `.pbl-view` clips, and a region
		// nobody can reach is the one thing this must never produce. All three bands, both
		// axes, one rule: the two axis rules differ in nothing but `flex`, and they said this
		// twice until 2026-08-17, which is how the copy came to disagree with the paragraph
		// promising it would not have to be remembered.
		expect(ruleBody(SCROLLING_BANDS)).toContain('overflow-y: auto;');
	});

	it('caps the two bands that compete with the axis, and only those two', () => {
		// A band with no maximum in a frame that owns the pane's height squeezes the buckets
		// out instead — true of the shelf and the context strip, which draw beside a
		// populated axis. NOT true of the advisory: `renderRoadmapAdvisory` draws it only
		// when the axis, the shelf and the context strip are all empty, so a cap on it can
		// only clip the one thing on screen. It did — at a 553px pane the empty state was cut
		// mid-sentence with the ✨ CTA and the manual link below the fold of a box most
		// readers would not know scrolls. `bodyOf` matches the selector list EXACTLY, so
		// re-adding the advisory to this rule fails here rather than passing on a prefix.
		expect(ruleBody(CAPPED_BANDS)).toContain('max-height: 30%;');
		expect(ruleBody(SCROLLING_BANDS)).not.toContain('max-height');
	});

	it('refuses to let a horizon band be shrunk below the maximum it declared', () => {
		// `flex-shrink` is the default, and a cap is not a size: with the buckets band
		// asking for room, the shelf was squeezed to 109px of its own 225px allowance —
		// enough for its header and a 35px sliver of a 139px card, on the axis where the
		// shelf is the thing a card is dragged FROM. Measured in the harness at ~800 notes
		// in a 766px pane. The buckets keep `flex: 1 1 auto` and their 220px floor, so the
		// remainder still lands on them and the pane still scrolls past it.
		expect(horizonBands()).toContain('flex: 0 0 auto;');
	});

	/** The horizon axis's band rule — the three bands beside the buckets, in one rule. */
	function horizonBands(): string {
		const at = css.indexOf('.pbl-roadmap-mode:not(.pbl-roadmap-dates) .pbl-shelf,');
		expect(at).toBeGreaterThan(-1);
		return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
	}
});
