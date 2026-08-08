import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STATE_COLOR_SLOTS } from '../../src/domain/settings';

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
		expect(ruleBody('.pbl-bar.pbl-bar-milestone')).toContain('translateX(-50%)');
	});
});

/**
 * The legend and the marks it keys are coloured in two different stylesheets, and a
 * swatch that drifts from the mark it names is a key that lies. Three of this feature's
 * defects were exactly that, so the pairing is asserted rather than trusted to review.
 *
 * Text again, and its reach is exactly that: it reads the palette variable each rule
 * names. It cannot tell you what those variables resolve to in a theme, which is the
 * live-vault question `docs/requirements/Smoke test the roadmap.md` still carries.
 */
describe('the legend keys the same palette colours the marks draw', () => {
	const timelineCss = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');
	const legendCss = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');

	/** The palette colour a rule names — `--color-green`, `rgb(var(--color-pink-rgb))`, … */
	function paletteColour(css: string, selector: string): string {
		const at = css.indexOf(`\n${selector} {`);
		if (at === -1) throw new Error(`no rule for ${selector}`);
		const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', css.indexOf('{', at)));
		const named = /--color-([a-z]+)(?:-rgb)?\b/.exec(body);
		if (!named) throw new Error(`${selector} names no palette colour: ${body.trim()}`);
		return named[1];
	}

	it.each([
		['.pbl-legend-done', '.pbl-timeline-row.pbl-done .pbl-bar'],
		['.pbl-legend-milestone', '.pbl-bar.pbl-bar-milestone'],
		['.pbl-legend-today', '.pbl-today'],
	])('keys %s with the colour %s draws', (swatch, mark) => {
		expect(paletteColour(legendCss, swatch)).toBe(paletteColour(timelineCss, mark));
	});

	it('keeps every state slot clear of the three colours that already mean something', () => {
		// `STATE_COLOR_SLOTS` says this in a comment — five rather than the palette's eight,
		// so no state's bar can be mistaken for the today line, a milestone or a done item.
		// A sixth slot added without reading that comment is what this catches.
		const slots = Array.from({ length: STATE_COLOR_SLOTS }, (_, i) => paletteColour(timelineCss, `.pbl-state-${i}`));
		expect(new Set(slots).size, `slots repeat a colour: ${slots.join(', ')}`).toBe(STATE_COLOR_SLOTS);
		for (const reserved of ['red', 'cyan', 'green']) {
			expect(slots, `slot palette must stay clear of ${reserved}`).not.toContain(reserved);
		}
	});
});
