import { ESLint } from 'eslint';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECTION_TREE, WRITE_BOUNDARY } from '../../eslint.config.mjs';

/**
 * Two flat-config blocks matching one file OVERRIDE `no-restricted-syntax` rather than
 * merging it, so every region in `eslint.config.mjs` has to spread the shared bans BY
 * HAND — and a new block that forgets one loses it in silence. `src/storage/` already
 * did (PR #252): it was carrying no `PROJECTION_TREE` and nothing said so, because a
 * missing ban produces no error to notice. That is the same shape as
 * `docs/issues/A gate that did not run looks like one that passed.md` — the absence of a
 * check reads exactly like a check that passed.
 *
 * **The instrument is ESLint's own config resolution, not a walk over the file's text.**
 * `calculateConfigForFile` answers what the linter would ACTUALLY apply to a path, after
 * every block, every `ignores` and the override semantics above. A source walk pairing
 * each `syntaxRules(` call with the `files:` above it can only see the blocks that exist;
 * this sees the two holes such a walk cannot — a region carved out of a wider block and
 * given no block of its own (which matches nothing, the way `MANUAL` would have), and a
 * later block silently replacing an earlier one's list.
 *
 * What it does NOT reach: whether each selector is CORRECT. A ban present in every region
 * and blind to a spelling is `PROJECTION_TREE`'s own history — `host?.projection` walked
 * past it for a day — and no test over the config can see that. The claim here is
 * "every file in `src/` resolves to a set carrying these two bans", not "these two bans
 * catch everything they are about".
 */

/** The two bans that hold across `src/` rather than belonging to one region. */
const SHARED = { WRITE_BOUNDARY, PROJECTION_TREE };

/**
 * Where a ban is deliberately absent, as a RULE rather than as a list of the files that
 * satisfy it today — a new file in `src/storage/` inherits the exemption, and a new file
 * anywhere else does not.
 *
 * `src/storage/` is exempt from the write boundary because it IS the write boundary: the
 * three banned calls are what those modules exist to make. `src/view/projection.ts` is
 * exempt from the projection ban because it OWNS the predicate the ban points at —
 * `treeShaped()` has to compare against `'tree'` somewhere.
 */
const EXEMPT: Record<keyof typeof SHARED, (file: string) => boolean> = {
	WRITE_BOUNDARY: (file) => file.startsWith('src/storage/'),
	PROJECTION_TREE: (file) => file === 'src/view/projection.ts',
};

/** Every `.ts` file under `src/`, as a repo-relative POSIX path (CI runs on Windows too). */
const sources = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sources(path);
		return path.endsWith('.ts') ? [relative('.', path).split(sep).join('/')] : [];
	});

/** Each file that resolves to a `no-restricted-syntax` set missing one of SHARED, and which. */
const dropped = async (eslint: ESLint, files: string[]): Promise<Record<string, string[]>> => {
	const out: Record<string, string[]> = {};
	for (const file of files) {
		const config = await eslint.calculateConfigForFile(file);
		// [severity, ...selectors] — or nothing at all, when no block matched the file.
		const configured = (config.rules?.['no-restricted-syntax'] ?? []).slice(1) as Array<{ selector: string }>;
		const present = new Set(configured.map((entry) => entry.selector));
		const missing = Object.entries(SHARED)
			.filter(([, ban]) => !ban.every((entry) => present.has(entry.selector)))
			.map(([name]) => name);
		if (missing.length > 0) out[file] = missing;
	}
	return out;
};

describe('the bans that hold across src/', () => {
	const files = sources('src');

	it('reaches every file in src/, except where an exemption says otherwise', async () => {
		// 177 files on 2026-09-02, but the number is not the assertion — that the walk found
		// SOMETHING is, since an empty list would make every claim below vacuously true.
		expect(files.length).toBeGreaterThan(100);

		const unexplained = Object.entries(await dropped(new ESLint(), files)).flatMap(([file, bans]) =>
			bans.filter((ban) => !EXEMPT[ban as keyof typeof SHARED](file)).map((ban) => `${file}: ${ban}`),
		);
		expect(unexplained).toEqual([]);
	});

	it('still has a file behind each exemption', async () => {
		// An exemption whose reason has gone is a hole standing open for the next file that
		// lands in that directory. This fails when the last exempt file leaves.
		const exercised = new Set(
			Object.entries(await dropped(new ESLint(), files)).flatMap(([file, bans]) =>
				bans.filter((ban) => EXEMPT[ban as keyof typeof SHARED](file)),
			),
		);
		expect([...exercised].sort()).toEqual(['PROJECTION_TREE', 'WRITE_BOUNDARY']);
	});

	it('names the files a region that drops a ban would leave uncovered', async () => {
		// The instrument, tested on a known input: one appended block matching `render/`,
		// carrying a `no-restricted-syntax` of its own. Flat config REPLACES the rule's
		// options rather than merging them, so those files lose both shared bans — the exact
		// accident this test exists to catch, staged rather than described.
		const holed = new ESLint({
			overrideConfig: [
				{
					files: ['src/view/render/**/*.ts'],
					rules: { 'no-restricted-syntax': ['error', { selector: 'DebuggerStatement', message: 'planted' }] },
				},
			],
		});
		const reported = await dropped(holed, files);

		expect(reported['src/view/render/board.ts']).toEqual(['WRITE_BOUNDARY', 'PROJECTION_TREE']);
		// And only there: the block above matches `render/` alone, so everything else still
		// resolves to what it resolved to before — which is what the first test asserts.
		expect(Object.keys(reported).filter((file) => file.startsWith('src/view/render/')).length).toBeGreaterThan(1);
		expect(reported['src/main.ts']).toBeUndefined();
	});
});
