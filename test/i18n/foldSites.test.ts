import { readdirSync, readFileSync, statSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { FOLD_SITES, FoldSite } from './foldSites';

/**
 * The classification in `foldSites.ts`, held against the tree it describes.
 *
 * A case fold is either identity — what something *is*, and locale-independent by
 * specification — or matching, which compares what the user typed against what they can
 * see and should follow the user's locale. The two look identical in the source, and one
 * of them is a vault-corruption bug: `wipLimitKey` folded with a Turkish locale keys
 * `In progress` on `wiplimit.ın progress`, so every WIP limit in the vault silently
 * resets. So the split is written down and checked rather than remembered.
 *
 * **The spelling check is the one that matters.** An `identity` entry must be spelled
 * `toLowerCase`, and a `matching` entry one of the two locale-aware spellings —
 * `foldForMatch(x)` at a site, or the `toLocaleLowerCase` that is `foldForMatch`'s own
 * body. So a sweep that moves an identity fold to either FAILS until the table is edited
 * to say so, and the table edit is then the reviewable act, in a diff that is exactly the
 * set of sites that changed category. The flip of 2026-09-02 shows up here as eight rows
 * whose `kind` and `text` both changed, which the stale-entry check below is what forces.
 *
 * **`foldForMatch(x)` is in the walk for a reason, and the reason was a live hole.** With
 * matching sites calling the helper, a fold spelled that way is not a `toLowerCase`-family
 * call at all: for one commit a brand-new `foldForMatch(x)` written for an IDENTITY purpose
 * — the vault-corrupting direction — needed no row, moved no count and failed nothing. A
 * planted `planted.${foldForMatch(v)}` in `src/domain/vocabulary.ts` passed 7/7. It now
 * fails the unclassified-entry check and the count. Found by review.
 *
 * That check reads the spelling ANYWHERE in an entry's text, not the outermost callee, so a
 * nested mixed fold (`foo(a.toLocaleLowerCase()).toLowerCase()`) would be judged by its
 * inner one. No such site exists, and a nested pair is two calls and therefore two entries
 * — the inner one is unambiguous, and it is the outer row's `why` that would have to say
 * which fold it is about.
 *
 * The instrument is the TypeScript compiler API rather than a grep, and the difference was
 * measured rather than assumed: on 2026-09-02, `grep -o 'toLowerCase('` over the same tree
 * returned 113 against this walk's 105 `toLowerCase` calls, and every one of the eight
 * extras was inside a comment. A comment is not a call. **No example of one is named
 * here**, and that is the third correction this feature has made to a measured claim in a
 * header: the example this paragraph carried was true of the paren-LESS grep and false of
 * the one the sentence names, which is exactly the confusion a paragraph about instruments
 * must not ship. Re-run both if you want to know where they are. **Nothing asserts either
 * figure**, and both drift: editing a comment that mentions a fold moves the grep number
 * without moving anything real. It is dated for that reason, and the walk's own count is
 * what the suite holds.
 *
 * What the walk cannot see, stated rather than implied: a fold reached other than by its
 * own name — a `toLowerCase` through a variable (`const fold = s.toLowerCase; fold()`) or
 * through element access (`s['toLowerCase']()`), or a `foldForMatch` renamed on import or
 * passed as a value (`known.map(foldForMatch)`). None occurs in `src/` today, and the
 * assertion that this walk finds 114 calls in 27 files is what fails if the instrument ever
 * stops seeing the tree at all.
 */

const SRC = 'src';
const FOLD_NAMES = new Set(['toLowerCase', 'toLocaleLowerCase']);
/** The helper a matching site calls instead of spelling a fold — see `MATCHING_SPELLINGS`. */
const FOLD_HELPER = 'foldForMatch';
/** A row is `matching` exactly when its text carries one of these. */
const MATCHING_SPELLINGS = ['toLocaleLowerCase', FOLD_HELPER];

/** Every `.ts` under `dir`, recursively, in a stable order. */
function sources(dir: string): string[] {
	return readdirSync(dir)
		.sort()
		.flatMap((name) => {
			const path = `${dir}/${name}`;
			if (statSync(path).isDirectory()) return sources(path);
			return path.endsWith('.ts') ? [path] : [];
		});
}

/** One fold call: the file it is in and its whitespace-collapsed source text. */
type FoldCall = Pick<FoldSite, 'file' | 'text'>;

/**
 * Every fold in `src/`, in either of the two shapes it can take: `x.toLowerCase()` /
 * `x.toLocaleLowerCase()` on a property access, and a bare `foldForMatch(x)` call.
 * Comments are excluded by construction.
 *
 * **The helper call is what the walk would otherwise be blind to**, and that blindness was
 * real for one commit: with the matching SITES calling `foldForMatch` instead of spelling a
 * fold, a brand-new `foldForMatch(x)` written for an identity purpose needed no row, moved
 * no count and failed nothing. Found by review. `foldForMatch`'s own declaration is a
 * `FunctionDeclaration` and its import an `ImportSpecifier`, so neither is a call and
 * neither is counted; its BODY is counted once, as the `toLocaleLowerCase` it is.
 */
function foldCalls(): FoldCall[] {
	const found: FoldCall[] = [];
	for (const file of sources(SRC)) {
		const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2020, true);
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node) && isFold(node.expression)) {
				found.push({ file, text: node.getText(source).replace(/\s+/g, ' ') });
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return found;
}

/** The callee of a fold: a `.toLowerCase`-family property access, or `foldForMatch` itself. */
function isFold(callee: ts.Expression): boolean {
	if (ts.isPropertyAccessExpression(callee)) return FOLD_NAMES.has(callee.name.text);
	return ts.isIdentifier(callee) && callee.text === FOLD_HELPER;
}

/** How many times each `file`+`text` pair occurs — the table repeats a spelling per call. */
function tally(calls: FoldCall[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const call of calls) {
		const key = `${call.file} :: ${call.text}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

/** Pairs `left` has that `right` does not, or has fewer of — `other` names the side that is short. */
function missing(left: Map<string, number>, right: Map<string, number>, other: string): string[] {
	return [...left]
		.filter(([key, count]) => count > (right.get(key) ?? 0))
		.map(([key, count]) => `${key} — ${count} found, ${other} has ${right.get(key) ?? 0}`);
}

const calls = foldCalls();
const inSource = tally(calls);
const inTable = tally(FOLD_SITES);

describe('every case fold in src/ is classified', () => {
	it('reads a tree that actually folds, so the walk is not silently looking at nothing', () => {
		expect(calls.length).toBe(114);
		expect(new Set(calls.map((call) => call.file)).size).toBe(27);
	});

	it('states the counts the table itself claims', () => {
		expect(FOLD_SITES.length).toBe(114);
		expect(FOLD_SITES.filter((site) => site.kind === 'identity').length).toBe(105);
		expect(FOLD_SITES.filter((site) => site.kind === 'matching').length).toBe(9);
	});

	it('has an entry for every fold call — a new, unclassified fold fails here', () => {
		expect(missing(inSource, inTable, 'the table')).toEqual([]);
	});

	it('has no entry src/ no longer holds — a stale entry fails here', () => {
		expect(missing(inTable, inSource, 'src/')).toEqual([]);
	});

	it('spells identity folds toLowerCase and matching folds toLocaleLowerCase or foldForMatch', () => {
		const wrong = FOLD_SITES.filter(
			(site) =>
				MATCHING_SPELLINGS.some((name) => site.text.includes(name)) !== (site.kind === 'matching'),
		).map((site) => `${site.file} :: ${site.text} is ${site.kind}`);

		expect(wrong).toEqual([]);
	});

	it('says what every identity fold decides', () => {
		const unexplained = FOLD_SITES.filter((site) => site.kind === 'identity' && site.why.trim() === '').map(
			(site) => `${site.file} :: ${site.text}`,
		);

		expect(unexplained).toEqual([]);
	});

	it('is sorted by file, then by call text', () => {
		const keys = FOLD_SITES.map((site) => `${site.file} :: ${site.text}`);
		expect(keys).toEqual([...keys].sort());
	});
});
