import { describe, expect, it } from 'vitest';
// @ts-expect-error — a build script, deliberately outside tsconfig's `src/**` include.
import { assembleStyles } from '../../scripts/styles-assemble.mjs';

/**
 * [[Nothing pins a physical side]], as far as it has landed. Two categories of
 * direction-dependent construct are clean on the whole assembled stylesheet, and this
 * asserts them AT THE FORBIDDEN THING rather than by listing the rules that used to
 * carry one — the next partial is exactly the one a list would not name.
 *
 * Deliberately narrower than the PBI: `border-left`/`border-right` and every bare
 * `left:`/`right:` placement are still in the file, classified there as coupled to a
 * gradient or to an offset TypeScript computes physically. A rule over those would open
 * with an exemption list, which is what [[Styling rules are checks]] is written to avoid.
 * So the sentence this file can hold is two sentences, and they are deliberately not the
 * same one: a margin or padding names no side EXCEPT where the same rule pins one, and
 * text alignment names no side at all. The licence belongs to the first only — it exists
 * for a clearance whose neighbour is placed physically, and no such coupling can make
 * `text-align: left` right. Writing them as one sentence is the defect review found here.
 */
const styles: string = assembleStyles();

/**
 * Comments are prose ABOUT the rules and may legitimately name a physical property —
 * a comment explaining why an offset stayed physical is not a violation. Blanked rather
 * than deleted so a reported offset still lands on the right line.
 */
const declarations = styles.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

/**
 * Every declaration block, innermost first — `{ … }` containing no brace is a body and
 * never an `@media` wrapper, so this reads rules without parsing nesting.
 *
 * The block rather than the line is the unit because the one legal physical margin or
 * padding is legal BY ITS NEIGHBOURS: a clearance that holds a physically-placed thing
 * off another physically-placed thing has to stay physical, or it mirrors away from what
 * it clears. That is a rule and not an allowlist — it cannot go stale when a partial is
 * added, and it stops being satisfied the moment the offset beside it goes logical.
 */
const blocks = [...declarations.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);

/**
 * How many top-level values a CSS value list holds — which is what says whether a
 * `margin`/`padding` shorthand names a side, since only the four-value form does.
 *
 * Balanced-parenthesis aware, and that is the whole reason it is a function rather than a
 * `split`: collapsing `\([^)]*\)` stops at the FIRST `)`, so `calc(var(--gap) + 1px) 2px
 * 3px 4px` came out as six tokens and a four-sided declaration went unreported. Caught in
 * review on PR #196, the third instrument failure on this file — a scan that reads the
 * easy spelling of a thing and reports on all of them.
 */
const valueCount = (value: string): number => {
	let depth = 0;
	let values = 0;
	let inValue = false;
	for (const char of value.trim()) {
		if (char === '(') depth += 1;
		else if (char === ')') depth -= 1;
		// Whitespace inside a function is part of one value — `calc(a + b)` is not three.
		if (depth === 0 && /\s/.test(char)) inValue = false;
		else if (!inValue) {
			values += 1;
			inValue = true;
		}
	}
	return values;
};

/**
 * Whether `block` pins a physical side itself, which is what licenses a physical box value.
 *
 * The VALUE decides, not the property: `left: auto` declines to anchor that side, so a
 * block whose only placement is `auto` pins nothing and licenses nothing — it read as
 * pinned until review on PR #196. The CSS-wide keywords are refused with it for the same
 * reason. Latent rather than live: the file's one `left: auto` (`.pbl-bar-clipped-end
 * .pbl-bar-connector`) sits beside a `right: 0` that does pin, and carries no box value
 * either way. The check exists for the rule nobody has written yet.
 */
const pinsAPhysicalSide = (block: string): boolean =>
	/(?:^|[;{\s])(?:left|right)\s*:\s*(?!auto|inherit|initial|unset|revert)[^;\s]/.test(block);

/** Every block `matches` holds for, licensed or not. */
const matching = (matches: (block: string) => boolean): string[] =>
	blocks.filter(matches).map((block) => block.trim());

/**
 * The blocks `matches` holds for that have no physical placement to justify it.
 *
 * Separate from `matching` rather than a flag on it, because ONE of the two categories
 * here is licensed and the other is not — a single helper applying the licence to both
 * silently exempted `left: 0; text-align: left` while the comment below said no exemption
 * was coherent. Caught in review on PR #196; the naming is what keeps the two apart at
 * the call, where a boolean argument would not.
 *
 * Both take a PREDICATE rather than a pattern, so that the licence has exactly one
 * definition and every box-property spelling reaches it by name. The four-value shorthand
 * reached it by neither, and was filtered inline instead — which review caught in the
 * round after the one above: the two findings are the same licence applied where it should
 * not be and then withheld where it should.
 */
const unlicensed = (matches: (block: string) => boolean): string[] =>
	blocks.filter((block) => matches(block) && !pinsAPhysicalSide(block)).map((block) => block.trim());

/** Whether `block` sets a four-value `margin`/`padding`, the shorthand form that names a side. */
const hasFourSidedShorthand = (block: string): boolean =>
	// EVERY shorthand in the block, not the first: `exec` stops at one, so
	// `margin: 0; padding: 1px 2px 3px 4px;` passed on the symmetric margin while the
	// four-value padding went unread — and that is the exact order `.pbl-card-kid` writes
	// them in, so the one rule this category exists for was a `margin: 0` away from being
	// invisible to it. Caught in review on PR #196.
	//
	// The value ends at a `;` or at the END OF THE BLOCK, since the last declaration in a
	// rule may legally drop its semicolon — requiring one made the guard blind to exactly
	// the declaration a hand-written rule is most likely to spell that way. `[^;]+` cannot
	// cross a `;`, so dropping it from the pattern is the whole of that. Fourth instrument
	// failure on this file, caught in review on PR #196 like the three above it.
	[...block.matchAll(/(?:^|[;{\s])(?:margin|padding)\s*:\s*([^;]+)/g)].some(
		(decl) => valueCount(decl[1]) === 4,
	);

describe('the stylesheet names no physical side', () => {
	it('sets no margin or padding on a named physical side, unless the same rule pins one', () => {
		// Longhands (`margin-left`) and the four-value shorthand alike — the second is the
		// spelling a property-name check misses, and `.pbl-card-kid`'s indent was written
		// that way. A three-value shorthand is symmetric on the inline axis, so it names
		// no side and is not matched.
		expect(unlicensed((block) => /(?:^|[;{\s])(?:margin|padding)-(?:left|right)\s*:/.test(block))).toEqual([]);
		// `unlicensed` for BOTH: the licence is about the declaration, not about how it is
		// spelled, so `padding: 0 8px 0 18px` in a pinned block is the same licensed
		// clearance `.pbl-bar-label-after` writes as a longhand. Filtered inline here until
		// review pointed out the test's own name promised otherwise.
		expect(unlicensed(hasFourSidedShorthand)).toEqual([]);
	});

	it('licenses a physical margin or padding only where the placement beside it is physical too', () => {
		// The exemption above is the whole reason this file can keep the strong sentence,
		// so it is asserted rather than assumed: `.pbl-bar-label-after` is the one rule
		// using it, and it must still be pinned by the offset `barLabel.ts` computes. Were
		// that offset to go logical without the padding following, the clearance would
		// mirror away from the connector it clears and the test above would go on passing.
		//
		// The count is asserted before the body for the reason the shorthand scan above
		// records: a lone match reads only the first rule, so a second one — under a media
		// query, say — would be unchecked and this would go on passing. Whether both must
		// carry both declarations is a question for whoever adds the second.
		const labelRules = [...declarations.matchAll(/\.pbl-bar-label-after\s*\{([^}]*)\}/g)];
		expect(labelRules.length, '.pbl-bar-label-after is gone, renamed, or now has a second rule').toBe(1);
		expect(labelRules[0][1]).toMatch(/padding-left:/);
		expect(labelRules[0][1]).toMatch(/left:\s*var\(--pbl-label-left\)/);
	});

	it('reads a four-value shorthand that a rule spells last and unterminated', () => {
		// The stylesheet has no such declaration today, so the sentence above cannot show
		// this and would go on passing with the guard blind. Asserted against a planted
		// block for that reason: the instrument is what is under test here, not `styles/`.
		expect(hasFourSidedShorthand('margin: 0; padding: 1px 2px 3px 4px')).toBe(true);
		expect(hasFourSidedShorthand('padding: calc(var(--gap) + 1px) 2px 3px 4px')).toBe(true);
		expect(hasFourSidedShorthand('margin: 0 auto; padding: 1px 2px')).toBe(false);
	});

	it('aligns text to a logical end, never to a physical one', () => {
		// No licence here, and none is coherent: text alignment follows the text, whatever
		// pins the box the text is in. `matching`, NOT `unlicensed` — this line read
		// `offenders` until review, which applied the placement licence to both categories
		// and let `left: 0; text-align: left` through the sentence above it.
		expect(matching((block) => /text-align:\s*(?:left|right)\b/.test(block))).toEqual([]);
	});
});
