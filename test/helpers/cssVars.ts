/**
 * Reading CSS custom properties the way the harness page resolves them.
 *
 * Extracted from `test/harness/themeStub.test.ts`, which asserts with it — the parser and
 * the assertions had grown into one file against the 450-line budget, and they are two
 * subjects: what a sheet SAYS, and whether the harness's two sheets between them answer
 * what `styles/` asks. `test/view/timelineBoxing.test.ts` is now a second caller, asking
 * the same question of a real Obsidian token (`test/harness/obsidian.css`) and a plugin
 * custom property's own declared scope — a name being declared is not it being reachable
 * from where a swatch actually sits, and this module is what tells the two apart.
 *
 * It is a reader, not an engine. What it models is what the harness page needs and what
 * review found it getting wrong: the element a rule matches, the at-rule above it, the
 * two branches of a `var()`, and the difference between resolving a value and finding a
 * cycle. What it deliberately does not model is specificity — see `declarations`.
 *
 * `bodyOf` is the plainest thing here and is why this file is now the home for every
 * stylesheet READ rather than for custom properties alone: five suites assert whole
 * declarations in a named rule, and between them they carried SEVEN copies of it.
 */

/**
 * The declarations of one rule, addressed by its selector LIST — pass the whole list,
 * newlines and all, for a grouped rule.
 *
 * **Two requirements, both inherited and both failing toward a loud throw.** The match is
 * EXACT rather than a prefix, which is load-bearing now that two rules in `roadmap.css`
 * open on `.pbl-roadmap .pbl-shelf,` and differ in nothing but which bands follow it; and
 * the rule must start at LINE START, so one indented into an `@media` block reads as
 * absent. `test/view/rendering.test.ts` is the suite that genuinely asks an `@media`
 * question and is deliberately not a caller — it wants the rule NEAREST an enclosing
 * wrapper, which is a different question rather than a stricter one.
 *
 * The one rule reader the stylesheet suites share, and deliberately not built on anything
 * above it. `declarations` answers for custom properties and `rules` for property NAMES,
 * while every caller asserts declaration TEXT — `max-height: 30%;`,
 * `contain: inline-size;` — which only the body carries. `eachBlock` is the one that
 * could plausibly have carried this, and was declined for the reason that matters when
 * an INSTRUMENT is what changes: it strips comments and normalises selector whitespace,
 * so every assertion reading a body would have been re-pointed at a subtly different
 * string by the commit that was supposed to leave them alone. This body was lifted
 * verbatim from the copy two suites already shared, byte for byte, so their assertions
 * are provably untouched.
 *
 * It was hand-rolled in seven places until 2026-08-17 across five suites, three of them
 * slicing from the SELECTOR rather than from the `{`, so any needle that could appear in
 * a prelude passed on the prelude. The count reads seven because it was re-measured with
 * `grep -rn "\.indexOf(" test/` — the brief named four, and a narrower grep for one
 * spelling is how a count like this goes wrong.
 *
 * `file` is passed rather than recovered from the text: the caller already knows which
 * stylesheet it read, and a miss has to name it to be actionable. It THROWS on a miss —
 * a helper that asserted would report a renamed selector with no test name attached.
 */
export function bodyOf(css: string, selector: string, file: string): string {
	const at = css.indexOf(`\n${selector} {`);
	if (at === -1) throw new Error(`no rule for ${selector} in ${file}`);
	const open = css.indexOf('{', at);
	return css.slice(open + 1, css.indexOf('}', open));
}

/**
 * The selectors a harness page matches, by the ELEMENT they match — which is two
 * elements, not one namespace. `:root` is the `<html>`; everything else here is the
 * `<body class="theme-dark|light">` Obsidian's theme class goes on.
 *
 * Resolution walks them in order, because a name a body rule does not declare is
 * inherited from the root already computed. Cycle detection stays inside one element:
 * that same inheritance ENDS an edge, so `:root { --a: var(--b, red) }` beside
 * `body { --b: var(--a) }` is valid CSS — the root takes its fallback, the body inherits
 * the result — and a flattened graph reports `--a → --b → --a` and fails a page that
 * works.
 */
export const ROOT_SELECTORS = new Set([':root']);
export const BODY_SELECTORS = new Set(['body', '.theme-light', '.theme-dark', 'body.theme-light', 'body.theme-dark']);
export const APPLIES = new Set([...ROOT_SELECTORS, ...BODY_SELECTORS]);

/**
 * A conditional wrapper a harness page never satisfies. `@media print` is the only one
 * either sheet uses around an applicable selector, and app.css puts real declarations
 * there — `body { --font-text: var(--font-print) }` and a dark `--highlight-mix-blend-mode`.
 * Counting them is not merely lenient about what EXISTS: they come last, so "later wins"
 * takes the print value over the screen one and then chases `--font-print`, which no
 * applicable block declares. The rule is stated for the spelling the sheets actually
 * contain; `wrappers` is what lets a test fail when a different one appears, rather than
 * letting this quietly assume every future wrapper applies.
 */
const NEVER_APPLIES = /\bprint\b/;

/**
 * The selectors one rule matches — a LIST, because CSS lets a rule name several and a
 * rule applies when any of them matches.
 *
 * Taking the last physical line instead is a real bug review caught: app.css writes
 * `body,\n[dir='ltr'] { --direction: 1; … }`, which that reading records as
 * `[dir='ltr']` alone and so reports three properties the harness body does declare as
 * missing. The text is cut at the last `;` or `}` so a declaration sitting above a
 * nested rule cannot be mistaken for part of its prelude.
 */
function selectorsOf(prelude: string): string[] {
	return (prelude.split(/[;}]/).pop() ?? '').split(',').map((selector) => selector.trim());
}

/** Walk a stylesheet's blocks, handing each one its selector list and the at-rules above it. */
function eachBlock(css: string, visit: (selectors: string[], wrappers: string[], body: string) => void): void {
	const stack: string[] = [];
	let chunk = '';
	for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
		if (ch === '{') {
			stack.push(chunk);
			chunk = '';
			continue;
		}
		if (ch === '}') {
			const prelude = stack.pop() ?? '';
			visit(
				selectorsOf(prelude),
				stack.flatMap((outer) => selectorsOf(outer)).filter((outer) => outer.startsWith('@')),
				chunk,
			);
			chunk = '';
			continue;
		}
		chunk += ch;
	}
}

/**
 * Every custom property `css` declares for `scheme`, with its VALUE, from blocks in
 * `scope` only. The value is what makes a coverage check transitive: a name with a
 * declaration whose own `var()` leads nowhere computes to nothing, and a set of names
 * cannot say so.
 *
 * Brace-walked rather than matched with one regular expression, because both sheets nest
 * — `@supports (…) { :root { … } }` — and a flat pattern either misses the inner block or
 * swallows the wrapper's name with it. Later declaration wins, which is the cascade for
 * everything the harness links only because the two sheets AGREE; specificity is not
 * simulated, and would have to be if they diverged.
 */
export function declarations(css: string, scheme: 'dark' | 'light', scope: Set<string> = APPLIES): Map<string, string> {
	const declared = new Map<string, string>();
	const other = scheme === 'dark' ? 'light' : 'dark';
	eachBlock(css, (selectors, wrappers, body) => {
		if (wrappers.some((wrapper) => NEVER_APPLIES.test(wrapper))) return;
		if (!selectors.some((selector) => scope.has(selector) && !selector.includes(`theme-${other}`))) return;
		for (const match of body.matchAll(/(?:^|;)\s*(--[\w-]+)\s*:([^;]*)/g)) declared.set(match[1], match[2]);
	});
	return declared;
}

/**
 * Every at-rule wrapper that has a custom-property declaration under an applicable
 * selector. The evidence behind `NEVER_APPLIES` naming one spelling: a rule that cannot
 * see every wrapper must at least let a test fail when a new one shows up.
 */
export function wrappers(css: string): Set<string> {
	const found = new Set<string>();
	eachBlock(css, (selectors, wrapping, body) => {
		if (!selectors.some((selector) => APPLIES.has(selector))) return;
		if (!/(?:^|;)\s*--[\w-]+\s*:/.test(body)) return;
		for (const wrapper of wrapping) found.add(wrapper);
	});
	return found;
}

/**
 * Every ordinary rule in a sheet: the selectors it names, and the properties it sets.
 *
 * For asking whether one sheet restates what another already says — the question the
 * custom-property comparison could not answer, and the one that let `.clickable-icon`
 * sit here overriding app.css while the notes claimed the page drew Obsidian's own.
 */
export function rules(css: string): { selectors: string[]; properties: string[] }[] {
	const found: { selectors: string[]; properties: string[] }[] = [];
	eachBlock(css, (selectors, _wrappers, body) => {
		if (selectors[0]?.startsWith('@')) return;
		found.push({
			selectors,
			properties: [...body.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)].map((match) => match[1]),
		});
	});
	return found;
}

/**
 * The `var()` references at the TOP level of a value — the name each reads, and the
 * fallback text after its first comma, if it has one.
 *
 * Paren-balanced rather than matched, because a fallback can hold a whole value including
 * more `var()`s: app.css has `var(--color-base-35, var(--background-modifier-border-focus))`
 * in three places, and `styles/tree.css` has one of its own. Scanning those inner ones as
 * if they were top level demands that a fallback nobody would evaluate resolve anyway.
 * Each reference is consumed whole, so a nested one is only ever seen by the recursion
 * that actually evaluates its branch.
 */
export function references(value: string): { name: string; fallback: string | null }[] {
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
 * That difference is why this exists separately. A branch CSS never evaluates still
 * contributes a dependency: `--a: var(--present, var(--a))` is invalid at computed-value
 * time even though `--present` resolves, so a walk that short-circuits on the primary
 * cannot see the self-edge. Validity is two questions — is the graph acyclic, and does
 * some branch resolve — and they are two functions here rather than one.
 */
function edges(value: string): string[] {
	return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
}

/**
 * The names taking part in a dependency cycle, over the edges above.
 *
 * Given ONE element's declarations: an edge to a name this element does not declare is
 * not an edge at all, because that name arrives already computed from an ancestor.
 */
export function cyclic(values: Map<string, string>): string[] {
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
 * neither would pass a broken one.
 *
 * It answers for a use site as readily as for a declaration, which is the point: a
 * partial writing `var(--a, var(--b))` is asking the same question of the page.
 */
export function resolvesValue(value: string, values: Map<string, string>, seen: Set<string> = new Set()): boolean {
	return references(value).every(
		({ name, fallback }) => resolves(name, values, seen) || (fallback !== null && resolvesValue(fallback, values, seen)),
	);
}

/**
 * `--x: initial` gives a custom property the GUARANTEED-INVALID value, so `var(--x)` is
 * invalid and only a fallback can save it. A declaration is not always a value, and this
 * is the spelling where a present literal means the opposite of resolved.
 *
 * The other CSS-wide keywords are deliberately not here. `inherit` and `unset` mean "take
 * the parent's computed value", which this reader does not model — app.css declares 30 of
 * them — and guessing would be worse than the gate `themeStub.test.ts` puts under this
 * paragraph: no name a partial READS may be declared as any CSS-wide keyword. That check
 * fails the day the question becomes real, which is the day to teach this inheritance.
 */
const GUARANTEED_INVALID = /^initial$/i;

/**
 * Does `name` compute to something, following its value's own `var()` references?
 *
 * A declaration is not a value. `--shadow-xs: … var(--shadow-edges)` is declared under
 * `.theme-dark` while `--shadow-edges` is declared only under `.theme-light`, so in dark
 * it computes to nothing while a check for names alone calls it covered. A cycle answers
 * false: CSS treats one as invalid at computed-value time, and it also stops the walk.
 */
export function resolves(name: string, values: Map<string, string>, seen: Set<string> = new Set()): boolean {
	if (seen.has(name)) return false;
	const value = values.get(name);
	if (value === undefined || GUARANTEED_INVALID.test(value.replace(/!important\s*$/, '').trim())) return false;
	return resolvesValue(value, values, new Set([...seen, name]));
}
