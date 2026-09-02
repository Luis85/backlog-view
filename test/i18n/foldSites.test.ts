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
 * `toLowerCase` and a `matching` entry `toLocaleLowerCase`, so a sweep that moves an
 * identity fold to the locale-aware form FAILS until the table is edited to say so — and
 * the table edit is then the reviewable act, in a diff that is exactly the set of sites
 * that changed category. Exactly one entry is `matching` — `foldForMatch` itself, the
 * helper the matching SITES have not moved to yet; see `foldSites.ts`'s own comment.
 *
 * That check reads the spelling ANYWHERE in an entry's text, not the outermost callee, so a
 * nested mixed fold (`foo(a.toLocaleLowerCase()).toLowerCase()`) would be judged by its
 * inner one. No such site exists, and a nested pair is two calls and therefore two entries
 * — the inner one is unambiguous, and it is the outer row's `why` that would have to say
 * which fold it is about.
 *
 * The instrument is the TypeScript compiler API rather than a grep, and the difference was
 * measured rather than assumed: on 2026-09-02, `grep -o 'toLowerCase('` over the same tree
 * returned 120 against this walk's 113, and every one of the seven extras was inside a
 * comment — three of them in this feature's own notes about the folds. A comment is not a
 * call. **Nothing asserts either figure**, and both drift: editing a comment that mentions
 * a fold moves the grep number without moving anything real. It is dated for that reason,
 * and the walk's own count is what the suite holds.
 *
 * What the walk cannot see, stated rather than implied: a fold not spelled as a property
 * access — through a variable (`const fold = s.toLowerCase; fold()`) or through element
 * access (`s['toLowerCase']()`). Neither occurs in `src/` today, and the assertion that
 * this walk finds 114 calls in 27 files is what fails if the instrument ever stops seeing
 * the tree at all.
 */

const SRC = 'src';
const FOLD_NAMES = new Set(['toLowerCase', 'toLocaleLowerCase']);

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

/** Every `x.toLowerCase()` / `x.toLocaleLowerCase()` call in `src/` — a call on a property
 * access, which is the only spelling `src/` uses. Comments are excluded by construction. */
function foldCalls(): FoldCall[] {
	const found: FoldCall[] = [];
	for (const file of sources(SRC)) {
		const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2020, true);
		const visit = (node: ts.Node): void => {
			if (
				ts.isCallExpression(node) &&
				ts.isPropertyAccessExpression(node.expression) &&
				FOLD_NAMES.has(node.expression.name.text)
			) {
				found.push({ file, text: node.getText(source).replace(/\s+/g, ' ') });
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return found;
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
		expect(FOLD_SITES.filter((site) => site.kind === 'identity').length).toBe(113);
		expect(FOLD_SITES.filter((site) => site.kind === 'matching').length).toBe(1);
	});

	it('has an entry for every fold call — a new, unclassified fold fails here', () => {
		expect(missing(inSource, inTable, 'the table')).toEqual([]);
	});

	it('has no entry src/ no longer holds — a stale entry fails here', () => {
		expect(missing(inTable, inSource, 'src/')).toEqual([]);
	});

	it('spells identity folds toLowerCase and matching folds toLocaleLowerCase', () => {
		const wrong = FOLD_SITES.filter(
			(site) => site.text.includes('toLocaleLowerCase') !== (site.kind === 'matching'),
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
