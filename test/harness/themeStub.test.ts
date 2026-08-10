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

/** The selectors a `<body class="theme-dark|light">` on the harness page actually matches. */
const APPLIES = new Set([':root', 'body', '.theme-light', '.theme-dark', 'body.theme-light', 'body.theme-dark']);

/**
 * Every custom property `file` declares for `scheme`, with its VALUE, from applicable
 * blocks only. The value is what makes the check transitive: a name with a declaration
 * whose own `var()` leads nowhere computes to nothing, and a set of names cannot say so.
 *
 * Brace-walked rather than matched with one regular expression, because both sheets nest
 * — `@supports (…) { :root { … } }` — and a flat pattern either misses the inner block or
 * swallows the wrapper's name with it. The innermost selector is the one that decides.
 * Later declaration wins, which is the cascade for everything here only because the two
 * sheets now AGREE; specificity is not simulated, and would have to be if they diverged.
 */
function declarations(file: string, scheme: 'dark' | 'light'): Map<string, string> {
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
			if (APPLIES.has(selector) && !selector.includes(`theme-${other}`)) {
				for (const match of chunk.matchAll(/(?:^|;)\s*(--[\w-]+)\s*:([^;]*)/g)) declared.set(match[1], match[2]);
			}
			chunk = '';
			continue;
		}
		chunk += ch;
	}
	return declared;
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
 * Does `name` compute to something, following its value's own `var()` references?
 *
 * A declaration is not a value. `--shadow-xs: … var(--shadow-edges)` is declared under
 * `.theme-dark` while `--shadow-edges` is declared only under `.theme-light`, so in dark
 * it computes to nothing while a check for names alone calls it covered — the exact hole
 * a review pointed at, with an instance already in the tree.
 *
 * A cycle answers false: CSS treats one as invalid at computed-value time, and it also
 * stops the walk. A reference WITH a fallback answers true without recursing, because the
 * fallback is what applies when the name is missing — no `var()` in either sheet carries
 * one today (measured), so that branch is reasoned rather than exercised.
 */
function resolves(name: string, values: Map<string, string>, seen: Set<string> = new Set()): boolean {
	if (seen.has(name)) return false;
	const value = values.get(name);
	if (value === undefined) return false;
	const next = new Set([...seen, name]);
	for (const ref of value.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
		if (ref[2] !== ',' && !resolves(ref[1], values, next)) return false;
	}
	return true;
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
	});
});
