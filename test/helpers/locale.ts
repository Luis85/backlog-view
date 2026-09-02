import { beforeEach } from 'vitest';
import { intlLocale } from '../../src/i18n/locale';
import { setLocale } from '../../src/i18n/t';

/**
 * Which locale the suite runs in — resolved once, explicitly, rather than inherited.
 *
 * A suite that has only ever run in the source language proves nothing about the
 * translation layer, so `PBL_TEST_LOCALE` runs the whole thing somewhere else and CI
 * does exactly that on one leg. What that second pass can and cannot answer is worth
 * stating, because it is narrower than "the suite is locale-independent":
 *
 * - it DOES exercise the fallback across every surface — a code with no catalog of its
 *   own resolves to English, and `grammarOf` has to bring English's plural rules with
 *   it — and it exercises `Intl.NumberFormat` in a locale that groups and separates
 *   differently from English, which is where a rendered count would diverge;
 * - it does NOT run the suite in a second CATALOG. Most assertions here name the English
 *   text on purpose (that is what `test/i18n/`'s marked catalogs are for, key by key), so
 *   a pass under `en-x-pseudo` would fail on wording rather than on behaviour and would
 *   be measuring the assertions, not the layer.
 *
 * Set it to any language tag. `de-DE` is what CI uses: no catalog, and number formatting
 * unlike English's.
 */
export const TEST_LOCALE = process.env.PBL_TEST_LOCALE ?? 'en';

/**
 * Put the locale back where the run started. Resolution is module state by design — once,
 * at load — so a test that drives `setLocale` itself has to restore it, and restoring it
 * to a hard-coded `'en'` is what would make the second CI leg green by accident.
 */
export function resetLocale(): void {
	setLocale(TEST_LOCALE);
}

/**
 * Before EVERY test, not once per file — which is what a setup file's top-level statement
 * would be. A file that drives `setLocale` in one test leaves it there for every test
 * after it, so the second CI leg ran the tail of three files in English while reporting
 * that it had run the suite in `de-DE`. Registered here rather than asked of each file,
 * because "nothing inherits a locale" cannot be checked by driving the files somebody
 * remembered. A file-local `beforeEach` still wins: it is registered after this one and
 * so runs after it, which is how `test/i18n/`'s fixture catalogs still take effect.
 * Found by review (Codex, PR #240).
 */
beforeEach(resetLocale);

resetLocale();

/**
 * A number as the run's locale writes it — the same `Intl.NumberFormat` `t()` builds, on
 * the same resolved code. An expectation that spells `2.5` or `12,345` is asserting
 * ENGLISH number formatting, which is the one thing the second pass exists to vary, and
 * the assertion is almost never about that.
 */
export function num(value: number): string {
	return new Intl.NumberFormat(intlLocale(TEST_LOCALE)).format(value);
}

/**
 * `num()`'s sibling for the one caller that must NOT go through the default three-
 * fraction-digit cap — `formatNumber(value, true)`, the estimation table's confidence
 * and effort cells, which show a value the user typed rather than a count this plugin
 * computed. Same reason `num()` exists: an expectation spelling `3.142` for `3.14159`
 * would be pinning `Intl`'s default rounding rather than what the cell promises.
 *
 * The options here MIRROR `activate`'s `numberPrecise` and have to keep mirroring it —
 * significant digits rather than fraction digits, for the reason stated there. A helper
 * that drifted from the formatter it stands in for would assert the old policy while the
 * view rendered the new one, which is the one failure a helper like this can cause.
 *
 * It stands in for the SPELLED-OUT branch only. `formatNumber(value, true)` switches to
 * an exponent outside `String()`'s own threshold, and this does not: every caller here
 * passes an ordinary value, so a mirrored branch would be a line no test reaches. Hand it
 * something below 1e-6 or at 1e21 and the expectation it builds is the wrong one — the
 * branch belongs in `test/i18n/locale.test.ts`, which asserts the boundary directly.
 */
export function numPrecise(value: number): string {
	return new Intl.NumberFormat(intlLocale(TEST_LOCALE), { maximumSignificantDigits: 21 }).format(value);
}

/**
 * Run `body` with the plugin resolved to `code`, and put the locale back afterwards —
 * for a test that asks the same question in two locales and compares the answers.
 *
 * Here rather than in each file that wants it: the `beforeEach` above covers a test that
 * never touches the locale, and `resetLocale` covers a body that throws, but neither
 * covers a test resolving TWICE inside one `it`. Two files needed exactly that and each
 * had its own copy.
 */
export function withLocale<T>(code: string, body: () => T): T {
	setLocale(code);
	try {
		return body();
	} finally {
		resetLocale();
	}
}
