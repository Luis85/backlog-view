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

	it('refuses forms on a message nothing can plural-select, whole', () => {
		// `emptyState.noItems` names no `{count}`, so its call site passes none and
		// `selectForm` reads 0 at every use: `one` would be text nothing reaches, and even
		// a lone `other` is a plain string wearing an object. Reported as `extra` rather
		// than as a missing `one`, because the fix is to spell it as a string — the first
		// version of this rule gave the opposite advice. Found by review (Codex, PR #240).
		const one = compareToSource('en', { ...complete, 'emptyState.noItems': { other: 'XX' } });
		expect(one.plurals).toEqual([{ key: 'emptyState.noItems', missing: [], extra: ['other'] }]);
		const both = compareToSource('en', { ...complete, 'emptyState.noItems': { one: 'XX', other: 'XX' } });
		expect(both.plurals).toEqual([{ key: 'emptyState.noItems', missing: [], extra: ['one', 'other'] }]);
	});

	it('asks the MESSAGE for a count, never English’s shape', () => {
		// Seven English messages name `{count}` and spell one string — English needs no
		// second form for them and another language may — so a rule reading "is the English
		// entry plural" would refuse a legitimate translation of them and miss a German
		// catalog spelling them plainly. `toolbar.levelCount` is one.
		const forms = { one: 'XX {count}', other: 'XX {count}' };
		expect(compareToSource('en', { ...complete, 'toolbar.levelCount': forms }).plurals).toEqual([]);
		expect(compareToSource('ja', { ...complete, 'toolbar.levelCount': forms }).plurals).toContainEqual({
			key: 'toolbar.levelCount',
			missing: [],
			extra: ['one'],
		});
	});

	it('refuses a PLAIN entry where the locale needs forms, and allows it where it does not', () => {
		// `t()` never plural-selects a string, so a German catalog spelling `count.items`
		// plainly would render one form at every count — and the check saw nothing, because
		// it asked whether forms were SUPPLIED rather than whether the locale wants any.
		// Found by review (Codex, PR #240).
		const plain = { ...complete, 'count.items': 'XX {count} items' };
		expect(compareToSource('en', plain).plurals).toEqual([
			{ key: 'count.items', missing: ['one', 'other'], extra: [] },
		]);
		// Nothing else changed about it: the parameters are still read off the string.
		expect(compareToSource('en', plain).parameters).toEqual([]);
		// Japanese says the same thing at every count, so a string IS the whole message.
		// Asked of this key rather than of the report, since a clone of English is
		// over-supplied for `ja` at every other plural key and that is the next test's
		// subject, not this one's.
		expect(compareToSource('ja', plain).plurals.map((entry) => entry.key)).not.toContain('count.items');
	});
});

describe('a malformed locale code cannot silence the plural check', () => {
	it('falls back to the source language rather than skipping the rule', () => {
		expect(compareToSource('!!!', { ...complete, 'count.items': { other: 'XX' } }).plurals).toEqual([
			{ key: 'count.items', missing: ['one'], extra: [] },
		]);
	});
});
