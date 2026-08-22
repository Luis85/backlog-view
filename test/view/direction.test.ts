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
 * So the sentence this file can hold is "margins, paddings and text alignment name no
 * side", and it says only that.
 */
const styles: string = assembleStyles();

/**
 * Comments are prose ABOUT the rules and may legitimately name a physical property —
 * a comment explaining why an offset stayed physical is not a violation. Blanked rather
 * than deleted so a reported offset still lands on the right line.
 */
const declarations = styles.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

/** Every line of `declarations` matching `pattern`, as `line number: text`. */
function offenders(pattern: RegExp): string[] {
	return declarations
		.split('\n')
		.map((line, i) => (pattern.test(line) ? `${i + 1}: ${line.trim()}` : ''))
		.filter(Boolean);
}

describe('the stylesheet names no physical side', () => {
	it('sets no margin or padding on a named physical side', () => {
		// Longhands (`margin-left`) and the four-value shorthand alike — the second is the
		// spelling a property-name check misses, and `.pbl-card-kid`'s indent was written
		// that way. A three-value shorthand is symmetric on the inline axis, so it names
		// no side and is not matched.
		expect(offenders(/(?:^|[;{\s])(?:margin|padding)-(?:left|right)\s*:/)).toEqual([]);
		const fourValue = declarations
			.split('\n')
			.map((line, i) => {
				const decl = /(?:^|[;{\s])(?:margin|padding)\s*:\s*([^;]+);/.exec(line);
				if (!decl) return '';
				// `var(--x)` holds no spaces once collapsed, so counting words counts VALUES.
				const values = decl[1].trim().replace(/\([^)]*\)/g, 'X').split(/\s+/).length;
				return values === 4 ? `${i + 1}: ${line.trim()}` : '';
			})
			.filter(Boolean);
		expect(fourValue).toEqual([]);
	});

	it('aligns text to a logical end, never to a physical one', () => {
		expect(offenders(/text-align:\s*(?:left|right)\b/)).toEqual([]);
	});
});
