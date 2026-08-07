import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The dated axis positions everything it draws — bars, the today line, milestone lines,
 * gridlines — from arithmetic in TypeScript: a count of days times `dayPx`, plus
 * `TIMELINE_LEAD_PX`. Two elements are then sized from those same numbers in CSS, and
 * both must therefore render at exactly the number they are given. Under the default
 * `content-box` their padding and borders are ADDED to it: the lead came out 237px wide
 * where TS had placed every mark against 220, and nine month cells came out 153px wider
 * than the days they name, so the header labels drifted right of the marks below them
 * and the two header tiers sheared apart by 102px.
 *
 * Nothing else in this suite can see that. jsdom computes no layout — every
 * `getBoundingClientRect` is zeros — so the sibling test asserting the two tiers sum to
 * the same width is comparing the `--pbl-cell-w` values TS wrote, which agreed with each
 * other throughout the whole time the rendered tiers did not. The real check is a
 * browser, and it is recorded in `docs/requirements/Smoke test the roadmap.md`.
 *
 * What this file can do is read the stylesheet and refuse the deletion. It is a text
 * check and its reach is exactly that: it sees the declaration in the rule, and it
 * cannot see a later rule overriding `box-sizing` for the same element, nor tell you
 * whether the widths came out right. It fails if someone drops the line, which is the
 * failure that actually happened.
 */
describe('the two boxes sized from TypeScript arithmetic', () => {
	const css = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');

	/** The declarations of one rule, by selector — good enough for a single-selector rule. */
	function ruleBody(selector: string): string {
		const at = css.indexOf(`\n${selector} {`);
		if (at === -1) throw new Error(`no rule for ${selector} in styles/timeline.css`);
		const open = css.indexOf('{', at);
		const close = css.indexOf('}', open);
		return css.slice(open + 1, close);
	}

	it.each(['.pbl-timeline-lead', '.pbl-timeline-cell'])('sizes %s border-box', (selector) => {
		expect(ruleBody(selector)).toContain('box-sizing: border-box;');
	});

	it('centres the milestone diamond on its date rather than starting it there', () => {
		// A point has no width to spend: hung off `--pbl-bar-left` the 12px diamond sits
		// 6px right of the full-height line drawn for the same milestone on the same day.
		expect(ruleBody('.pbl-bar-milestone')).toContain('translateX(-50%)');
	});
});
