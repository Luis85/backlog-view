import { describe, expect, it } from 'vitest';
import { Catalog, CATALOGS } from '../../src/i18n/t';
import { compareToSource, Divergence } from './parity';
import { markedCatalog } from './fixtures';

/**
 * Every shipped catalog says what English says: the same keys, the same parameters in
 * each message, and the plural categories its OWN language has — no more and no fewer.
 *
 * The registry is what drives this, not a list here: adding a language is one row in
 * `CATALOGS` and no test edit, which is the whole claim `English ships alone` makes
 * about the layer being a starting point rather than a dead end.
 *
 * **English shipping alone is why the fixtures below exist.** Against the registry as it
 * stands this file compares English to itself and every check passes vacuously, which is
 * not a check. Each fixture breaks exactly one rule and is asserted to be caught by it.
 */

const clean = (): Divergence => ({ missing: [], stale: [], parameters: [], plurals: [] });

/** A catalog that mirrors English exactly — the shape a real translation has. */
const complete = markedCatalog();

/** One entry's plural forms, for a fixture that changes exactly one of them. */
function forms(key: string): Record<string, string> {
	const entry = complete[key];
	if (typeof entry === 'string') throw new Error(`${key} is not a plural entry`);
	return entry;
}

function without(key: string): Catalog {
	const catalog = { ...complete };
	delete catalog[key];
	return catalog;
}

describe('every shipped catalog is complete against English', () => {
	it.each(Object.entries(CATALOGS))('%s diverges from English nowhere', (locale, catalog) => {
		expect(compareToSource(locale, catalog)).toEqual(clean());
	});

	it('checks at least the source catalog, so the sweep is not empty', () => {
		expect(Object.keys(CATALOGS)).toContain('en');
	});
});

describe('a complete fixture passes, so the checks are not refusing everything', () => {
	it('reports nothing for a catalog mirroring English', () => {
		expect(compareToSource('en', complete)).toEqual(clean());
	});
});

describe('a missing key and a stale key are reported apart', () => {
	it('names the keys English has that the catalog does not', () => {
		const report = compareToSource('en', without('emptyState.noItems'));
		expect(report.missing).toEqual(['emptyState.noItems']);
		expect(report.stale).toEqual([]);
	});

	it('names the keys the catalog has that English does not', () => {
		const report = compareToSource('en', { ...complete, 'emptyState.retired': 'Gone' });
		expect(report.stale).toEqual(['emptyState.retired']);
		expect(report.missing).toEqual([]);
	});
});

describe("a translation that drops a parameter renders a sentence with a hole in it", () => {
	it('names the key and the parameter, in whichever direction it diverged', () => {
		const report = compareToSource('en', { ...complete, 'emptyState.noTypeItems': 'XX No items' });
		expect(report.parameters).toEqual([{ key: 'emptyState.noTypeItems', missing: ['type'], extra: [] }]);
	});

	it('catches an invented parameter too, which renders as literal braces', () => {
		const report = compareToSource('en', { ...complete, 'emptyState.noTypeItems': 'XX No {kind} items' });
		expect(report.parameters).toEqual([{ key: 'emptyState.noTypeItems', missing: ['type'], extra: ['kind'] }]);
	});

	it('reads a plural entry across its forms, which is the check’s stated ceiling', () => {
		// UNIONED, because English's own `lane.absenceClash` names `{count}` in one form
		// and not the other. Dropped from every form is caught; dropped from one is not,
		// and that is written here rather than left to be discovered.
		expect(compareToSource('en', { ...complete, 'count.items': { one: 'XX item', other: 'XX items' } }).parameters).toEqual(
			[{ key: 'count.items', missing: ['count'], extra: [] }],
		);
		const oneForm = { ...forms('count.items'), other: 'XX items' } as Catalog[string];
		expect(compareToSource('en', { ...complete, 'count.items': oneForm }).parameters).toEqual([]);
	});
});

describe('plural categories are the locale’s own, checked against Intl', () => {
	it('refuses a category the locale does not have', () => {
		// `few` is Russian's; English cannot select it, so a form supplying it is dead text.
		const entry = { ...forms('count.items'), few: 'XX few {count}' } as Catalog[string];
		const report = compareToSource('en', { ...complete, 'count.items': entry });
		expect(report.plurals).toEqual([{ key: 'count.items', missing: [], extra: ['few'] }]);
	});

	it('refuses a category the locale requires and the catalog omits', () => {
		const report = compareToSource('en', { ...complete, 'count.items': { other: 'XX {count} items' } });
		expect(report.plurals).toEqual([{ key: 'count.items', missing: ['one'], extra: [] }]);
	});

	it('asks the catalog’s OWN locale, so English does not force a second form on Japanese', () => {
		// Japanese has `other` alone. The same entry that is incomplete for English above
		// is complete here, and the one English calls complete is over-supplied.
		expect(compareToSource('ja', { 'count.items': { other: '{count}' } }).plurals).toEqual([]);
		expect(compareToSource('ja', { 'count.items': complete['count.items'] }).plurals).toEqual([
			{ key: 'count.items', missing: [], extra: ['one'] },
		]);
	});

	it('says nothing about a plain message, which has no categories to have', () => {
		expect(compareToSource('en', { ...complete, 'emptyState.noItems': 'XX' }).plurals).toEqual([]);
	});

	it('does not read a plural entry where English has a plain one, or the reverse', () => {
		const asPlural = compareToSource('en', { ...complete, 'emptyState.noItems': { other: 'XX' } });
		expect(asPlural.plurals).toEqual([{ key: 'emptyState.noItems', missing: ['one'], extra: [] }]);
		const asPlain = compareToSource('en', { ...complete, 'count.items': 'XX {count} items' });
		expect(asPlain.plurals).toEqual([]);
		expect(asPlain.parameters).toEqual([]);
	});
});

describe('a malformed locale code cannot silence the plural check', () => {
	it('falls back to the source language rather than skipping the rule', () => {
		expect(compareToSource('!!!', { ...complete, 'count.items': { other: 'XX' } }).plurals).toEqual([
			{ key: 'count.items', missing: ['one'], extra: [] },
		]);
	});
});
