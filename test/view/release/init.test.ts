// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getReleaseViewOptions, resolveReleaseSettings, SHARED_STATUS_OPTIONS } from '../../../src/domain/releaseOptions';
import { releaseNoteProblems } from '../../../src/domain/settingsConsistency';
import { en } from '../../../src/i18n/en';
import { RELEASE_SUGGESTED_KEYS, runReleaseInit } from '../../../src/view/release/init';
import { bindAndReport } from '../../../src/view/release/newRelease';
import { makeReleaseView, mountRelease, noReleaseVault, RELEASE_CONFIG, scopeVault } from '../../helpers/release';
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
		const { view, config } = makeReleaseView(new FakeVault(), { versionProperty: '' });
		await runReleaseInit(view);
		const boundKeys = config.setCalls.map((c) => c.key);
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
		// `RELEASE_CONFIG` deliberately leaves `releaseNotesFolder` unbound (see its own
		// docblock) so the folder-bind test below has something to bind — bound here
		// explicitly, since THIS test's claim is about a genuinely fully-configured view.
		const { view, config } = makeReleaseView(new FakeVault(), { ...RELEASE_CONFIG, releaseNotesFolder: 'docs/release-notes' });
		await runReleaseInit(view);
		expect(config.setCalls).toEqual([]);
	});

	it('does not hand out an already-taken suggested key a second time', async () => {
		// versionProperty is explicitly bound to the key releaseStatusProperty would
		// otherwise suggest for itself ('status'). releaseStatusProperty is left unset, so
		// without the collision guard it would adopt 'status' too, and the two options
		// would silently read the same property.
		const { view, config } = makeReleaseView(new FakeVault(), { versionProperty: 'note.status' });
		await runReleaseInit(view);
		const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('releaseStatusProperty')).toBeUndefined();
	});

	it('does not hand out a key an explicitly-bound releasedDateProperty already holds', async () => {
		// releasedDateProperty is bound to the key targetDateProperty would otherwise
		// suggest for itself ('target-date'). Without releasedDateKey seeded into `taken`,
		// targetDateProperty would adopt 'target-date' too — aliasing the target date and
		// the released date onto one key, so `createRelease` writes the target date there
		// and `releaseIndex` reads that same value back as the release having shipped.
		const { view, config } = makeReleaseView(new FakeVault(), { releasedDateProperty: 'note.target-date' });
		await runReleaseInit(view);
		const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('targetDateProperty')).toBeUndefined();
	});

	it('does not hand out a key an explicitly-bound membershipProperty already holds', async () => {
		// membershipProperty is explicitly bound to the key releaseStatusProperty would
		// otherwise suggest for itself ('status'). Without membershipKey seeded into
		// `taken`, releaseStatusProperty would adopt 'status' too.
		const { view, config } = makeReleaseView(new FakeVault(), { membershipProperty: 'note.status' });
		await runReleaseInit(view);
		const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('releaseStatusProperty')).toBeUndefined();
	});

	/**
	 * The CATEGORY form of the three tests below, which stay beside it: each of those names
	 * a pairing that shipped, while this one holds for a pairing nobody has written yet.
	 *
	 * Both halves are DERIVED rather than listed. The option set comes from
	 * `getReleaseViewOptions` — every declared `type: 'property'` option — and not from the
	 * fields of `ReleaseSettings`, which is what the two previous fixes each swept and what
	 * missed `stateProperty`: this view declares that option and it resolves onto
	 * `BacklogSettings.stateKey`, so it is on no field of `ReleaseSettings` and an
	 * `Object.entries` sweep over a fully-bound one cannot see it. The suggestions come from
	 * what a run against an EMPTY config actually binds, so a fifth candidate joins this
	 * check by existing. A tenth option does too — which is the whole point, since this is
	 * the third finding of this one shape in this one file.
	 */
	it('hands out no key ANY declared property option already holds, outside the one exemption', async () => {
		const { view: untouched, config: untouchedConfig } = makeReleaseView(new FakeVault(), {});
		await runReleaseInit(untouched);
		// Narrowed to the PROPERTY sweep's own writes: this check is about a declared
		// property option colliding with a suggested property KEY, and since 2026-08-30 an
		// unconstrained run's `setCalls` also carries the three value candidates (a folder
		// path, a vocabulary, a transition) — strings no property option collides with by
		// this rule, and counting them in `suggested` would ask a `typeProperty` fixture to
		// hold a folder path as though it were a property key.
		const suggestedKeys = new Set(RELEASE_SUGGESTED_KEYS.map((candidate) => candidate.option));
		const suggested = untouchedConfig.setCalls
			.filter((call) => suggestedKeys.has(call.key))
			.map((call) => String(call.value));
		expect(suggested.length).toBeGreaterThan(0);

		const declared = getReleaseViewOptions(untouched.config)
			.flatMap((entry) => (entry.type === 'group' ? entry.items : [entry]))
			.filter((option) => option.type === 'property')
			.map((option) => option.key);
		expect(declared.length).toBeGreaterThan(suggested.length);

		for (const option of declared) {
			// The exemption is asserted in its own two tests below, in both directions and by
			// name. Skipping it HERE rather than weakening the assertion keeps this check
			// saying exactly what it checks: every other pairing is still refused, including
			// every pairing involving an option outside the exempt list — `typeProperty`
			// holding `status` is in this loop and is still a collision.
			if (SHARED_STATUS_OPTIONS.includes(option)) continue;
			for (const key of suggested) {
				const { view, config } = makeReleaseView(new FakeVault(), { [option]: key });
				await runReleaseInit(view);
				const collisions = config.setCalls.filter((call) => call.value === key);
				expect(collisions, `${option} already holds ${key}`).toEqual([]);
			}
		}
	});

	/**
	 * The exemption itself, in the direction a vault actually meets it: nothing bound, one
	 * press, and BOTH status options come out naming `status` — the release note's own
	 * status and every item's workflow state, which is what the vault this plugin creates
	 * looks like and what `docs/` itself is.
	 *
	 * Without it `stateProperty` is the one that loses (it is offered second), and losing it
	 * is not a cosmetic gap: `ReleaseRow.done` is unconfigured for every release, so the
	 * index bands, the scope rollups and the hide-done toggle are all withheld after a press
	 * that reported success.
	 */
	it('binds the item state and the release status onto one property, which is the shipped vault', async () => {
		const { view, config } = makeReleaseView(new FakeVault(), {});
		await runReleaseInit(view);
		const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('stateProperty')).toBe('note.status');
		expect(bound.get('releaseStatusProperty')).toBe('note.status');
		expect(view.settings.statusKey).toBe('status');
	});

	it('offers the exemption in both directions, so an explicit binding either way still adopts', async () => {
		// Each of the two bound by hand to `status`, with the other left unset. The exempt
		// list is what makes the unset one adopt anyway; every other option holding `status`
		// blocks it, which the category check above drives.
		for (const [held, adopting] of [
			['stateProperty', 'releaseStatusProperty'],
			['releaseStatusProperty', 'stateProperty'],
		]) {
			const { view, config } = makeReleaseView(new FakeVault(), { [held]: 'note.status' });
			await runReleaseInit(view);
			const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
			expect(bound.get(adopting), `${held} held status; ${adopting} should still adopt it`).toBe('note.status');
		}
	});

	it('refuses the exempt pair when a NON-shared option holds the key, even beside a shared one', async () => {
		// Found by review (Codex, PR #211). The exemption was written as "subtract the keys
		// the shared options hold", which reads the same as the rule on the shipped defaults
		// and is wrong the moment BOTH kinds hold one key: with the version and the item
		// state both on `status`, subtracting freed it, ✨ bound the release status onto the
		// version's key, and `releaseNoteProblems` — landed the same day — then blocked every
		// write in the view. The rule is "does a NON-shared option hold it".
		const { view, config } = makeReleaseView(new FakeVault(), {
			versionProperty: 'note.status',
			stateProperty: 'note.status',
		});
		await runReleaseInit(view);
		const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('releaseStatusProperty')).toBeUndefined();
		// And the press left the view writable rather than bricking it.
		expect(releaseNoteProblems(view.settings)).toEqual([]);
	});

	it('still refuses both status candidates when an option OUTSIDE the exemption holds the key', async () => {
		// `typeProperty: note.status` is the PR #203 corruption: `createRelease` writes the
		// type first and the status after it, so a release came out carrying a status and no
		// type. The exemption must not reopen it — neither status option may adopt here.
		const { view, config } = makeReleaseView(new FakeVault(), { typeProperty: 'note.status' });
		await runReleaseInit(view);
		const bound = new Map(config.setCalls.map((c) => [c.key, c.value]));
		expect(bound.get('releaseStatusProperty')).toBeUndefined();
		expect(bound.get('stateProperty')).toBeUndefined();
	});

	it('binds the released-date key too, so the shipped figure is not unconfigured after a press', async () => {
		// [[Marking a release as released]]'s own figure reads `releasedDateKey`; a press that
		// left it unbound reported success and left that column unconfigured for every release.
		const { view } = makeReleaseView(new FakeVault(), {});
		await runReleaseInit(view);
		expect(view.settings.releasedDateKey).toBe('released');
	});

	it('binds the readiness keys too, so a press leaves no criterion unconfigured', async () => {
		const { view, config } = makeReleaseView(new FakeVault(), {});
		await runReleaseInit(view);
		expect(config.get('estimateProperty')).toBe('note.effort');
		expect(config.get('capacityProperty')).toBe('note.capacity');
		expect(config.get('dependsOnProperty')).toBe('note.dependsOn');
		expect(config.get('riskProperty')).toBe('note.risk');
		// The VOCABULARIES are not candidates and could not be: there is no key to hand out —
		// what a vault calls its own risk values is its own to write, the same reason
		// `releaseStatusValues` is absent from this list.
		expect(config.get('criticalRiskValues')).toBeUndefined();
		expect(config.get('addressedRiskValues')).toBeUndefined();
	});

	it('binds only the option it was narrowed to', async () => {
		const { view } = makeReleaseView(noReleaseVault(), {});
		const bound = await runReleaseInit(view, ['estimateProperty']);

		expect(bound).toBe(true);
		expect(view.config.getAsPropertyId('estimateProperty')).toBe('note.effort');
		// Every other candidate is untouched — the whole point of the narrowing.
		expect(view.config.getAsPropertyId('capacityProperty')).toBeNull();
		expect(view.config.getAsPropertyId('membershipProperty')).toBeNull();
	});

	it('reports nothing bound when the narrowed option is already set', async () => {
		const { view } = makeReleaseView(noReleaseVault(), { estimateProperty: 'note.effort' });
		expect(await runReleaseInit(view, ['estimateProperty'])).toBe(false);
	});
});

describe('the press binds the options that are not properties', () => {
	it('binds the notes folder to the option’s own placeholder', async () => {
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		expect(view.config.get('releaseNotesFolder')).toBe('docs/release-notes');
	});

	it('binds the released vocabulary from domain data, never from the catalog', async () => {
		// The option's placeholder is `t('release.option.releasedValuesHint')` — the string
		// `Released, Archived`. Binding a placeholder uniformly would write the CATALOG's
		// language into the `.base`, which is data in the wrong artifact.
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		expect(view.config.get('releasedStatusValues')).toBe('Released');
		expect(view.config.get('releasedStatusValues')).not.toBe(en['release.option.releasedValuesHint']);
	});

	it('binds the transition to the FIRST of the reader’s own list, not the literal', async () => {
		// The case a fixture spelling `Released` cannot see: with a vocabulary already
		// declared, binding the literal would fail `configProblems`' own check that the
		// transition is one of the released values.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releasedStatusValues', 'Shipped, Archived');
		await runReleaseInit(view);
		expect(view.config.get('releasedTransitionValue')).toBe('Shipped');
	});

	// The PADDED spelling is the second case and not a variation on the first: the value is
	// seeded through `resolveReleaseSettings`, whose `releasedTransition` was untrimmed while
	// `releasedValues` trims every item — so ` Shipped` seeded the list `['Shipped']` and then
	// matched none of it, which is the very mismatch this seeding exists to prevent (found by
	// review, PR #221). A hand edit of the `.base` is the only way in; the dropdown's own
	// values come from `releasedValuesOf` and are trimmed already.
	it.each(['Shipped', ' Shipped'])(
		'seeds the vocabulary FROM a transition the reader set first (%j), so the pair agrees either way',
		async (transition) => {
			// The mirror of the case above it, and the direction the docblock's "by construction"
			// claim did not hold in (found by review, Codex, PR #221). With the transition touched
			// and the vocabulary unset, seeding the list from `DEFAULT_RELEASED_VALUES` bound
			// `Released` beside a transition of `Shipped`: `closeOffer` then reads the transition
			// as not one of the released values, pushes it into `missing` and withholds BOTH
			// closing actions, while `releaseNoteProblems` raises a configuration problem — after
			// a press that reported it had configured the view.
			const { view } = mountRelease({ bindAll: false });
			view.config.set('releasedTransitionValue', transition);
			await runReleaseInit(view);
			const settings = resolveReleaseSettings(view.config);
			expect(settings.releasedValues).toContain('Shipped');
			expect(releaseNoteProblems(settings)).toEqual([]);
		},
	);

	it('binds nothing for a transition with no list to choose from, rather than writing an empty value', async () => {
		// The empty-value guard `wouldBindValue` carries: with `releasedStatusValues`
		// cleared, `releasedValuesOf` returns `[]`, so the transition candidate computes
		// `''`. Without the guard that `''` would be WRITTEN — reporting as touched to the
		// next press, which is exactly the failure mode `runReleaseInit`'s own comment
		// states beside the sweep.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releasedStatusValues', '');
		await runReleaseInit(view);
		expect(view.config.get('releasedTransitionValue')).toBeUndefined();
	});

	it('never overwrites an option the reader has touched', async () => {
		// Cleared is not untouched, and neither is set — `adoptCandidates`' own rule,
		// applied to the three that reach none of its machinery.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('releaseNotesFolder', 'notes/ship');
		await runReleaseInit(view);
		expect(view.config.get('releaseNotesFolder')).toBe('notes/ship');
	});

	it('binds the capacity unit to the option’s own placeholder, so one press fully enables the comparison', async () => {
		// The product owner's reversal of `init.ts`'s own former boundary: a guessed unit is
		// a real cost, spent on purpose so ✨ finishes enabling the feature in one press.
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		expect(view.config.get('capacityUnit')).toBe('points');
	});

	it('never overwrites a unit the reader already typed', async () => {
		const { view } = mountRelease({ bindAll: false });
		view.config.set('capacityUnit', 'story points');
		await runReleaseInit(view);
		expect(view.config.get('capacityUnit')).toBe('story points');
	});

	it('never refills a unit the reader deliberately cleared', async () => {
		// Cleared is not untouched, and neither is set — `resolveReleaseSettings`'s own rule
		// ("unset takes the suggestion, cleared means off"), applied to the one candidate
		// that could silently drift past it: `wouldBindValue` reads `config.get() ===
		// undefined`, so an empty string already survives a press, and this pins it rather
		// than leaving that inherited.
		const { view } = mountRelease({ bindAll: false });
		view.config.set('capacityUnit', '');
		await runReleaseInit(view);
		expect(view.config.get('capacityUnit')).toBe('');
	});

	it('leaves a fully configured view with no configuration problems', async () => {
		// The promise of the press, as one assertion rather than five.
		const { view } = mountRelease({ bindAll: false });
		await runReleaseInit(view);
		const settings = resolveReleaseSettings(view.config);
		expect(settings.notesFolder).not.toBe('');
		expect(settings.releasedValues).toContain(settings.releasedTransition);
	});
});

describe('the press reports binding a non-property option', () => {
	it('sees a folder bind that no property key reflects', async () => {
		// Every PROPERTY already bound, so the only work left is the folder — the one kind of
		// bind a reading of the declared property keys cannot see. That reading was how
		// `bindAndReport` answered until 2026-09-04, and the press reported it had bound
		// nothing and skipped the redraw that would show the button it had just switched on.
		// It answers off `runReleaseInit`'s own writes now, which cannot miss a kind of option.
		const { view } = mountRelease({ bindAll: true });
		expect(view.config.get('releaseNotesFolder')).toBeUndefined();
		expect(await bindAndReport(view)).toBe(true);
	});
});
