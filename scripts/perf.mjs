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
 *   npm run perf -- --axis=dates           the roadmap's dated grid rather than its buckets
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
 *
 * The FIRST `=` only. A value may contain one — `--against=/tmp/build=control/.harness` is
 * a legal path — and splitting on every delimiter kept `/tmp/build`, which either fails to
 * load or measures a different directory that happens to exist. (Codex, PR #137.)
 */
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
	const flag = argv[i].replace(/^--/, '');
	const eq = flag.indexOf('=');
	const key = eq === -1 ? flag : flag.slice(0, eq);
	const next = argv[i + 1];
	if (eq !== -1) args[key] = flag.slice(eq + 1);
	else if (next !== undefined && !next.startsWith('--')) args[key] = argv[++i];
	else args[key] = 'true';
}

/**
 * Every flag this file reads, and a refusal for anything else.
 *
 * A typo used to be stored under its own key and ignored, so the run continued and
 * printed a plausible table for a command nobody meant: `--rums=4` measured once and
 * headed the table `1 run`, and `--no-buid` REBUILT `.harness` — over whatever had
 * deliberately been put there, which is the single thing `--no-build` exists to prevent.
 * Both are this file's own subject once more, and this is the last door it came through:
 * every earlier fix checked a value that had reached the right key. (Codex, PR #137.)
 *
 * A list rather than a derivation, and it is the one kind of list this register warns
 * about — it goes stale if a flag is added without touching it. That is accepted here
 * because the alternative is worse: `args` is a plain object, so "which keys are read"
 * cannot be asked of it, and a Proxy recording reads would refuse a typo only after the
 * work it should have prevented. The five lines below are the flags, in the order they
 * are read.
 */
const KNOWN = new Set(['notes', 'runs', 'against', 'window', 'fixture', 'axis', 'build', 'no-build']);
const unknown = Object.keys(args).filter((key) => !KNOWN.has(key));
if (unknown.length > 0) {
	console.error(`Unknown flag${unknown.length > 1 ? 's' : ''}: ${unknown.map((k) => `--${k}`).join(', ')}`);
	console.error(`Known: ${[...KNOWN].map((k) => `--${k}`).join(', ')}`);
	process.exit(1);
}

/**
 * `--flag=` with nothing after it, on ANY flag — one refusal rather than eight.
 *
 * Every flag reads its empty value as a different silence, and each one was found
 * separately: `Number('')` is 0, so `--notes=` passed the whole-number guard because zero
 * is legitimately askable, and the run measured the curated fixture alone; `--against=`
 * is falsy, so a requested comparison became a one-build table; `--fixture=` and
 * `--axis=` are falsy too and simply drop out of the query. None of them is a value
 * anybody could have meant, so the class is refused HERE, before a single flag is read.
 * Doing it per flag is what produced this finding twice. (Codex, PR #137.)
 */
const blank = Object.keys(args).filter((key) => args[key].trim() === '');
if (blank.length > 0) {
	console.error(`Empty value${blank.length > 1 ? 's' : ''}: ${blank.map((k) => `--${k}=`).join(', ')}`);
	process.exit(1);
}

/**
 * A flag that is only on or off: bare, `=true` or `=false`, and a refusal otherwise.
 *
 * `--no-build` was read by PRESENCE, so `--no-build=false` — the caller explicitly asking
 * for the build they were about to skip — skipped it anyway, and so did `--no-build=flase`.
 * Silently measuring a stale `.harness`, which is the same failure the flag's own earlier
 * bug had. Presence is not a boolean the moment `--k=v` is legal syntax. (Codex, PR #137.)
 */
function boolFlag(flag, value) {
	if (value === undefined) return null;
	if (value === 'true') return true;
	if (value === 'false') return false;
	console.error(`--${flag} takes no value, or true or false — got "${value}".`);
	process.exit(1);
}

/**
 * A whole number, or a refusal naming the value — the two size knobs share this because
 * they share the failure. `--notes=abc` reached the page as junk, which `wantedNotes`
 * reads as "no generated notes", and the run then printed `?notes=abc` over a table of
 * the curated fixture alone: measurements labelled for a workload nobody ran. `--runs=abc`
 * printed an empty table and exited 0. Both are this file's own subject — an instrument
 * answering confidently about something it did not measure. (Codex, PR #137.)
 */
function wholeNumber(flag, value, min) {
	const asked = Number(value);
	if (Number.isInteger(asked) && asked >= min) return asked;
	console.error(`--${flag} must be a whole number, at least ${min} — got "${value}".`);
	process.exit(1);
}

// Zero is a legitimate ask: the curated fixture on its own, which is what an omitted flag
// already measures. Junk and fractions are not.
const notes = String(wholeNumber('notes', args.notes ?? 800, 0));
// Both resolved here rather than at the build site, so a refusal lands before any other
// work and so neither is left unvalidated by the other's short circuit.
const wantsBuild = boolFlag('build', args.build);
const wantsNoBuild = boolFlag('no-build', args['no-build']);
const against = args.against ?? null;
/**
 * An ASKED-FOR comparison that names nothing is a refusal, never a single-build run.
 *
 * A bare `--against` at the end of the line leaves `'true'`, and every check below is a
 * truthiness test — so it turned comparison mode OFF and printed a perfectly ordinary
 * one-build table, the run the person did not ask for, with nothing saying so.
 * `--against=` is the same silence and is refused one block up, with the rest of its
 * class. A path that is merely WRONG already fails loudly (the browser finds no perf data
 * and the run exits 1), which is why neither is chased further. (Codex, PR #137.)
 */
if (against === 'true') {
	console.error('--against needs the path of a second built harness — got no value.');
	console.error('  npm run perf -- --against ../base/.harness');
	process.exit(1);
}
// One run answers "what does it cost"; a COMPARISON off one run each is the mistake this
// register has now made twice — a difference smaller than the noise of its own terms,
// read as a finding. So a comparison starts at three and prints both sides' spreads.
// At least one: zero printed an EMPTY table and exited 0, `2.5` ran three times under a
// heading saying 2.5, and `Infinity` never came back.
const runs = wholeNumber('runs', args.runs ?? (against ? 3 : 1), 1);
/**
 * A viewport, because one is load-bearing rather than incidental: `content-visibility`
 * skips what is off screen, so a window twice as tall renders twice as many rows before
 * the browser stops. Chromium's headless default is 800x600; this states a size instead
 * of inheriting one, and prints it, so a number can be reproduced.
 *
 * Which is exactly why the value is checked. Chromium's switch is `w,h` and it IGNORES
 * anything it cannot parse — so `--window=1200x900`, the spelling a person is most likely
 * to type, silently measured the default 800x600 while the heading printed 1200x900. The
 * one number this table's own subject depends on, reported as something it was not.
 * (Codex, PR #137.)
 */
const wantedWindow = String(args.window ?? '1200,900');
const size = wantedWindow.split(',').map(Number);
if (size.length !== 2 || !size.every((n) => Number.isInteger(n) && n > 0)) {
	console.error(`--window must be WIDTH,HEIGHT in whole pixels — got "${wantedWindow}".`);
	process.exit(1);
}
/**
 * NORMALIZED, not the string that was typed. `1e3,900` and `1200.0,900` both pass the
 * check above — JavaScript reads them as whole numbers — and Chromium then ignores the
 * token it cannot parse and keeps its own default, under a heading printing what was
 * asked. Passing the parsed pair means what is printed is what is used, whatever spelling
 * arrived. (Codex, PR #137.)
 */
const window = size.join(',');

/**
 * No `--view`: it selected nothing this table measures.
 *
 * The run switches to the tree, times `update` and `render only` there, and then times a
 * switch to every projection in turn — so the projection a page opened on changed no
 * number in the table while heading it as though it had. `?view=` stays a PAGE knob, for
 * looking and for screenshots, which is what it was built for. `--axis` is different and
 * stays: the roadmap row draws whichever axis is active, so it really is the workload.
 * (Codex, PR #137.)
 */
const query = new URLSearchParams({ notes, perf: '' });
if (args.fixture) query.set('fixture', args.fixture);
if (args.axis) query.set('axis', args.axis);
const search = `?${query.toString().replace(/=$/, '').replace(/=&/, '&')}`;

/**
 * Playwright's own builds, newest first — `headless_shell` before the full Chrome, and
 * every platform's spelling of both. Windows was absent from all three lists until review
 * pointed it out: its Playwright builds live under `chrome-win` with `.exe` names, in a
 * cache root neither of the two here, and a PATH lookup for `chromium` finds nothing
 * without the extension. So `npm run perf` reported "No Chromium found" on a machine that
 * had one by either advertised route. UNVERIFIED, here and for macOS beside it — this
 * container is the only platform the search has ever been run on, and CI does not run this
 * script at all. (Codex, PR #137.)
 */
const BUNDLED = [
	'chrome-linux/headless_shell',
	'chrome-linux/chrome',
	'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
	'chrome-win/headless_shell.exe',
	'chrome-win/chrome.exe',
];
const NAMES = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
const INSTALLED = process.platform === 'win32' ? NAMES.map((name) => `${name}.exe`) : NAMES;

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
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? '';
/**
 * Where Playwright puts its downloads, per platform — this container's first, then the
 * Linux, macOS and Windows defaults its own docs name. Two of the three arrived only
 * because review asked for them in turn: the macOS LEAF was in `BUNDLED` from the start
 * while its ROOT was missing, which is the shape of gap a list like this hides — the
 * entry looks covered because its other half is there. (Codex, PR #137.)
 */
const PW_ROOTS = [
	'/opt/pw-browsers',
	path.join(HOME, '.cache/ms-playwright'),
	path.join(HOME, 'Library/Caches/ms-playwright'),
	path.join(process.env.LOCALAPPDATA ?? path.join(HOME, 'AppData/Local'), 'ms-playwright'),
];
const PATH_DIRS = (process.env.PATH ?? '').split(path.delimiter);

function candidates() {
	if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];
	const bundled = PW_ROOTS.flatMap(under).flatMap((dir) => BUNDLED.map((leaf) => path.join(dir, leaf)));
	const onPath = PATH_DIRS.flatMap((dir) => INSTALLED.map((name) => path.join(dir, name)));
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

/**
 * Build unless told not to, in either spelling: `--no-build` is what this file's own
 * examples used while the code read `--build`, so the documented flag rebuilt `.harness`
 * anyway — over whatever had deliberately been put there to measure. Both go through
 * `boolFlag`, so each answers true, false or a refusal rather than "was it typed".
 * (Codex, PR #137.)
 */
if (wantsBuild !== false && wantsNoBuild !== true) {
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

/**
 * Both middle samples when there are two of them. `--runs=4` is this file's own documented
 * form, and picking the upper middle there reported 500 for 100/101/500/501 — biasing each
 * side of an `--against` comparison and the delta between them. (Codex, PR #137.)
 */
const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
/**
 * The run-to-run range, at the SAME precision as the median beside it.
 *
 * It was whole milliseconds, which reads fine at 300 ms and destroys the column's whole
 * purpose below 1: a real 0.1–0.4 printed as `0–0`, so the one number a reader consults
 * to decide whether a delta is noise said there was none. Small workloads are supported
 * and documented — `--notes=0`, `--fixture=edges` — so this is a case the tool offers,
 * not an edge it stumbles into. One decimal throughout rather than a precision that
 * scales with magnitude: the spread is read AGAINST the median, and two columns rounded
 * differently cannot be compared by eye. (Codex, PR #137.)
 */
const spread = (values) => `${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`;

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
/** Ops where the two builds did not draw the same thing — see the warning below. */
const unlike = [];
/**
 * Ops one build has and the other does not — a renamed or added row. The baseline's
 * median was `NaN` and its delta `NaN%` with nothing said, and an op only the BASELINE
 * has was dropped from the table entirely, so the comparison read as complete.
 * (Codex, PR #137.)
 */
const unmatched = !against
	? []
	: [
			...[...left.keys()].filter((op) => !right.has(op)).map((op) => `${op} (only in this build)`),
			...[...right.keys()].filter((op) => !left.has(op)).map((op) => `${op} (only in the baseline)`),
		];
for (const [op, { drew, times }] of left) {
	// The RAW medians are kept beside the rounded ones, because the delta is computed from
	// them: taking it from the printed columns divided two numbers already flattened to one
	// decimal, so on a small workload — `--notes=0`, `--fixture=edges` — 0.04 against 0.06
	// printed as 0 and 0.1 and reported `Infinity%`, and closer pairs reported 0% over a
	// real difference. Round for the reader, never for the arithmetic. (Codex, PR #137.)
	const ms = median(times);
	const otherTimes = against ? right.get(op)?.times : undefined;
	const otherMs = otherTimes ? median(otherTimes) : null;
	const row = { op, drew, ms: +ms.toFixed(1), spread: spread(times) };
	if (against) {
		const other = right.get(op);
		// An em dash rather than a number wherever there is nothing to compare with: `NaN%`
		// in a delta column is a value a reader has to interpret, and every reading is wrong.
		row.against = otherMs === null ? '—' : +otherMs.toFixed(1);
		// Beside the delta, never behind it: two medians whose spreads overlap have no
		// delta worth reading, and the only way a reader can see that is if both are here.
		row.againstSpread = other ? spread(other.times) : '—';
		// And the baseline's own SAMPLE, for the same reason one level up: two builds can
		// draw different populations — one before a change that adds or hides cards — and
		// a delta between unlike workloads reads exactly like a speedup. (Codex, PR #137.)
		row.againstDrew = other ? other.drew : '—';
		// A zero baseline is the one case raw numbers do not rescue — a percentage of nothing
		// is not a quantity — so it takes the same em dash as a missing one.
		row.delta = otherMs ? `${(((ms - otherMs) / otherMs) * 100).toFixed(0)}%` : '—';
		if (other && other.drew !== drew) unlike.push(`${op} (${drew} vs ${other.drew})`);
	}
	table.push(row);
}

/**
 * What the page says it MOUNTED, not what was typed at it.
 *
 * `?fixture=edegs` mounts the demo and `?axis=date` picks no axis — the page absorbs both
 * silently, so a heading built from the query string labelled the table with a workload
 * nobody ran. The vocabularies stay where they are enforced rather than being copied here
 * to go stale; the page reports what it resolved and this prints THAT, and says so when
 * the two disagree. (Codex, PR #137.)
 */
const ran = a[0]?.ran;
const asked = { fixture: args.fixture ?? 'demo', axis: args.axis };
/**
 * And the BASELINE's own resolved workload, which is a second question with the same
 * shape: the two builds can absorb one flag differently — the newer knows an axis the
 * older ignores — and then equal `drew` counts prove nothing, because they can be equal
 * across two different projections. Its absence is reported too: a baseline built before
 * the page reported this at all cannot say what it drew, and silence there is exactly the
 * assumption this whole block exists to refuse. (Codex, PR #137.)
 */
const ranAgainst = b[0]?.ran;
/**
 * `results` is in this list, not just the fixture NAME: two builds can mount different
 * populations under one name — a fixture that gained notes between them — and `drew`
 * does not cover it, since it counts what was RENDERED and a hidden result or a child
 * inside an existing card moves no count. `contents` is in the list for the same reason
 * one level down: the same NUMBER of results can be a different hierarchy, different
 * fields or a different generated shape, and then every count matches while the work does
 * not. A field the baseline is too old to publish reads as "not reported" rather than as
 * agreement. (Codex, PR #137.)
 */
// `grid` is here because the two grid axes derive their span from the reader's own
// calendar date: the same build measured on two dates, or one A/B run crossing midnight,
// draws a different grid while every other field compares equal. It is `grid` and not
// `window`, which in this file is the viewport flag. (Codex, PR #137.)
const WORKLOAD = ['fixture', 'results', 'contents', 'projection', 'axis', 'grid'];
const show = (value) => (value === undefined ? 'not reported' : String(value));
const differs = !against || !ran || !ranAgainst ? [] : WORKLOAD.filter((key) => ran[key] !== ranAgainst[key]);
const baselineWorkload = !against
	? []
	: !ranAgainst
		? ['the baseline does not report what it mounted — it was built before the page said so']
		: differs.map((key) => `${key}: ${show(ran[key])} here, ${show(ranAgainst[key])} in the baseline`);
/**
 * The same comparison ACROSS runs, on each side, because run 1 is not the run.
 *
 * `ran` and `ranAgainst` are the first result's, and a multi-run comparison can cross
 * midnight after its first pair: later samples then draw a different grid, every timing is
 * pooled into one median, and the heading states the span the run STARTED on. Checking two
 * builds against each other while trusting each to be constant within itself is the same
 * assumption this whole block exists to refuse, one level in. (Codex, PR #137.)
 *
 * Against run 1 rather than pairwise: the drift is chronological, so naming the first run
 * that moved is what a reader needs, and n comparisons say it where n² would repeat it.
 */
const drift = (results, side) =>
	results.flatMap((result, i) => {
		if (i === 0) return [];
		const moved = WORKLOAD.filter((key) => result.ran?.[key] !== results[0].ran?.[key]);
		if (moved.length === 0) return [];
		const said = moved.map((key) => `${key} ${show(results[0].ran?.[key])} → ${show(result.ran?.[key])}`);
		return [`${side} run ${i + 1}: ${said.join(', ')}`];
	});
const drifted = [...drift(a, 'this build'), ...(against ? drift(b, 'the baseline') : [])];
const ignored = [
	ran && asked.fixture !== ran.fixture ? `--fixture=${asked.fixture} (mounted ${ran.fixture})` : '',
	ran && asked.axis !== undefined && asked.axis !== ran.axis ? `--axis=${asked.axis} (axis ${ran.axis ?? 'unpicked'})` : '',
].filter(Boolean);

// `ran.notes`, not the flag: the edge-case fixture ignores the size knob, so a request for
// 800 was printed over a handful of curated cases. (Codex, PR #137.)
// The GRID joins the heading on a dated or resources axis, and only there: it is derived
// from the reader's own calendar date, so it is a reproducibility fact rather than a
// detail — a table taken today and one taken next month are of different spans. Null on
// the horizon axis, which has no grid, so that heading is unchanged. (Codex, PR #137.)
const drawn = ran
	? `${ran.fixture}${ran.axis ? ` · ${ran.axis}` : ''}${ran.grid ? ` · ${ran.grid}` : ''} · ${ran.results} results`
	: search;
console.log(`\n${drawn}  ·  ${runs} run${runs === 1 ? '' : 's'}  ·  window ${window}  ·  ${path.basename(browser)}`);
if (against) console.log(`against ${against} (alternated, A B A B)`);
console.table(table);
// Loud, and not a refusal: "did this change cost anything" is a legitimate question to
// ask of two builds that draw different amounts, and only the person asking knows which
// question this run is. What must not happen is the delta being read as a speedup by
// someone who never saw that the workloads differed.
if (unlike.length > 0) {
	console.log(`\n!! The two builds drew DIFFERENT samples — the delta is not a like-for-like comparison:\n   ${unlike.join('\n   ')}`);
}
if (ignored.length > 0) {
	console.log(`\n!! The page did not use what was asked for — the table is of what it DID draw:\n   ${ignored.join('\n   ')}`);
}
if (drifted.length > 0) {
	console.log(`\n!! The workload CHANGED between runs — every timing above is pooled across both:\n   ${drifted.join('\n   ')}`);
}
if (baselineWorkload.length > 0) {
	console.log(`\n!! The two builds did not mount the same workload — the delta compares unlike things:\n   ${baselineWorkload.join('\n   ')}`);
}
if (unmatched.length > 0) {
	console.log(`\n!! The two builds do not time the same set of ops:\n   ${unmatched.join('\n   ')}`);
}
console.log('No Bases pass, no metadata cache, no vault I/O, no theme. Not what the plugin costs in a vault.');
console.log('`drew` is that row’s own sample — rows and cards on screen after the op, which differs per projection.');
