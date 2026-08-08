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

	it('keeps every state slot clear of the four colours that already mean something', () => {
		// `STATE_COLOR_SLOTS` says this in a comment — four rather than the palette's eight,
		// so no state's bar can be mistaken for the today line, a milestone, a done item or
		// the plain accent an unslotted bar draws. A fifth slot added without reading that
		// comment is what this catches.
		//
		// PURPLE is in the list for the accent: Obsidian's default `--interactive-accent`
		// is a purple, and `.pbl-legend-other` keys it, so a purple slot drew the second
		// state and `Other` in one indistinguishable pair. The reach of that entry is
		// exactly the DEFAULT — the accent is a user setting, and no text check here can
		// see what a reader has set it to.
		const slots = Array.from({ length: STATE_COLOR_SLOTS }, (_, i) => paletteColour(timelineCss, `.pbl-state-${i}`));
		expect(new Set(slots).size, `slots repeat a colour: ${slots.join(', ')}`).toBe(STATE_COLOR_SLOTS);
		for (const reserved of ['red', 'cyan', 'green', 'purple']) {
			expect(slots, `slot palette must stay clear of ${reserved}`).not.toContain(reserved);
		}
	});

	it('draws no slot rule past the last slot the constant declares', () => {
		// The pair to the loop above: it reads exactly `STATE_COLOR_SLOTS` rules and so
		// cannot see a stale `.pbl-state-N` left behind when the count came DOWN. That
		// stale rule is live CSS — `stateColorSlot` never emits the class, but a reader
		// dropping a colour from the rotation and only editing the constant leaves the
		// removed hue one edit away from coming back.
		expect(timelineCss).not.toContain(`.pbl-state-${STATE_COLOR_SLOTS} `);
	});
});

/**
 * A colour key whose colour patch has been squeezed away is not a key. `.pbl-legend-item`
 * is a flex container, so the swatch is a flex item: `flex-shrink` defaults to 1 and its
 * `min-width: auto` resolves to the min-content size of an empty span, which is 0. In a
 * pane narrower than the swatch plus the longest word of a state's name, the 10px square
 * gets whatever is left — which is the narrow split where the colour is doing more work
 * than the label beside it.
 *
 * Text again, and its reach is exactly that: it reads the declaration that refuses the
 * shrink. jsdom computes no layout, so nothing here measures the rendered square; a
 * narrow pane in a real vault, or `npm run harness` at a narrow viewport, is what does.
 */
describe('the legend swatch keeps its size in a narrow pane', () => {
	const css = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');

	it('refuses to shrink, rather than relying on there being room', () => {
		const body = css.slice(css.indexOf('.pbl-legend-swatch {'), css.indexOf('}', css.indexOf('.pbl-legend-swatch {')));
		expect(body, 'the swatch declares no size at all').toContain('width: 10px;');
		expect(body, 'the swatch is a flex item with nothing stopping it shrinking to 0').toMatch(
			/flex(-shrink)?\s*:\s*0/,
		);
	});
});

/**
 * The sticky lead column is what the day track scrolls UNDER, so it has to stay opaque.
 * That is easy to lose by accident: `--background-modifier-hover` is itself translucent
 * in Obsidian's themes, so tinting the lead with
 * `color-mix(in srgb, var(--background-modifier-hover) 35%, var(--background-primary))`
 * produces alpha 0.67 rather than an opaque colour — and the grid then scrolled visibly
 * through the sticky column on every tinted row. Measured at 0.667843 in Chromium before
 * this rule changed, opaque after.
 *
 * So the tint goes on as a background-IMAGE layer over the opaque background-color the
 * base rule sets, and the check is that no rule tinting the lead ever sets
 * `background-color` — which is the mistake, stated at the thing that makes it.
 */
describe('the sticky lead column stays opaque under its tint', () => {
	const css = readFileSync(new URL('../../styles/timelineFurniture.css', import.meta.url), 'utf8');

	/** Every rule whose selector list ends at `.pbl-timeline-lead`, with its declarations. */
	function leadTintRules(): string[] {
		return css
			.split('}')
			.filter((chunk) => /\.pbl-timeline-lead\s*\{/.test(chunk + '}'))
			.map((chunk) => chunk.slice(chunk.indexOf('{') + 1));
	}

	it('tints it with a layer, never by replacing the opaque colour underneath', () => {
		const rules = leadTintRules();
		expect(rules.length).toBeGreaterThan(0);
		const tinting = rules.filter((body) => /^\s*background(-color|-image)?\s*:/m.test(body));
		expect(tinting.length, 'no rule tints the lead at all').toBeGreaterThan(0);
		for (const body of tinting) {
			expect(body, `a lead rule sets background-color: ${body.trim()}`).not.toMatch(/^\s*background-color\s*:/m);
			expect(body).toMatch(/^\s*background-image\s*:/m);
		}
	});

	it('gives the lead the same tint value the row itself uses, rather than a second copy', () => {
		// One custom property, redefined by zebra and by hover, read by both. Two literal
		// percentages in two rules is how the lead and the track came to disagree once.
		expect(css).toMatch(/\.pbl-card\.pbl-timeline-row\.pbl-row-even\s*\{[^}]*--pbl-row-tint:/);
		expect(css).toMatch(/\.pbl-card\.pbl-timeline-row:hover\s*\{[^}]*--pbl-row-tint:/);
		for (const body of leadTintRules()) {
			if (/^\s*background-image\s*:/m.test(body)) expect(body).toContain('var(--pbl-row-tint)');
		}
	});
});

/**
 * A focus indicator has to be visible against what it indicates. The grip is a 6px strip
 * filled with `--interactive-accent` while focused, and its outline was that same token —
 * a ring drawn in the colour of the thing it rings, on the one control in this pane that
 * has to say where the keyboard is.
 *
 * Text again, and its reach is exactly that: it reads the two tokens the rules name and
 * refuses them being the same one. It cannot tell you what either resolves to in a theme,
 * nor measure the contrast between them — that stays the live-vault question in
 * `docs/requirements/Smoke test the roadmap.md`.
 */
describe('the resize grip is ringed in a colour other than its own fill', () => {
	const css = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');

	/** The colour tokens one property names, across every rule that styles the focused grip. */
	function tokens(property: string): string[] {
		return css
			.split('}')
			.filter((chunk) => chunk.includes('.pbl-timeline-lead-grip:focus-visible'))
			.flatMap((chunk) => [...chunk.matchAll(new RegExp(`${property}[^;]*var\\(\\s*(--[\\w-]+)`, 'g'))])
			.map((match) => match[1]);
	}

	it('never paints the outline in the token the strip itself is filled with', () => {
		const fills = tokens('background-color');
		const rings = tokens('outline');
		expect(fills.length, 'nothing fills the focused grip').toBeGreaterThan(0);
		expect(rings.length, 'the focused grip draws no outline').toBeGreaterThan(0);
		for (const ring of rings) expect(fills, `the ring repeats its own fill: ${ring}`).not.toContain(ring);
	});
});
