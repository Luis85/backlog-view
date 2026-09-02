import { afterEach, beforeEach } from 'vitest';
import { en } from '../../src/i18n/en';
import { Catalog, MessageKey, setLocale } from '../../src/i18n/t';
import { resetLocale } from '../helpers/locale';
import { Menu } from '../helpers/obsidian-mock';

/** The prefix a marked catalog puts in front of every value. See `markedCatalog`. */
export const MARK = 'XX ';

/**
 * The whole English catalog behind `MARK`, so a projection can be driven and whatever
 * renders UNMARKED is data rather than text. One builder rather than the nine copies
 * this was, and one place where `Forms`'s required `other` is carried across the map —
 * `Object.fromEntries` alone answers an index signature, which the shape does not accept.
 */
export function markedCatalog(keys: readonly MessageKey[] = Object.keys(en) as MessageKey[]): Catalog {
	return Object.fromEntries(
		keys.map((key) => {
			const entry = en[key];
			return [key, typeof entry === 'string' ? MARK + entry : { ...entry, ...mark(entry) }];
		}),
	);
}

/**
 * An English message with its parameters filled in, for an assertion that names a WHOLE
 * sentence. The code under test calls `t()`, so an expectation built with `t()` would
 * assert nothing — this substitutes by hand, the same `.replace('{type}', …)` the
 * assertions here have always spelled, collected once now that a sentence can quote a
 * view option's own label as a parameter.
 */
export function filled(text: string, values: Record<string, string | number>): string {
	return text.replace(/\{(\w+)\}/g, (whole: string, name: string) =>
		name in values ? String(values[name]) : whole,
	);
}

const mark = (forms: Record<string, string>): Record<string, string> =>
	Object.fromEntries(Object.entries(forms).map(([form, value]) => [form, MARK + value]));

/**
 * Put the marked catalog in front of every test in the file, and English back after it.
 * Resolution is module state by design (once, at load), so it is the RESTORE that matters:
 * a file that left `xx` resolved would hand the next one a catalog it never asked for.
 *
 * A call rather than hooks in this module's body, `useViewHarness`'s rule: a file that
 * imports `markedCatalog` alone is never surprised by a hook it did not ask for.
 */
export function useMarkedLocale(xx: Catalog): void {
	beforeEach(() => setLocale('xx', { xx }));
	// `resetLocale`, never a hard-coded 'en': resolution is module state by design, and a
	// literal restore is what would make CI's second (PBL_TEST_LOCALE) leg green by accident.
	afterEach(resetLocale);
}

/** What that key renders as under a marked catalog — the assertion's own single source. */
export function marked(key: MessageKey): string {
	const entry = en[key];
	if (typeof entry !== 'string') throw new Error(`${key} is a plural entry; assert its form directly`);
	return MARK + entry;
}

/** What a surface drew that is NOT from the catalog — the set each test names in full. */
export const unmarked = (strings: readonly string[]): string[] => [
	...new Set(strings.filter((text) => !text.startsWith(MARK))),
];

/**
 * Every string a surface puts in front of a reader, sighted or not: the visible words of
 * each leaf element, plus every `aria-label`, every `title` and every tooltip. All four,
 * because the acceptance criterion is that screen-reader text moves WITH the visible text
 * — a surface translated for sighted users only passes any check that reads `textContent`
 * alone. `title` was in one of the two copies this replaces and not the other, which is
 * the drift a second copy buys.
 *
 * Leaves only: an ancestor's `textContent` is its children concatenated, so a frame
 * holding one unmarked child would read as marked.
 */
export function drawnText(root: HTMLElement): string[] {
	const out: string[] = [];
	for (const el of root.querySelectorAll<HTMLElement>('*')) {
		const label = el.getAttribute('aria-label');
		if (label) out.push(label);
		if (el.dataset.tooltip) out.push(el.dataset.tooltip);
		if (el.title) out.push(el.title);
		if (el.childElementCount === 0 && el.textContent) out.push(el.textContent);
	}
	return out;
}

/** Every title a menu draws, following submenus — the whole of what the reader sees. */
function menuTitles(menu: Menu): string[] {
	const out: string[] = [];
	for (const item of menu.items) {
		out.push(item.titleText);
		if (item.submenu) out.push(...menuTitles(item.submenu));
	}
	return out;
}

/**
 * The two readers above, wired to one accumulating set so a file can audit at the end
 * what its whole run actually watched reach a surface.
 *
 * A factory rather than module state here, and that is the point: the audit's question is
 * about ONE file's run, so a set shared between files would answer it with another file's
 * sightings. `record` is exposed for the surfaces neither reader covers — a `Notice`, a
 * prompt's own option bag — which is why it takes the value to hand back rather than
 * returning the strings.
 */
export function sweep(): {
	seen: Set<string>;
	record: <T>(strings: readonly string[], value: T) => T;
	drawnText: (root: HTMLElement) => string[];
	titlesOf: (menu: Menu) => string[];
} {
	const seen = new Set<string>();
	const record = <T>(strings: readonly string[], value: T): T => {
		for (const text of strings) if (text.startsWith(MARK)) seen.add(text);
		return value;
	};
	return {
		seen,
		record,
		drawnText: (root) => {
			const drawn = drawnText(root);
			return record(drawn, drawn);
		},
		titlesOf: (menu) => {
			const titles = menuTitles(menu);
			return record(titles, titles);
		},
	};
}

/**
 * Fixture catalogs, which are not languages.
 *
 * Nothing loads these and nothing ships them, and no one has to maintain a translation
 * to have them — but they are the only way most of this layer can FAIL in a round where
 * English ships alone (`docs/requirements/English ships alone.md`). Every real language
 * code resolves straight to `en`, so the regional fallback, the missing-key fallback,
 * plural categories beyond `one`/`other` and the catalog-versus-user split are all
 * correct-by-vacuum against the shipped registry. These break that.
 *
 * They deliberately do NOT mirror the English key set: each carries the keys its own
 * question needs, so a check reading one of them is reading the fact it is about.
 */

/**
 * Portuguese, so `pt-BR` has a base language to find before it falls to English. Its
 * text is nonsense on purpose — a check that passed on a fixture reading like English
 * would pass equally on English.
 */
export const pt: Catalog = {
	'count.items': { one: 'PT {count} item', other: 'PT {count} itens' },
};

/**
 * Russian, which has `few` — a category English does not have and so cannot select.
 * `many` is deliberately ABSENT, so the `other` last resort is reachable too: a catalog
 * missing the selected category must still render a sentence.
 */
export const ru: Catalog = {
	'count.items': {
		one: 'RU one {count}',
		few: 'RU few {count}',
		other: 'RU other {count}',
	},
};

/**
 * A catalog with the parameters in the other order, which is the whole reason parameters
 * are named rather than positional: no call site changes to read this.
 */
export const reordered: Catalog = {
	'count.shownOfTotal': '{total} :: {shown}',
};

/** A catalog carrying one key, so every other key falls back to English rather than blank. */
export const sparse: Catalog = {
};
