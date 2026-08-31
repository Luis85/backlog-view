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
