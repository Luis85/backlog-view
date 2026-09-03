import { describe, expect, it } from 'vitest';
import { baseRegister, checkRegister } from '../helpers/register';

/**
 * **Legal frontmatter, accepted** — the accept half of `checkerRejectsFrontmatter.test.ts`,
 * split out of `checkerAccepts.test.ts` by subject when that file reached its 450-line
 * budget, the same way the rejection groups were.
 *
 * It is the half that matters more here than in most groups, and the file it came from
 * says why: these rules refuse a **spelling**, and the legal spellings are on hundreds of
 * real notes — `parent: "[[...]]"` on most of them, a `source:` naming a pull request by
 * number on many. A rule that widened to the quoted forms would fail the register at once.
 *
 * **Green is not the assertion.** Every case here asserts an absence, which almost
 * anything produces. Break the rule the case is named after and watch it fail; if it stays
 * green it is testing something else. Two cases below were watched failing against the
 * pre-2026-09-02 regex reader for exactly that reason.
 */

describe('the gate accepts legal frontmatter', () => {
	it('accepts a quoted value holding a wikilink and a hash, which is how the register writes both', async () => {
		// The direction that matters more than the rejections beside it: this rule refuses a
		// SPELLING, and the legal spelling is everywhere in `docs/` — `parent: "[[...]]"` on
		// most notes, and a `source:` naming a pull request by number on many. A rule that
		// widened to the quoted forms would fail hundreds of real notes at once, which is
		// the failure this case exists to catch rather than the one above.
		const files = baseRegister();
		files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
			'status: Open\n',
			'status: Open\nsource: "Review of [[A slice]] (Codex, PR #114)"\n',
		);

		await expectAccepted(files);
	});
	it('accepts a quoted ADR date and a quoted order, which the line patterns used to refuse', async () => {
		// Two restrictions nothing in this repository states, removed on 2026-09-02 when
		// `frontmatter()` started parsing rather than matching lines. `^date:\s*\d{4}-…$`
		// could not see past a quote, and `Number('"30"')` is NaN — so `date: "2026-08-24"`
		// was "date is not YYYY-MM-DD" and `order: "30"` was "not a number", both of which
		// YAML and Obsidian read exactly as the unquoted form. Neither spelling is in
		// `docs/` today, which is the whole reason nothing noticed: this is the burn list's
		// own shape — a pattern imposing a naming rule nothing states — and the case is
		// here because removing a restriction needs a check that it stayed removed.
		const files = baseRegister();
		files['docs/adrs/0001-the-first-decision.md'] = files['docs/adrs/0001-the-first-decision.md'].replace(
			/^date: (.+)$/m,
			'date: "$1"',
		);
		files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
			/^order: (\d+)$/m,
			'order: "$1"',
		);

		await expectAccepted(files);
	});
	it('accepts a flow collection, which is legal YAML and changes type if quoted', async () => {
		// Three rounds of review found three legal flow forms this rule refused: a bare
		// collection, one holding a quoted hash, and — asserted here — one with a trailing
		// YAML comment, where the value no longer ends at its `]`. The check that refused
		// them is gone rather than narrowed a fourth time: measured against the seven notes
		// the rule has caught, it caught none the `[[` test does not already catch. Nothing
		// in `docs/` writes flow style, so only this case stands between the rule and a
		// fourth attempt at the same mistake.
		const files = baseRegister();
		files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
			'status: Open\n',
			'status: Open\naliases: [Backlog, Planning] # legacy names\n',
		);

		await expectAccepted(files);
	});
	it('accepts a hash where YAML reads it as content, not a comment', async () => {
		// The second over-refusal on the same rule (review, PR #232). ` #` opens a comment
		// only in a PLAIN scalar: a block scalar takes its body literally, and a flow
		// collection may hold a quoted string. Both are legal and neither is in `docs/`
		// today, so — like the flow case above — the corpus cannot imply this.
		const files = baseRegister();
		files['docs/requirements/Thing.md'] = files['docs/requirements/Thing.md'].replace(
			'status: Open\n',
			'status: Open\nsource: >\n  Review of PR #114, which found it\naliases: ["PR #114"]\n',
		);

		await expectAccepted(files);
	});
});

/** The same two-part assertion `checkerAccepts.test.ts` makes, and for the same reason. */
async function expectAccepted(files: Record<string, string>): Promise<void> {
	const result = await checkRegister(files);
	expect(result.problems, result.output).toEqual([]);
	expect(result.ok, result.output).toBe(true);
}
