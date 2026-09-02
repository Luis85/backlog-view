import { describe, expect, it } from 'vitest';
import { TFile, TFolder } from './obsidian-mock';
import { FakeQueryResult, FakeViewConfig } from './vault';

/**
 * The doubles were WIDENED to satisfy the real Obsidian types, and nothing checked that
 * what they claim behaves like the real thing — `docs/tasks/Close the holes the test
 * typecheck cannot see through.md`'s own last open item.
 *
 * Most of that claim cannot be checked here, because Obsidian cannot run here. **The part
 * that can is the part that has already gone wrong**: a member the double does NOT
 * implement. Declared, it emits nothing and answers `undefined`, so a module that starts
 * reading it fails somewhere else — which is exactly what `groupedData` did, silently, in
 * every test in the suite. Each one is a getter that throws now, and these are what say so.
 *
 * **This is a check on the FORBIDDEN THING rather than a list of places.** What it forbids
 * is a member that answers `undefined` while claiming a type: turn any of them back into a
 * `declare` and its case here goes red, on a suite nobody edited. What it does NOT reach is
 * a member added tomorrow — nothing walks the real types to find one, since the typings
 * describe far more surface than these doubles have any reason to carry. So the guarantee
 * is: every member this suite knows is unimplemented is loud about it.
 */
describe('a member the doubles do not implement is loud rather than undefined', () => {
	// One row per unimplemented member, and the whole point is that reading it is what
	// runs the check — hence the thunk. A property access cannot be passed to `toThrow`.
	const reads: [string, () => unknown][] = [
		['TFolder.children', () => new TFolder().children],
		['TFolder.vault', () => new TFolder().vault],
		['TFolder.parent', () => new TFolder().parent],
		['TFile.vault', () => new TFile('Note.md').vault],
		['BasesQueryResult.properties', () => new FakeQueryResult([]).properties],
		['BasesQueryResult.getSummaryValue', () => new FakeQueryResult([]).getSummaryValue],
		['BasesViewConfig.getEvaluatedFormula', () => new FakeViewConfig({}).getEvaluatedFormula],
	];

	it.each(reads)('%s throws, naming itself', (member, read) => {
		// The message names the member, because the failure a reader sees is a stack in
		// whatever `src/` module reached for it, not a line in this file.
		expect(read).toThrow(`${member} is not implemented by the test double`);
	});

	it('costs nothing until it is read', () => {
		// The getters are on the PROTOTYPE, which is what keeps them out of a spread, out of
		// `JSON.stringify`, and out of the own-property walk vitest prints a failure diff
		// with — so constructing a double, copying one and printing one all stay safe.
		const file = new TFile('Note.md');
		expect(() => ({ ...file })).not.toThrow();
		expect(() => JSON.stringify(new TFolder())).not.toThrow();
		expect(Object.keys(new FakeQueryResult([]))).not.toContain('properties');
	});
});
