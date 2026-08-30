import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * **Who the Markdown gate reads, and under which rule set.**
 *
 * `npm run lint:md` gates two populations with two rule sets: the CONTRIBUTOR's full set
 * over the root documents, `.github/` and the three skills this repository wrote, and
 * `docs/.markdownlint.jsonc`'s four rules over the vault the backlog owner types into.
 * ADR 0032 is the decision; `.markdownlint-cli2.jsonc` and `docs/.markdownlint.jsonc` are
 * the two files that carry it.
 *
 * **Nothing read either file until this test.** The split rests on two behaviours of
 * `markdownlint-cli2` — a nested config REPLACES the root set rather than merging into it,
 * and a `!.claude` exclusion can be re-included by a later, narrower glob — and
 * `markdownlint-cli2` is in Dependabot's auto-merged `dev-minor` group. Either behaviour
 * changing quietly turns `main` red for the backlog owner, or un-lints the three own
 * skills, and `npm run check` stays green in both directions because the only thing that
 * knew the intent was a comment. `test/docs/checkerAccepts.test.ts` and its rejects sibling
 * make exactly this argument about `docs-check.mjs`.
 *
 * So the tree below is planted rather than described. Each file carries **two** violations:
 * `MD011`, a reversed link, which is in both sets, and `MD034`, a bare URL, which is in the
 * contributor's set and deliberately not in the owner's. What each location reports is what
 * the scope decision says it should.
 */

const REPO = resolve(__dirname, '../..');
const CLI = join(REPO, 'node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs');

const BOTH = '# Title\n\nA (reversed)[https://example.com/a] link.\n\nhttps://example.com/bare\n';

const TREE: Record<string, string> = {
	'README.md': BOTH,
	'docs/A note.md': BOTH,
	'docs/superpowers/plans/A plan.md': BOTH,
	'.claude/skills/resolve-pbi/SKILL.md': BOTH,
	'.claude/skills/vendored/SKILL.md': BOTH,
	'.github/CONTRIBUTING.md': BOTH,
};

const root = mkdtempSync(join(tmpdir(), 'md-scope-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

for (const [path, body] of Object.entries(TREE)) {
	mkdirSync(join(root, path, '..'), { recursive: true });
	writeFileSync(join(root, path), body);
}
copyFileSync(join(REPO, '.markdownlint-cli2.jsonc'), join(root, '.markdownlint-cli2.jsonc'));
copyFileSync(join(REPO, 'docs/.markdownlint.jsonc'), join(root, 'docs/.markdownlint.jsonc'));

/** Rule names reported per file, from one run over the planted tree. */
function lint(): Map<string, Set<string>> {
	let output = '';
	try {
		output = execFileSync(process.execPath, [CLI], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
	} catch (error) {
		const failure = error as { stdout?: string; stderr?: string };
		output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
	}
	const found = new Map<string, Set<string>>();
	for (const line of output.split('\n')) {
		const match = /^(.+?):\d+(?::\d+)? error (MD\d+)\//.exec(line);
		if (!match) continue;
		const file = match[1].replace(/\\/g, '/');
		if (!found.has(file)) found.set(file, new Set());
		found.get(file)?.add(match[2]);
	}
	return found;
}

const reported = lint();
const rulesFor = (path: string): string[] => [...(reported.get(path) ?? [])].sort();

describe('the Markdown gate reads what a person maintains', () => {
	it.each(['README.md', '.github/CONTRIBUTING.md', '.claude/skills/resolve-pbi/SKILL.md'])(
		"%s is read under the contributor's full set",
		(path) => {
			expect(rulesFor(path)).toEqual(['MD011', 'MD034']);
		},
	);

	it('the vault is read under its own four rules, and the root set does not reach it', () => {
		// The nested config REPLACES rather than merges: MD011 is one of the four, MD034 is
		// not, and a merge would report both.
		expect(rulesFor('docs/A note.md')).toEqual(['MD011']);
	});

	it.each(['docs/superpowers/plans/A plan.md', '.claude/skills/vendored/SKILL.md'])(
		'%s is excluded, so nothing is reported for it',
		(path) => {
			expect(rulesFor(path)).toEqual([]);
		},
	);

	it('the planted violations are the instrument, so the run found something', () => {
		// Without this the four assertions above pass on a run that linted nothing at all —
		// a wrong glob, a moved binary, an output format this parser cannot read.
		expect([...reported.keys()].sort()).toEqual([
			'.claude/skills/resolve-pbi/SKILL.md',
			'.github/CONTRIBUTING.md',
			'README.md',
			'docs/A note.md',
		]);
	});
});
