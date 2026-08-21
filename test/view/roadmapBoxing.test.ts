import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bodyOf } from '../helpers/cssVars';

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
	/**
	 * The two capped bands, one rule each since 2026-08-21: the shelf's cap became a reader's
	 * own pick and the strip's did not, so they can no longer be one declaration. Both are
	 * asserted below, and the DEFAULT in the shelf's `var()` fallback is what keeps the two
	 * agreeing about what an unpicked band takes.
	 */
	const CAPPED_SHELF = '.pbl-roadmap .pbl-shelf';
	const CAPPED_CONTEXT = '.pbl-roadmap .pbl-roadmap-context';
	/** The horizon axis's own rule over those same three bands. */
	const HORIZON_BANDS = ['.pbl-shelf', '.pbl-roadmap-context', '.pbl-board-advisory']
		.map((band) => `.pbl-roadmap-mode:not(.pbl-roadmap-dates) ${band}`)
		.join(',\n');

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

	it('caps the two bands that compete with the axis', () => {
		// A band with no maximum in a frame that owns the pane's height squeezes the buckets
		// out instead — true of the shelf and the context strip, which draw beside a
		// populated axis. `bodyOf` matches the selector list EXACTLY, so adding a band to
		// either rule fails here rather than passing on a prefix.
		expect(ruleBody(CAPPED_CONTEXT)).toContain('max-height: 30%;');
		// The shelf's cap is the reader's own pick, and 30% is what the `var()` falls through
		// to until the grip at its foot is dragged. Both halves asserted in one needle: a
		// fallback dropped from the `var()` is a band with no cap at all until a height is
		// picked, and a custom property renamed here without `shelfResize.ts` is a band whose
		// grip moves nothing.
		expect(ruleBody(CAPPED_SHELF)).toContain('max-height: var(--pbl-shelf-h, 30%);');
	});

	it('caps the advisory nowhere in the file, not merely in the rule we thought of', () => {
		// `renderRoadmapAdvisory` draws the advisory only when the axis, the shelf and the
		// context strip are all empty, so a cap on it can only ever clip the one thing on
		// screen. It did — at a 553px pane the empty state was cut mid-sentence with the ✨
		// CTA and the manual link below the fold of a box most readers would not know
		// scrolls.
		// At the FORBIDDEN THING rather than at the two rules that happen to exist today:
		// asserting `SCROLLING_BANDS` carries no `max-height` says nothing about a fresh
		// `.pbl-roadmap .pbl-board-advisory { max-height: … }` written anywhere else in this
		// file, which is exactly how the cap would come back. This pattern reads every rule
		// whose selector list names the advisory and refuses a height cap in any of them.
		// A cap is not only spelled `max-height`, and the pattern read only that until
		// 2026-08-17: `.pbl-roadmap .pbl-board-advisory { height: 30% }` clips the advisory
		// exactly the same way and passed. `block-size` is in it because it would cap the
		// same way too, not because anything here writes one — `styles/` has no logical SIZE
		// property anywhere, and the live half of the gap was the bare `height`.
		// Its imprecisions, stated rather than left to be discovered: the class name written
		// inside a COMMENT would make the pattern read on to the next rule's body, and any
		// other `height` in a matched rule — a `min-height` floor, a `line-height` — trips it
		// without capping anything. Both are false ALARMS rather than false passes, which is
		// the right way round for a guard whose whole job is to hold for rules nobody has
		// written yet.
		expect(css).not.toMatch(/pbl-board-advisory[^{]*\{[^}]*(max-)?(height|block-size)/);
	});

	it('refuses to let a horizon band be shrunk below the maximum it declared', () => {
		// `flex-shrink` is the default, and a cap is not a size: with the buckets band
		// asking for room, the shelf was squeezed to 109px of its own 225px allowance —
		// enough for its header and a 35px sliver of a 139px card, on the axis where the
		// shelf is the thing a card is dragged FROM. Measured in the harness at ~800 notes
		// in a 766px pane. The buckets keep `flex: 1 1 auto` and their 220px floor, so the
		// remainder still lands on them and the pane still scrolls past it.
		// The whole list, like the two rules above it: a fourth band added to this rule
		// fails here rather than passing on a prefix — and `bodyOf` THROWS on a rename
		// rather than asserting inside itself, which this line used to do and so reported
		// a renamed selector with no test name attached.
		expect(ruleBody(HORIZON_BANDS)).toContain('flex: 0 0 auto;');
	});
});
