import esbuild from 'esbuild';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assembleStyles } from './styles-assemble.mjs';

/**
 * Build a page that renders the real view in a browser, with no Obsidian.
 *
 * `test-build.mjs` beside this one exists so a HUMAN can look at the plugin — it needs a
 * vault, the app, and a GUI to open it in. This is the same need for a session that has
 * a browser and no Obsidian: bundle `ProductBacklogView` against the module mock and the
 * fake vault the test suite already uses, hand it the real assembled stylesheet, and
 * write a static page.
 *
 * What it is not: a test. Nothing here asserts what gets drawn, there is no baseline to
 * diff against, and it is deliberately outside `npm run check` — see ADR 0020. The
 * check that keeps the harness alive is `test/harness/harness.test.ts`, which vitest
 * already runs.
 *
 * The output is a build artifact, gitignored like `main.js` and `.obsidian/`.
 */

const OUT = '.harness';

await mkdir(OUT, { recursive: true });

await esbuild.build({
	entryPoints: ['test/harness/page.ts'],
	bundle: true,
	// A page opened over file:// cannot load ES modules (the browser treats every file
	// as a distinct opaque origin), and an IIFE needs no server to exist for it.
	format: 'iife',
	target: 'es2020',
	// The types-only 'obsidian' package, resolved to the same runtime stand-in
	// `vitest.config.mts` points the suite at. One mock, two consumers.
	alias: { obsidian: './test/helpers/obsidian-mock.ts' },
	// pragmatic-drag-and-drop's development branch keeps its warnings, which is what you
	// want in the thing you are debugging in.
	define: { 'process.env.NODE_ENV': '"development"' },
	sourcemap: 'inline',
	outfile: path.join(OUT, 'harness.js'),
	logLevel: 'info',
});

// The plugin's own stylesheet, assembled from the partials exactly as the build and the
// vault install do — so what is on screen is the CSS being edited, never a stale copy.
await writeFile(path.join(OUT, 'styles.css'), assembleStyles());
// Obsidian's variables, which the partials read and do not define. Approximations: see
// the file's own header, and do not read a colour here as a colour a user sees.
await copyFile('test/harness/theme.css', path.join(OUT, 'theme.css'));

await writeFile(
	path.join(OUT, 'index.html'),
	`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Product Backlog — harness</title>
		<link rel="stylesheet" href="theme.css" />
		<link rel="stylesheet" href="styles.css" />
	</head>
	<body>
		<script src="harness.js"></script>
	</body>
</html>
`,
);

console.log(`\nOpen ${pathToFileURL(path.resolve(OUT, 'index.html')).href}`);
console.log('The toolbar switches tree, board and roadmap; ?view=board and ?view=roadmap open into one.');
console.log('Every action is the view’s own. The menu and dialog WIDGETS are the harness’s stand-ins.');
console.log(
	'Colours are approximations of Obsidian’s, and so is any layout a partial leans on an Obsidian element default for — see test/harness/theme.css and test/CLAUDE.md.',
);
