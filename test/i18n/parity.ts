import { intlLocale } from '../../src/i18n/locale';
import { en } from '../../src/i18n/en';
import { Catalog } from '../../src/i18n/t';

/**
 * What a catalog owes English, as data rather than as an assertion — so the report can
 * say WHICH keys and in which direction, and a contributor reading a failure knows
 * whether to translate something or delete something.
 *
 * Four divergences, kept apart because they have four different fixes:
 *
 * - `missing` — English has the key and this catalog does not. It renders in English.
 * - `stale` — this catalog has a key English does not. Nothing will ever read it.
 * - `parameters` — the same key takes a different `{name}` set, so a sentence renders
 *   with a hole in it or with a literal brace in it.
 * - `plurals` — the entry's forms are not the categories this catalog's own language
 *   has, per `Intl.PluralRules`.
 */
export interface Divergence {
	missing: string[];
	stale: string[];
	parameters: NameDiff[];
	plurals: NameDiff[];
}

/** One key, and what each side has that the other does not. */
export interface NameDiff {
	key: string;
	missing: string[];
	extra: string[];
}

const names = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

const formsOf = (entry: Catalog[string]): string[] => (typeof entry === 'string' ? [entry] : Object.values(entry));

/**
 * A message's parameters, UNIONED across its plural forms rather than compared form by
 * form — and that is the check's stated ceiling, not an oversight. English's own
 * `lane.absenceClash` names `{count}` in `other` and not in `one`, because *an absence*
 * needs no count and *three absences* do, so a per-form rule would refuse the source
 * catalog. What this cannot see is a translation that drops a parameter from one form
 * and keeps it in another; what it does see is a parameter dropped or invented outright.
 */
const parametersOf = (entry: Catalog[string]): Set<string> => new Set(formsOf(entry).flatMap(names));

/** The plural categories an entry supplies — none at all for a plain message. */
const categoriesOf = (entry: Catalog[string]): Set<string> =>
	new Set(typeof entry === 'string' ? [] : Object.keys(entry));

function diff(key: string, source: Set<string>, catalog: Set<string>): NameDiff | null {
	const missing = [...source].filter((name) => !catalog.has(name)).sort();
	const extra = [...catalog].filter((name) => !source.has(name)).sort();
	return missing.length === 0 && extra.length === 0 ? null : { key, missing, extra };
}

/**
 * Every way `catalog` diverges from English, read in the locale it claims to be.
 *
 * The locale matters for one of the four checks and only that one: plural categories are
 * the CATALOG's grammar, so English carrying `one` and `other` must not force Japanese to
 * invent a second form, and a Russian catalog owes a `few` English has no way to want.
 * The code goes through `intlLocale` first for the same reason `t.ts` does — a malformed
 * tag falls back to English rather than throwing a `RangeError` out of a check.
 */
export function compareToSource(locale: string, catalog: Catalog): Divergence {
	const categories = new Set(new Intl.PluralRules(intlLocale(locale)).resolvedOptions().pluralCategories);
	const report: Divergence = { missing: [], stale: [], parameters: [], plurals: [] };

	for (const key of Object.keys(en)) {
		const entry = catalog[key];
		if (entry === undefined) {
			report.missing.push(key);
			continue;
		}
		const params = diff(key, parametersOf(en[key as keyof typeof en]), parametersOf(entry));
		if (params) report.parameters.push(params);
		// A plain message has no categories to have. Spelling one plainly where English
		// spells it plurally is legitimate in a language that says the same thing at every
		// count — Japanese has `other` alone — and a DEFECT anywhere else, because `t()`
		// never plural-selects a string, so a German catalog written that way would render
		// one form forever and this check would have passed it. Found by review
		// (Codex, PR #240), which is also why the condition asks the locale rather than
		// asking whether anything was supplied.
		const supplied = categoriesOf(entry);
		const pluralHere = typeof en[key as keyof typeof en] !== 'string' && categories.size > 1;
		if (supplied.size > 0 || pluralHere) {
			const plurals = diff(key, categories, supplied);
			if (plurals) report.plurals.push(plurals);
		}
	}

	for (const key of Object.keys(catalog)) {
		if (!(key in en)) report.stale.push(key);
	}
	return report;
}
