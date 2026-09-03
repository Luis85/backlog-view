import { describe, expect, it } from 'vitest';
import { releaseReadiness } from '../../src/domain/releaseReadiness';
import { releaseIndex, releaseScope } from '../../src/domain/releases';
import { buildModel } from '../../src/domain/model';
import { CivilDate } from '../../src/domain/noteFields';
import { releaseSettingsWith } from '../helpers/releaseSettings';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/** This suite is not about `today` — `releaseReadiness.test.ts`'s own stand-in. */
const TODAY: CivilDate = { year: 2026, month: 1, day: 1 };

/** `test/domain/releaseReadiness.test.ts`'s `readinessOf`, narrowed to what this file needs. */
function readinessOf(vault: FakeVault, overrides: Record<string, unknown> = {}) {
	const plan = settingsWith({ stateKey: 'status', doneValues: ['Done'] });
	const settings = releaseSettingsWith({
		parentKey: 'parent',
		orderKey: 'order',
		typeKey: 'type',
		membershipKey: 'release',
		estimateKey: 'effort',
		capacityKey: 'capacity',
		...overrides,
	});
	const model = buildModel(vault.app, vault.entries(), plan);
	const index = releaseIndex(vault.app, model, settings, { stateKey: plan.stateKey, today: TODAY });
	const scope = releaseScope(vault.app, model, settings, index, 'R.md');
	return releaseReadiness(vault.app, scope, settings, plan);
}

/**
 * The capacity half of `docs/requirements/Commitment against declared capacity.md`.
 * Its own file rather than `releaseReadiness.test.ts`, which is already the longest
 * suite in `test/domain/`.
 */
describe('the capacity a release declares', () => {
	function vaultWith(capacity: unknown): FakeVault {
		const vault = new FakeVault();
		vault.addFile('R.md', {
			frontmatter: capacity === undefined ? { type: 'Release' } : { type: 'Release', capacity },
		});
		vault.addFile('M.md', { frontmatter: { type: 'PBI', order: 1, release: '[[R]]', effort: 5 } });
		return vault;
	}

	function capacityOf(vault: FakeVault, overrides: Record<string, unknown> = {}) {
		return readinessOf(vault, overrides).capacity;
	}

	it('reads a number the release note declares', () => {
		expect(capacityOf(vaultWith(40))).toEqual({ value: 40, invalid: false, unconfigured: false });
	});

	it('reads a quoted number, exactly as an estimate is read', () => {
		expect(capacityOf(vaultWith('40'))).toEqual({ value: 40, invalid: false, unconfigured: false });
	});

	it('is unconfigured with no key bound, whatever the note says', () => {
		expect(capacityOf(vaultWith(40), { capacityKey: '' })).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
	});

	it('is absent — not unconfigured — where the key is bound and the note is silent', () => {
		expect(capacityOf(vaultWith(undefined))).toEqual({ value: null, invalid: false, unconfigured: false });
	});

	it('is absent, the same as no key at all, when the note spells the key with null', () => {
		expect(capacityOf(vaultWith(null))).toEqual({ value: null, invalid: false, unconfigured: false });
	});

	it('refuses a negative capacity on READ, since nothing writes one', () => {
		expect(capacityOf(vaultWith(-5))).toEqual({ value: null, invalid: true, unconfigured: false });
	});

	it('refuses a value that is not a number at all', () => {
		expect(capacityOf(vaultWith('later'))).toEqual({ value: null, invalid: true, unconfigured: false });
	});

	it('accepts zero, which is a statement rather than an error', () => {
		expect(capacityOf(vaultWith(0))).toEqual({ value: 0, invalid: false, unconfigured: false });
	});
});

describe('estimates that may already be inside another estimate', () => {
	function doubleCountOf(vault: FakeVault): number | null {
		return readinessOf(vault).doubleCounted.value;
	}

	function baseVault(): FakeVault {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release', capacity: 40 } });
		return vault;
	}

	it('counts a member whose ancestor member is also estimated', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		expect(doubleCountOf(vault)).toBe(1);
	});

	it('counts each estimated ancestor once, however deep the chain', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		vault.addFile('P.md', { frontmatter: { type: 'PBI', parent: 'F', order: 1, release: '[[R]]', effort: 2 } });
		// `E` and `F` each cover something estimated below them; `P` covers nothing.
		expect(doubleCountOf(vault)).toBe(2);
	});

	it('counts the ancestor once, not each estimated child under it', () => {
		// The case that tells the two directions apart, and the one a chain cannot: ONE
		// estimate may already contain the two below it, so there is one possible double
		// count and not two.
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('P1.md', { frontmatter: { type: 'PBI', parent: 'E', order: 1, release: '[[R]]', effort: 3 } });
		vault.addFile('P2.md', { frontmatter: { type: 'PBI', parent: 'E', order: 2, release: '[[R]]', effort: 2 } });
		expect(doubleCountOf(vault)).toBe(1);
	});

	it('does not count a descendant whose ancestor carries no estimate', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]' } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		expect(doubleCountOf(vault)).toBe(0);
	});

	it('does not count an estimated member whose children are unestimated', () => {
		const vault = baseVault();
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, release: '[[R]]', effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]' } });
		expect(doubleCountOf(vault)).toBe(0);
	});

	it('never counts through a context ancestor — an excluded note is not a member', () => {
		const vault = baseVault();
		// `E` is NOT in the release: it is drawn as context to hold `F` in place, and its
		// own estimate is no part of this release's commitment.
		vault.addFile('E.md', { frontmatter: { type: 'Epic', order: 1, effort: 8 } });
		vault.addFile('F.md', { frontmatter: { type: 'Feature', parent: 'E', order: 1, release: '[[R]]', effort: 5 } });
		expect(doubleCountOf(vault)).toBe(0);
	});

	it('is unconfigured with no estimate key, rather than a truthful-looking zero', () => {
		const vault = baseVault();
		vault.addFile('F.md', { frontmatter: { type: 'Feature', order: 1, release: '[[R]]', effort: 5 } });
		expect(readinessOf(vault, { estimateKey: '' }).doubleCounted).toEqual({
			value: null,
			invalid: false,
			unconfigured: true,
		});
	});
});
