/**
 * Which catalog a language code reads from, and which locale `Intl` gets. Two answers,
 * because they are two questions: the catalog is narrowed to what this plugin ships,
 * and `Intl` handles far more locales than this plugin will ever carry catalogs for.
 * A French user with no French catalog reads English and still counts in French.
 *
 * Pure, and deliberately unaware of which catalogs exist — the registry lives with the
 * catalogs in `t.ts`, so this file can be asked any question a test wants to ask.
 */

/** The source catalog, the fallback, and in this round the only one that ships. */
export const SOURCE_LOCALE = 'en';

/**
 * The one answer to "is this a language tag, and what is it called" — so the two
 * questions below cannot disagree about a code. `Intl.getCanonicalLocales` is the
 * validator rather than a pattern of our own: it is the same judgement every `Intl`
 * constructor makes, so a tag this accepts is one they accept.
 *
 * Underscores are normalized first, because a tag spelled `pt_BR` is a real thing to
 * receive and BCP 47 does not have it — and then it is the SAME tag to both callers,
 * which is the point. Null rather than a fallback, because the two callers fall back to
 * different things.
 */
function canonical(code: string): string | null {
	try {
		return Intl.getCanonicalLocales(code.trim().replace(/_/g, '-'))[0] ?? null;
	} catch {
		return null;
	}
}

/**
 * The shipped catalog a language code reads from: an exact match, then the base
 * language, then English. Obsidian's translation list carries regional codes, so
 * `pt-BR` must find `pt` rather than falling all the way to the source — and the match
 * is case-insensitive because a language tag's case is convention, not meaning.
 *
 * **The tag is validated WHOLE before its base is taken**, and that order is the rule
 * rather than a step: `pt-!!!` and `pt_` both begin with a real language subtag, so a
 * base match taken first hands a corrupted host locale the Portuguese catalog — a
 * translation nobody asked for, and the opposite of what a malformed code is documented
 * to do. Found by review (Codex, PR #151).
 */
export function resolveCatalog(code: string, available: readonly string[]): string {
	const tag = canonical(code);
	if (tag === null) return SOURCE_LOCALE;
	const wanted = tag.toLowerCase();
	const base = wanted.split('-')[0];
	return (
		available.find((name) => name.toLowerCase() === wanted) ??
		available.find((name) => name.toLowerCase() === base) ??
		SOURCE_LOCALE
	);
}

/**
 * The raw code, made safe for `Intl`. `getLanguage()` documents a default of `'en'` and
 * this does not rely on it: every `Intl` constructor throws a RangeError on a malformed
 * tag, and a view that fails to render because a language code was odd is a worse answer
 * than counting in English.
 *
 * It narrows nothing. `Intl` handles far more locales than this plugin will ever ship
 * catalogs for, so a French reader with no French catalog still counts in French.
 */
export function intlLocale(code: string): string {
	return canonical(code) ?? SOURCE_LOCALE;
}
