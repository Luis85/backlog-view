import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The declarations of one rule, by selector — good enough for a single-selector rule. */
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
	const ruleBody = (selector: string) => bodyOf(css, selector, 'styles/roadmap.css');

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
		expect(ruleBody('.pbl-bucket')).toContain('max-height: 100%;');
	});

	it('gives the horizon frame the pane, so the shelf stays on screen', () => {
		expect(ruleBody('.pbl-roadmap-mode:not(.pbl-roadmap-dates) .pbl-roadmap')).toContain('height: 100%;');
	});

	it('lets the buckets band flex rather than take its tallest bucket', () => {
		expect(ruleBody('.pbl-roadmap-buckets')).toContain('flex: 1 1 auto;');
	});

	it('makes the horizon bands declare a maximum and scroll themselves', () => {
		// The dated axis's band rule, extended to the axis that was exempt: a band with no
		// maximum in a frame that owns the pane's height squeezes the buckets out instead.
		const at = css.indexOf('.pbl-roadmap-mode:not(.pbl-roadmap-dates) .pbl-shelf,');
		expect(at).toBeGreaterThan(-1);
		const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
		expect(body).toContain('max-height: 30%;');
		expect(body).toContain('overflow-y: auto;');
	});
});
