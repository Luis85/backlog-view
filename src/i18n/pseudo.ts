/**
 * The pseudo-locale: English, accented and padded, so a layout can be looked at in a
 * language that is not English before one exists.
 *
 * It is not a translation and never ships — `t.ts` registers it in development builds
 * only, and the production `define` folds that branch away so the release carries
 * neither the catalog nor this module. What it answers is the question
 * `English ships alone` otherwise leaves open for a whole round: does the toolbar still
 * fit, does a column still line up, does a button still hold its label, when every
 * string is a third longer and no character is the one the design was drawn around.
 *
 * Three properties, each doing one job:
 *
 * - **every letter is accented**, so a string still spelled at a call site stands out on
 *   screen without reading the source — the same job the test suite's `MARK` does, for
 *   the eye rather than for an assertion;
 * - **the text is a third longer**, which is roughly what German costs against English,
 *   so a control that only just fits stops fitting;
 * - **it is bracketed**, so truncation is visible: a sentence missing its `⟧` was cut
 *   off, and no guess about ellipses is needed to see it.
 *
 * A `{parameter}` passes through untouched. The name is what `t()` substitutes on, so
 * accenting it would leave a literal brace on screen and hide the value it stood for.
 */

/** A private-use extension of English, so `Intl` resolves it to English grammar. */
export const PSEUDO_LOCALE = 'en-x-pseudo';

const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ACCENTED = 'ãbçdéfghïjklmñöpqrstüvwxyzÃBÇDÉFGHÏJKLMÑÖPQRSTÜVWXYZ';

/** How much longer than English, roughly what German costs. */
const PADDING = 0.3;

function pseudoText(text: string): string {
	const accented = text.replace(/\{\w+\}|[A-Za-z]/g, (match) =>
		match.startsWith('{') ? match : ACCENTED[PLAIN.indexOf(match)],
	);
	return `⟦${accented}${'·'.repeat(Math.ceil(accented.length * PADDING))}⟧`;
}

/**
 * The same catalog, said in the pseudo-locale — the same keys and the same forms.
 *
 * Generic over the catalog it is given rather than typed against `t.ts`'s `Catalog`, and
 * that is a structural decision rather than a flourish: `t.ts` registers this and
 * importing the type back from it is a cycle, which fallow refuses and which would stop
 * the production build tree-shaking this module out — the one property the whole design
 * rests on. Taking the source's own type also means the result is `typeof en`, so the
 * registry entry needs no cast of its own.
 */
export function pseudoCatalog<C extends Record<string, string | Record<string, string>>>(source: C): C {
	return Object.fromEntries(
		Object.entries(source).map(([key, entry]) => [
			key,
			typeof entry === 'string'
				? pseudoText(entry)
				: Object.fromEntries(Object.entries(entry).map(([form, text]) => [form, pseudoText(text)])),
		]),
	) as C;
}
