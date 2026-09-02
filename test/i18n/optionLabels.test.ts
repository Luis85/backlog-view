import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog } from '../../src/i18n/t';

/**
 * A sentence that tells the reader to set a view option QUOTES that option's label, and
 * the label it quotes has to be the one the option itself draws — otherwise the sentence
 * points at a control the reader cannot find, which is worse than an untranslated one.
 *
 * The rule is checked at the forbidden thing rather than by listing the nine keys that
 * broke it: a message may not spell a quoted option label at all, so a tenth sentence
 * added next year fails without anyone remembering this file. What it costs is that the
 * label must arrive as a parameter — one key, one label, quoted wherever it is named.
 *
 * Quoted, not merely contained: `option.group.release` is the single word *Release*, and
 * a rule reading it unquoted would refuse every sentence that mentions a release.
 */

// Read as a `Catalog` rather than through `en`'s own `as const` type: the question here
// is about the text, and the literal union `en` carries makes every entry a different
// type from every other one.
const catalog: Catalog = en;

/** Every option's own label — the keys `viewOptions.ts` and its two siblings draw from. */
const optionLabels: [string, string][] = Object.entries(catalog).filter(
	(entry): entry is [string, string] => /(^|\.)option\./.test(entry[0]) && typeof entry[1] === 'string',
);

/** Every message and, for a plural entry, every one of its forms. */
const messages: [string, string][] = Object.entries(catalog).flatMap(([key, entry]) =>
	typeof entry === 'string' ? [[key, entry] as [string, string]] : Object.values(entry).map((form) => [key, form] as [string, string]),
);

describe('an option label is quoted from its own key, never re-spelled', () => {
	it('finds an option label to check, so the rule is not vacuous', () => {
		expect(optionLabels.length).toBeGreaterThan(30);
		expect(messages.length).toBeGreaterThan(optionLabels.length);
	});

	it.each(optionLabels)('%s is not quoted inside any other message', (labelKey, label) => {
		const offenders = messages
			.filter(([key, text]) => key !== labelKey && text.includes(`"${label}"`))
			.map(([key]) => key);
		expect(offenders).toEqual([]);
	});
});
