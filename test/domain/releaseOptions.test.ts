import { describe, expect, it } from 'vitest';
import { getReleaseViewOptions, resolveReleaseSettings } from '../../src/domain/releaseOptions';
import { membershipCollision, releaseNoteProblems } from '../../src/domain/settingsConsistency';
import { resolveSettings } from '../../src/domain/settingsResolve';
import { optionalKeyFor } from '../../src/domain/optionalProperties';
import { FakeViewConfig } from '../helpers/vault';
import { releaseSettingsWith } from '../helpers/releaseSettings';

function keysOf(config: FakeViewConfig): string[] {
	return getReleaseViewOptions(config as never)
		.flatMap((group) => ('items' in group ? group.items : []))
		.map((item) => (item as { key: string }).key);
}

describe('the release view names its own keys', () => {
	it('declares its whole option set — the model mappings, the folder, the open target, the Deliverable pair and the two editing keys', () => {
		// `deliverableStateProperty` and `deliverableDoneValues` joined this list so the
		// Deliverable workflow's progress gate (`ownWorkflowReading`, read through
		// `resolveSettings` in `releaseView.ts`'s `buildModel` call) is reachable from
		// Bases' own options menu — see the comment beside their declaration below.
		// `descriptionProperty` and `releaseStatusValues` joined it on 2026-08-29 with
		// [[Editing a release from its own screen]]: the field this view writes, and the
		// vocabulary its status menu offers. `releasedStatusValues`, `releasedTransitionValue`
		// and `releaseNotesFolder` joined it the same day with the closing actions
		// (`Mark as released`, `Generate release notes`).
		//
		// The COUNT left this test's own name earlier the same day: a name that carries a
		// number goes stale the moment an option is added, and the list below is the check
		// either way.
		expect(keysOf(new FakeViewConfig({})).sort()).toEqual(
			[
				'deliverableDoneValues',
				'deliverableStateProperty',
				'descriptionProperty',
				'doneValues',
				'membershipProperty',
				'openIn',
				'orderProperty',
				'parentProperty',
				'releasedDateProperty',
				'releasedStatusValues',
				'releasedTransitionValue',
				'releaseFolder',
				'releaseNotesFolder',
				'releaseStatusProperty',
				'releaseStatusValues',
				'stateProperty',
				'targetDateProperty',
				'typeProperty',
				'versionProperty',
			].sort(),
		);
	});

	it('carries a default on its open-target dropdown, or an unset pick would open nothing', () => {
		const openIn = getReleaseViewOptions(new FakeViewConfig({}) as never)
			.flatMap((group) => ('items' in group ? group.items : []))
			.find((item) => (item as { key: string }).key === 'openIn') as { default?: unknown } | undefined;
		expect(openIn?.default).toBe('split');
	});

	it('resolves each key, and leaves an unconfigured one empty', () => {
		const settings = resolveReleaseSettings(new FakeViewConfig({ typeProperty: 'note.kind' }) as never);
		expect(settings.typeKey).toBe('kind');
		expect(settings.membershipKey).toBe('');
		expect(settings.versionKey).toBe('');
	});

	it('defaults the three model mappings the way the backlog view does', () => {
		const settings = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(settings.typeKey).toBe('type');
		expect(settings.parentKey).toBe('parent');
		expect(settings.orderKey).toBe('order');
	});

	it('tells a CLEARED mapping from one never set', () => {
		// The whole "No type property is mapped" state depends on this, and `propKey`
		// cannot express it — it hands back the default for both.
		const cleared = resolveReleaseSettings(new FakeViewConfig({ typeProperty: '' }) as never);
		expect(cleared.typeKey).toBe('');
		const untouched = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(untouched.typeKey).toBe('type');
	});

	it('files a new release under docs/releases when nothing says otherwise', () => {
		// The value is DATA — where a note lands, not text anybody reads. It tracks
		// `defaultTypeFolder('Release')` rather than a literal so the two cannot drift.
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).folder).toBe('docs/releases');
	});

	it('reads a picked release folder the way every other folder option is read', () => {
		// Trimmed, stripped of leading/trailing separators and normalized — `vaultFolder`,
		// the same reading `resolveFolders` gives every type folder.
		expect(resolveReleaseSettings(new FakeViewConfig({ releaseFolder: '/Releases/' }) as never).folder).toBe(
			'Releases',
		);
	});

	it('resolves its own open target, defaulting to split like the estimation view', () => {
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).openIn).toBe('split');
		expect(resolveReleaseSettings(new FakeViewConfig({ openIn: 'tab' }) as never).openIn).toBe('tab');
	});

	it('offers the declared released values as the transition dropdown\'s own choices', () => {
		const items = getReleaseViewOptions(
			new FakeViewConfig({ releasedStatusValues: 'Released, Archived' }) as never,
		).flatMap((group) => ('items' in group ? group.items : []));
		const dropdown = items.find((item) => (item as { key: string }).key === 'releasedTransitionValue') as {
			options?: Record<string, string>;
		};
		expect(dropdown.options).toEqual({ Released: 'Released', Archived: 'Archived' });
	});

	it('resolves the three closing options, and leaves each unconfigured one empty', () => {
		const bound = resolveReleaseSettings(
			new FakeViewConfig({
				releasedStatusValues: 'Released, Archived',
				releasedTransitionValue: 'Released',
				releaseNotesFolder: 'docs/notes',
			}) as never,
		);
		expect(bound.releasedValues).toEqual(['Released', 'Archived']);
		expect(bound.releasedTransition).toBe('Released');
		expect(bound.notesFolder).toBe('docs/notes');

		// Absence is a value: an unconfigured list is empty and an unconfigured folder is '',
		// which is what every gate below reads as "not bound" rather than as "none".
		const bare = resolveReleaseSettings(new FakeViewConfig({}) as never);
		expect(bare.releasedValues).toEqual([]);
		expect(bare.releasedTransition).toBe('');
		expect(bare.notesFolder).toBe('');
	});

	it('trims a hand-edited transition, so it can match a vocabulary that is trimmed item by item', () => {
		// `releasedValues` goes through `list`, which trims every item; the transition went
		// through `str`, which did not. So ` Released` was compared against `Released` and
		// matched nothing — `releaseNoteProblems` reported a mismatch and `closeOffer`
		// withheld both closing actions, over two halves the options screen shows as
		// agreeing (found by review, PR #221). The dropdown only ever offers trimmed values,
		// so a hand edit of the `.base` is the whole of the way in.
		const padded = resolveReleaseSettings(
			new FakeViewConfig({ releasedStatusValues: 'Released, Archived', releasedTransitionValue: ' Released ' }) as never,
		);
		expect(padded.releasedTransition).toBe('Released');
		expect(releaseNoteProblems(padded)).toEqual([]);
	});

	it('resolves the released date key, and leaves it empty when unbound', () => {
		// `propKey`, not `clearablePropKey`: the default is '' so the two resolve the same
		// value for every input, exactly as `versionKey` and the other release-own keys do.
		expect(
			resolveReleaseSettings(new FakeViewConfig({ releasedDateProperty: 'note.released' }) as never).releasedDateKey,
		).toBe('released');
		expect(resolveReleaseSettings(new FakeViewConfig({}) as never).releasedDateKey).toBe('');
	});

	it('refuses a released date aimed at the target date, and a transition outside the list', () => {
		// Same key for the plan and the record: a released date written onto the target date
		// destroys the only evidence a release slipped, which is the one thing nobody can
		// reconstruct afterwards.
		//
		// The `owned` collision map above ALSO reports this pair generically ("the release
		// target date and released date properties share the key…"), since both are
		// ordinary roles in it with no exemption — so a bare `.toContain('due')` would pass
		// on that message alone and never watch-fail if the new check below were deleted.
		// Asserted against the SPECIFIC sentence instead, so the check is of the new code.
		const collided = releaseNoteProblems(releaseSettingsWith({ targetDateKey: 'due', releasedDateKey: 'due' }));
		expect(collided).toContain('the released date and the target date both use due');

		// A hand-edited `.base` can spell a transition the dropdown never offered. Nothing
		// in the `owned` map can catch this one — `releasedTransition` names no frontmatter
		// property key at all, so this is the whole check.
		const stray = releaseNoteProblems(
			releaseSettingsWith({ releasedValues: ['Released'], releasedTransition: 'Shipped' }),
		);
		expect(stray).toContain('Shipped is not one of the statuses that mean released');

		// Case-insensitive, the same match every vocabulary membership check in this view
		// makes (`sameValue`) — a dropdown pick and a hand-typed value that differ only in
		// case are the same status.
		expect(
			releaseNoteProblems(
				releaseSettingsWith({ releasedValues: ['Released'], releasedTransition: 'released' }),
			),
		).toEqual([]);

		// And the exact pair reports nothing.
		expect(
			releaseNoteProblems(releaseSettingsWith({ releasedValues: ['Released'], releasedTransition: 'Released' })),
		).toEqual([]);

		// **An UNCONFIGURED list is not a mismatch**, and this one matters far beyond the
		// message: `releaseNoteProblems` is the release view's `writeProblems`, so a
		// problem reported here blocks every write the view has — the status chip, the
		// description, the released date — plus generation. A half-configured closing
		// action must not disable the editing screen around it. Withholding the CLOSE
		// action is `closeOffer`'s job, and it names `releasedStatusValues` for the reader.
		expect(
			releaseNoteProblems(releaseSettingsWith({ releasedValues: [], releasedTransition: 'Released' })),
		).toEqual([]);
	});

	it('reports a membership key aimed at any item-side property, except the backlog’s own release key', () => {
		// `releaseProperty` bound, or the exemption below would compare against '' — the
		// same value the unbound case already checks, and the test would pass whether or
		// not the exemption existed.
		const plan = resolveSettings(new FakeViewConfig({ releaseProperty: 'note.release' }) as never);

		// Derived from `ownedProperties`, not a list of roles somebody thought of: `tags` is
		// the case a four-role check passes and this one catches.
		expect(membershipCollision(releaseSettingsWith({ membershipKey: plan.typeKey }), plan)).not.toBeNull();
		expect(membershipCollision(releaseSettingsWith({ membershipKey: plan.tagsKey }), plan)).not.toBeNull();

		// The ONE exemption, and it is the shipped default rather than an edge case: the
		// backlog view's own release property and this view's membership key legitimately
		// name one property. Sharing a suggestion is not sharing a setting.
		const releaseKey = optionalKeyFor(plan, 'release');
		expect(membershipCollision(releaseSettingsWith({ membershipKey: releaseKey }), plan)).toBeNull();

		// And an unbound key is not a collision — it is the offer predicate's business.
		expect(membershipCollision(releaseSettingsWith({ membershipKey: '' }), plan)).toBeNull();
	});

	it('reports a membership key aimed at a property the RELEASE NOTE itself owns', () => {
		// The second population, and the gap neither report could see: `configProblems` has
		// no membership role and `releaseNoteProblems` deliberately excludes the item side,
		// so `membershipKey` pointed at this view's own status or released-date key was
		// reported by nothing — while every release in the base counted itself among the
		// unresolved memberships, a figure that scales with the vault.
		const plan = resolveSettings(new FakeViewConfig({}) as never);
		for (const key of ['versionKey', 'targetDateKey', 'statusKey', 'releasedDateKey', 'descriptionKey'] as const) {
			const settings = releaseSettingsWith({ [key]: 'shared', membershipKey: 'shared' });
			expect(membershipCollision(settings, plan), key).not.toBeNull();
		}

		// Derived from `releaseOwnedProperties`, the same list `releaseNoteProblems` reads,
		// so a release property added later is covered by being declared once. A key this
		// view names nowhere is outside what any check can see, and stays a clean answer.
		expect(
			membershipCollision(releaseSettingsWith({ membershipKey: 'nothing-names-this' }), plan),
		).toBeNull();
	});
});
