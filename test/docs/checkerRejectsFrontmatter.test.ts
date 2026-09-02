import { describe } from 'vitest';
import { runRejections } from '../helpers/register';

/**
 * **Planted violations: a frontmatter value YAML would not read as written.**
 *
 * Split from `checkerRejects.test.ts` by subject, the way the ADR, citation and hierarchy
 * groups were, and the same reason: that file is at its line budget and a group that has
 * its own subject belongs beside it rather than inside it.
 *
 * The subject is narrow and the gate says so itself. `frontmatter()` in `docs-check.mjs`
 * is a REGEX reader, so it answers `field("cadence")` for a block no YAML parser accepts —
 * which is how five notes reached `main` with frontmatter Obsidian cannot parse, and two
 * more that parse while silently meaning less than they say. A note whose block does not
 * parse has no `type` and no `cadence` in the metadata cache, so it is in no Bases query
 * and on no projection: `docs/tests/cases/The assignee chip and Set assignee.md` was
 * invisible to the very Tests projection it had just been written for, and the gate
 * reported it green. [[The register gate cannot see unparseable frontmatter]] is that gap,
 * and this closes the two spellings of it that have actually occurred rather than the
 * language.
 *
 * The accept direction matters more here than in most groups and lives in
 * `checkerAccepts.test.ts`: this rule refuses a SPELLING, and the legal spelling —
 * `parent: "[[...]]"`, a quoted `source:` naming a pull request — is on hundreds of real
 * notes. A rule that widened to the quoted forms would fail most of the register at once.
 */

describe('a frontmatter value YAML would not read as written', () => {
	// Two spellings, because these are the two that have actually reached `main`: five
	// notes whose frontmatter no YAML parser accepts, and two more that parse while
	// silently meaning less than they say. A note whose block does not parse has no `type`
	// and no `cadence` in Obsidian's cache, so it is in no Bases query and on no
	// projection — `docs/tests/cases/The assignee chip and Set assignee.md` was invisible
	// to the very Tests projection it had just been written for, and the regex reader in
	// `docs-check.mjs` reported it green.
	runRejections([
		[
			'an unquoted wikilink, which YAML reads as a nested list',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
					'status: Open\n',
					'status: Open\nsource: [[Another note]], and why\n',
				);
			},
			'opens with `[[`, so YAML reads the wikilink as a nested list',
		],
		[
			'an unquoted value whose hash opens a comment',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
					'status: Open\n',
					'status: Open\nsource: Review of PR #114, which found it\n',
				);
			},
			'starts a YAML comment',
		],
	]);
});

/**
 * **A block no YAML parser accepts**, which is the class the two spellings above were a
 * sample of. `frontmatter()` parses with `yaml` since 2026-09-02, so the gate's answer is
 * now the parser's own — see [[The register gate cannot see unparseable frontmatter]].
 *
 * Each case is a spelling **the two narrow rules above cannot see**, deliberately: a case
 * that both catch would pass on the older rule and prove nothing about the parse. The
 * duplicate key is the one that had actually reached `main` —
 * `docs/requirements/Editing a release from its own screen.md` carried `priority` twice
 * from 2026-08-29 and was invisible to Obsidian and green here for four days.
 *
 * **What this list is not.** It is a sample, not an enumeration of the ways YAML can be
 * refused, and the register has been burned by an enumerated list reading as complete. The
 * guarantee is the parser's, not this table's: whatever `yaml` refuses, the gate refuses,
 * and these three are evidence the call is wired up rather than a statement of its reach.
 */
describe('frontmatter no YAML parser accepts', () => {
	runRejections([
		[
			'a key given twice',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
					'status: Open\n',
					'status: Open\nstatus: Done\n',
				);
			},
			'frontmatter is not valid YAML, so Obsidian reads none of it — Map keys must be unique',
		],
		[
			'a quoted scalar that closes early',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
					'status: Open\n',
					'status: Open\nsource: "a stray " quote\n',
				);
			},
			'frontmatter is not valid YAML, so Obsidian reads none of it',
		],
		[
			'a value indented under nothing',
			(files) => {
				files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
					'status: Open\n',
					'status: Open\nsource: a value\n  continued: badly\n',
				);
			},
			'frontmatter is not valid YAML, so Obsidian reads none of it',
		],
		[
			// The parent link is read off the parsed VALUE and anchored at both ends since
			// 2026-09-02. The raw-text pattern it replaced could not be anchored — the block
			// continues past the line — so `"[[A]] and [[B]]"` matched its first link and the
			// gate ranked the note under `A`. Naming one of two parents is worse than
			// naming none, and this is the case that says which the gate now does.
			'a parent naming two notes',
			(files) => {
				files['docs/requirements/A slice.md'] = files['docs/requirements/A slice.md'].replace(
					'parent: "[[Thing]]"',
					'parent: "[[Thing]] and [[Doing the thing]]"',
				);
			},
			'Feature with no parent',
		],
	]);
});
