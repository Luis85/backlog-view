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
 * the rules `docs/.markdownlint.jsonc` keeps over the vault the backlog owner types into.
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

/**
 * Every construct <https://obsidian.md/help/syntax>, its callouts page and its
 * Obsidian-Flavored-Markdown page document, in one note. The owner's set must report
 * NOTHING on it: this is what "a note the owner types is not held to Markdown style" means,
 * and it was a comment until this fixture existed.
 *
 * The contributor assertion below is what stops that from being vacuous. Under `default:
 * true` this note draws SEVEN findings from four rules, every one on a shape Obsidian's own
 * documentation prints as correct: MD032 on the list inside a callout (the multi-paragraph
 * callout example verbatim), MD028 on the blank line between two callouts, and MD007 with
 * MD010 on Tab-indented nesting, which the syntax page names as THE way to nest.
 *
 * The contributor's set reports **three** of those four rather than all four, and the
 * difference is the point of asserting the exact list: MD028 is already off at the root, for
 * the consecutive quoted examples in `docs/product/Product Definition Playbook.md`. So the
 * silence under `docs/` is a rule set choosing not to fire, not a fixture with nothing in
 * it — and this assertion is measured against the config as it stands rather than against
 * what a comment claims it contains.
 */
const OBSIDIAN = [
	'# A note written the Obsidian way',
	'',
	'A link [[Another note]], an alias [[Another note|shown]], an embed ![[Another note]]',
	'and a sized image ![[Engelbart.jpg|200]] with a block reference ![[Another note#^abc]].',
	'',
	'This paragraph is a block. ^abc',
	'',
	'%%A comment.%% Some ==highlight==, ~~strikethrough~~ and a #tag.',
	'',
	'> [!info]',
	'> A callout.',
	'>',
	'> A second paragraph.',
	'> - a list inside the callout',
	'> - a second item',
	'',
	'> [!faq]- A foldable callout',
	'> Hidden until expanded.',
	'',
	'> [!question] Outer',
	'> > [!todo] Nested',
	'',
	'- [ ] An incomplete task',
	'- [x] A complete task',
	'\t- A child indented with a Tab',
	'\t\t- A grandchild indented with two',
	'',
	'A footnote[^n] and an inline one ^[shown in reading view].',
	'',
	'[^n]: The footnote text.',
	'',
	'| Link | Image |',
	'| --- | --- |',
	'| [[A note\\|shown]] | ![[Engelbart.jpg\\|200]] |',
	'',
	'Inline math $e^{2i\\pi} = 1$ and a block:',
	'',
	'$$\\begin{vmatrix}a & b\\\\ c & d\\end{vmatrix}=ad-bc$$',
	'',
	'```mermaid',
	'sequenceDiagram',
	'Alice->>+John: Hello',
	'```',
	'',
].join('\n');

const TREE: Record<string, string> = {
	'README.md': BOTH,
	'docs/A note.md': BOTH,
	'docs/superpowers/plans/A plan.md': BOTH,
	'.claude/skills/resolve-pbi/SKILL.md': BOTH,
	'.claude/skills/vendored/SKILL.md': BOTH,
	'.github/CONTRIBUTING.md': BOTH,
	'docs/Obsidian syntax.md': OBSIDIAN,
	'An Obsidian note a contributor maintains.md': OBSIDIAN,
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

	it('the vault is read under its own rule set, and the root set does not reach it', () => {
		// The nested config REPLACES rather than merges: MD011 is one of them, MD034 is
		// not, and a merge would report both.
		expect(rulesFor('docs/A note.md')).toEqual(['MD011']);
	});

	it.each(['docs/superpowers/plans/A plan.md', '.claude/skills/vendored/SKILL.md'])(
		'%s is excluded, so nothing is reported for it',
		(path) => {
			expect(rulesFor(path)).toEqual([]);
		},
	);

	it('the vault reports nothing on every construct Obsidian documents', () => {
		// Wikilinks, aliases, embeds, block references, comments, highlights, callouts in
		// all three forms, footnotes, task lists, Tab nesting, math and Mermaid. ADR 0032.
		expect(rulesFor('docs/Obsidian syntax.md')).toEqual([]);
	});

	it("the same note is not silent under the contributor's set, so the fixture is live", () => {
		// Without this, the assertion above passes on an empty file. Each of these fires on
		// a shape Obsidian's own documentation prints as correct — which is why the vault
		// does not carry them, and why a contributor file is a different question.
		expect(rulesFor('An Obsidian note a contributor maintains.md')).toEqual([
			'MD007',
			'MD010',
			'MD032',
		]);
	});

	it('the planted violations are the instrument, so the run found something', () => {
		// Without this the four assertions above pass on a run that linted nothing at all —
		// a wrong glob, a moved binary, an output format this parser cannot read.
		expect([...reported.keys()].sort()).toEqual([
			'.claude/skills/resolve-pbi/SKILL.md',
			'.github/CONTRIBUTING.md',
			'An Obsidian note a contributor maintains.md',
			'README.md',
			'docs/A note.md',
		]);
	});
});
