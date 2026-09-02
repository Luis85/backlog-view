import { afterEach, describe, expect, it } from 'vitest';
import { intlLocale, resolveCatalog } from '../../src/i18n/locale';
import { Catalog, compareText, foldForMatch, formatNumber, list, setLocale, t, activeLocale } from '../../src/i18n/t';
import { resetLocale } from '../helpers/locale';
import { shelfLabel } from '../../src/domain/roadmap';
import { unscheduledLabel } from '../../src/domain/bars';
import { noStateCollisionLabel, noStateLabel } from '../../src/domain/board';
import { pt, reordered, ru, sparse } from './fixtures';

/**
 * The translation layer, driven through fixture catalogs rather than through the one
 * catalog that ships. Every check below would pass vacuously against the shipped
 * registry, since with English alone no code can resolve to anything else and no lookup
 * can miss — which is exactly why the fixtures exist.
 */

// Resolution is module state by design (once, at load), so each test puts it back.
afterEach(() => resetLocale());

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

	it('refuses a malformed tag WHOLE rather than salvaging its first subtag', () => {
		// The trap this states: `pt-!!!` and `pt_` both begin with a real language subtag,
		// so a base match taken before validating hands back the Portuguese catalog for a
		// corrupted host locale — a translation nobody's Obsidian asked for, and the exact
		// opposite of this note's "malformed resolves to English". Found by review
		// (Codex, PR #151).
		expect(resolveCatalog('pt-!!!', shipped)).toBe('en');
		expect(resolveCatalog('pt_', shipped)).toBe('en');
		expect(resolveCatalog('pt-', shipped)).toBe('en');
	});

	it('falls back to English even when English is not in the list — it always exists', () => {
		expect(resolveCatalog('ja', ['pt'])).toBe('en');
	});
});

describe('intlLocale', () => {
	it('canonicalizes a usable tag rather than narrowing it — Intl handles more than we ship', () => {
		expect(intlLocale('pt-br')).toBe('pt-BR');
	});

	it('accepts the same underscore form `resolveCatalog` does, so the two cannot disagree', () => {
		// `Intl.getCanonicalLocales` throws on an underscore, and `resolveCatalog` splits on
		// one — so before both went through one validator, `pt_BR` read the Portuguese
		// catalog and formatted its numbers in English. Found by review (Codex, PR #151).
		expect(intlLocale('pt_BR')).toBe('pt-BR');
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

	it('answers both halves for one tag, or neither — never a catalog without its numbers', () => {
		// The pair is the assertion. A tag one function accepts and the other refuses
		// renders translated text with the source language's numbers, which reads as a
		// broken translation rather than as a rejected tag.
		setLocale('pt_BR', { pt });
		expect(activeLocale()).toEqual({ catalog: 'pt', numbers: 'pt-BR' });
		setLocale('pt-!!!', { pt });
		expect(activeLocale()).toEqual({ catalog: 'en', numbers: 'en' });
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
			'the state, parent, and order properties share the key "k"',
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

	it('selects the 0 category for a plural key called with no count at all', () => {
		// Unreachable from typed call sites — `Params` demands `count: number` for any key
		// carrying `{count}` — reachable only from a caller that bypassed the types.
		// `selectForm`'s own fallback picks a category (English `other` at 0) rather than
		// throwing; `fill` has no value to substitute, so the placeholder itself stays —
		// a broken caller reads as an odd label rather than a crash.
		// `as never` on purpose: the claim is what `t` renders when the parameter it needs is
		// absent, which a caller cannot express without getting past the parameter type.
		expect(t('count.items', {} as never)).toBe('{count} items');
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
		// ENGLISH formatting is the subject here, so the locale is driven rather than inherited:
		// the point is that 12345 comes out grouped at all, and the grouping is the locale's.
		setLocale('en');
		expect(t('count.items', { count: 12345 })).toBe('12,345 items');
		setLocale('de', { de: {} });
		expect(t('count.items', { count: 12345 })).toBe('12.345 items');
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

/**
 * The placement labels are FUNCTIONS in `domain/`, and this is what that buys. A
 * `const X = t(…)` is evaluated when its module is first imported, which happens before
 * `main.ts`'s `onload` calls `initLocale()` — so a constant would hold English no matter
 * what Obsidian's language is, and nothing else in the suite would notice: every
 * assertion elsewhere runs under the English catalog, where a frozen value and a live one
 * are the same string.
 *
 * Reverting any of these four to a `const` fails here and nowhere else.
 */
describe('a placement label reads the locale that is active when it is CALLED', () => {
	afterEach(() => resetLocale());

	const placements: Catalog = {
		'placement.unplaced': 'Nicht geplant',
		'placement.unscheduled': 'Ohne Termin',
		'placement.noState': 'Kein Status',
		'placement.noStateCollision': 'Nicht gesetzt',
	};

	it('follows a locale set after the module was imported', () => {
		// Imported at the top of this file, so any module constant has already been
		// evaluated by the time this runs — which is the whole point.
		expect(shelfLabel()).toBe('Unplaced');
		setLocale('de', { de: placements });
		expect(shelfLabel()).toBe('Nicht geplant');
		expect(unscheduledLabel()).toBe('Ohne Termin');
		expect(noStateLabel()).toBe('Kein Status');
		expect(noStateCollisionLabel()).toBe('Nicht gesetzt');
	});
});

/**
 * The three presentation helpers, which all take the REQUESTED locale rather than the
 * catalog's — the split `t()`'s own header states, asked of the half that is data.
 *
 * Every case here uses a locale with NO catalog on purpose. That is the arrangement the
 * host default would survive undetected in: with a shipped catalog beside it, an assertion
 * cannot tell "took the requested locale" from "took the resolved one".
 */
describe('collation, folding and numbers follow the requested locale', () => {
	afterEach(() => resetLocale());

	it('collates in the requested locale rather than the host default', () => {
		// Swedish sorts `ä` AFTER `z`; German sorts it with `a`. So the pair is the
		// assertion: a collator on the host default, or on the English catalog either of
		// these falls back to, answers the same way twice.
		setLocale('sv');
		expect(compareText('ä', 'z')).toBeGreaterThan(0);
		setLocale('de');
		expect(compareText('ä', 'z')).toBeLessThan(0);
	});

	it('builds ONE collator per setLocale, not one per comparison', () => {
		// The reason the helper exists rather than `localeCompare(b, locale)`, which
		// constructs a collator for every comparison — n·log n of them inside a sort in a
		// render path. Counted at the constructor, because the cost is not observable in
		// any answer the helper gives.
		const real = Intl.Collator;
		let built = 0;
		// A Proxy rather than a subclass: `Intl.Collator` is callable without `new` as well
		// as constructible, and a `class` satisfies only half of that signature.
		Intl.Collator = new Proxy(real, {
			construct: (target, args: ConstructorParameters<typeof real>) => {
				built++;
				return new target(...args);
			},
		});
		try {
			setLocale('sv');
			expect(built).toBe(1);
			['a', 'b', 'c', 'd'].sort(compareText);
			expect(built).toBe(1);
		} finally {
			Intl.Collator = real;
		}
	});

	it('folds for matching in the requested locale, where toLowerCase would not', () => {
		// Turkish folds `I` to `ı`. `toLowerCase()` gives `i` in every locale by
		// specification, which is the bug: the filter misses a note plainly on screen.
		setLocale('tr');
		expect(foldForMatch('I')).toBe('ı');
		setLocale('en');
		expect(foldForMatch('I')).toBe('i');
	});

	it('formats a bare number with the SAME formatter a sentence uses', () => {
		// German groups with a dot and there is no German catalog, so the sentence is
		// English. The two numbers agreeing is what stops a count outside a sentence
		// disagreeing with one inside it — they did, at a thousand.
		setLocale('de', { en: sparse });
		expect(formatNumber(12345)).toBe('12.345');
		expect(t('count.items', { count: 12345 })).toBe('12.345 items');
	});

	it('caps a bare number at three fraction digits by default, and not when asked to be precise', () => {
		// The default is right for a COUNT, which is never this precise. `precise` is for
		// a VALUE someone typed — the estimation view's confidence and effort cells — where
		// the same cap would silently round what the user entered.
		setLocale('en');
		expect(formatNumber(3.14159)).toBe('3.142');
		expect(formatNumber(3.14159, true)).toBe('3.14159');
		// Still the SAME locale's separators either way — `precise` changes the
		// fraction-digit cap, not which formatter's locale is asked.
		setLocale('de', { en: sparse });
		expect(formatNumber(3.14159, true)).toBe('3,14159');
	});
});
