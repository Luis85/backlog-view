import { Catalog } from '../../src/i18n/t';

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
	'count.cards': { one: 'SPARSE {count}', other: 'SPARSE {count}' },
};
