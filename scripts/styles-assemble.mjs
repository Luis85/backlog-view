import { readFileSync, readdirSync } from 'node:fs';

/**
 * Assemble `styles/index.css` and its partials into the single stylesheet Obsidian
 * loads. The root `styles.css` is this function's output written to disk — a build
 * artifact, gitignored beside `main.js`, and NOT a file to edit.
 *
 * Obsidian injects a plugin's `styles.css` as one blob, so a runtime `@import` would
 * resolve against the app rather than the plugin folder. The imports in the entry file
 * are therefore a build instruction, and this is the build: concatenation in the stated
 * order, which is the whole of it because the order is the only thing CSS assembly has
 * to get right.
 *
 * Both callers that put a stylesheet somewhere go through here (`esbuild.config.mjs`
 * for the root file and the minified `dist/` copy, `test-build.mjs` for the vault), and
 * so does `test/view/rendering.test.ts`, which is why the suite needs no build to have
 * run first and cannot read a stale one.
 *
 * Resolving the imports here rather than in a bundler is also why `.fallowrc.json`
 * seeds `styles/**` as `dynamicallyLoaded`: the graph runs through this function, which
 * no static analyser walks. Fallow therefore cannot report an unimported partial, so
 * this does — see the check below.
 */

// Relative to the WORKING DIRECTORY, not to this file — which is worth saying twice now
// that this file lives in `scripts/` and `styles/` does not. npm scripts and vitest both
// run from the repository root, and every other build script here resolves the same way
// (`main.js`, `dist/`). `import.meta.url` would be the more robust spelling and is not
// available: vitest's jsdom environment gives this module a non-file URL, and that is
// where the tests read it from.
const DIR = 'styles/';

// The cap `eslint.config.mjs` holds every TypeScript module to. Splitting a file that
// nothing measures leaves it split only until someone appends to it.
const MAX_LINES = 400;

const IMPORT = /^@import\s+"\.\/([\w.]+\.css)";$/gm;

export function assembleStyles() {
	const entry = readFileSync(`${DIR}index.css`, 'utf8');
	const imported = [...entry.matchAll(IMPORT)].map((match) => match[1]);

	// An unimported partial is silently absent from the shipped sheet — the one failure
	// mode of a split that a stylesheet cannot report and a screenshot barely can.
	const present = readdirSync(DIR).filter((name) => name.endsWith('.css') && name !== 'index.css');
	const missing = present.filter((name) => !imported.includes(name));
	if (missing.length > 0) {
		throw new Error(`styles/index.css does not import: ${missing.join(', ')}`);
	}

	const parts = imported.map((name) => {
		const body = readFileSync(DIR + name, 'utf8');
		const lines = body.split('\n').length;
		if (lines > MAX_LINES) throw new Error(`styles/${name} is ${lines} lines, over the ${MAX_LINES}-line cap`);
		return `/* === styles/${name} === */\n\n${body.trim()}\n`;
	});

	return `/*
THIS FILE IS GENERATED from styles/ by styles-assemble.mjs — edit the partial, not this.
The import order in styles/index.css is load-bearing and states why.
*/\n\n${parts.join('\n')}`;
}
