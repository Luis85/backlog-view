import { getLanguage } from 'obsidian';
import { en } from './en';
import { intlLocale, resolveCatalog, SOURCE_LOCALE } from './locale';

/**
 * The lookup. One function answers "what does this key say", and it is total: every key
 * renders something in every locale, because a key missing from the active catalog falls
 * back to English and a key missing from English does not compile.
 *
 * Keys are TYPED against the English catalog, so a typo is a compile error rather than a
 * blank label, and the parameters a message takes are part of its key's type — omitting
 * one does not compile either. Both fall out of `en` being `as const`: the placeholders
 * are read out of the message text itself, so adding `{count}` to a message is the same
 * edit as demanding it of every caller. No codegen, no key list to keep in step.
 *
 * The sentence is the unit of translation. Nothing here builds a message by joining
 * pieces, because word order is not universal and a sentence assembled at a call site
 * cannot be reordered by any translation.
 *
 * **Two locales, because they answer different questions.** Grammar follows the CATALOG:
 * plural categories and list joining are grammar inside a sentence, and asking
 * `Intl.PluralRules('ru')` for a category while reading the English catalog would request
 * a `few` form English does not have. Data presentation follows the USER: a French reader
 * with no French catalog reads English and still sees French numbers.
 */

/**
 * A message with plural forms. Partial by design: a catalog supplies only the categories
 * its own language has, so English carrying `one` and `other` must not force Japanese to
 * invent a second form.
 */
type Forms = Partial<Record<Intl.LDMLPluralRule, string>>;
type Entry = string | Forms;

/** The shape every catalog has. English is the source; see `en.ts`. */
export type Catalog = Record<string, Entry>;

type Messages = typeof en;
export type MessageKey = keyof Messages;

/** Every form of an entry, as a union — one string, or all the plural forms. */
type TextOf<E> = E extends string ? E : E extends Record<string, infer V> ? V & string : never;

/** The `{name}`s in a message, read out of the message itself. */
type Placeholder<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Placeholder<Rest> : never;
type Names<K extends MessageKey> = Placeholder<TextOf<Messages[K]>>;

/**
 * `count` is what selects the plural form, so it is a number and not a rendered one:
 * a caller that formatted it first would hand `Intl.PluralRules` a string.
 */
type Params<K extends MessageKey> = { [P in Names<K>]: P extends 'count' ? number : string | number };

/** No placeholders, no second argument — and one that takes them cannot omit it. */
type Args<K extends MessageKey> = [Names<K>] extends [never] ? [] : [params: Params<K>];

type Values = Record<string, string | number>;

/**
 * Every catalog that ships. One entry in this round, deliberately — see
 * `docs/requirements/English ships alone.md`. A second language is one file beside `en`
 * and one row here, and nothing else anywhere.
 */
const CATALOGS: Record<string, Catalog> = { [SOURCE_LOCALE]: en };

/**
 * The resolved locale and the formatters that follow from it. Built once rather than per
 * call: `t()` runs inside render loops, and an `Intl` constructor there would be a cost
 * with no observable benefit — Obsidian needs a restart to change its language, so this
 * cannot go stale while the view is open.
 */
function activate(code: string, catalogs: Record<string, Catalog>): {
	name: string;
	messages: Catalog;
	plural: Intl.PluralRules;
	list: Intl.ListFormat;
	number: Intl.NumberFormat;
} {
	const name = resolveCatalog(code, Object.keys(catalogs));
	return {
		name,
		messages: catalogs[name] ?? en,
		plural: new Intl.PluralRules(name),
		list: new Intl.ListFormat(name, { style: 'long', type: 'conjunction' }),
		number: new Intl.NumberFormat(intlLocale(code)),
	};
}

let active = activate(SOURCE_LOCALE, CATALOGS);

/**
 * Resolve the locale. Once, at load: `main.ts` registers the view name and the command
 * name at `onload` and could not react to a later change anyway.
 *
 * `catalogs` is a seam for tests, not a feature. With one shipped catalog every code
 * resolves to English and no lookup can miss, which makes the fallback chain
 * correct-by-vacuum — fixture catalogs are what make it capable of failing before a
 * user's Obsidian is the first thing to exercise it.
 */
export function setLocale(code: string, catalogs: Record<string, Catalog> = CATALOGS): void {
	active = activate(code, catalogs);
}

/** The one call `main.ts` makes: Obsidian's language, applied. */
export function initLocale(): void {
	setLocale(getLanguage());
}

/** Which catalog is being read, and which locale `Intl` was given. */
export function activeLocale(): { catalog: string; numbers: string } {
	return { catalog: active.name, numbers: active.number.resolvedOptions().locale };
}

/**
 * What a key says, with its parameters filled in.
 *
 * A key the active catalog does not carry renders the English text — never the key and
 * never an empty string, because a gap in a translation must not read as a broken view.
 */
export function t<K extends MessageKey>(key: K, ...args: Args<K>): string {
	const values = (args as [Values?])[0];
	const entry = active.messages[key] ?? en[key];
	return fill(typeof entry === 'string' ? entry : selectForm(entry, values), values);
}

/**
 * Values joined as a list inside a sentence. `Intl.ListFormat` rather than a literal
 * joiner, in the CATALOG's locale: a joiner is grammar, and `' and '` reads right at two
 * items and wrong at three in English alone, never mind elsewhere.
 */
export function list(values: string[]): string {
	return active.list.format(values);
}

function selectForm(forms: Forms, values: Values | undefined): string {
	const count = typeof values?.count === 'number' ? values.count : 0;
	// `other` is the last resort rather than an assumption: every language has it, and a
	// catalog missing the selected category must still render a sentence.
	return forms[active.plural.select(count)] ?? forms.other ?? '';
}

/**
 * Named parameters, substituted. Named rather than positional so a translation can
 * reorder them — a message built by `+` or by a template literal at the call site cannot
 * be reordered at all. Numbers are FORMATTED rather than pasted, in the user's locale:
 * a count is data presentation, not grammar.
 */
function fill(text: string, values: Values | undefined): string {
	if (!values) return text;
	return text.replace(/\{(\w+)\}/g, (whole: string, name: string) => {
		const value = values[name];
		if (value === undefined) return whole;
		return typeof value === 'number' ? active.number.format(value) : value;
	});
}
