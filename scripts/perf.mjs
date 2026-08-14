import { execFile, execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Read the harness's `?perf` panel from a headless browser, so the numbers can be taken
 * where there is no screen — this environment, a container, an SSH session.
 *
 * It ADDS no measurement. `test/harness/perf.ts` times the calls exactly as it always
 * has and publishes what it found as JSON; this drives the page, reads that, and does the
 * arithmetic across runs. Everything ADR 0020 refuses still holds: nothing here asserts,
 * nothing here is part of `npm run check`, and a threshold is not something to add later —
 * the panel's own last line about what is missing from these numbers is printed below
 * every table for the same reason.
 *
 * What it exists to stop is the hand-rolled version. Getting one A/B out of this harness
 * meant a shell loop around `--dump-dom`, a grep over the panel's markup and a throwaway
 * script for the medians — three instruments to get wrong before the first number, and
 * the register already has two retracted findings from exactly that.
 *
 *   npm run perf                            one run at ?notes=800
 *   npm run perf -- --notes=1600 --runs=4   a bigger tree, four runs
 *   npm run perf -- --view=board --axis=dates
 *   npm run perf -- --against ../base/.harness    two builds, alternated
 *
 * **`--against` is what makes a comparison honest here**, and it takes a built harness
 * rather than a git ref on purpose: this environment's run-to-run swing is larger than
 * many of the differences worth reading, so the two builds are ALTERNATED within one loop
 * — A B A B — instead of measured an hour apart. Building the other side is one command
 * in a worktree and stays the human's, because a script that checked out a ref would be
 * moving the tree someone is working in:
 *
 *   git worktree add ../base main && cd ../base && npm ci && npm run harness
 */

/**
 * `--k=v`, and `--k v` too: the space form is how a path gets typed and how this file's
 * own examples read, and a parser that took only the first silently resolved `--against`
 * to the string "true" and then looked for a directory called that.
 */
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
	const [key, value] = argv[i].replace(/^--/, '').split('=');
	const next = argv[i + 1];
	if (value !== undefined) args[key] = value;
	else if (next !== undefined && !next.startsWith('--')) args[key] = argv[++i];
	else args[key] = 'true';
}

const notes = args.notes ?? '800';
const against = args.against ?? null;
// One run answers "what does it cost"; a COMPARISON off one run each is the mistake this
// register has now made twice — a difference smaller than the noise of its own terms,
// read as a finding. So a comparison starts at three and prints both sides' spreads.
const runs = Number(args.runs ?? (against ? 3 : 1));
// A viewport, because one is load-bearing rather than incidental: `content-visibility`
// skips what is off screen, so a window twice as tall renders twice as many rows before
// the browser stops. Chromium's headless default is 800x600; this states a size instead
// of inheriting one, and prints it, so a number can be reproduced.
const window = args.window ?? '1200,900';

const query = new URLSearchParams({ notes, perf: '' });
if (args.fixture) query.set('fixture', args.fixture);
if (args.view) query.set('view', args.view);
if (args.axis) query.set('axis', args.axis);
const search = `?${query.toString().replace(/=$/, '').replace(/=&/, '&')}`;

/** Playwright's own builds, newest first — `headless_shell` before the full Chrome. */
const BUNDLED = ['chrome-linux/headless_shell', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'];
const INSTALLED = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];

const runnable = (file) => {
	try {
		accessSync(file, constants.X_OK);
		return true;
	} catch {
		return false;
	}
};

const under = (dir) => (existsSync(dir) ? readdirSync(dir).sort().reverse() : []).map((entry) => path.join(dir, entry));

/**
 * Every Chromium worth trying, in the order to try it — `CHROME_PATH` first, then
 * Playwright's downloads, then the PATH.
 *
 * A list rather than a search: the nested loops this replaced were the one function in
 * this file `npm run analyze` failed on, at 12 cyclomatic and no coverage, for a job whose
 * whole content is "these places, in this order".
 */
function candidates() {
	if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];
	const roots = ['/opt/pw-browsers', path.join(process.env.HOME ?? '', '.cache/ms-playwright')];
	const bundled = roots.flatMap(under).flatMap((dir) => BUNDLED.map((leaf) => path.join(dir, leaf)));
	const onPath = (process.env.PATH ?? '')
		.split(path.delimiter)
		.flatMap((dir) => INSTALLED.map((name) => path.join(dir, name)));
	return [...bundled, ...onPath];
}

/**
 * `headless_shell` is Playwright's headless-only build and takes no `--headless`; a full
 * Chrome needs the flag. Which one was found therefore decides the arguments, so the two
 * travel together rather than being decided twice.
 */
const browser = candidates().find(runnable) ?? null;
if (browser === null) {
	console.error('No Chromium found. Set CHROME_PATH to one, or install Playwright’s (npx playwright install chromium).');
	process.exit(1);
}

/** Build unless told not to — `--no-build` when alternating against a tree already built. */
if (args.build !== 'false') {
	execFileSync(process.execPath, ['scripts/harness.mjs'], { stdio: 'inherit' });
}

/**
 * One page load, and the numbers it published.
 *
 * `--dump-dom` prints the page after load, which is all this needs: the run is synchronous
 * inside the load event, so the JSON is there by the time the DOM is serialized. Stderr is
 * dropped — a sandboxed Chromium narrates its missing D-Bus at length and none of it is
 * about the page.
 */
function measure(dir) {
	const url = pathToFileURL(path.resolve(dir, 'index.html')).href + search;
	return new Promise((resolve, reject) => {
		execFile(
			browser,
			[
				...(browser.endsWith('headless_shell') ? [] : ['--headless']),
				'--no-sandbox',
				'--disable-gpu',
				`--window-size=${window}`,
				'--dump-dom',
				url,
			],
			{ maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000 },
			(err, stdout) => {
				if (err && !stdout) return reject(err);
				const found = stdout.match(/id="pbl-perf-data"[^>]*>([\s\S]*?)<\/script>/);
				if (!found) return reject(new Error(`no perf data in the page — did it fail to load? ${url}`));
				resolve(JSON.parse(found[1]));
			},
		);
	});
}

const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
const spread = (values) => `${Math.min(...values).toFixed(0)}–${Math.max(...values).toFixed(0)}`;

/** Op → the per-run medians, in the order the runs happened. */
function collect(results) {
	const byOp = new Map();
	for (const result of results) {
		for (const row of result.rows) {
			if (!byOp.has(row.op)) byOp.set(row.op, { drew: row.drew, times: [] });
			byOp.get(row.op).times.push(row.median);
		}
	}
	return byOp;
}

const table = [];
const a = [];
const b = [];
for (let run = 0; run < runs; run++) {
	// Alternated rather than run in blocks: this environment drifts, and the same build
	// has measured 306ms and 570ms hours apart on one machine.
	a.push(await measure('.harness'));
	if (against) b.push(await measure(against));
}

const left = collect(a);
const right = collect(b);
for (const [op, { drew, times }] of left) {
	const row = { op, drew, ms: +median(times).toFixed(1), spread: spread(times) };
	if (against) {
		const other = right.get(op);
		const base = other ? median(other.times) : NaN;
		row.against = +base.toFixed(1);
		// Beside the delta, never behind it: two medians whose spreads overlap have no
		// delta worth reading, and the only way a reader can see that is if both are here.
		row.againstSpread = other ? spread(other.times) : '';
		row.delta = `${(((row.ms - base) / base) * 100).toFixed(0)}%`;
	}
	table.push(row);
}

console.log(`\n${search}  ·  ${runs} run${runs === 1 ? '' : 's'}  ·  window ${window}  ·  ${path.basename(browser)}`);
if (against) console.log(`against ${against} (alternated, A B A B)`);
console.table(table);
console.log('No Bases pass, no metadata cache, no vault I/O, no theme. Not what the plugin costs in a vault.');
console.log('`drew` is that row’s own sample — rows and cards on screen after the op, which differs per projection.');
