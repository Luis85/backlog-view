import { getLanguage } from 'obsidian';
import { en } from './en';
import { intlLocale, resolveCatalog, SOURCE_LOCALE } from './locale';
import { PSEUDO_LOCALE, pseudoCatalog } from './pseudo';

/**
 * The bundler's own constant, the one every entry already defines — see the `define` in
 * `scripts/esbuild.config.mjs`, `scripts/harness.mjs` and Node's own value under vitest.
 * Declared rather than imported because `src/` is typed without Node, and a build-time
 * literal is what lets the production bundle drop the pseudo catalog entirely.
 */
declare const process: { env: { NODE_ENV?: string } };

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
 * A message with plural forms. The language-specific categories are optional by design —
 * a catalog supplies only the ones its own language has, so English carrying `one` and
 * `other` must not force Japanese to invent a second form.
 *
 * **`other` is the exception and is required**, because every language in CLDR has it. So
 * requiring it costs no locale anything, and it is what makes the last resort below a
 * real value rather than an empty string: with every category optional, a catalog written
 * with `few` alone type-checked and rendered a BLANK label, against this module's own
 * "every key renders something" guarantee. Stated in the type rather than guarded at the
 * lookup, so it holds for a catalog nobody has written yet — checked by the compiler for
 * every catalog under `src/`, which is every catalog that ships. Since `tsconfig.test.json`
 * (`npm run typecheck:test`), a `test/` fixture is held to the same shape — the nine
 * hand-rolled marked catalogs it caught are now one `markedCatalog()` in
 * `test/i18n/fixtures.ts`. Found by review (Codex, PR #151).
 */
type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
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
type Params<K extends MessageKey> = {
	[P in Names<K>]: P extends 'count' ? number : string | number | readonly string[];
};

/** No placeholders, no second argument — and one that takes them cannot omit it. */
type Args<K extends MessageKey> = [Names<K>] extends [never] ? [] : [params: Params<K>];

/**
 * A parameter is a scalar, or a LIST — which is joined as grammar rather than by the
 * caller, because it has to be joined in the locale of the message it lands in and only
 * this module knows which that is. See `grammarOf`.
 */
type Values = Record<string, string | number | readonly string[]>;

/**
 * Every catalog that ships. One entry in this round, deliberately — see
 * `docs/requirements/English ships alone.md`. A second language is one file beside `en`
 * and one row here, and nothing else anywhere.
 *
 * Exported so the completeness check reads the REGISTRY rather than a list of its own:
 * a language added here is checked against English without a test edit, which is what
 * makes "nothing else anywhere" true rather than merely intended.
 *
 * The pseudo-locale is NOT a language and is added to that one row rather than beside it:
 * a development build carries it so a layout can be looked at in something that is not
 * English, and the production `define` folds the ternary to `SHIPPED`, which leaves
 * `pseudo.ts` unreferenced and tree-shaken out of the release. That is what "ships in no
 * release" is, mechanically — not a flag somebody has to remember to turn off.
 *
 * **`SHIPPED` is named rather than spelled in both arms, and that is the whole point of
 * it.** Written as two object literals, a real catalog added to one arm alone either
 * ships unchecked (the suite reads the development arm) or is checked and unreleasable —
 * and "one row" would have become two edits that must agree, which is the promise this
 * comment makes. Found by review (Codex, PR #240).
 */
const SHIPPED: Record<string, Catalog> = { [SOURCE_LOCALE]: en };

export const CATALOGS: Record<string, Catalog> =
	process.env.NODE_ENV === 'production' ? SHIPPED : { ...SHIPPED, [PSEUDO_LOCALE]: pseudoCatalog(en) };

/**
 * Everything about a locale that decides GRAMMAR: which plural form a count selects, and
 * how a list is joined inside a sentence.
 */
interface Grammar {
	plural: Intl.PluralRules;
	list: Intl.ListFormat;
}

function grammarFor(locale: string): Grammar {
	return {
		plural: new Intl.PluralRules(locale),
		list: new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }),
	};
}

/**
 * The resolved locale and the formatters that follow from it. Built once rather than per
 * call: `t()` runs inside render loops, and an `Intl` constructor there would be a cost
 * with no observable benefit — Obsidian needs a restart to change its language, so this
 * cannot go stale while the view is open.
 *
 * `source` is built beside `grammar` and is not redundant with it. A message the active
 * catalog does not carry is rendered from ENGLISH, and English's grammar has to come with
 * it — see `grammarOf`.
 */
function activate(code: string, catalogs: Record<string, Catalog>): {
	name: string;
	messages: Catalog;
	grammar: Grammar;
	source: Grammar;
	number: Intl.NumberFormat;
} {
	const name = resolveCatalog(code, Object.keys(catalogs));
	return {
		name,
		messages: catalogs[name] ?? en,
		grammar: grammarFor(name),
		source: grammarFor(SOURCE_LOCALE),
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

/**
 * The one call `main.ts` makes: Obsidian's language, applied.
 *
 * One override comes ahead of it in a DEVELOPMENT build, and it is a knob rather than a
 * setting: Obsidian offers no way to ask for a language it does not itself ship, so the
 * pseudo-locale above would be unreachable from the `npm run test-build` vault without
 * it. Set `localStorage['product-backlog-locale'] = 'en-x-pseudo'` in the console and
 * reload. It is deliberately not a view option and not a command — nothing writes it and
 * nothing lists it.
 *
 * **It is behind the same `define` as the catalog it exists for, and that is the
 * correction rather than symmetry for its own sake.** This said "in a release build any
 * value resolves to a shipped catalog, so the worst it can do is nothing", and that was
 * a guarantee written ahead of what the code does: the catalog falls back, but `activate`
 * gives `Intl` the REQUESTED code, so a key left behind in a vault would have given a
 * German reader English number formatting off a production build until they cleared it by
 * hand. A development knob that survives into a release is not a development knob. Found
 * by review (Codex, PR #240).
 */
export function initLocale(): void {
	setLocale(process.env.NODE_ENV === 'production' ? getLanguage() : (localeOverride() ?? getLanguage()));
}

function localeOverride(): string | null {
	try {
		return window.localStorage.getItem('product-backlog-locale');
	} catch {
		// A vault with storage denied is a vault that reads its own language, not one
		// that fails to render.
		return null;
	}
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
	const own = active.messages[key];
	const grammar = grammarOf(own);
	const entry = own ?? en[key];
	return fill(typeof entry === 'string' ? entry : selectForm(entry, grammar, values), grammar, values);
}

/**
 * The grammar of the catalog that supplied THIS message, which is not always the active
 * one: a key the active catalog does not carry is rendered from English, and English's
 * plural categories and list joining have to come with it.
 *
 * "Grammar follows the catalog" was implemented as "grammar follows the ACTIVE catalog"
 * once, and the two are the same everywhere except the one path the fallback exists for.
 * Russian selects `one` at 21, so English forms read by Russian rules rendered
 * `21 item`; French selects `one` at zero, where English selects `other`. A translation
 * gap must degrade to English, not to broken English. Found by review (Codex, PR #151).
 */
function grammarOf(own: Entry | undefined): Grammar {
	return own === undefined ? active.source : active.grammar;
}

/**
 * Values joined as a list inside a sentence. `Intl.ListFormat` rather than a literal
 * joiner: a joiner is grammar, and `' and '` reads right at two items and wrong at three
 * in English alone, never mind elsewhere.
 *
 * **Prefer passing the array to `t()` as a parameter**, which joins it in the locale of
 * the message it lands in — the thing a call site cannot know. This export is for a list
 * joined into text that is not a catalog message YET: `runInit`'s notice, whose outer
 * sentence `Every surface translated` still owes a key. There is nothing for it to agree
 * with there, which is exactly why it should go when that sentence arrives.
 */
export function list(values: readonly string[]): string {
	return active.grammar.list.format(values);
}

function selectForm(forms: Forms, grammar: Grammar, values: Values | undefined): string {
	const count = typeof values?.count === 'number' ? values.count : 0;
	// `other` is the last resort, and it is a real one: the type requires it, so a catalog
	// missing the SELECTED category still renders a sentence rather than an empty string.
	return forms[grammar.plural.select(count)] ?? forms.other;
}

/**
 * Named parameters, substituted. Named rather than positional so a translation can
 * reorder them — a message built by `+` or by a template literal at the call site cannot
 * be reordered at all.
 *
 * Two parameter kinds are FORMATTED rather than pasted, and they take different locales
 * for the reason this whole module is split on: a list is grammar inside the sentence, so
 * it follows the message's own catalog, while a number is data presentation, so it
 * follows the user.
 */
function fill(text: string, grammar: Grammar, values: Values | undefined): string {
	if (!values) return text;
	return text.replace(/\{(\w+)\}/g, (whole: string, name: string) => {
		const value = values[name];
		if (value === undefined) return whole;
		if (Array.isArray(value)) return grammar.list.format(value as readonly string[]);
		return typeof value === 'number' ? active.number.format(value) : (value as string);
	});
}
