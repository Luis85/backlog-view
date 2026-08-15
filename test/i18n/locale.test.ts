import { afterEach, describe, expect, it } from 'vitest';
import { intlLocale, resolveCatalog } from '../../src/i18n/locale';
import { list, setLocale, t, activeLocale } from '../../src/i18n/t';
import { pt, reordered, ru, sparse } from './fixtures';

/**
 * The translation layer, driven through fixture catalogs rather than through the one
 * catalog that ships. Every check below would pass vacuously against the shipped
 * registry, since with English alone no code can resolve to anything else and no lookup
 * can miss — which is exactly why the fixtures exist.
 */

// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => setLocale('en'));

describe('resolveCatalog', () => {
	const shipped = ['en', 'pt', 'de'];

	it('takes an exact match', () => {
		expect(resolveCatalog('de', shipped)).toBe('de');
	});

	it('falls a regional code back to its base language before English', () => {
		expect(resolveCatalog('pt-BR', shipped)).toBe('pt');
	});

	it('matches case-insensitively, and reads an underscore tag as regional too', () => {
		expect(resolveCatalog('PT-br', shipped)).toBe('pt');
		expect(resolveCatalog('pt_BR', shipped)).toBe('pt');
	});

	it('falls back to English for a code with no catalog, empty or malformed', () => {
		expect(resolveCatalog('ja', shipped)).toBe('en');
		expect(resolveCatalog('', shipped)).toBe('en');
		expect(resolveCatalog('  ', shipped)).toBe('en');
		expect(resolveCatalog('!!not a tag!!', shipped)).toBe('en');
	});

	it('falls back to English even when English is not in the list — it always exists', () => {
		expect(resolveCatalog('ja', ['pt'])).toBe('en');
	});
});

describe('intlLocale', () => {
	it('canonicalizes a usable tag rather than narrowing it — Intl handles more than we ship', () => {
		expect(intlLocale('pt-br')).toBe('pt-BR');
	});

	it('answers English for a tag Intl would throw on, rather than propagating it', () => {
		// Every Intl constructor throws RangeError on a malformed tag, and a view that
		// failed to render because a language code was odd is the worse answer.
		expect(intlLocale('!!not a tag!!')).toBe('en');
		expect(intlLocale('')).toBe('en');
	});
});

describe('the two locales are separate answers', () => {
	it('reads the nearest catalog while giving Intl the code the user actually set', () => {
		setLocale('pt-BR', { pt });
		expect(activeLocale()).toEqual({ catalog: 'pt', numbers: 'pt-BR' });
		expect(t('count.items', { count: 2 })).toBe('PT 2 itens');
	});

	it('formats numbers in the USER locale even with no catalog for it', () => {
		// German groups with a dot. There is no German catalog here at all — the message
		// is English and the number is still the reader's, which is the whole split.
		setLocale('de', { en: sparse });
		expect(t('count.items', { count: 12345 })).toBe('12.345 items');
	});

	it('selects the plural form by the CATALOG locale, not the requested one', () => {
		// Asking Intl.PluralRules('ru') for a category while reading English would request
		// a `few` form English does not have. The catalog decides its own grammar.
		setLocale('ru', { en: sparse });
		expect(t('count.items', { count: 3 })).toBe('3 items');
		setLocale('ru', { ru });
		expect(t('count.items', { count: 3 })).toBe('RU few 3');
	});
});

describe('lookup is total', () => {
	it('renders the English text for a key the active catalog does not carry', () => {
		setLocale('pt', { pt });
		// `pt` carries `count.items` and nothing else. Never the key, never blank: a gap in
		// a translation must not read as a broken view.
		expect(t('count.items', { count: 1 })).toBe('PT 1 item');
		expect(t('emptyState.allDone', { count: 1 })).toBe('All 1 item is done and hidden.');
	});

	it('renders a plural category the catalog does have, and falls to `other` for one it does not', () => {
		setLocale('ru', { ru });
		expect(t('count.items', { count: 1 })).toBe('RU one 1');
		expect(t('count.items', { count: 3 })).toBe('RU few 3');
		// Russian selects `many` at 5, and this fixture omits it deliberately.
		expect(t('count.items', { count: 5 })).toBe('RU other 5');
	});

	it('selects a FALLEN-BACK message by English rules, not by the active catalog\'s', () => {
		// The rule is "grammar follows the catalog", and on this path the catalog that
		// supplied the message is English rather than the active one. Russian selects `one`
		// at 21, so reading English forms by Russian rules renders `21 item`.
		setLocale('ru', { ru: {} });
		expect(t('count.items', { count: 21 })).toBe('21 items');
		expect(t('count.items', { count: 1 })).toBe('1 item');
		// French selects `one` at zero, where English selects `other`.
		setLocale('fr', { fr: {} });
		expect(t('count.items', { count: 0 })).toBe('0 items');
	});

	it('still selects a TRANSLATED message by the active catalog\'s rules', () => {
		// The other half of the same rule, so the fix above cannot be "always use English".
		setLocale('ru', { ru });
		expect(t('count.items', { count: 21 })).toBe('RU one 21');
	});

	it('joins a list inside a fallen-back message by English rules too', () => {
		// A list is grammar inside a sentence, so it follows the sentence. A German joiner
		// in an English sentence is the mixed-grammar case this asserts against.
		setLocale('de', { de: {} });
		expect(t('settings.sharedKey', { properties: ['state', 'parent', 'order'], key: 'k' })).toBe(
			'The state, parent, and order properties share the key "k".',
		);
	});

	it('joins a list in the active catalog when that catalog supplied the message', () => {
		setLocale('de', { de: { 'settings.sharedKey': 'DE {properties} :: {key}' } });
		expect(t('settings.sharedKey', { properties: ['a', 'b'], key: 'k' })).toBe('DE a und b :: k');
	});

	it('leaves a placeholder the caller did not supply visible rather than rendering "undefined"', () => {
		// Unreachable from typed call sites; reachable from a TRANSLATION that introduced a
		// parameter English does not have, which `Catalogs stay complete` is what catches.
		setLocale('pt', { pt: { 'count.items': { one: '{count} {nope}', other: '{count} {nope}' } } });
		expect(t('count.items', { count: 1 })).toBe('1 {nope}');
	});
});

describe('the sentence is the unit of translation', () => {
	it('lets a catalog reorder the parameters, because they are named', () => {
		setLocale('pt', { pt: reordered });
		expect(t('count.shownOfTotal', { shown: 2, total: 9 })).toBe('9 :: 2');
	});

	it('joins a list as grammar in the catalog locale, not with a literal joiner', () => {
		expect(list(['a', 'b', 'c'])).toBe('a, b, and c');
		expect(list(['a', 'b'])).toBe('a and b');
		setLocale('de', { de: {} });
		expect(list(['a', 'b'])).toBe('a und b');
	});

	it('formats a number inside a message rather than pasting it', () => {
		expect(t('count.items', { count: 12345 })).toBe('12,345 items');
	});
});

describe('English, which is what actually ships', () => {
	it('selects one and other', () => {
		expect(t('count.items', { count: 1 })).toBe('1 item');
		expect(t('count.items', { count: 0 })).toBe('0 items');
		expect(t('count.items', { count: 2 })).toBe('2 items');
	});

	it('resolves every real language code to English, because English ships alone', () => {
		for (const code of ['de', 'pt-BR', 'ja', 'ar', 'zh-TW']) {
			setLocale(code);
			expect(activeLocale().catalog).toBe('en');
			expect(t('count.items', { count: 1 })).toBe('1 item');
		}
	});
});
