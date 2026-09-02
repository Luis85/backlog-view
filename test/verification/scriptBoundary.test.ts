import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **`scripts/*.mjs` are JavaScript, so `npm run typecheck:test` reads their parameters as
 * whatever JSDoc says and as `any` where it says nothing.** `tsconfig.json` sets
 * `allowJs` without `checkJs`, which is the combination that makes a `@param {string}` a
 * TYPE at every call site while leaving the script's own body unchecked — so a boundary
 * function documented in prose alone is one a test can call with anything at all, and
 * `docs/tasks/Close the holes the test typecheck cannot see through.md` left exactly that
 * open ("every call into the other 30 lands on an implicit `any`").
 *
 * Re-derived 2026-09-02: **23 exported functions across 8 scripts are imported by tests,
 * and all 23 already carry a typed `@param` per parameter.** Nothing was owed. What was
 * missing is this — the convention was held by whoever wrote each one, and the next
 * export would inherit nothing.
 *
 * The alternative was measured and refused: `checkJs` over the same 6 scripts a test
 * imports and executes reports **217 errors**, and no single file is clean, so
 * `// @ts-check` per file buys nothing either. That is a project, which is what the task
 * note already said and what this re-measured rather than repeated.
 *
 * ## What this reaches, and what it does not
 *
 * It reads the **named imports a test file writes**, so it is a check on the boundary as
 * it is USED. Three ways past it, stated because a check that reads wider than it looks
 * is this repository's own recorded defect:
 *
 * - A script a test reaches by `import(…)`, by a namespace import (`import * as`), or by
 *   spawning it as a subprocess. `docs-check.mjs` and `perf.mjs` are reached the last way
 *   on purpose (see `test/helpers/register.ts`), and a subprocess has no call site to type.
 * - An exported **value** that is not a function declaration or an arrow assigned to an
 *   `export const` — a class method, a re-export, an object of functions.
 * - Whether the type is RIGHT. `@param {object}` satisfies this and checks nothing.
 */

const REPO = resolve(__dirname, '..', '..');

interface Boundary {
	script: string;
	name: string;
	params: number;
	typed: number;
}

/**
 * Every named import a test file takes from `scripts/*.mjs`, paired with the exported
 * function it names and how many of that function's parameters carry a typed `@param`.
 *
 * `ts.getJSDocTags` rather than reading `node.jsDoc`, and that is not a style pick: a
 * comment above `export const prose = (text) => …` attaches to the VariableStatement, two
 * nodes up from the arrow. The first version of this walk read the arrow's own parent and
 * reported both of `docs-markdown.mjs`'s prose helpers as undocumented when they are not.
 */
const boundaries = (): Boundary[] => {
	const imported = new Map<string, Set<string>>();
	const files = ts.sys.readDirectory(join(REPO, 'test'), ['.ts']);
	for (const file of files) {
		const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		const walk = (node: ts.Node): void => {
			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				const script = /scripts\/([a-z-]+\.mjs)$/.exec(node.moduleSpecifier.text)?.[1];
				const bindings = node.importClause?.namedBindings;
				if (script && bindings && ts.isNamedImports(bindings)) {
					const set = imported.get(script) ?? new Set<string>();
					for (const element of bindings.elements) set.add(element.propertyName?.text ?? element.name.text);
					imported.set(script, set);
				}
			}
			ts.forEachChild(node, walk);
		};
		walk(src);
	}

	const out: Boundary[] = [];
	for (const [script, names] of [...imported].sort()) {
		const path = join(REPO, 'scripts', script);
		const src = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
		const fns = new Map<string, ts.SignatureDeclaration>();
		const exported = (node: ts.Node): boolean =>
			ts.canHaveModifiers(node) &&
			(ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
		const walk = (node: ts.Node): void => {
			if (ts.isFunctionDeclaration(node) && node.name && exported(node)) fns.set(node.name.text, node);
			if (ts.isVariableStatement(node) && exported(node))
				for (const decl of node.declarationList.declarations)
					if (
						decl.initializer &&
						(ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
						ts.isIdentifier(decl.name)
					)
						fns.set(decl.name.text, decl.initializer);
			ts.forEachChild(node, walk);
		};
		walk(src);
		for (const name of [...names].sort()) {
			const fn = fns.get(name);
			// Not a function export — a constant, a class, a re-export. Nothing to type.
			if (!fn) continue;
			const typed = ts
				.getJSDocTags(fn)
				.filter((tag): tag is ts.JSDocParameterTag => ts.isJSDocParameterTag(tag) && tag.typeExpression !== undefined);
			out.push({ script, name, params: fn.parameters.length, typed: typed.length });
		}
	}
	return out;
};

describe('the scripts/ boundary a test calls across', () => {
	it('types every parameter of every exported function a test imports', () => {
		const found = boundaries();
		const gaps = found.filter((b) => b.typed < b.params).map((b) => `${b.script}#${b.name}`);
		expect(gaps).toEqual([]);
		// Not vacuous: a walk that found nothing reports no gaps and would pass. A floor
		// rather than the number, so an added import does not fail this — and a named
		// instance, so a rewrite that stopped seeing `export const` arrows cannot stay
		// green (`prose` is one, and is the shape the first version of this walk missed).
		expect(found.length).toBeGreaterThanOrEqual(23);
		expect(found.some((b) => b.script === 'docs-markdown.mjs' && b.name === 'prose')).toBe(true);
	});

	/**
	 * The census above is worth nothing if a typed `@param` is not ENFORCED, and "allowJs
	 * carries JSDoc types to the call site" is a claim about the compiler rather than
	 * about this repository. So it is asked of the compiler, on the same options
	 * `tsconfig.test.json` resolves, over a probe that is a wrong call.
	 *
	 * Three wrong calls, and **only the first of them is what the census buys** — which
	 * was found by watching this fail rather than by reasoning, and is why the sentence
	 * says so. Deleting `{number}` from `headings`'s `[depth]` left this GREEN: `depth = 2`
	 * has a default, so the compiler infers `number` from the initializer and the JSDoc
	 * was never load-bearing there. Deleting `{string}` from `text` — a parameter with no
	 * default and no other inference source — is what drops a `2345`. So: argument 1 is
	 * the enforcement a `@param` provides, argument 2 is the enforcement a DEFAULT
	 * provides, and the arity is the enforcement `allowJs` provides with no annotation at
	 * all. All three are asserted; only the first would survive as evidence for the
	 * census, and a boundary function whose every parameter is defaulted gains nothing
	 * from being documented.
	 */
	it('rejects a mistyped and a miscounted call at the call site', () => {
		const config = ts.parseJsonConfigFileContent(
			ts.readConfigFile(join(REPO, 'tsconfig.test.json'), ts.sys.readFile).config,
			ts.sys,
			REPO,
		);
		const dir = mkdtempSync(join(tmpdir(), 'pbl-boundary-'));
		const probe = join(dir, 'probe.ts');
		// A RELATIVE specifier, forward-slashed: an absolute one would be a rooted path on
		// one platform and a drive-lettered one on the other, and only the relative form is
		// classified the same way by the resolver on both. CI gates Windows.
		const specifier = relative(dir, join(REPO, 'scripts', 'docs-markdown.mjs')).replaceAll('\\', '/');
		try {
			writeFileSync(
				probe,
				[
					`import { headings } from '${specifier}';`,
					`headings(42, 2);`,
					`headings('ok', 'two');`,
					`headings();`,
				].join('\n'),
			);
			const program = ts.createProgram([probe], { ...config.options, noEmit: true });
			const codes = ts
				.getPreEmitDiagnostics(program)
				.filter((d) => d.file?.fileName === probe.replaceAll('\\', '/'))
				.map((d) => d.code)
				.sort();
			// 2345 is "argument of type X is not assignable", 2554 is "expected N arguments".
			expect(codes).toEqual([2345, 2345, 2554]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 20_000);
});
