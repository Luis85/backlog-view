// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { PSEUDO_LOCALE, pseudoCatalog } from '../../src/i18n/pseudo';
import { activeLocale, CATALOGS, initLocale, setLocale, t } from '../../src/i18n/t';
import { resetLocale } from '../helpers/locale';
import { compareToSource } from './parity';

/**
 * The pseudo-locale is what makes "English ships alone" a starting point rather than a
 * dead end: a second catalog that resolves, renders and is a third longer than English,
 * without anyone translating anything.
 *
 * Two claims are checked elsewhere on purpose. That it does not reach a release is a
 * fact about the BUNDLE, so `scripts/esbuild.config.mjs` refuses a production `main.js`
 * carrying it — no test here can see a bundler setting. That it mirrors English key for
 * key is `parity.test.ts`'s rule, and the registry sweep there already reads it.
 */

const pseudo = pseudoCatalog(en);

describe('the pseudo-locale is a catalog, not a translation', () => {
	it('is registered under a development build, which is what the suite runs as', () => {
		expect(Object.keys(CATALOGS)).toContain(PSEUDO_LOCALE);
	});

	it('owes English everything a real translation would', () => {
		expect(compareToSource(PSEUDO_LOCALE, pseudo)).toEqual({
			missing: [],
			stale: [],
			parameters: [],
			plurals: [],
		});
	});

	it('resolves as its own catalog, and leaves plain English alone', () => {
		setLocale(PSEUDO_LOCALE);
		const drawn = t('emptyState.noItems');
		resetLocale();

		expect(drawn).not.toBe(en['emptyState.noItems']);
		expect(t('emptyState.noItems')).toBe(en['emptyState.noItems']);
	});
});

describe('what it does to a sentence is what makes it worth looking at', () => {
	it('accents every letter, so a string left at a call site stands out on screen', () => {
		expect(pseudo['emptyState.noItems']).toContain('Ñö bãçklög ïtéms');
	});

	it('is a third longer, so a control that only just fits stops fitting', () => {
		const source = en['emptyState.whatShowsHere'];
		const drawn = pseudo['emptyState.whatShowsHere'] as string;
		expect(drawn.length).toBeGreaterThan(source.length * 1.3);
	});

	it('brackets the sentence, so a truncation is visible without guessing', () => {
		expect(pseudo['emptyState.noItems']).toMatch(/^⟦.*⟧$/u);
	});

	it('leaves a parameter name alone, since that is what t() substitutes on', () => {
		setLocale(PSEUDO_LOCALE);
		const drawn = t('emptyState.noTypeItems', { type: 'Epic' });
		resetLocale();

		// The value arrives unaccented — it is the user's own type name, not text.
		expect(drawn).toContain('Epic');
		expect(drawn).not.toContain('{type}');
	});

	it('keeps a plural entry plural, so the count still selects a form', () => {
		setLocale(PSEUDO_LOCALE);
		const one = t('count.items', { count: 1 });
		const many = t('count.items', { count: 4 });
		resetLocale();

		expect(one).not.toBe(many);
	});
});

describe('the override is the only way to ask for it, and it is the development build’s', () => {
	const KEY = 'product-backlog-locale';

	afterEach(() => {
		window.localStorage.removeItem(KEY);
		resetLocale();
	});

	it('reads the key ahead of the app’s own language', () => {
		window.localStorage.setItem(KEY, PSEUDO_LOCALE);
		initLocale();

		expect(activeLocale().catalog).toBe(PSEUDO_LOCALE);
	});

	it('falls back to the app’s language with no key set', () => {
		initLocale();

		// The mock answers `'en'`, which is what a vault with no override gets.
		expect(activeLocale().catalog).toBe('en');
	});

	it('never leaves a malformed value deciding anything', () => {
		window.localStorage.setItem(KEY, '!!!');
		initLocale();

		expect(activeLocale().catalog).toBe('en');
		expect(activeLocale().numbers).toBe('en');
	});
});
