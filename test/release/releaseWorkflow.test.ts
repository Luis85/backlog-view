import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The release workflow's API calls, held against the scopes it declares.
 *
 * Declaring a `permissions:` block at all sets every permission NOT listed in it to
 * `none`. So a step that calls an API nobody added a scope for does not degrade — it
 * fails with a permissions error, at the one moment there is no cheap way to try again,
 * and only after a tag has already been pushed. That is exactly what happened when the CI
 * gate was added: it read `/check-runs` under a block that named `contents`, `id-token`
 * and `attestations`, and nothing in this repository could see it, because the workflow
 * only ever executes inside Actions.
 *
 * This is the check `docs/adrs/0007` would otherwise not have: a node test rather than a
 * sixth step in `npm run check`, the same argument `versionFiles.test.ts` makes — the
 * suite already runs in CI, so the gate gains a guarantee without changing what the gate
 * IS.
 *
 * What it can and cannot reach, stated narrowly because the difference matters: it checks
 * that every `gh` call in the file is one this test KNOWS, and that the scope named beside
 * it is declared. It cannot check GitHub's own endpoint-to-scope mapping — that lives on
 * GitHub's servers and no test here can ask it. The value is in the first half: a call
 * this table has never seen fails, which is the point at which a person has to look the
 * scope up. An unknown call is the forbidden thing, so the check sits on the call rather
 * than on a list of the scopes someone remembered to add.
 */
const WORKFLOW = '.github/workflows/release.yml';

/**
 * Every `gh` invocation the workflow makes, keyed by enough of it to be unambiguous, and
 * the scope it needs. `/commits/…/check-runs` is keyed whole rather than by its
 * `/commits/` prefix: that prefix reads as `contents`, and the scope that actually
 * governs it is `checks`.
 */
const SCOPES: Record<string, string> = {
	'gh api "repos/$GITHUB_REPOSITORY/compare/': 'contents',
	'gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/check-runs"': 'checks',
	'gh release view': 'contents',
	'gh release create': 'contents',
};

/**
 * Comment lines are dropped before scanning. The workflow documents the command a USER
 * runs to verify an attestation (`gh attestation verify …`), which is prose about someone
 * else's machine rather than a call this job makes — counting it would demand a scope for
 * a step that does not exist.
 */
function ghCalls(yaml: string): string[] {
	const code = yaml
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('#'))
		.join('\n');
	return [...code.matchAll(/\bgh\s+\S+[^\n]*/g)].map((m) => m[0]);
}

/** The keys of the top-level `permissions:` block — the block, not the file. */
function declaredScopes(yaml: string): Set<string> {
	const block = /^permissions:\n((?:[ \t]+.*\n|[ \t]*#.*\n)*)/m.exec(yaml);
	if (!block) return new Set();
	return new Set(
		[...block[1].matchAll(/^\s+([a-z-]+):\s*(?:read|write)\s*$/gm)].map((m) => m[1]),
	);
}

describe('the release workflow declares a scope for every call it makes', () => {
	const yaml = readFileSync(WORKFLOW, 'utf8');
	const calls = ghCalls(yaml);
	const scopes = declaredScopes(yaml);

	it('makes only calls this table knows the scope of', () => {
		const unknown = calls.filter((call) => !Object.keys(SCOPES).some((known) => call.startsWith(known)));
		// A new `gh` call reaches here before it reaches a release. Look up the scope it
		// needs, add it to SCOPES and to the workflow's own `permissions:` block — the
		// second is what actually fixes it; this table is only what makes you go looking.
		expect(unknown).toEqual([]);
	});

	it('declares the scope each of those calls needs', () => {
		const missing = calls
			.map((call) => Object.entries(SCOPES).find(([known]) => call.startsWith(known))?.[1])
			.filter((scope): scope is string => scope !== undefined && !scopes.has(scope));
		expect([...new Set(missing)]).toEqual([]);
	});

	it('reads the file it claims to — the instrument before its verdict', () => {
		// Both assertions above pass vacuously on an empty scan, which a renamed workflow,
		// a reformatted permissions block or a regex that stopped matching all produce
		// quietly. Floors rather than counts: this is asking whether the scan can SEE the
		// file, and a scope legitimately dropped alongside the call that needed it is the
		// assertion above's business, not this one's.
		expect(calls.length).toBeGreaterThanOrEqual(4);
		expect(scopes.size).toBeGreaterThanOrEqual(2);
		// The hazard this whole file exists for: an explicit block is what makes an
		// unlisted scope `none` rather than a default.
		expect(yaml).toMatch(/^permissions:$/m);
	});
});
