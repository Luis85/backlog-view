import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tablesWith } from '../../scripts/docs-markdown.mjs';
import { ALL_TYPES, RESOURCE_TYPE } from '../../src/domain/typeVocabulary';

/**
 * **Does the register's schema still cover the vocabulary the plugin ships?**
 *
 * The gap that let the gate fall behind twice. `docs-check.mjs` says in a comment beside
 * `EXTRA` that "adding a type to `EXTRA_TYPES` means adding it here too", and nothing
 * checked it: `Deliverable` was missing for the whole increment that introduced it, and
 * `Release` was missing from the day that type shipped (2026-08-24) until the register
 * gate went red on `main` five days later — 71 problems, none of which named the actual
 * cause, because a type the gate does not know fails once per NOTE rather than once.
 *
 * Both existing directions are checks between two things that can drift together: the
 * hierarchy table is held to `LEGAL_CHILDREN` and back (`checkerRejectsHierarchy`), so
 * editing both keeps them agreeing while both fall behind `src/`. This is the third leg —
 * the register's schema against the PLUGIN's — and it is the only one that fails when a
 * type is added to `typeVocabulary.ts` and nowhere else.
 *
 * Asked of the TABLE rather than of the gate's own constants, and that is deliberate
 * rather than convenient: `docs-check.mjs` is a script with top-level await and
 * `process.exit`, run as a subprocess for that reason (`test/helpers/register.ts`), so its
 * constants cannot be imported without building the seam that would then be the thing
 * under test. The gate already holds the table to `LEGAL_CHILDREN` in both directions, so
 * a table that names every declared type is a `LEGAL_CHILDREN` that does too.
 *
 * Read with the same mdast parser `docs-check.mjs` trusts, never a hand-written pattern —
 * ADR 0021 settled that argument once already.
 */
describe('the register schema and the plugin vocabulary', () => {
	/** Every type named in the type column of `docs/README.md`'s hierarchy table. */
	function documentedTypes(): Set<string> {
		const readme = readFileSync('docs/README.md', 'utf8');
		const tables = tablesWith(readme, ['Type', 'Parent may be', 'Children may be']) as { code: string[]; text: string }[][][];
		// Exactly one, for `tablesWith`'s own stated reason: with two tables under the same
		// headings, "the rows of the table" has no single answer, and taking the first
		// validates one document while a reader sees two.
		expect(tables, 'docs/README.md does not have exactly one hierarchy table').toHaveLength(1);
		const [table] = tables;
		// `code` per cell, not a pattern over the text: the parser has already separated the
		// code spans from the prose around them, and the gate reads the column that same way
		// — a name outside a code span is one it does not see either. One row covers the
		// whole extra-type category as `A` / `B` / `C`, which is the register's own spelling
		// and is why this collects every span in the cell rather than expecting one.
		return new Set(table.flatMap((row) => row[0].code));
	}

	// The instrument first, per the root guide: a parse that silently found nothing would
	// make every assertion below vacuously true, which is the failure mode a set
	// measurement has when nobody checks the measurer.
	it('reads a type column that actually has types in it', () => {
		expect(documentedTypes().size).toBeGreaterThanOrEqual(ALL_TYPES.length);
	});

	it('documents every type the plugin declares', () => {
		const documented = documentedTypes();
		for (const type of ALL_TYPES) {
			expect(documented, `the register's hierarchy table omits ${type}, which the plugin declares`).toContain(type);
		}
	});

	// The other direction, and the reason it is narrower than "the two sets are equal": a
	// `Resource` is declared in order to be REFUSED (ADR 0028) and is deliberately absent
	// from `ALL_TYPES`, so the table must not hold one either. Stating it as its own
	// assertion rather than as a set difference keeps the exemption visible — a silent
	// `.filter()` is how a refusal becomes an oversight nobody can find later.
	it('does not document a type the plugin refuses to make a work item', () => {
		expect(documentedTypes()).not.toContain(RESOURCE_TYPE);
	});
});
