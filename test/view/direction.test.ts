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

/** Whether `block` pins a physical side itself, which is what licenses a physical box value. */
const pinsAPhysicalSide = (block: string): boolean => /(?:^|[;{\s])(?:left|right)\s*:/.test(block);

/** Every block matching `pattern`, licensed or not. */
const matching = (pattern: RegExp): string[] =>
	blocks.filter((block) => pattern.test(block)).map((block) => block.trim());

/**
 * The blocks matching `pattern` that have no physical placement to justify it.
 *
 * Separate from `matching` rather than a flag on it, because ONE of the two categories
 * here is licensed and the other is not — a single helper applying the licence to both
 * silently exempted `left: 0; text-align: left` while the comment below said no exemption
 * was coherent. Caught in review on PR #196; the naming is what keeps the two apart at
 * the call, where a boolean argument would not.
 */
const unlicensed = (pattern: RegExp): string[] =>
	blocks.filter((block) => pattern.test(block) && !pinsAPhysicalSide(block)).map((block) => block.trim());

describe('the stylesheet names no physical side', () => {
	it('sets no margin or padding on a named physical side, unless the same rule pins one', () => {
		// Longhands (`margin-left`) and the four-value shorthand alike — the second is the
		// spelling a property-name check misses, and `.pbl-card-kid`'s indent was written
		// that way. A three-value shorthand is symmetric on the inline axis, so it names
		// no side and is not matched.
		expect(unlicensed(/(?:^|[;{\s])(?:margin|padding)-(?:left|right)\s*:/)).toEqual([]);
		const fourValue = blocks.filter((block) => {
			const decl = /(?:^|[;{\s])(?:margin|padding)\s*:\s*([^;]+);/.exec(block);
			if (!decl) return false;
			// `var(--x)` holds no spaces once collapsed, so counting words counts VALUES.
			return decl[1].trim().replace(/\([^)]*\)/g, 'X').split(/\s+/).length === 4;
		});
		expect(fourValue).toEqual([]);
	});

	it('licenses a physical margin or padding only where the placement beside it is physical too', () => {
		// The exemption above is the whole reason this file can keep the strong sentence,
		// so it is asserted rather than assumed: `.pbl-bar-label-after` is the one rule
		// using it, and it must still be pinned by the offset `barLabel.ts` computes. Were
		// that offset to go logical without the padding following, the clearance would
		// mirror away from the connector it clears and the test above would go on passing.
		const label = /\.pbl-bar-label-after\s*\{([^}]*)\}/.exec(declarations);
		expect(label, '.pbl-bar-label-after is gone or renamed').not.toBeNull();
		expect(label?.[1]).toMatch(/padding-left:/);
		expect(label?.[1]).toMatch(/left:\s*var\(--pbl-label-left\)/);
	});

	it('aligns text to a logical end, never to a physical one', () => {
		// No licence here, and none is coherent: text alignment follows the text, whatever
		// pins the box the text is in. `matching`, NOT `unlicensed` — this line read
		// `offenders` until review, which applied the placement licence to both categories
		// and let `left: 0; text-align: left` through the sentence above it.
		expect(matching(/text-align:\s*(?:left|right)\b/)).toEqual([]);
	});
});
