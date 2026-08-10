import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Does the harness page RESOLVE every Obsidian variable `styles/` reads?
 *
 * Two sheets answer that together, and which one answers is the whole subject of this
 * file. `obsidian.css` is Obsidian's real app.css reduced, and it defines the default
 * palette outright — the base scale, the named colours, the accent — under
 * `.theme-light` / `.theme-dark`. `theme.css` is the stub, which used to be the only
 * source of those values and is now the smaller thing that remains: what a partial reads
 * and app.css does not supply from an applicable block.
 *
 * So the question is asked of the UNION, per scheme, and never of "the file mentions the
 * name somewhere" — a variable set only under `theme-dark` reads as nothing in light,
 * and a text search would call that covered. It is also asked only of the blocks that
 * apply to this page: app.css defines `--color-base-00` a third time under
 * `.is-mobile.theme-dark`, and counting that would report a variable as resolved on a
 * page where it is not.
 *
 * And it is asked of the VALUE, not of the declaration. `--interactive-accent` is declared
 * as `var(--color-accent-1)`; a reduction that kept the first and dropped the second would
 * leave every accented rule in the plugin computing to nothing while a name check stayed
 * green. Following the chain is what makes this the check it claims to be — raised in
 * review on this file (PR #125), and there was already an instance in the tree: see
 * `--shadow-xs` in the instrument test at the bottom.
 */

/**
 * The selectors a harness page matches, by the ELEMENT they match — which is two
 * elements, not one namespace. `:root` is the `<html>`; everything else here is the
 * `<body class="theme-dark|light">` Obsidian's theme class goes on.
 *
 * Resolution can flatten the two, because a name a body rule does not declare is
 * inherited from the root already computed. Cycle detection cannot: that same
 * inheritance ENDS an edge, so `:root { --a: var(--b, red) }` beside
 * `body { --b: var(--a) }` is valid CSS — the root takes its fallback, the body inherits
 * the result — and a flattened graph reports `--a → --b → --a` and fails a page that
 * works. Raised in review; the fix is that a cycle is looked for within one element's
 * own declarations, which is less walking rather than more.
 */
const ROOT_SELECTORS = new Set([':root']);
const BODY_SELECTORS = new Set(['body', '.theme-light', '.theme-dark', 'body.theme-light', 'body.theme-dark']);
const APPLIES = new Set([...ROOT_SELECTORS, ...BODY_SELECTORS]);

/**
 * A conditional wrapper this page never satisfies. `@media print` is the only one either
 * sheet uses around an applicable selector, and app.css puts real declarations there —
 * `body { --font-text: var(--font-print) }` and a dark `--highlight-mix-blend-mode`.
 * Counting them is not merely lenient about what EXISTS: they come last, so "later wins"
 * would take the print value over the screen one and then chase `--font-print`, which no
 * applicable block declares. The rule is stated for the spelling the sheets actually
 * contain; the wrapper test below fails if a different one appears, rather than letting
 * this quietly assume every future wrapper applies.
 */
const NEVER_APPLIES = /\bprint\b/;

/**
 * Every custom property `file` declares for `scheme`, with its VALUE, from applicable
 * blocks only. The value is what makes the check transitive: a name with a declaration
 * whose own `var()` leads nowhere computes to nothing, and a set of names cannot say so.
 *
 * Brace-walked rather than matched with one regular expression, because both sheets nest
 * — `@supports (…) { :root { … } }` — and a flat pattern either misses the inner block or
 * swallows the wrapper's name with it. The innermost selector decides WHETHER the rule
 * applies; every at-rule above it can still veto, which is what `NEVER_APPLIES` is for.
 * Later declaration wins, which is the cascade for everything here only because the two
 * sheets now AGREE; specificity is not simulated, and would have to be if they diverged.
 */
function declarations(
	file: string,
	scheme: 'dark' | 'light',
	scope: Set<string> = APPLIES,
): Map<string, string> {
	const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const declared = new Map<string, string>();
	const stack: string[] = [];
	let chunk = '';
	for (const ch of css) {
		if (ch === '{') {
			stack.push((chunk.trim().split('\n').pop() ?? '').trim());
			chunk = '';
			continue;
		}
		if (ch === '}') {
			const selector = stack.pop() ?? '';
			const other = scheme === 'dark' ? 'light' : 'dark';
			const vetoed = stack.some((wrapper) => wrapper.startsWith('@') && NEVER_APPLIES.test(wrapper));
			if (!vetoed && scope.has(selector) && !selector.includes(`theme-${other}`)) {
				for (const match of chunk.matchAll(/(?:^|;)\s*(--[\w-]+)\s*:([^;]*)/g)) declared.set(match[1], match[2]);
			}
			chunk = '';
			continue;
		}
		chunk += ch;
	}
	return declared;
}

/**
 * Every at-rule wrapper that has a custom-property declaration under an applicable
 * selector, in either sheet. The evidence behind `NEVER_APPLIES` naming one spelling: a
 * rule that cannot see every wrapper must at least fail when a new one shows up.
 */
function wrappers(file: string): Set<string> {
	const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const found = new Set<string>();
	const stack: string[] = [];
	let chunk = '';
	for (const ch of css) {
		if (ch === '{') {
			stack.push((chunk.trim().split('\n').pop() ?? '').trim());
			chunk = '';
			continue;
		}
		if (ch === '}') {
			const selector = stack.pop() ?? '';
			if (APPLIES.has(selector) && /(?:^|;)\s*--[\w-]+\s*:/.test(chunk)) {
				for (const wrapper of stack) if (wrapper.startsWith('@')) found.add(wrapper);
			}
			chunk = '';
			continue;
		}
		chunk += ch;
	}
	return found;
}

/** Just the names — what a caller asking "is it declared at all" wants. */
function definitions(file: string, scheme: 'dark' | 'light'): Set<string> {
	return new Set(declarations(file, scheme).keys());
}

/** Both linked sheets as one lookup: app.css first, the stub over it, as the page links them. */
function sheetValues(scheme: 'dark' | 'light'): Map<string, string> {
	return new Map([
		...declarations('test/harness/obsidian.css', scheme),
		...declarations('test/harness/theme.css', scheme),
	]);
}

/**
 * The `var()` references at the TOP level of a value — the name each reads, and the
 * fallback text after its first comma, if it has one.
 *
 * Paren-balanced rather than matched, because a fallback can hold a whole value including
 * more `var()`s: app.css has `var(--color-base-35, var(--background-modifier-border-focus))`
 * in three places. Scanning those inner ones as if they were top level is what made the
 * first version of this file wrong in the strict direction — it demanded that a fallback
 * nobody would evaluate resolve anyway. Each reference is consumed whole, so a nested one
 * is only ever seen by the recursion that actually evaluates its branch.
 */
function references(value: string): { name: string; fallback: string | null }[] {
	const found: { name: string; fallback: string | null }[] = [];
	for (let i = value.indexOf('var('); i !== -1; i = value.indexOf('var(', i)) {
		let depth = 1;
		let comma = -1;
		let j = i + 4;
		for (; j < value.length && depth > 0; j++) {
			if (value[j] === '(') depth++;
			else if (value[j] === ')') depth--;
			else if (value[j] === ',' && depth === 1 && comma === -1) comma = j;
		}
		const name = (comma === -1 ? value.slice(i + 4, j - 1) : value.slice(i + 4, comma)).trim();
		if (name.startsWith('--')) found.push({ name, fallback: comma === -1 ? null : value.slice(comma + 1, j - 1) });
		i = j;
	}
	return found;
}

/**
 * Every name a value references, fallbacks INCLUDED — the edges CSS counts when it looks
 * for cycles, which is a different set from the ones `resolvesValue` evaluates.
 *
 * That difference is the whole reason this exists separately. A branch CSS never
 * evaluates still contributes a dependency: `--a: var(--present, var(--a))` is invalid at
 * computed-value time even though `--present` resolves, so a walk that short-circuits on
 * the primary cannot see the self-edge. Validity is therefore two questions — is the
 * graph acyclic, and does some branch resolve — and this file asks them in two tests
 * rather than folding one into the other.
 */
function edges(value: string): string[] {
	return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
}

/** One element's own declarations, both sheets, for the per-element cycle walk. */
function scopeValues(scope: Set<string>, scheme: 'dark' | 'light'): Map<string, string> {
	return new Map([
		...declarations('test/harness/obsidian.css', scheme, scope),
		...declarations('test/harness/theme.css', scheme, scope),
	]);
}

/**
 * The names taking part in a dependency cycle, over the edges above.
 *
 * Given ONE element's declarations: an edge to a name this element does not declare is
 * not an edge at all, because that name arrives already computed from an ancestor.
 */
function cyclic(values: Map<string, string>): string[] {
	const state = new Map<string, 'open' | 'done'>();
	const found = new Set<string>();
	const walk = (name: string): void => {
		if (state.get(name) === 'done') return;
		if (state.get(name) === 'open') {
			found.add(name);
			return;
		}
		state.set(name, 'open');
		for (const next of edges(values.get(name) ?? '')) if (values.has(next)) walk(next);
		state.set(name, 'done');
	};
	for (const name of values.keys()) walk(name);
	return [...found];
}

/**
 * Does a VALUE compute to something — every reference in it either resolving, or carrying
 * a fallback that does? That is CSS's own rule: a fallback applies exactly when the name
 * is missing, so requiring both branches would refuse a legitimate sheet and requiring
 * neither would pass a broken one. Raised in review after the first version did the first
 * of those.
 */
function resolvesValue(value: string, values: Map<string, string>, seen: Set<string>): boolean {
	return references(value).every(
		({ name, fallback }) =>
			resolves(name, values, seen) || (fallback !== null && resolvesValue(fallback, values, seen)),
	);
}

/**
 * Does `name` compute to something, following its value's own `var()` references?
 *
 * A declaration is not a value. `--shadow-xs: … var(--shadow-edges)` is declared under
 * `.theme-dark` while `--shadow-edges` is declared only under `.theme-light`, so in dark
 * it computes to nothing while a check for names alone calls it covered — the exact hole
 * a review pointed at, with an instance already in the tree.
 *
 * A cycle answers false: CSS treats one as invalid at computed-value time, and it also
 * stops the walk.
 */
function resolves(name: string, values: Map<string, string>, seen: Set<string> = new Set()): boolean {
	if (seen.has(name)) return false;
	const value = values.get(name);
	return value !== undefined && resolvesValue(value, values, new Set([...seen, name]));
}

/** Every `var(--x)` in a directory of CSS, minus the plugin's own, which code sets. */
function variablesUsed(dir: string): Set<string> {
	const used = new Set<string>();
	for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
		for (const match of readFileSync(`${dir}/${file}`, 'utf8').matchAll(/var\(\s*(--[\w-]+)/g)) {
			if (!match[1].startsWith('--pbl')) used.add(match[1]);
		}
	}
	return used;
}

describe('the harness sheets cover the stylesheet', () => {
	it.each(['dark', 'light'] as const)('resolves every Obsidian variable the partials read, in %s', (scheme) => {
		const values = sheetValues(scheme);

		expect([...variablesUsed('styles')].filter((name) => !resolves(name, values))).toEqual([]);
	});

	/**
	 * Asked of the STUB alone, and that is not an oversight: app.css is scheme-asymmetric
	 * in at least one place — `--shadow-edges` is defined under `.theme-light` and read by
	 * `.theme-dark`'s `--shadow-xs` — so requiring symmetry of the union would assert a
	 * property Obsidian's own sheet does not have. No partial reads either name, so the
	 * coverage test above is unaffected; what stays checkable is that the stub's own two
	 * blocks are a pair.
	 */
	it('splits the schemes in the stub rather than defining one of them', () => {
		const dark = definitions('test/harness/theme.css', 'dark');
		const light = definitions('test/harness/theme.css', 'light');

		// Same set, different values — a name in one and not the other is the defect.
		expect([...dark].filter((name) => !light.has(name))).toEqual([]);
		expect([...light].filter((name) => !dark.has(name))).toEqual([]);
	});

	/**
	 * The instrument, before its verdict is trusted — an empty match on either side would
	 * make every assertion above pass forever.
	 */
	it('measures both sheets, and only the blocks this page matches', () => {
		expect(variablesUsed('styles').size).toBeGreaterThan(20);
		expect(variablesUsed('styles').has('--background-primary')).toBe(true);
		expect(variablesUsed('styles').has('--pbl-indent')).toBe(false);

		// app.css carries the palette itself, in both schemes — the fact that shrank the
		// stub. Read from the sheet rather than from the union, or the stub could supply
		// it and this would still pass.
		const app = definitions('test/harness/obsidian.css', 'dark');
		expect(app.has('--color-base-00')).toBe(true);
		expect(definitions('test/harness/obsidian.css', 'light').has('--color-base-00')).toBe(true);
		// And the block filter bites: app.css defines this one under `.mod-macos` alone,
		// which no harness body matches, so it is NOT something the page resolves.
		expect(app.has('--slider-thumb-opacity-active')).toBe(false);

		// The stub still answers for itself, so a deleted block fails here rather than
		// silently leaning on app.css.
		expect(definitions('test/harness/theme.css', 'dark').size).toBeGreaterThan(20);

		// And the union is doing real work rather than being the stub with a second file
		// beside it: `--interactive-accent` is read by the partials, was deleted from the
		// stub on 2026-08-10 for approximating it, and is resolved now only because app.css
		// is counted. If this ever flips, the coverage test above quietly narrowed.
		expect(variablesUsed('styles').has('--interactive-accent')).toBe(true);
		expect(definitions('test/harness/theme.css', 'dark').has('--interactive-accent')).toBe(false);
		expect(app.has('--interactive-accent')).toBe(true);

		// The transitive walk, pinned to the instance already in the tree rather than to a
		// planted one: `--shadow-xs` is DECLARED in both schemes, and in dark its value
		// reaches `--shadow-edges`, which `.theme-light` alone declares. Name-checking
		// calls that covered; following the value does not. No partial reads either, which
		// is why this is the instrument's business and not the coverage test's.
		expect(app.has('--shadow-xs')).toBe(true);
		expect(resolves('--shadow-xs', sheetValues('dark'))).toBe(false);
		expect(resolves('--shadow-xs', sheetValues('light'))).toBe(true);

		// One reference, not two: app.css spells the nested fallback three times, and
		// reading the inner one as top level is the strict-direction bug below.
		const dark = sheetValues('dark');
		expect(references(dark.get('--graph-line') ?? '')).toHaveLength(1);

		// The print veto, asked of the VALUE that survived: app.css declares `--font-text`
		// twice on `body`, and the print one comes second. Without the veto "later wins"
		// takes it, and then chases a `--font-print` no applicable block declares.
		expect(dark.get('--font-text')).not.toContain('--font-print');
		expect(resolves('--font-text', dark)).toBe(true);
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

		// The review's case: valid CSS, and the version this replaced called it false.
		expect(resolves('--primary-ok', values)).toBe(true);
		expect(resolves('--fallback-used', values)).toBe(true);
		expect(resolves('--both-gone', values)).toBe(false);
	});

	it.each(['dark', 'light'] as const)('has no dependency cycle in %s, fallbacks counted', (scheme) => {
		// Raised in review: `resolves` answers which branch supplies a value, and CSS asks
		// something else first. Nothing in either sheet is cyclic today, so this is the
		// assertion that keeps it that way rather than a fix for a live defect. Asked per
		// ELEMENT — see `ROOT_SELECTORS` — because a cross-element reference is inheritance
		// rather than a dependency, and flattening the two invents cycles.
		expect(cyclic(scopeValues(ROOT_SELECTORS, scheme))).toEqual([]);
		expect(cyclic(scopeValues(BODY_SELECTORS, scheme))).toEqual([]);
	});

	it.each(['dark', 'light'] as const)('reads a cross-element reference as inheritance, in %s', (scheme) => {
		// Both scopes are non-empty, or the test above is two walks over nothing — and
		// app.css does declare on both: the `@supports` heading weights sit on `:root`
		// while the palette sits on `body` and the theme classes.
		expect(scopeValues(ROOT_SELECTORS, scheme).size).toBeGreaterThan(0);
		expect(scopeValues(BODY_SELECTORS, scheme).size).toBeGreaterThan(0);

		// The review's example, which a flattened namespace calls a cycle and CSS does not:
		// the root takes its fallback, and the body inherits the computed result.
		const root = new Map([['--a', 'var(--b, red)']]);
		const body = new Map([['--b', 'var(--a)']]);
		expect(cyclic(root)).toEqual([]);
		expect(cyclic(body)).toEqual([]);
		// The last line is the contrast, and the honest limit with it: flattening the two
		// invents a cycle, and nothing in the SHEETS can tell the two walks apart, since
		// neither is cyclic either way. What is checked is the predicate on these shapes
		// and that both scopes are populated — not that the wiring above passes the scoped
		// maps, which only a future cross-element reference would make falsifiable.
		expect(cyclic(new Map([...root, ...body]))).not.toEqual([]);
	});

	it('sees a cycle that only the unused fallback branch creates', () => {
		// The detector's own instrument, and the exact shape the review named: `--present`
		// resolves, so every value-side walk short-circuits before the self-edge. A
		// green cycle check would otherwise mean nothing.
		const values = new Map([
			['--a', 'var(--present, var(--a))'],
			['--present', 'red'],
		]);

		expect(resolvesValue(values.get('--a') ?? '', values, new Set())).toBe(true);
		expect(cyclic(values)).toEqual(['--a']);
		// And the pair from the spec, where neither branch is the one taken.
		expect(cyclic(new Map([['--x', 'var(--y, 0px)'], ['--y', 'var(--x, 0px)']]))).not.toEqual([]);
	});

	it('fails when a conditional wrapper it has never seen appears', () => {
		// `NEVER_APPLIES` names one spelling because one is what the sheets contain. This
		// is the check under that sentence: a new wrapper — a width query, `@layer`, a
		// second media type — has to be ruled on rather than silently assumed to apply.
		const seen = new Set([...wrappers('test/harness/obsidian.css'), ...wrappers('test/harness/theme.css')]);

		expect([...seen].sort()).toEqual(['@media print', '@supports (font-variation-settings: normal)']);
	});
});
