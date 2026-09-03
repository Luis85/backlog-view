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
