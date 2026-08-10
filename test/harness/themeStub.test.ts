import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	APPLIES,
	BODY_SELECTORS,
	ROOT_SELECTORS,
	cyclic,
	declarations,
	references,
	resolves,
	resolvesValue,
	rules,
	wrappers,
} from '../helpers/cssVars';

/**
 * Does the harness page RESOLVE every Obsidian variable `styles/` reads?
 *
 * Two sheets answer that together, and which one answers is the whole subject of this
 * file. `obsidian.css` is Obsidian's real app.css reduced, and it defines the default
 * palette outright — the base scale, the named colours, the accent — under
 * `.theme-light` / `.theme-dark`. `theme.css` is the stub, which used to be the only
 * source of those values and now declares none of them: what is left there is the
 * harness's own chrome. Its copy of the palette outlived its usefulness by one review
 * round — identical to app.css's and winning the cascade anyway, so it could only ever
 * hold a value back, never supply one.
 *
 * The question is asked per scheme and of the VALUE, never of "the file mentions the name
 * somewhere". Five review rounds on PR #125 shaped what that means, and each one is a
 * rule in `test/helpers/cssVars.ts` rather than a line here: only blocks this page
 * matches, only wrappers it satisfies, every selector in a comma-separated list, one
 * branch of a `var()` rather than both, and cycles per element. The first two were live
 * defects; the rest were correct about CSS with nothing in either sheet exhibiting them.
 *
 * What this file adds is the asking: the sheets in element order, the partials' own use
 * sites, and an instrument test that holds each rule to an instance in the tree.
 */

const SHEETS = ['test/harness/obsidian.css', 'test/harness/theme.css'] as const;

/** The CSS-wide keywords, whose meaning for a custom property is not "this literal". */
const CSS_WIDE = /^(initial|inherit|unset|revert|revert-layer)$/i;

/** One element's own declarations, both sheets, in link order — app.css then the stub. */
function scopeValues(scope: Set<string>, scheme: 'dark' | 'light'): Map<string, string> {
	return new Map(SHEETS.flatMap((sheet) => [...declarations(readFileSync(sheet, 'utf8'), scheme, scope)]));
}

/**
 * What a rule ON THE BODY can read, which is where every one of the plugin's own rules
 * sits — built in element order rather than merged.
 *
 * A root value is computed against the root's OWN declarations: CSS cannot resolve a
 * `:root` value from something a descendant declares, so `:root { --used: var(--body-only) }`
 * is invalid however many body rules declare `--body-only`. What the body inherits is the
 * RESULT, which is why an inherited name carries an edge-free placeholder — a computed
 * value is a value, not a token stream to walk again.
 *
 * Nothing in either sheet exercises that ordering today: every root-scope property is a
 * literal with no `var()` among them, which the instrument test states rather than leaves
 * to be rediscovered.
 */
function pageValues(scheme: 'dark' | 'light'): Map<string, string> {
	const root = scopeValues(ROOT_SELECTORS, scheme);
	const inherited = new Map<string, string>();
	for (const name of root.keys()) if (resolves(name, root)) inherited.set(name, 'computed at the root');
	return new Map([...inherited, ...scopeValues(BODY_SELECTORS, scheme)]);
}

/** Every declaration value in a directory of CSS that reads a variable — the use sites. */
function usedValues(dir: string): string[] {
	const found: string[] = [];
	for (const file of readdirSync(dir).filter((name) => name.endsWith('.css'))) {
		const css = readFileSync(`${dir}/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		for (const match of css.matchAll(/[\w-]+\s*:\s*([^;{}]+)/g)) if (match[1].includes('var(')) found.push(match[1]);
	}
	return found;
}

/** Every `var(--x)` name in a directory of CSS, whoever is expected to supply it. */
function variablesUsed(dir: string): Set<string> {
	return new Set(usedValues(dir).flatMap((value) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])));
}

/**
 * The page as a partial sees it: the two sheets, plus the plugin's own `--pbl` names,
 * which no stylesheet declares because the view sets them on the element at render time.
 * Seeding them is what keeps this a question about OBSIDIAN's variables.
 */
function pageValuesForPartials(scheme: 'dark' | 'light'): Map<string, string> {
	const values = pageValues(scheme);
	for (const name of variablesUsed('styles')) if (name.startsWith('--pbl')) values.set(name, 'set by the view');
	return values;
}

describe('the harness sheets cover the stylesheet', () => {
	it.each(['dark', 'light'] as const)('resolves every value the partials ask the page for, in %s', (scheme) => {
		const values = pageValuesForPartials(scheme);

		// Asked of whole VALUES, not of the names inside them, because a use site has
		// branches too: `styles/tree.css` reads
		// `var(--background-modifier-active-hover, var(--background-modifier-hover))`, and
		// requiring both to resolve would fail a sheet the browser renders correctly.
		expect(usedValues('styles').filter((value) => !resolvesValue(value, values))).toEqual([]);
	});

	it.each(['dark', 'light'] as const)('has no dependency cycle in %s, fallbacks counted', (scheme) => {
		// `resolves` answers which branch supplies a value, and CSS asks something else
		// first. Nothing in either sheet is cyclic today, so this keeps it that way rather
		// than fixing a live defect. Asked per ELEMENT: a cross-element reference is
		// inheritance rather than a dependency, and flattening the two invents cycles.
		expect(cyclic(scopeValues(ROOT_SELECTORS, scheme))).toEqual([]);
		expect(cyclic(scopeValues(BODY_SELECTORS, scheme))).toEqual([]);
	});

	it.each(['dark', 'light'] as const)('reads a cross-element reference as inheritance, in %s', (scheme) => {
		// Both scopes are non-empty, or the walks above are two passes over nothing — and
		// app.css does declare on both: the `@supports` heading weights sit on `:root`
		// while the palette sits on `body` and the theme classes.
		expect(scopeValues(ROOT_SELECTORS, scheme).size).toBeGreaterThan(0);
		expect(scopeValues(BODY_SELECTORS, scheme).size).toBeGreaterThan(0);

		// The shape a flattened namespace calls a cycle and CSS does not: the root takes
		// its fallback, and the body inherits the computed result.
		const root = new Map([['--a', 'var(--b, red)']]);
		const body = new Map([['--b', 'var(--a)']]);
		expect(cyclic(root)).toEqual([]);
		expect(cyclic(body)).toEqual([]);
		expect(cyclic(new Map([...root, ...body]))).not.toEqual([]);

		// The same argument on the resolution side: a `:root` value cannot read what only a
		// descendant declares, so flattening reports resolved what the page cannot resolve.
		const rootOnly = new Map([['--used', 'var(--body-only)']]);
		expect(resolves('--used', rootOnly)).toBe(false);
		expect(resolves('--used', new Map([...rootOnly, ['--body-only', 'red']]))).toBe(true);

		// And why neither sheet can exercise either ordering: every root-scope value is a
		// literal, so no root reference exists to reach a body declaration in the first
		// place. Non-vacuous by the size assertion above — the root scope is app.css's
		// heading weights and nothing else, now that the stub declares no variables.
		const rootValues = [...scopeValues(ROOT_SELECTORS, scheme).values()];
		expect(rootValues.filter((value) => value.includes('var('))).toEqual([]);
	});

	/**
	 * A fallback is ONE branch, not two — and nothing in either sheet can say so, because
	 * every nested fallback there happens to name something declared. So the predicate is
	 * asked directly, over a map written here. The alternative was planting a broken
	 * `var()` in a vendored sheet to make a real case, which would be a fixture disguised
	 * as evidence.
	 */
	it('evaluates a fallback only when the primary is missing', () => {
		const values = new Map([
			['--primary-ok', 'var(--present, var(--gone))'],
			['--fallback-used', 'var(--gone, var(--present))'],
			['--both-gone', 'var(--gone, var(--also-gone))'],
			['--present', 'red'],
		]);

		expect(resolves('--primary-ok', values)).toBe(true);
		expect(resolves('--fallback-used', values)).toBe(true);
		expect(resolves('--both-gone', values)).toBe(false);
	});

	it.each(['dark', 'light'] as const)('declares no partial-read name as a CSS-wide keyword, in %s', (scheme) => {
		// The gate under `GUARANTEED_INVALID`. `initial` is handled — it is the one spelling
		// that makes a present literal mean unresolved — while `inherit` and `unset` mean
		// "the parent's computed value", which this reader does not model. app.css declares
		// 30 of those, and no partial reads any of them. This is what fails the day one
		// does, rather than a resolver guessing at an inheritance chain it cannot see.
		const values = pageValues(scheme);
		const read = [...variablesUsed('styles')].filter((name) => !name.startsWith('--pbl'));

		expect(read.filter((name) => CSS_WIDE.test((values.get(name) ?? '').trim()))).toEqual([]);
		// Not vacuous: the sheets do contain such declarations, just not under a name read here.
		expect([...values.values()].filter((value) => CSS_WIDE.test(value.trim())).length).toBeGreaterThan(0);
	});

	it('reads `initial` as the guaranteed-invalid value it is', () => {
		// Nothing in either sheet spells it, so the predicate is asked directly: a name
		// declared `initial` is not resolved, and only a fallback rescues a use of it.
		const values = new Map([
			['--killed', 'initial'],
			['--reader', 'var(--killed)'],
			['--rescued', 'var(--killed, red)'],
		]);

		expect(resolves('--killed', values)).toBe(false);
		expect(resolves('--reader', values)).toBe(false);
		expect(resolves('--rescued', values)).toBe(true);
	});

	it('never restates, in the stub, a declaration app.css already makes for that selector', () => {
		// The check under the "Obsidian's default appearance" claim, and the one that was
		// missing while `.clickable-icon` sat in the stub overriding app.css's padding and
		// hover colour: the earlier measurement compared CUSTOM PROPERTIES and could not
		// see an ordinary declaration. It briefly exempted variables in exchange — the
		// palette copy was "known, measured identical, deliberate" — which review then read
		// the other way round: a copy that wins the cascade is equal or wrong, never
		// better, and the next vendored app.css is what turns identical into stale with
		// every other check still green. The copy is gone, so the exemption is too. Only
		// `height` remains, the frame rule app.css cannot supply on a page with no `html`
		// height.
		const styled = new Set(rules(readFileSync('test/harness/obsidian.css', 'utf8')).flatMap((rule) => rule.selectors));
		const allowed = new Set(['height']);

		const restated = rules(readFileSync('test/harness/theme.css', 'utf8'))
			.filter((rule) => rule.selectors.some((selector) => styled.has(selector)))
			.flatMap((rule) => rule.properties.filter((name) => !allowed.has(name)));

		expect(restated).toEqual([]);
		// Not vacuous, and pinned to the instance: app.css does style the selector the
		// deleted rules used, so this check would have caught them.
		expect(styled.has('.clickable-icon')).toBe(true);
	});

	it('fails when a conditional wrapper it has never seen appears', () => {
		// The wrapper rule names one spelling because one is what the sheets contain. This
		// is the check under that sentence: a new wrapper — a width query, `@layer`, a
		// second media type — has to be ruled on rather than silently assumed to apply.
		const seen = new Set(SHEETS.flatMap((sheet) => [...wrappers(readFileSync(sheet, 'utf8'))]));

		expect([...seen].sort()).toEqual(['@media print', '@supports (font-variation-settings: normal)']);
	});

	/**
	 * The instrument, before its verdict is trusted. Every claim below is pinned to an
	 * instance in the tree rather than to a planted one, so a rule that stopped holding
	 * fails here and names itself.
	 */
	it('measures both sheets, and only what this page matches', () => {
		const app = declarations(readFileSync('test/harness/obsidian.css', 'utf8'), 'dark');
		const stub = declarations(readFileSync('test/harness/theme.css', 'utf8'), 'dark');
		const dark = pageValues('dark');

		expect(usedValues('styles').length).toBeGreaterThan(20);
		expect(variablesUsed('styles').has('--background-primary')).toBe(true);

		// app.css carries the palette itself, in both schemes — the fact that shrank the
		// stub. Read from the sheet rather than from the page, or the stub could supply it
		// and this would still pass.
		expect(app.has('--color-base-00')).toBe(true);
		expect(declarations(readFileSync('test/harness/obsidian.css', 'utf8'), 'light').has('--color-base-00')).toBe(true);
		// And the block filter bites: app.css defines this one under `.mod-macos` alone,
		// which no harness body matches, so it is NOT something the page resolves.
		expect(app.has('--slider-thumb-opacity-active')).toBe(false);
		// The stub declares no variable at all now, which is the shape of the whole claim:
		// app.css is the ONLY source of the palette, so nothing here can go stale against
		// a newer one. This says it where a re-added block fails rather than passes.
		expect(stub.size).toBe(0);

		// So app.css carries every name the partials read — `--interactive-accent` being
		// the one the stub used to approximate before that pass deleted it.
		expect(variablesUsed('styles').has('--interactive-accent')).toBe(true);
		expect(app.has('--interactive-accent')).toBe(true);

		// Following the value, not the name: `--shadow-xs` is declared in both schemes and
		// its dark value reaches `--shadow-edges`, which `.theme-light` alone declares.
		expect(app.has('--shadow-xs')).toBe(true);
		expect(resolves('--shadow-xs', pageValues('dark'))).toBe(false);
		expect(resolves('--shadow-xs', pageValues('light'))).toBe(true);

		// One reference, not two: app.css spells the nested fallback three times.
		expect(references(dark.get('--graph-line') ?? '')).toHaveLength(1);

		// The print veto, asked of the VALUE that survived: app.css declares `--font-text`
		// twice on `body` and the print one comes second, so "later wins" would take it and
		// then chase a `--font-print` no applicable block declares.
		expect(dark.get('--font-text')).not.toContain('--font-print');
		expect(resolves('--font-text', dark)).toBe(true);

		// Every selector in a list, not the last line of one: app.css writes
		// `body,\n[dir='ltr'] { --direction: 1; … }`, and reading only the last member
		// reports three properties the harness body does declare as missing.
		expect(dark.has('--direction')).toBe(true);
		expect(dark.has('--inset-start')).toBe(true);

		// A use site has branches too — this is the one in `styles/`, and both names have
		// to be present for the assertion above it to mean anything.
		const branched = usedValues('styles').filter((value) => references(value).some((ref) => ref.fallback !== null));
		expect(branched.length).toBeGreaterThan(0);
		expect(branched.join(' ')).toContain('--background-modifier-hover');
	});

	it('reads only the blocks a harness body matches, per scheme', () => {
		// The scheme split, stated where it can fail: the same name, a different value.
		expect(pageValues('dark').get('--color-base-00')).not.toEqual(pageValues('light').get('--color-base-00'));
		// And `APPLIES` is the union of the two element sets rather than a third list.
		expect([...APPLIES].sort()).toEqual([...new Set([...ROOT_SELECTORS, ...BODY_SELECTORS])].sort());
	});
});
