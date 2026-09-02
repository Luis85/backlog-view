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
export type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Entry = string | Forms;

/** The shape every catalog has. English is the source; see `en.ts`. */
export type Catalog = Record<string, Entry>;

/**
 * `Messages` and `Args` below stay private on purpose, and the two suppressions are the
 * only ones this rule has here. Both are DERIVATION machinery, not a contract: `Messages`
 * is the English object's own type, so exporting it would publish every key's literal text
 * as API and let a caller depend on a sentence; `Args` is a tuple type nobody can usefully
 * write, since the whole point of it is that `t()` computes it from the key. What a caller
 * names is `MessageKey`, and it is exported. Everything else this rule reported on
 * 2026-09-02 was a narrowing a caller could legitimately name, and is exported now.
 */
type Messages = typeof en;
// fallow-ignore-next-line private-type-leak
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
 * The locale a MATCHING fold may be taken in — the requested one only where lowercasing
 * really differs by language, and the root locale (`und`) everywhere else.
 *
 * Unicode's own model, taken rather than invented: case FOLDING is locale-independent
 * apart from one Turkic tailoring, while case MAPPING carries several more. Turkish and
 * Azerbaijani are the tailoring — `I` lowercases to `ı`, which is the whole reason this
 * fold takes a locale at all. Lithuanian is the case that made the distinction matter: its
 * mapping adds a dot above `i`/`j` before an accent, which is right for display and wrong
 * for deciding whether two strings are the same word.
 *
 * A language subtag test rather than a list of full codes, so `tr-TR` and `az-Latn-AZ`
 * answer the same as `tr` and `az`. Found by review (Codex, PR #251).
 */
function foldLocale(requested: string): string {
	return /^(tr|az)\b/i.test(requested) ? requested : 'und';
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
	numberPrecise: Intl.NumberFormat;
	numberScientific: Intl.NumberFormat;
	collator: Intl.Collator;
	requested: string;
	fold: string;
} {
	const name = resolveCatalog(code, Object.keys(catalogs));
	// The ONE answer to "which locale does presentation use", taken once and shared by the
	// two formatters and the fold below. `number.resolvedOptions().locale` is what `Intl`
	// RESOLVED to and can differ from what was asked for, so a second reader taking it from
	// there would be a second idea of the locale rather than the same one.
	const requested = intlLocale(code);
	return {
		name,
		messages: catalogs[name] ?? en,
		grammar: grammarFor(name),
		source: grammarFor(SOURCE_LOCALE),
		number: new Intl.NumberFormat(requested),
		// `formatNumber(value, true)`'s own formatter, built once beside the other one for
		// the reason stated there: a VALUE someone typed (estimation's confidence and
		// effort) rather than a COUNT this plugin computed.
		//
		// **SIGNIFICANT digits, not fraction digits, and the difference is not cosmetic.**
		// A fraction-digit cap is a cap on MAGNITUDE: at `maximumFractionDigits: 20` every
		// value below 1e-20 has no digit left to land in and formats as `0`, so a
		// confidence of `1e-21` displayed as zero — a nonzero number rendered as nothing,
		// which is exactly the silent-wrong-answer shape this whole PBI is about. 21 is
		// `Intl`'s own ceiling and comfortably past a JS number's ~17, so no value is cut
		// for precision; every ordinary number formats identically either way, which is
		// what made this a swap rather than a second formatting policy.
		// Found by review (Codex, PR #251).
		numberPrecise: new Intl.NumberFormat(requested, { maximumSignificantDigits: 21 }),
		// The same precision in the notation standard cannot keep SHORT. Standard notation
		// has to write every zero, so `1e100` spells 134 characters and `5e-324` spells
		// 326 — and `.pbl-est-cell` is `flex: 0 0 72px` with `overflow: hidden`, so the
		// cell shows an ellipsis instead of a number. That is not a cost of the
		// significant-digit cap: it arrived with the original `String()` → `Intl` switch,
		// where `1e100` was already 134 characters. Found by review (Codex, PR #251).
		numberScientific: new Intl.NumberFormat(requested, {
			notation: 'scientific',
			maximumSignificantDigits: 21,
		}),
		collator: new Intl.Collator(requested),
		requested,
		fold: foldLocale(requested),
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
 * Collation, in the REQUESTED locale — an ordering is presentation of the user's own data,
 * so it follows the user rather than the catalog: a French reader with no French catalog
 * still sorts in French.
 *
 * The helper exists rather than a locale-passing `localeCompare` because of WHERE the
 * comparison happens. `a.localeCompare(b, locale)` builds a fresh `Intl.Collator` per
 * comparison, so a sort in a render path constructs n·log n of them; this one is built
 * once per `setLocale`, beside the formatters, for the same reason they are. A bare
 * `localeCompare(b)` is worse again — it takes the HOST's default, which is the operating
 * system's language rather than Obsidian's. Both spellings are banned in `src/` by
 * `no-restricted-properties` in `eslint.config.mjs`.
 */
export function compareText(a: string, b: string): number {
	return active.collator.compare(a, b);
}

/**
 * A string folded for MATCHING — what the user typed against what they can see — in the
 * REQUESTED locale, for the same reason collation takes it: a filter that cannot find a
 * note plainly on screen is the fold getting the locale wrong. Turkish is the worked
 * example, where `I` folds to `ı` and `toLowerCase()` gives `i`.
 *
 * **This is the one fold in `src/` whose job is matching**, and it must stay the only one:
 * every other fold decides what something *is* — a type name, a state, a persisted option
 * key — and folding those with a locale corrupts vaults. `test/i18n/foldSites.ts`
 * classifies all of them and the suite holds the split.
 *
 * **The locale it takes is `fold`, not `requested`**, and that is the whole of what three
 * review rounds cost (Codex, PR #251). Lowercasing is correct CASING and is not a
 * case-INSENSITIVE form: Lithuanian's tailoring ADDS a dot above a soft-dotted letter when
 * an accent follows, so `Ì` lowercases to `i̇̀` while `ì` stays `ì` and a query stops
 * meeting the title it was typed from. `foldLocale` is where that is answered, and
 * `.normalize('NFC')` is the other half: canonically equivalent spellings of one string
 * are one string to a reader, so a decomposed `I` + `U+0307` has to meet a precomposed
 * `İ`, and it does not without it. **Before** the fold and not after, which is the
 * narrower claim the suite can actually hold: a trailing one changed nothing for any
 * single code point in the first three planes under any of the three locales this fold
 * asks for, so it would have been a line no test could fail.
 *
 * Two shapes were tried and are worse. Stripping the added dot back off (`[ij]`, then
 * `\p{Soft_Dotted}`) cannot tell a tailoring's dot from one an author WROTE, so it united
 * `Ì`/`ì` at the price of splitting `J̇`/`j̇`. `Intl.Collator` with `sensitivity: 'base'`
 * answers a different question entirely: every call site asks `.includes(needle)` about a
 * SUBSTRING, and a collator compares whole strings.
 */
export function foldForMatch(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase(active.fold);
}

/**
 * Where a precise value stops being spelled out and starts being written with an exponent
 * — `Number.prototype.toString`'s OWN boundary, taken rather than invented.
 *
 * Borrowed because it is the shape the value already had: these cells show back a number
 * someone typed into frontmatter, and a note carrying `1e-21` should read as an exponent
 * in the table too. Picking a threshold of our own would make the table disagree with the
 * note for a band of values, and there is no reading of "show back what was entered" that
 * wants that.
 */
const SPELLED_OUT_FROM = 1e-6;
const SPELLED_OUT_BELOW = 1e21;

/**
 * IEEE negative zero, made ordinary before any formatter sees it.
 *
 * `-0` is a value arithmetic really produces — `Math.round(-0.001)` is `-0`, so
 * `weightedScore.ts`'s `round2` returns it for any weighted total that lands just below
 * zero, and a scoring model may legitimately span negatives (`outputMin` need only be an
 * integer below `outputMax`). `String(-0)` is `'0'` and hid this; `Intl.NumberFormat`
 * spells it `'-0'`, so the switch to `Intl` put a meaningless minus sign on a score that
 * had rounded away to nothing.
 *
 * Normalized HERE rather than at the callers, because "a number this module hands to
 * `Intl`" is one category with exactly two members — `formatNumber` and `fill` — and a
 * guard placed at the sites that happen to produce a score today would miss the next one.
 * `Object.is` rather than `=== -0`, which is true for plain zero as well.
 * Found by review (Codex, PR #251).
 */
function withoutNegativeZero(value: number): number {
	return Object.is(value, -0) ? 0 : value;
}

/**
 * Which of the three number formatters a value gets — asked of the VALUE's own magnitude,
 * and only then of who is asking.
 *
 * The two questions are independent and were tangled once: `precise` says whether the
 * digits someone TYPED may be rounded, while the magnitude says whether the number can be
 * written out at all. Tying the second to the first left every computed score — totals and
 * indicators, which pass `precise` false — spelling `1e21` across 25 characters in a cell
 * that clips at 72px. Found by review (Codex, PR #251).
 *
 * `fill` asks it too, so a number inside a sentence and the same number outside one still
 * cannot disagree — the property `formatNumber`'s own doc exists for.
 */
function formatterFor(shown: number, precise: boolean): Intl.NumberFormat {
	const magnitude = Math.abs(shown);
	const spelledOut = magnitude === 0 || (magnitude >= SPELLED_OUT_FROM && magnitude < SPELLED_OUT_BELOW);
	if (!spelledOut) return active.numberScientific;
	return precise ? active.numberPrecise : active.number;
}

/**
 * A bare number shown to a person, in the REQUESTED locale — presentation, like collation.
 * The SAME formatter `t()` gives a `{count}` parameter, so a count outside a sentence and
 * one inside it cannot disagree; they did, at a thousand, which is what this exists for.
 *
 * `precise`, for the one shape of number this default formatter is wrong for: a VALUE
 * someone TYPED rather than a count this plugin computed. `Intl.NumberFormat`'s default
 * caps at three fraction digits, silently rounding `3.14159` to `3.142` — fine for a
 * count, which is never that precise, and wrong for the estimation view's confidence and
 * effort cells, whose whole promise is showing back the number the user entered. `true`
 * asks the same locale's grouping and decimal separator, capped at 21 SIGNIFICANT digits
 * instead — see `activate`, which says why that is the cap that follows the value.
 *
 * **Outside `SPELLED_OUT_FROM`…`SPELLED_OUT_BELOW` it switches to an exponent**, because
 * precision and compactness are two different failures and a cell 72px wide has both: a
 * fraction cap rounds `1e-21` away to `0`, and standard notation spells `1e100` across 134
 * characters that `overflow: hidden` then clips. Neither is a number anyone can read.
 * Zero is excluded explicitly — it is not "very small", it has no exponent to show, and
 * `Intl` would otherwise render it `0E0`.
 *
 * **`precise` does not gate that branch, and this paragraph said it did.** The claim was
 * that a COUNT cannot reach either extreme, which is true and answers the wrong question:
 * `precise` is false for every COMPUTED number too, and a computed score is bounded by a
 * range the user writes. `parseRange` takes `-?\d+` and `modelProblems` asks only for
 * integers, so an output range of `0-1000000000000000000000` is a valid model and its
 * total lands at `1e21` in the same 72px cell. Found by review (Codex, PR #251).
 */
export function formatNumber(value: number, precise = false): string {
	const shown = withoutNegativeZero(value);
	return formatterFor(shown, precise).format(shown);
}

/**
 * What a key says, with its parameters filled in.
 *
 * A key the active catalog does not carry renders the English text — never the key and
 * never an empty string, because a gap in a translation must not read as a broken view.
 */
// fallow-ignore-next-line private-type-leak
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
		if (typeof value !== 'number') return value as string;
		const shown = withoutNegativeZero(value);
		return formatterFor(shown, false).format(shown);
	});
}
