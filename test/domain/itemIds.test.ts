import { describe, expect, it } from 'vitest';
import { ITEM_ID_KEY, nextItemId } from '../../src/domain/itemIds';
import { FakeVault } from '../helpers/vault';

/** One note carrying whatever the vault holds under the id key. */
function withId(vault: FakeVault, path: string, value: unknown): void {
	vault.addFile(path, { frontmatter: { [ITEM_ID_KEY]: value } });
}

describe('nextItemId', () => {
	it('starts at 1 in a vault that holds no ids', () => {
		const vault = new FakeVault();
		vault.addFile('Backlog/Epic.md');

		expect(nextItemId(vault.app)).toBe(1);
	});

	it('answers one past the highest id, wherever in the vault it sits', () => {
		const vault = new FakeVault();
		withId(vault, 'Backlog/A.md', 7);
		withId(vault, 'Backlog/B.md', 41);
		// Last scanned and NOT the highest: the answer is the maximum, never the last read.
		withId(vault, 'Backlog/C.md', 3);

		expect(nextItemId(vault.app)).toBe(42);
	});

	it('ignores a value that is not a number, rather than poisoning the maximum', () => {
		const vault = new FakeVault();
		withId(vault, 'Backlog/Text.md', 'not a number');
		withId(vault, 'Backlog/Empty.md', '');
		withId(vault, 'Backlog/Null.md', null);
		withId(vault, 'Backlog/Object.md', { nested: 1 });
		vault.addFile('Backlog/None.md');
		withId(vault, 'Backlog/Real.md', 5);

		expect(nextItemId(vault.app)).toBe(6);
	});

	it('floors a fractional id rather than issuing a fractional one', () => {
		// Floored rather than ignored: ignoring `7.5` would let the next creation land on
		// `7`, which reads as the same item to anyone who rounded it.
		const vault = new FakeVault();
		withId(vault, 'Backlog/Typo.md', 7.5);

		expect(nextItemId(vault.app)).toBe(8);
	});

	it('ignores a value so large that adding one would not move it', () => {
		// `1e21 + 1` is still `1e21` in a double, so counting one would pin every later id
		// to that same number forever. Ignored rather than clamped: a note holding it is a
		// typo or an import artefact, not a position in this sequence.
		const vault = new FakeVault();
		withId(vault, 'Backlog/Absurd.md', 1e21);
		withId(vault, 'Backlog/Real.md', 5);

		// ONE call, deliberately: a second would also be answered by the session floor, so
		// this test would go red when the FLOOR was removed and stop isolating the guard it
		// is named for.
		expect(nextItemId(vault.app)).toBe(6);
	});

	it('refuses to issue an id it could not add one to', () => {
		// The boundary the scan's own ceiling leaves open: `MAX_SAFE_INTEGER - 1` is under
		// it, so the first call issues `MAX_SAFE_INTEGER` legitimately and the second would
		// issue a number that adding one no longer moves — repeating forever after that.
		const vault = new FakeVault();
		withId(vault, 'Backlog/Edge.md', Number.MAX_SAFE_INTEGER - 1);

		expect(nextItemId(vault.app)).toBe(Number.MAX_SAFE_INTEGER);
		expect(() => nextItemId(vault.app)).toThrow(/safe integers/);
	});

	it('does not repeat a number when the cache has not caught up between two calls', () => {
		// The rule this states: `metadataCache` updates asynchronously, so two creations in
		// one tick both scan a vault that knows about neither. Nothing is added between
		// these calls — exactly the state a real vault is in mid-creation.
		const vault = new FakeVault();
		withId(vault, 'Backlog/A.md', 4);

		expect(nextItemId(vault.app)).toBe(5);
		expect(nextItemId(vault.app)).toBe(6);
		expect(nextItemId(vault.app)).toBe(7);
	});

	it('keeps each vault its own count', () => {
		// The floor is per-App, so one test's issued numbers cannot leak into the next
		// vault's answers — and two vaults open at once cannot read each other's.
		const first = new FakeVault();
		withId(first, 'Backlog/A.md', 30);
		expect(nextItemId(first.app)).toBe(31);

		const second = new FakeVault();
		expect(nextItemId(second.app)).toBe(1);
	});

	it('lets the vault overrule a floor that is behind it', () => {
		// A note restored from a backup, or an id typed by hand, is answered by the scan.
		const vault = new FakeVault();
		expect(nextItemId(vault.app)).toBe(1);

		withId(vault, 'Backlog/Imported.md', 900);
		expect(nextItemId(vault.app)).toBe(901);
	});
});
