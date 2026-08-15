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
 * The shipped catalog a language code reads from: an exact match, then the base
 * language, then English. Obsidian's translation list carries regional codes, so
 * `pt-BR` must find `pt` rather than falling all the way to the source — and the match
 * is case-insensitive because a language tag's case is convention, not meaning.
 */
export function resolveCatalog(code: string, available: readonly string[]): string {
	const wanted = code.trim().toLowerCase();
	const base = wanted.split(/[-_]/)[0];
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
 */
export function intlLocale(code: string): string {
	try {
		return Intl.getCanonicalLocales(code.trim())[0] ?? SOURCE_LOCALE;
	} catch {
		return SOURCE_LOCALE;
	}
}
