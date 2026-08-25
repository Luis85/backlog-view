// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { runReleaseInit } from '../../../src/view/release/init';
import { makeReleaseView, RELEASE_CONFIG, scopeVault } from '../../helpers/release';
import { FakeVault } from '../../helpers/vault';
import { useViewHarness } from '../../helpers/view';

useViewHarness();

describe('runReleaseInit', () => {
	it('binds every untouched option and leaves a cleared one alone', async () => {
		// Unset vs cleared is asked of the LIVE CONFIG, never of the resolved keys — both
		// resolve to '' and cannot be told apart. `adoptCandidates` asks
		// `config.get(option) !== undefined`, and this follows it: `versionProperty` below
		// is explicitly cleared (present in the config, holding ''), while
		// `membershipProperty`, `targetDateProperty` and `releaseStatusProperty` are simply
		// absent, i.e. never set.
		const { view } = makeReleaseView(new FakeVault(), { versionProperty: '' });
		await runReleaseInit(view);
		const boundKeys = view.config.setCalls.map((c) => c.key);
		expect(boundKeys).toContain('membershipProperty');
		expect(boundKeys).toContain('targetDateProperty');
		expect(boundKeys).toContain('releaseStatusProperty');
		expect(boundKeys).not.toContain('versionProperty');
	});

	it('writes to no note at all, against a vault that genuinely holds a release and its members', async () => {
		// The whole of Task 5's claim, driven at the one control that could break it. This
		// is the test that makes "never edits an existing note" mean something — without
		// it, that sentence passes only because nothing exercises the view. `scopeVault`
		// gives a real release note (R.md) and two real work items (F1.md, F2.md) that
		// already name it, so "wrote nothing" is a fact about a populated vault rather than
		// an empty one — and every option below is left unset, so there is something for
		// this action to bind, not merely nothing to do.
		const vault = scopeVault();
		const before = vault.files.size;
		const { view } = makeReleaseView(vault, {});
		await runReleaseInit(view);
		expect(vault.writeLog).toEqual([]);
		expect(vault.trashed).toEqual([]);
		expect(vault.files.size).toBe(before);
	});

	it('resolves the bound properties onto view.settings, for the caller that opens the dialog next', async () => {
		const { view } = makeReleaseView(new FakeVault(), {});
		await runReleaseInit(view);
		expect(view.settings.membershipKey).toBe('release');
		expect(view.settings.versionKey).toBe('version');
		expect(view.settings.targetDateKey).toBe('target-date');
		expect(view.settings.statusKey).toBe('status');
	});

	it('adopts nothing already bound, and leaves an unrelated key alone', async () => {
		const { view } = makeReleaseView(new FakeVault(), RELEASE_CONFIG);
		await runReleaseInit(view);
		expect(view.config.setCalls).toEqual([]);
	});

	it('does not hand out an already-taken suggested key a second time', async () => {
		// versionProperty is explicitly bound to the key releaseStatusProperty would
		// otherwise suggest for itself ('status'). releaseStatusProperty is left unset, so
		// without the collision guard it would adopt 'status' too, and the two options
		// would silently read the same property.
		const { view } = makeReleaseView(new FakeVault(), { versionProperty: 'note.status' });
		await runReleaseInit(view);
		const bound = new Map(view.config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('releaseStatusProperty')).toBeUndefined();
	});

	it('does not hand out a key an explicitly-bound membershipProperty already holds', async () => {
		// membershipProperty is explicitly bound to the key releaseStatusProperty would
		// otherwise suggest for itself ('status'). Without membershipKey seeded into
		// `taken`, releaseStatusProperty would adopt 'status' too.
		const { view } = makeReleaseView(new FakeVault(), { membershipProperty: 'note.status' });
		await runReleaseInit(view);
		const bound = new Map(view.config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('releaseStatusProperty')).toBeUndefined();
	});
});
