import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STATE_COLOR_SLOTS } from '../../src/domain/settings';
import { LABEL_RESERVE_PX } from '../../src/view/render/barLabel';
import { BODY_SELECTORS, bodyOf, declarations, resolvesValue } from '../helpers/cssVars';

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
 * browser, and it is recorded in `docs/tests/suites/Smoke test the roadmap.md`.
 *
 * What this file can do is read the stylesheet and refuse the deletion. It is a text
 * check and its reach is exactly that: it sees the declaration in the rule, and it
 * cannot see a later rule overriding `box-sizing` for the same element, nor tell you
 * whether the widths came out right. It fails if someone drops the line, which is the
 * failure that actually happened.
 */
describe('the two boxes sized from TypeScript arithmetic', () => {
	const css = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');

	const ruleBody = (selector: string) => bodyOf(css, selector, 'styles/timeline.css');

	it.each(['.pbl-timeline-lead', '.pbl-timeline-cell'])('sizes %s border-box', (selector) => {
		expect(ruleBody(selector)).toContain('box-sizing: border-box;');
	});

	it('centres the milestone diamond on its date rather than starting it there', () => {
		// A point has no width to spend: hung off `--pbl-bar-left` the 12px diamond sits
		// 6px right of the full-height line drawn for the same milestone on the same day.
		expect(ruleBody('.pbl-bar.pbl-bar-milestone')).toContain('translateX(-50%)');
	});

	it('never dims a row that carries the sticky lead column', () => {
		// `opacity` below 1 on a ROW does two things here and both are wrong: the lead column
		// it contains goes translucent, so a scrolled-past today line and the gridlines show
		// through the names; and the row becomes a stacking context, which takes the lead's
		// `z-index: 2` out of the grid's layer order entirely. Reported from a vault as "the
		// things underneath the resources columns are shining through". Muting belongs to a
		// row's CONTENT, and this refuses the shape rather than the symptom — a text check
		// over the stylesheet, exactly like the box-sizing pair above, which cannot tell you
		// what the pane looks like and can refuse the declaration that made it look wrong.
		const lanes = readFileSync(new URL('../../styles/lanes.css', import.meta.url), 'utf8');
		// Every selector that dims. A ROW selector is one naming a row class and nothing
		// beneath it — `.pbl-lane-context .pbl-timeline-lead > *` is CONTENT, and is exactly
		// the shape this rule asks for.
		const rowClass = /^\.pbl-(lane-context|lane-head|timeline-row)\b[^\s>]*$/;
		const dimmed = [...lanes.matchAll(/([^{}]+)\{([^}]*)\}/g)]
			.filter((rule) => /opacity:\s*0?\.\d/.test(rule[2]))
			.flatMap((rule) => rule[1].split(','))
			.map((selector) => selector.trim().split('\n').pop()?.trim() ?? '');

		expect(dimmed.filter((selector) => rowClass.test(selector))).toEqual([]);
		// Not vacuous: the muting a context row needs is still declared, on its content —
		// the absence row's own version of this rule went with the row itself on 2026-08-14,
		// since a stretch is drawn in its header's track now and has no row to mute.
		expect(dimmed).toContain('.pbl-lane-context .pbl-timeline-lead > *');
	});

	it('lays a row out from being a ROW, never from being a card', () => {
		// Every row of this grid is a sticky lead beside a day track, and that geometry has
		// to come from `.pbl-timeline-row` alone. Attached to `.pbl-card.pbl-timeline-row`
		// it reached only the rows that are also cards — so an absence stretch, which is
		// deliberately not a `BacklogItem` and so deliberately not a card, had no flex
		// context at all: its lead and its track stacked as blocks, and the stripe drew on
		// the line BELOW the name of the person it belongs to. Reported from a vault, and
		// invisible to every other test here, since jsdom lays nothing out.
		//
		// The reach is a text check, exactly as the box-sizing pair above: it sees the
		// declaration in the rule and cannot tell you the row came out on one line. What it
		// refuses is the shape that broke — a layout gated on a class only some rows carry.
		expect(ruleBody('.pbl-timeline-row')).toContain('display: flex;');
		expect(bodyOf(css, '.pbl-card.pbl-timeline-row', 'styles/timeline.css')).not.toContain('display');
	});

	it.each(['.pbl-drop-ghost', '.pbl-drop-ghost-dates'])('lets the pointer through %s, the one decoration that MOVES under it', (selector) => {
		// The preview is drawn into the dragged bar's own row track and the drop target is
		// somewhere else — a band element on the resources axis, the grid-wide overlay on the
		// dated one — so a preview that takes the pointer answers the release with the row the
		// bar came FROM. On the resources axis that is the whole message: the bar keeps its
		// assignee, the band under the pointer never highlights, and the gesture reads as one
		// that did not register.
		//
		// Stated at the forbidden thing, like the absence wash below it and for the same
		// reason: jsdom hit-tests nothing, so every drop test in this suite stays green
		// through exactly this declaration being absent — which is how it shipped. The reach
		// is the declaration in this rule, not a later one overriding it.
		expect(ruleBody(selector)).toContain('pointer-events: none;');
	});
});

/**
 * The legend and the marks it keys are coloured in two different stylesheets, and a
 * swatch that drifts from the mark it names is a key that lies. Three of this feature's
 * defects were exactly that, so the pairing is asserted rather than trusted to review.
 *
 * Text again, and its reach is exactly that: it reads the palette variable each rule
 * names. It cannot tell you what those variables resolve to in a theme, which is the
 * live-vault question `docs/tests/suites/Smoke test the roadmap.md` still carries.
 */
describe('the legend keys the same palette colours the marks draw', () => {
	const timelineCss = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');
	const legendCss = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');

	/**
	 * The palette colour a rule names — `--color-green`, `rgb(var(--color-pink-rgb))`, …
	 * `file` is passed rather than recovered by comparing the two stylesheets' CONTENTS
	 * for identity: the caller already knows which file it handed over.
	 */
	function paletteColour(css: string, selector: string, file: string): string {
		const body = bodyOf(css, selector, file);
		const named = /--color-([a-z]+)(?:-rgb)?\b/.exec(body);
		if (!named) throw new Error(`${selector} names no palette colour: ${body.trim()}`);
		return named[1];
	}

	it.each([
		['.pbl-legend-done', '.pbl-timeline-row.pbl-done .pbl-bar'],
		['.pbl-legend-milestone', '.pbl-bar.pbl-bar-milestone'],
		['.pbl-legend-today', '.pbl-today'],
	])('keys %s with the colour %s draws', (swatch, mark) => {
		expect(paletteColour(legendCss, swatch, 'styles/legend.css')).toBe(paletteColour(timelineCss, mark, 'styles/timeline.css'));
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
		const slots = Array.from({ length: STATE_COLOR_SLOTS }, (_, i) =>
			paletteColour(timelineCss, `.pbl-state-${i}`, 'styles/timeline.css'),
		);
		expect(new Set(slots).size, `slots repeat a colour: ${slots.join(', ')}`).toBe(STATE_COLOR_SLOTS);
		for (const reserved of ['red', 'cyan', 'green', 'purple']) {
			expect(slots, `slot palette must stay clear of ${reserved}`).not.toContain(reserved);
		}
	});

	it('reads a state swatch off the same token the bar it keys reads', () => {
		// The pairs above check the four MODIFIER swatches, whose colours are written out
		// in both files. A state swatch is the other half: it carries the bar's own
		// `pbl-state-N` class and takes the value that class sets, so the mapping exists
		// once. A swatch rule naming a colour of its own would draw the right hue today
		// and drift the first time the rotation changes — which the distinctness test
		// beside it cannot see, because it never asks where the swatch's colour comes from.
		expect(bodyOf(legendCss, '.pbl-legend-swatch', 'styles/legend.css')).toContain(
			'background-color: var(--pbl-state-color);',
		);
		for (let slot = 0; slot < STATE_COLOR_SLOTS; slot++) {
			expect(bodyOf(timelineCss, `.pbl-state-${slot}`, 'styles/timeline.css')).toContain('--pbl-state-color:');
		}
	});

	it('draws no slot rule past the last slot the constant declares', () => {
		// The pair to the loop above: it reads exactly `STATE_COLOR_SLOTS` rules and so
		// cannot see a stale `.pbl-state-N` left behind when the count came DOWN. That
		// stale rule is live CSS — `stateColorSlot` never emits the class, but a reader
		// dropping a colour from the rotation and only editing the constant leaves the
		// removed hue one edit away from coming back.
		//
		// Every index the stylesheet declares, not the one index past the constant: a
		// check naming `.pbl-state-${STATE_COLOR_SLOTS}` alone sees a 5→4 drop and misses
		// a 4→2 one, which is the same instrument that cannot see the whole set the root
		// guide records. The count assertion is the instrument's own check — a regex that
		// matched nothing would satisfy the loop below for any stylesheet at all.
		const declared = [...timelineCss.matchAll(/\.pbl-state-(\d+)/g)].map((match) => Number(match[1]));
		expect(declared, `slot rules found: ${declared.join(', ')}`).toHaveLength(STATE_COLOR_SLOTS);
		for (const index of declared) {
			expect(index, `.pbl-state-${index} is past the last slot the constant declares`).toBeLessThan(STATE_COLOR_SLOTS);
		}
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
		const body = bodyOf(css, '.pbl-legend-swatch', 'styles/legend.css');
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
 * Three claims `styles/timelineFurniture.css` states in comments and nothing checked.
 * Text checks, and their reach is exactly that: they see the declaration in the rule and
 * cannot see a later rule overriding it, nor what any of it renders as — the browser
 * harness and a live vault are what do. Each one refuses the deletion that was described
 * as a defect beside it.
 */
describe('the furniture declarations whose comments call them load-bearing', () => {
	const css = readFileSync(new URL('../../styles/timelineFurniture.css', import.meta.url), 'utf8');
	const ruleBody = (selector: string) => bodyOf(css, selector, 'styles/timelineFurniture.css');

	it('repeats the weekend gradient every seven days, so its phase survives the repeat', () => {
		// One layer for every weekend in the window: TS publishes the phase
		// (`--pbl-weekend-offset`, which the sibling suite asserts) and the repeat is what
		// turns that one number into shading. Without an explicit period the gradient
		// covers the whole layer once, and `background-position-x` then bands the left
		// edge of any window that is not a whole number of weeks — the 92-day default
		// among them.
		expect(ruleBody('.pbl-weekend-layer')).toContain('background-size: calc(var(--pbl-day-px) * 7)');
	});

	it('spans the weekend layer over the drawn days, never the wrapper it sits in', () => {
		// `.pbl-timeline-content` carries `min-width: 100%`, so in a pane wider than the
		// dated track it runs past the last cell: `right: 0` would shade blank space no
		// header date explains.
		expect(ruleBody('.pbl-weekend-layer')).toContain('width: var(--pbl-tl-days);');
	});

	it('reserves in TypeScript exactly the width the stylesheet lets a label take', () => {
		// `LABEL_RESERVE_PX` decides which SIDE of its bar a label is drawn on; this rule
		// decides how wide it may then be. The two comments say "change them together" and
		// nothing made that true — a wider `max-width` alone flips labels at the wrong
		// point and truncates them where the reserve said they fit.
		//
		// The padding term is Obsidian's `--size-4-N` scale, which is N × 4px; a theme
		// redefining it moves the budget by a few pixels, the same accepted cost as the
		// column-fit constants that read those tokens (`src/view/CLAUDE.md`).
		const body = ruleBody('.pbl-bar-label');
		const maxWidth = /max-width:\s*(\d+)px/.exec(body);
		const padding = /padding:\s*0\s+var\(--size-4-(\d+)\)/.exec(body);
		if (!maxWidth || !padding) throw new Error(`.pbl-bar-label states no max-width and padding pair: ${body.trim()}`);
		expect(Number(maxWidth[1]) + 2 * Number(padding[1]) * 4).toBe(LABEL_RESERVE_PX);
	});

	it('lays the label out as a flex row, not a block the ellipsis can only apply to as a whole', () => {
		// Text check, same reach as the pair above: it sees the declaration in the rule, it
		// cannot see a later rule overriding it, and it cannot tell you what the label
		// actually renders as. Without `display: flex` the title and the token
		// (`.pbl-bar-label-title`, `.pbl-days-lost`) share one line box, and
		// `text-overflow: ellipsis` truncates at the LINE's end regardless of which child
		// put it there — the defect a long title reproduced by evicting the token
		// entirely, `drawn.daysLost` still true for a mark nothing on screen made.
		expect(ruleBody('.pbl-bar-label')).toContain('display: flex;');
	});

	it('gives the title all four declarations a truncating flex child needs — min-width: 0 above all', () => {
		// The other three (`overflow`, `text-overflow`, `white-space`) are what make a
		// truncating label a truncating label at all; `min-width: 0` is the one whose
		// ABSENCE silently reproduces the eviction bug, because a flex item's default
		// `min-width: auto` resolves to its own content size and refuses to shrink below
		// it — the title would then push `.pbl-days-lost` out of the box instead of
		// truncating around it, and nothing else here would say why it came back.
		const body = ruleBody('.pbl-bar-label-title');
		for (const declaration of ['overflow: hidden;', 'text-overflow: ellipsis;', 'white-space: nowrap;', 'min-width: 0;']) {
			expect(body, `.pbl-bar-label-title states no ${declaration}`).toContain(declaration);
		}
	});

	it('ties the 118px content box absenceCost’s own comment names to the declarations that produce it', () => {
		// `.pbl-bar-label` states no `box-sizing` of its own — Obsidian's own global reset
		// (`* { box-sizing: border-box }`, real app.css) is what makes it border-box, so
		// `max-width` already INCLUDES the padding rather than adding to it. For the
		// `after` variant: 144 (max-width) − 18 (its own `padding-inline-start`, which
		// overrides the base rule's inline-start side — a logical longhand and a physical
		// shorthand cascade together, so source order decides) − 8 (the base rule's
		// `padding: 0 var(--size-4-2)`, unchanged on the inline end) = 118 — the number
		// `absenceCost`'s own comment
		// (`src/view/render/timeline.ts`) spends on the short tokens' whole budget.
		// Nothing before this tied that number to the three declarations that produce it,
		// so changing any one of them would leave the comment wrong with nothing red.
		// The premise before the arithmetic: a stray `box-sizing: content-box` here would leave
		// every number below unchanged and the box model diverged — `max-width` would stop
		// including the padding, so the real content box becomes 144 rather than 118 and this
		// test stays green through it. Asked of the declaration that must NOT be there.
		expect(ruleBody('.pbl-bar-label'), '.pbl-bar-label states a box-sizing of its own').not.toContain('box-sizing');
		const maxWidth = /max-width:\s*(\d+)px/.exec(ruleBody('.pbl-bar-label'));
		const padding = /padding:\s*0\s+var\(--size-4-(\d+)\)/.exec(ruleBody('.pbl-bar-label'));
		const afterPaddingStart = /padding-inline-start:\s*(\d+)px/.exec(ruleBody('.pbl-bar-label-after'));
		if (!maxWidth || !padding || !afterPaddingStart) {
			throw new Error('missing max-width, base padding, or the after variant’s own padding-inline-start');
		}
		const contentBox = Number(maxWidth[1]) - Number(afterPaddingStart[1]) - Number(padding[1]) * 4;
		expect(contentBox).toBe(118);
	});

	it('takes the labels off the grid while a drag is live', () => {
		// The other half of `timelineFurniture.test.ts`'s "declutters while a drop is
		// being aimed": that one drives the class onto the view, this one is the rule the
		// class exists for. Neither is the whole claim on its own.
		expect(ruleBody('.pbl-dragging .pbl-bar-label')).toContain('visibility: hidden;');
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
 * `docs/tests/suites/Smoke test the roadmap.md`.
 */
/**
 * The stretch a resource is away for is CONTENT, and it was drawn from the palette that
 * means decoration — `--background-modifier-border`, which is what `.pbl-grid-line` is made
 * of and the family `.pbl-weekend-layer` draws from. So it could not out-read the shading
 * behind it, which is exactly how it was reported: a light-mode vault at 382 results, three
 * stretches fainter than the weekend banding they sat on.
 *
 * Text checks, and their reach is exactly that: they read the tokens each rule names. They
 * cannot tell you what those tokens resolve to in a theme, nor measure the contrast between
 * them — that is the live-vault question `docs/tests/suites/Smoke test the roadmap.md`
 * carries.
 */
describe('the absence marks are drawn from the content palette', () => {
	const lanes = readFileSync(new URL('../../styles/lanes.css', import.meta.url), 'utf8');
	const timeline = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');

	/** Every custom property one rule names. */
	function tokens(css: string, selector: string, file: string): string[] {
		return [...bodyOf(css, selector, file).matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
	}

	it('draws the stretch from a text token and never from the decoration palette', () => {
		const named = tokens(lanes, '.pbl-absence', 'styles/lanes.css');
		// The instrument's own check, and not a nicety: a pattern that matched nothing would
		// satisfy the refusal below for any stylesheet at all, including an empty one.
		expect(named.filter((token) => token.startsWith('--text-')), '.pbl-absence names no text token').not.toHaveLength(0);
		for (const token of named) {
			expect(token, `.pbl-absence draws from the decoration palette: ${token}`).not.toMatch(/^--background-modifier/);
		}
	});

	it('draws the wash from --pbl-away and never from the decoration palette', () => {
		// The same instrument as the check above and the same reach: it sees the token a
		// declaration names, it cannot see a later rule overriding it, and it cannot tell
		// you what any of it looks like against a themed bar — a live-vault question.
		const named = tokens(lanes, '.pbl-absence-wash', 'styles/lanes.css');
		expect(named, '.pbl-absence-wash names no --pbl-away token').toContain('--pbl-away');
		for (const token of named) {
			expect(token, `.pbl-absence-wash draws from the decoration palette: ${token}`).not.toMatch(/^--background-modifier/);
		}
	});

	it('keys the days-lost swatch with the SAME --pbl-away token the wash names, not a copy', () => {
		// The pairing the hatch test below states for `.pbl-absence`/`.pbl-legend-absence`,
		// asked of the away key instead: both draw from ONE custom property declared once
		// (`.pbl-roadmap-dates`, `styles/lanes.css`), so the two cannot drift the colour apart
		// — only the gradient's own period differs, which is why this pairs the token alone
		// and not the whole gradient the way the hatch pairing below does.
		const legend = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');
		expect(tokens(lanes, '.pbl-absence-wash', 'styles/lanes.css')).toContain('--pbl-away');
		expect(tokens(legend, '.pbl-legend-days-lost', 'styles/legend.css')).toContain('--pbl-away');
	});

	it('resolves a colour for the days-lost swatch, not just a name it declares', () => {
		// The pairing above is honest about the NAME and blind to whether any element
		// actually inherits the value — exactly how this shipped once: `--pbl-away` was
		// declared on `.pbl-timeline`, the grid itself, while the legend is a SIBLING of
		// `.pbl-tree` (both direct children of `.pbl-view`, `src/view/backlogView.ts`) —
		// so a legend swatch naming the right custom property still computed to nothing,
		// because inheritance runs down the tree and the grid is not the legend's ancestor.
		// `test/helpers/cssVars.ts` follows a value's own `var()` references rather than
		// checking that a name is declared somewhere in the file, which is what catches
		// that a real theme's tokens plus `--pbl-away`'s OWN declared scope resolve.
		const obsidian = readFileSync(new URL('../harness/obsidian.css', import.meta.url), 'utf8');
		const legend = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');
		const values = new Map([
			...declarations(obsidian, 'dark', BODY_SELECTORS),
			// `.pbl-roadmap-dates` is the ancestor `--pbl-away` is actually scoped to — see
			// its own comment in `styles/lanes.css` for why `.pbl-timeline` was the wrong one.
			...declarations(lanes, 'dark', new Set(['.pbl-roadmap-dates'])),
		]);
		const body = bodyOf(legend, '.pbl-legend-days-lost', 'styles/legend.css');
		for (const property of ['background-color', 'border']) {
			const value = new RegExp(`${property}:\\s*([^;]+);`).exec(body)?.[1];
			expect(value, `.pbl-legend-days-lost states no ${property}`).toBeDefined();
			expect(resolvesValue(value as string, values), `${property}: ${value} does not resolve`).toBe(true);
		}
	});

	it('refuses the days-lost token any shrink, load-bearing twice over', () => {
		// `.pbl-bar-label` is a flex row now (`styles/timelineFurniture.css`) shared with
		// `.pbl-bar-label-title`, and this is the OTHER child's own refusal — without it
		// the flex algorithm would take space from either child impartially, including
		// this one, which has no `text-overflow` of its own to fall back on and would
		// just clip mid-token. Load-bearing a second way too: `white-space: nowrap` moved
		// off the label onto the title span when the two split, so this `flex: 0 0 auto`
		// is now the only thing stopping the token's own short text wrapping across two
		// lines in a narrow flex row.
		expect(bodyOf(lanes, '.pbl-days-lost', 'styles/lanes.css')).toMatch(/flex\s*:\s*0\s+0\s+auto/);
	});

	it('draws the stretch at the height its sub-lane pitch was sized for', () => {
		// 12px against a bar's 14px was saying "lesser" as well as "different", and only the
		// second was intended: what tells work from the absence of work is the hatch. Matching
		// the bar's own height exactly was the check for that, until the mark moved into the
		// header's own track (2026-08-14) and took on a sub-lane pitch instead — 13px marks on
		// a 17px pitch, a geometry the bar has no reason to share. What survives is that the
		// two stay close enough to read as the same KIND of mark, which a fixed value states
		// more honestly than an equality this design no longer keeps.
		const height = (css: string, selector: string, file: string) => /height:\s*(\d+)px/.exec(bodyOf(css, selector, file))?.[1];
		expect(height(timeline, '.pbl-bar', 'styles/timeline.css'), '.pbl-bar states no height').toBeDefined();
		expect(height(lanes, '.pbl-absence', 'styles/lanes.css')).toBe('13');
	});

	it('ties the sub-lane pitch to the height the header grows by, since the two must agree', () => {
		// One number in two rules, exactly as the 118px content box is tied to the three
		// declarations that produce it. `.pbl-absence` steps each mark down by its own
		// `--pbl-sublane` index; the header's track grows by the sub-lane COUNT. A pitch
		// changed in one of them alone either overlaps the marks or leaves a gap under the
		// last one, and nothing else here could say so — jsdom lays nothing out.
		const pitch = (selector: string) => /var\(--pbl-(?:lane-)?sublanes?[^)]*\)\s*\*\s*(\d+)px/.exec(bodyOf(lanes, selector, 'styles/lanes.css'))?.[1];
		expect(pitch('.pbl-absence'), '.pbl-absence steps by no sub-lane pitch at all').toBeDefined();
		expect(pitch('.pbl-lane-head .pbl-timeline-track')).toBe(pitch('.pbl-absence'));
	});

	it('keeps the mark’s border inside the width the pack was handed', () => {
		// `packLanes` separates the marks that would overlap, and it is handed `spanBox`'s
		// `--pbl-bar-width` — so the RENDERED extent has to be that width and not that width
		// plus two 1px borders, or two marks the pack judged to touch would overlap by 2px.
		// Obsidian's app.css does set `* { box-sizing: border-box }`, which is why no vault
		// has ever drawn the overlap; this states it in the plugin's own stylesheet instead of
		// resting the pack's premise on the host's reset — the same reason `.pbl-absence-wash`
		// and `.pbl-timeline-cell` beside it declare it rather than inherit it. Raised in
		// review (2026-08-15) as an overlap, which it is not; the assumption was real.
		expect(bodyOf(lanes, '.pbl-absence', 'styles/lanes.css')).toContain('box-sizing: border-box');
	});

	it('leaves the mark its pointer events, which are now the only route to Edit and Delete', () => {
		// Stated at the FORBIDDEN thing rather than by driving the paths that would break.
		// The mark's context menu is the only way to either act since the stretch lost its own
		// row, and the band's drop reaches it by bubbling — so `pointer-events: none` here
		// breaks the feature twice. jsdom dispatches events whatever the stylesheet says, so
		// the drop test and the menu test both stay green through exactly that declaration:
		// this is the one check that can see it. Its reach is the declaration in this rule,
		// not a later one overriding it.
		expect(bodyOf(lanes, '.pbl-absence', 'styles/lanes.css')).not.toContain('pointer-events');
	});

	it('keys the hatch with the very gradient the stretch draws, not a copy of it', () => {
		// The strip's whole subject is that a swatch cannot say something the mark does not
		// draw. The three pairs above check that for the marks whose colour is a `--color-*`
		// palette entry; this mark is a HATCH, so the thing to pair is the whole gradient —
		// the token and the period together, because a key drawn at a different period is a
		// different mark. It was: the swatch halved the period to fit a 10px square and came
		// out reading as a slashed circle. Widening the swatch is what made one gradient
		// serve both, so this now asserts what the earlier colour-only pairing could not.
		const legend = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');
		const gradient = (css: string, selector: string, file: string) =>
			/background-image:\s*([^;]+);/.exec(bodyOf(css, selector, file))?.[1].replace(/\s+/g, ' ');
		const mark = gradient(lanes, '.pbl-absence', 'styles/lanes.css');
		expect(mark, '.pbl-absence draws no gradient at all').toBeDefined();
		expect(gradient(legend, '.pbl-legend-absence', 'styles/legend.css')).toBe(mark);
		// And the border it sits in, which the gradient does not cover.
		const inked = (css: string, selector: string, file: string) => tokens(css, selector, file).filter((t) => t.startsWith('--text-'))[0];
		expect(inked(legend, '.pbl-legend-absence', 'styles/legend.css')).toBe(inked(lanes, '.pbl-absence', 'styles/lanes.css'));
	});

	it('lets the pointer through the shading, rather than taking the drop the row is the target for', () => {
		// On this axis each ELEMENT of a band is the drop target (`laneElement` in
		// `src/view/render/timeline.ts`) — there is no container to wire — so a child of a row
		// that intercepts the pointer is `docs/bugs/An absence stretch is a dead spot in its
		// own band.md` reached from inside the row. Every other absolutely positioned
		// decoration on this grid opts out the same way.
		expect(bodyOf(lanes, '.pbl-absence-wash', 'styles/lanes.css')).toContain('pointer-events: none;');
	});

	it('sizes the shading border-box, so its own edges claim no extra day', () => {
		// `--pbl-bar-width` is a count of DAYS times `dayPx` — the same arithmetic that places
		// every bar and gridline — so a rule that draws edges on the box has to state
		// `box-sizing`, or the two 1px borders are ADDED and the shading covers a sliver of a
		// day nobody is away for. `.pbl-timeline-cell`'s own rule, which the pair at the top of
		// this file guards for the same reason: the tests there record nine month cells coming
		// out 153px wider than the days they name.
		const body = bodyOf(lanes, '.pbl-absence-wash', 'styles/lanes.css');
		expect(body, 'the shading draws no edges, so nothing depends on box-sizing').toMatch(/border(-inline)?:/);
		expect(body).toContain('box-sizing: border-box;');
	});

	it('gives the shading no layer of its own', () => {
		// It sits over the bar by document order — appended after it — which is the layer
		// argument `styles/dependencyArrows.css` records, used in the other direction. A
		// `z-index` on either element competes with the sticky lead column at 2.
		expect(bodyOf(lanes, '.pbl-absence-wash', 'styles/lanes.css')).not.toContain('z-index');
	});
});

describe('the resize grip is ringed in a colour other than its own fill', () => {
	// The grip's own partial since 2026-08-15 — it left `styles/timeline.css` when that
	// file reached its 400-line cap. Read from ONE file on purpose: the question is
	// whether the two declarations name the same token, which only holds if both are
	// where this looks.
	const css = readFileSync(new URL('../../styles/timelineLeadResize.css', import.meta.url), 'utf8');

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

/**
 * `.pbl-bar-progress`'s track and `.pbl-timeline-row.pbl-done .pbl-bar`'s done override
 * paint the SAME green (`--color-green` and `rgb(var(--color-green-rgb))` both resolve to
 * `#44cf6e`, measured 2026-08-15 — contrast 1.00), so on a done row the fill vanishes into
 * the bar and the band shows only its unfilled remainder, inverted from what it means to
 * report. jsdom resolves no custom property to a colour, so this is a text check like the
 * pair above it: it sees the declaration and cannot tell you what a done bar's band
 * actually looks like — that is `npm run harness`'s `.superpowers/harness-band-fix.md`
 * pass, not this file.
 */
describe('the progress band carries a hairline no bar colour can erase', () => {
	const css = readFileSync(new URL('../../styles/barProgress.css', import.meta.url), 'utf8');
	const body = bodyOf(css, '.pbl-bar-progress', 'styles/barProgress.css');

	it('draws a 1px outline rather than an inset box-shadow', () => {
		// `outline` paints over the element's OWN descendants (documented browser
		// behaviour, confirmed in the harness pass): at 100% done the fill child covers
		// the whole track box, and an inset `box-shadow` — painted in the background/border
		// step, before a child renders — would sit UNDER that fill and never be seen. An
		// outline has no such ordering problem, which is the whole reason it was chosen.
		expect(body).toMatch(/outline:\s*1px\s+solid/);
		expect(body, 'an inset box-shadow would be hidden under a 100%-width fill').not.toMatch(/box-shadow:\s*inset/);
	});

	it('draws the ring outward, never inward into the band', () => {
		// An inward ring (a negative `outline-offset`) eats the band's own interior from
		// both sides — measured 2px of a 4px band, HALF the readable core, in the harness
		// pass this rule cost before it was corrected (`.superpowers/harness-band-fix.md`).
		// Outward is safe: the track's containing block is the bar's own PADDING box, so
		// a 0-offset ring lands exactly at that padding edge, never past it. On a bar with
		// no border that edge IS the outer edge (harmless — nothing else is painted
		// there); on an inferred bar the 1px dashed border sits OUTSIDE the padding box it
		// shrinks, so the ring stays a full 1px clear of it. Measured geometrically
		// (`getComputedStyle`) and cross-checked with a pixel scan, not merely reasoned —
		// the same report has both.
		expect(body).not.toMatch(/outline-offset:\s*-/);
	});

	it('draws the ring in the page background, not in either progress colour', () => {
		// Neither the track's neutral fill (`--background-modifier-border`) nor the
		// fill's green (`rgb(var(--color-green-rgb))`) survives a bar painted in that
		// same colour; a THIRD colour — the page's own background, the one thing a bar is
		// never painted in — is what a hairline needs to separate the band from any bar
		// colour, including a workflow state a reader has painted green through
		// `stateColorPaint`, which is why this is not scoped to `.pbl-done`. Asserted as
		// the rule rather than pinned to one token: neither progress colour, not "must be
		// exactly this one" — a future third colour choice that is still neither of them
		// should not have to touch this test.
		const outline = /outline:\s*1px\s+solid\s+([^;]+);/.exec(body)?.[1].trim();
		expect(outline, 'the outline rule is missing entirely').toBeDefined();
		expect(outline).not.toContain('--background-modifier-border');
		expect(outline).not.toContain('--color-green-rgb');
	});
});
