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
