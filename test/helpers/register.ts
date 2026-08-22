import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it, vi } from 'vitest';

/**
 * A whole miniature repository, handed to the real `docs-check.mjs`.
 *
 * The gate is a **script**, not a module: top-level await, paths relative to the working
 * directory, `process.exit` for its verdict. So it is run the way CI runs it — as a
 * subprocess over a tree — rather than refactored into something importable. That is not
 * a compromise. A checker tested through a seam built for the test is a checker whose
 * seam is what got tested, and this one's whole job is to be right about a directory on
 * disk; the thing under test here is the file `npm run docs` actually executes.
 *
 * The tree needs `src/` and `test/` as well as `docs/`, because the gate's last rule
 * reads them: every module must be named by at least one note.
 */

/**
 * A real budget for every case in the five files that import this, because every one of
 * them WRITES A TREE TO DISK AND SPAWNS NODE — a cost of its own, unlike anything else in
 * this suite, and one the 5s default was never chosen for. Under whole-suite contention
 * the first case in each file is the one that pays for the cold spawn, and those are
 * exactly the five that started timing out as the suite grew; each passes in well under a
 * second when run alone. Slack for a subprocess, not licence for a slow check: a case that
 * genuinely needs 20s is planting a corpus far larger than a delta against `baseRegister`.
 *
 * Set here rather than per file because it is a fact about what this helper DOES, and a
 * timeout repeated at every call site is one a new file forgets.
 */
vi.setConfig({ testTimeout: 20_000 });

const run = promisify(execFile);
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(REPO, 'scripts', 'docs-check.mjs');

/** Relative path → file contents. */
export type Register = Record<string, string>;

export interface CheckResult {
	/** What `npm run docs` would exit with. */
	ok: boolean;
	/** One entry per reported problem, `where: message`, as the script prints them. */
	problems: string[];
	output: string;
}

/**
 * Write `files` into a throwaway tree and run the gate over it.
 *
 * Every case gets its own directory: these are tests about what a *repository* looks
 * like, and a shared one would let a note planted by one case answer a question asked
 * by another — which is the same cross-talk the gate exists to catch in the register.
 */
export async function checkRegister(files: Register): Promise<CheckResult> {
	const root = await mkdtemp(path.join(tmpdir(), 'register-'));
	try {
		for (const [relative, contents] of Object.entries(files)) {
			const full = path.join(root, relative);
			await mkdir(path.dirname(full), { recursive: true });
			await writeFile(full, contents, 'utf8');
		}
		return await execute(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

async function execute(root: string): Promise<CheckResult> {
	try {
		const { stdout, stderr } = await run(process.execPath, [CHECKER], { cwd: root });
		return { ok: true, problems: [], output: stdout + stderr };
	} catch (error) {
		// A non-zero exit is the gate's ordinary "no", not a harness failure — the
		// problems are on stderr and the rejection is how they arrive.
		const failed = error as { stdout?: string; stderr?: string; code?: unknown };
		if (typeof failed.code !== 'number') throw error;
		const output = (failed.stdout ?? '') + (failed.stderr ?? '');
		const problems = parseProblems(failed.stderr ?? '');
		// …but only when it actually reported. A run that exits non-zero WITHOUT printing
		// the report has crashed — an unhandled rejection, or a tree this helper wrote
		// wrong — and `parseProblems` finds nothing to read, so returning it as a verdict
		// hands back "no problems" for a checker that never reached a verdict. Every
		// accept case would then read a crash as acceptance. Thrown here rather than left
		// to each assertion, so a new call site cannot reopen the hole by omission.
		if (problems.length === 0) {
			throw new Error(`docs-check.mjs exited ${failed.code} without reporting problems:\n${output}`);
		}
		return { ok: false, problems, output };
	}
}

/**
 * The indented lines under the `✗ N problem(s):` header, which is the report's whole shape.
 *
 * Separators are normalized to `/` because the gate builds every path it reports with
 * `walk` and `path.join`, so on Windows it says `docs\adrs\0001-….md` where every
 * expectation in these suites is written with forward slashes. That would fail the whole
 * corpus on a Windows checkout for a verdict the checker got *right* — a false failure,
 * which this project already holds is the more expensive direction to get wrong, and one
 * CI cannot see because the workflow is Ubuntu-only. Normalized here rather than at each
 * of the ~80 assertions: the separator is the OS's, never the checker's answer, and a
 * per-case `path.join` would be eighty chances to forget one. Whole-line rather than just
 * the `where:` prefix, since a message body carries a path too (`no use case or ADR
 * specifies src/x.ts`).
 */
function parseProblems(stderr: string): string[] {
	const start = stderr.indexOf('problem(s):');
	if (start === -1) return [];
	return stderr
		.slice(start)
		.split('\n')
		.slice(1)
		.filter((line) => line.startsWith('  '))
		.map((line) => line.trim().replaceAll('\\', '/'));
}

/**
 * One planted violation: a name, the single edit that plants it, and the message the
 * gate must produce. Shared by the two rejection suites, which are split by subject
 * rather than by kind — the ADR rules alone outnumber every other group.
 */
export type RejectionCase = [name: string, plant: (files: Register) => void, expected: string];

/** Run a table of them, each against its own fresh copy of the valid corpus. */
export function runRejections(cases: RejectionCase[]): void {
	it.each(cases)('reports %s', async (_name, plant, expected) => {
		const files = baseRegister();
		plant(files);
		const result = await checkRegister(files);
		// A planted violation that produced a green run is the failure these suites exist
		// to catch, and it should say so before the message assertion reports "" instead.
		expect(result.ok, 'expected the gate to reject this document, but it passed').toBe(false);
		expect(result.problems.join('\n')).toContain(expected);
	});
}

/**
 * A valid register: one of every note kind the gate has rules for, and nothing it
 * objects to. Rebuilt per call so a case can edit its copy freely.
 *
 * Every test here is a delta against this, in both directions — a legal form added and
 * expected to pass, or a violation planted and expected to be named. The corpus being
 * genuinely green is therefore load-bearing rather than incidental, and
 * `checkerAccepts.test.ts` asserts it before asserting anything about a variation of it.
 */
/**
 * The hierarchy the register documents, which `docs-check.mjs` now checks against its own
 * `LEGAL_CHILDREN` rather than trusting. A valid register states it, so the corpus states
 * it: without this every planted tree fails as "the hierarchy is documented nowhere",
 * which is the checker being right about a fixture that was not a register.
 *
 * It is a LITERAL, deliberately, though it duplicates the gate's map. The test cannot
 * import `docs-check.mjs` — a script with top-level await and `process.exit` — and
 * generating it from the same source the check compares against would make the check
 * compare a thing with itself. The cost is that adding a type means editing here too; the
 * corpus fails loudly and by name when someone forgets, which is exactly the enforcement
 * this whole change is about.
 */
export function hierarchyTable(): string {
	return HIERARCHY_TABLE;
}

/** The same table with one type's row taken out, for the "the table omits it" case. */
export function withoutHierarchyRow(type: string): string {
	return HIERARCHY_TABLE.split('\n')
		.filter((line) => !line.startsWith(`| \`${type}\``))
		.join('\n');
}

const HIERARCHY_TABLE = [
	'| Type | Parent may be | Children may be |',
	'| --- | --- | --- |',
	'| `Epic` | *(nothing — it is a root)* | `Feature`, `Issue`, `Bug`, `Idea`, `Deliverable` |',
	'| `Feature` | `Epic` | `PBI`, `Issue`, `Bug`, `Idea`, `Deliverable` |',
	'| `PBI` | `Feature` | `Task`, `Issue`, `Bug`, `Idea`, `Deliverable` |',
	'| `Task` | `PBI`, `Issue`, `Bug`, `Idea`, `Deliverable`, `Test case` | *(nothing)* |',
	'| `Issue` / `Bug` / `Idea` / `Deliverable` | `Epic`, `Feature` or `PBI` | `Task` |',
	'| `Milestone` | *(nothing — a root by nature)* | *(nothing)* |',
	'| `Iteration` | *(nothing — a root by nature)* | *(nothing)* |',
	'| `Test suite` | *(nothing — a root by nature)* | `Test case` |',
	'| `Test case` | `Test suite` | `Task` |',
].join('\n') + '\n';

export function baseRegister(): Register {
	return {
		'docs/README.md': `# docs\n\nThe register.\n\n${HIERARCHY_TABLE}`,
		'docs/adrs/README.md': '# ADRs\n\n- [0001](0001-the-first-decision.md)\n',
		'docs/adrs/0001-the-first-decision.md': adr(1, 'the-first-decision'),
		'docs/requirements/Thing.md': note('Epic', 10, null, '# Thing\n\nWhy this exists.\n'),
		'docs/requirements/A slice.md': note('Feature', 10, 'Thing', '# A slice\n\n**Outcome** — it works.\n'),
		'docs/requirements/Doing the thing.md': useCase(),
		'src/thing.ts': 'export const thing = 1;\n',
		// A real test NAME, not a placeholder export: the `**Checked by**` rule resolves a
		// citation by looking for the quoted name inside the file it points at, so a corpus
		// whose tests had no names could only ever exercise that rule's failure direction.
		'test/thing.test.ts': "it('the thing works', () => {});\n",
	};
}

/** A backlog note: the three required fields, then whatever body is passed. */
export function note(type: string, order: number | string, parent: string | null, body: string): string {
	const lines = ['---', `type: ${type}`, `order: ${order}`];
	if (parent !== null) lines.push(`parent: "[[${parent}]]"`);
	lines.push('status: Open', '---', '', body);
	return lines.join('\n');
}

/** An ADR with every field and section the gate requires, plus any frontmatter overrides. */
export function adr(number: number, slug: string, extra: Record<string, string> = {}): string {
	const fields = {
		adr: String(number),
		title: slug.replace(/-/g, ' '),
		status: 'Accepted',
		date: '2026-08-01',
		area: 'tooling',
		...extra,
	};
	const front = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
	const sections = ['Context', 'Decision', 'Consequences', 'Alternatives', 'Revisit when']
		.map((heading) => `## ${heading}\n\nSomething.\n`)
		.join('\n');
	return ['---', ...front, '---', '', sections].join('\n');
}

/**
 * The use-case shape, with every part overridable — the rejection cases work by
 * replacing exactly one of them, so a planted violation is visibly one edit rather than
 * a rewritten note whose failure could come from anywhere in it.
 */
export function useCase(parts: Partial<UseCaseParts> = {}): string {
	const p = { ...DEFAULT_USE_CASE, ...parts };
	return note(
		'PBI',
		p.order,
		p.parent,
		[
			`# ${p.title}`,
			'',
			p.opening,
			'',
			p.useCase,
			'',
			'**Main flow**',
			'',
			p.mainFlow,
			'',
			'**Extensions**',
			'',
			p.extensions,
			'',
			'## Acceptance criteria',
			'',
			'- It happens.',
			'',
			'## Where it lives',
			'',
			p.whereItLives,
		].join('\n'),
	);
}

export interface UseCaseParts {
	title: string;
	order: number | string;
	parent: string | null;
	opening: string;
	useCase: string;
	mainFlow: string;
	extensions: string;
	whereItLives: string;
}

const DEFAULT_USE_CASE: UseCaseParts = {
	title: 'Doing the thing',
	order: 10,
	parent: 'A slice',
	opening: '**As** a user, **I want** the thing done **so that** the work is visible.',
	useCase: [
		'## Use case',
		'',
		'| Field | Value |',
		'| --- | --- |',
		'| **Actor** | A user |',
		'| **Trigger** | They ask for it |',
		'| **Preconditions** | The vault is open |',
		'| **Guarantee** | Nothing is written that cannot be taken back |',
	].join('\n'),
	mainFlow: '1. They ask for it.\n2. It happens.',
	extensions: '- **2a — it cannot happen** — the notice says why.',
	whereItLives: 'Lives in `src/thing.ts`, covered by `test/thing.test.ts`.',
};
