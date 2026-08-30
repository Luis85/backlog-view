# Closing a release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the release view its two closing actions — `Mark as released` (one gated frontmatter batch on the release note) and `Generate release notes` (one plugin-owned Markdown file, written whole).

**Architecture:** Both actions sit in an actions area on the release scope screen, drawn *before* `renderScope`'s two early returns so an empty release can still reach them. Marking plans one `ReleaseWrite` carrying both sets through the existing `ReleaseView.applyRelease` gate; generation composes text in `domain/` and writes through a generic file writer extracted from `storage/readmeFile.ts`. No new write path bypasses `storage/`.

**Tech Stack:** TypeScript 6.0.x (pinned `~6.0.3`), Obsidian API 1.12.0 (pinned exactly), vitest 4 with jsdom for view tests and node for domain/storage tests, esbuild.

**Design spec:** `docs/superpowers/specs/2026-08-29-closing-a-release-design.md`. Read it before Task 1 — it records three corrections to the PBIs and two deliberate narrowings, and the reasoning behind several checks that look redundant until you know what they caught.

## Global Constraints

- **Four layers, outermost first: `main → commands → view → storage → domain`.** Each may reach anything below it and nothing above. `ui/` and `i18n/` are leaves. Enforced by `no-restricted-imports` in `eslint.config.mjs`; a violation fails `npm run lint`.
- **400-line max per `src/` file**, 450 per `test/` file. Lint-enforced.
- **Every user-visible string comes from `src/i18n/en.ts` via `t()`.** Never a literal at a setter, a `new Notice`, or one of the thirteen banned option-bag properties. `en.ts` is data — no imports, no logic.
- **Nothing writes frontmatter outside `storage/frontmatter.ts`, `storage/propertyWrite.ts`, `storage/createNote.ts` and `storage/absenceNotes.ts`.** `no-restricted-syntax` bans `processFrontMatter` and `vault.create` everywhere else.
- **Coverage thresholds only ever go up** (`vitest.config.mts`). Do NOT raise them in this increment — `docs/issues/The coverage figure is not reproducible to a hundredth.md` records why a rise needs a reproducible figure.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore. This is not optional and several steps below call for it explicitly.
- **Definition of done:** `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register). All five must pass before committing.
- **Commit style:** imperative subject describing the behaviour, not the mechanism. No model identifier anywhere in a commit message, PR body, or code comment.

---

### Task 1: Three new view options, resolved onto `ReleaseSettings`

**Files:**
- Modify: `src/domain/releaseOptions.ts` (the `ReleaseSettings` interface, `releaseGroup()`, `resolveReleaseSettings`)
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releaseOptions.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ReleaseSettings.releasedValues: string[]`, `ReleaseSettings.releasedTransition: string`, `ReleaseSettings.notesFolder: string`. Option keys `releasedStatusValues`, `releasedTransitionValue`, `releaseNotesFolder`. Every later task reads these exact names.

**Note on the spec:** its `## Where it lives` says `src/domain/settingsResolve.ts` gains the three fields. That is wrong — `resolveReleaseSettings` lives in `src/domain/releaseOptions.ts`. Follow the code, not the spec line.

- [ ] **Step 1: Write the failing test**

Add to `test/domain/releaseOptions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/releaseOptions.test.ts -t 'three closing options'`
Expected: FAIL — the properties do not exist on the resolved object.

- [ ] **Step 3: Add the three fields to `ReleaseSettings`**

In `src/domain/releaseOptions.ts`, inside the interface, after `statusValues`:

```ts
	/**
	 * Which of this vault's release statuses mean ALREADY OUT. Empty is unconfigured
	 * rather than "none" — the action is absent either way, and the distinction is only
	 * ever read as "say which option to bind".
	 */
	releasedValues: string[];
	/**
	 * The ONE value `Mark as released` writes. A list is not a choice: a view that picked
	 * from `releasedValues` would write a different status depending on how somebody
	 * ordered it.
	 */
	releasedTransition: string;
	/** Where `Generate release notes` files its output. A PATH, not a property key, and
	 *  with no default: the action does not choose a folder on the reader's behalf. */
	notesFolder: string;
```

- [ ] **Step 4: Resolve them**

In `resolveReleaseSettings`, beside `statusValues`:

```ts
		releasedValues: list('releasedStatusValues'),
		releasedTransition: str('releasedTransitionValue'),
		notesFolder: str('releaseNotesFolder'),
```

- [ ] **Step 5: Declare the options**

In `releaseGroup()`, after the `releaseStatusValues` entry. Note `getReleaseViewOptions(config)` must stop ignoring its parameter — rename `_config` to `config` and thread it into `releaseGroup(config)`:

```ts
			{
				type: 'text',
				key: 'releasedStatusValues',
				displayName: t('release.option.releasedValues'),
				placeholder: t('release.option.releasedValuesHint'),
			},
			{
				// A DROPDOWN over the list above, which is what `getReleaseViewOptions`'
				// config parameter is for: it makes "the transition value is one of the
				// released values" structural at the point of entry. It does not make it
				// TRUE — a hand-edited `.base` stores what it likes, which is why Task 2
				// adds the read-back check as well.
				type: 'dropdown',
				key: 'releasedTransitionValue',
				displayName: t('release.option.transitionValue'),
				options: Object.fromEntries(releasedValuesOf(config).map((value) => [value, value])),
			},
			{
				type: 'folder',
				key: 'releaseNotesFolder',
				displayName: t('release.option.notesFolder'),
				placeholder: 'docs/release-notes',
			},
```

And beside it, the reader the dropdown and the resolver share, so the option list and the resolved value cannot disagree:

```ts
/** The declared released values, read straight off the config for the dropdown that
 *  offers them — the same text `resolveReleaseSettings` turns into `releasedValues`. */
function releasedValuesOf(config: BasesViewConfig): string[] {
	const raw = config.get('releasedStatusValues');
	return typeof raw === 'string' ? raw.split(',').map((v) => v.trim()).filter((v) => v !== '') : [];
}
```

- [ ] **Step 6: Add the four catalog keys**

In `src/i18n/en.ts`, beside the other `release.option.*` entries:

```ts
	'release.option.releasedValues': 'Statuses that mean released',
	'release.option.releasedValuesHint': 'Released, Archived',
	'release.option.transitionValue': 'Status to write when releasing',
	'release.option.notesFolder': 'Release notes folder',
```

- [ ] **Step 7: Run the test and the whole options suite**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: PASS, including the existing "resolves each key, and leaves an unconfigured one empty".

- [ ] **Step 8: Commit**

```bash
git add src/domain/releaseOptions.ts src/i18n/en.ts test/domain/releaseOptions.test.ts
git commit -m "Bind the statuses that mean released, and where notes are filed"
```

---

### Task 2: Two refusals in `releaseNoteProblems`

**Files:**
- Modify: `src/domain/settingsConsistency.ts` (`releaseNoteProblems`)
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releaseOptions.test.ts` (this file already covers `releaseNoteProblems`)

**Interfaces:**
- Consumes: `ReleaseSettings.releasedValues`, `.releasedTransition`, `.releasedDateKey`, `.targetDateKey` (Task 1).
- Produces: nothing new — `releaseNoteProblems(settings)` keeps its `string[]` shape, so `WriteGate.writeProblems` and `createRelease` need no change.

- [ ] **Step 1: Write the failing tests**

```ts
it('refuses a released date aimed at the target date, and a transition outside the list', () => {
    // Same key for the plan and the record: a released date written onto the target date
    // destroys the only evidence a release slipped, which is the one thing nobody can
    // reconstruct afterwards.
    const collided = releaseNoteProblems(
        settingsWithReleaseKeys({ targetDateKey: 'due', releasedDateKey: 'due' }),
    );
    expect(collided.join(' ')).toContain('due');

    // A hand-edited `.base` can spell a transition the dropdown never offered.
    const stray = releaseNoteProblems(
        settingsWithReleaseKeys({ releasedValues: ['Released'], releasedTransition: 'Shipped' }),
    );
    expect(stray.join(' ')).toContain('Shipped');

    // And the legal pair reports nothing.
    expect(
        releaseNoteProblems(settingsWithReleaseKeys({ releasedValues: ['Released'], releasedTransition: 'Released' })),
    ).toEqual([]);
});
```

Add the fixture helper at the top of the file if it is not already there:

```ts
/** A fully bound `ReleaseSettings` with the named fields overridden — so each test states
 *  only the relationship it is about. */
function settingsWithReleaseKeys(over: Partial<ReleaseSettings>): ReleaseSettings {
    return { ...resolveReleaseSettings(new FakeViewConfig(RELEASE_CONFIG) as never), ...over };
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/releaseOptions.test.ts -t 'refuses a released date'`
Expected: FAIL — both lists come back empty.

- [ ] **Step 3: Implement both refusals**

At the end of `releaseNoteProblems`, before `return problems`:

```ts
	// The plan and the record must be two keys. This is NOT expressible through the
	// `owned` collision map above, because that reports a key claimed by two ROLES and
	// these two roles are both legitimately date keys — what is wrong is specifically
	// that a record overwriting the plan destroys the evidence a release slipped.
	if (settings.releasedDateKey !== '' && settings.releasedDateKey === settings.targetDateKey) {
		problems.push(t('settings.releasedIsTarget', { key: settings.releasedDateKey }));
	}
	// The dropdown offers only declared values; a hand-edited `.base` is why this is asked
	// again at read time. Empty is unconfigured and is the offer predicate's business
	// (Task 6), never a collision.
	if (settings.releasedTransition !== '' && !settings.releasedValues.includes(settings.releasedTransition)) {
		problems.push(t('settings.transitionNotReleased', { value: settings.releasedTransition }));
	}
```

- [ ] **Step 4: Add the two catalog keys**

```ts
	'settings.releasedIsTarget': 'the released date and the target date both use {key}',
	'settings.transitionNotReleased': '{value} is not one of the statuses that mean released',
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch each refusal fail on its own**

Comment out the first `problems.push` block, run the test, see it fail on the `'due'` assertion; restore. Repeat for the second. This is the "watched failing" rule — a fragment that never fires reads exactly like one that does.

- [ ] **Step 7: Commit**

```bash
git add src/domain/settingsConsistency.ts src/i18n/en.ts test/domain/releaseOptions.test.ts
git commit -m "Refuse a record that overwrites the plan, and a status nothing declares"
```

---

### Task 3: The membership-collision check

**Files:**
- Modify: `src/domain/settingsConsistency.ts` (new exported function beside `releaseNoteProblems`)
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releaseOptions.test.ts`

**Interfaces:**
- Consumes: `ownedProperties(settings: BacklogSettings)` from `src/domain/optionalProperties.ts`, `ReleaseSettings.membershipKey`.
- Produces: `membershipCollision(release: ReleaseSettings, plan: BacklogSettings): string | null` — the offending key's message, or null. Task 12 calls it as one of generation's three gates.

**Why it is not folded into `releaseNoteProblems`:** that function is over the keys read and written on the release NOTE, and its exemption of the item-side keys is load-bearing — a release's status and an item's workflow state may legitimately name one property, because they are read of different notes. Adding an item-side key to its list would refuse the shipped default.

- [ ] **Step 1: Write the failing test**

```ts
it('reports a membership key aimed at any item-side property, except the backlog’s own release key', () => {
    const plan = resolveSettings(new FakeViewConfig({}) as never);

    // Derived from `ownedProperties`, not a list of roles somebody thought of: `tags` is
    // the case a four-role check passes and this one catches.
    expect(membershipCollision(settingsWithReleaseKeys({ membershipKey: plan.typeKey }), plan)).not.toBeNull();
    expect(membershipCollision(settingsWithReleaseKeys({ membershipKey: plan.tagsKey }), plan)).not.toBeNull();

    // The ONE exemption, and it is the shipped default rather than an edge case: the
    // backlog view's own release property and this view's membership key legitimately
    // name one property. Sharing a suggestion is not sharing a setting.
    const releaseKey = optionalKeyFor(plan, 'release');
    expect(membershipCollision(settingsWithReleaseKeys({ membershipKey: releaseKey }), plan)).toBeNull();

    // And an unbound key is not a collision — it is the offer predicate's business.
    expect(membershipCollision(settingsWithReleaseKeys({ membershipKey: '' }), plan)).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/releaseOptions.test.ts -t 'membership key aimed at'`
Expected: FAIL — `membershipCollision` is not defined.

- [ ] **Step 3: Implement it**

```ts
/**
 * Whether this view's membership key is aimed at a property the MODEL already owns — the
 * gap neither collision report above can see. `configProblems` has no membership role,
 * and `releaseNoteProblems` deliberately excludes the item side.
 *
 * It matters because `membershipTarget` resolves whatever that key holds as a release
 * link: pointed at the type key it reads `type: PBI` as a membership, every scope reads
 * empty, and a generated notes file would say the release contained nothing — over a
 * previously valid one saying what shipped. Empty and unreadable are different answers,
 * and this is what keeps them apart.
 *
 * DERIVED from `ownedProperties` rather than naming roles, so a property added later is
 * covered without anybody remembering this function. One exemption: `release` is itself
 * an optional property — the BACKLOG view's own membership key — and the two legitimately
 * agree. That is the shipped default, not an edge case.
 */
export function membershipCollision(release: ReleaseSettings, plan: BacklogSettings): string | null {
	if (release.membershipKey === '') return null;
	for (const { role, key } of ownedProperties(plan)) {
		if (role === 'release' || key === '') continue;
		if (key === release.membershipKey) return t('settings.membershipCollides', { key, role: t(`property.${role}`) });
	}
	return null;
}
```

- [ ] **Step 4: Add the catalog key**

```ts
	'settings.membershipCollides': 'the release membership property and {role} both use {key}',
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run test/domain/releaseOptions.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch the exemption fail**

Delete `role === 'release' ||` from the guard and run the test. Expected: FAIL on the exemption assertion — which is the shipped default, so this is the direction that would have broken every vault taking the defaults. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/domain/settingsConsistency.ts src/i18n/en.ts test/domain/releaseOptions.test.ts
git commit -m "See a membership key pointed at a property the model owns"
```

---

### Task 4: `role` moves onto the set, and one planner carries both fields

**Files:**
- Modify: `src/domain/releaseWritePlan.ts` (`ReleaseWrite`, `fieldWrite`, `reconfiguredKey`, and a new planner)
- Modify: `src/view/release/releaseEdits.ts` (call sites only — the three existing planners keep their signatures)
- Test: `test/domain/releaseWritePlan.test.ts`

**Interfaces:**
- Consumes: `ReleaseSettings.releasedTransition` (Task 1), `PropertySet` from `src/domain/estimationWritePlan.ts`.
- Produces:
  - `interface ReleaseSet extends PropertySet { role: ReleaseField }` — the role is now per SET.
  - `ReleaseWrite` keeps `{ file, sets: ReleaseSet[], requiresType }` and **loses** its own `role`.
  - `releaseClosureWrites(file: TFile, settings: ReleaseSettings, current: { status: string | null; released: CivilDate | null }, raw: { status: unknown; released: unknown }, today: CivilDate): ReleaseWrite[]` — one write, two sets, or `[]` when there is nothing to write.

**`current` and `raw` are two different readings of the same two fields, and the planner
needs both.** `current` is `ReleaseRow`'s NORMALISED value — `readString` trims, and
coerces a number or a boolean to its string form — and that is the right reading for the
"already at the transition value" no-op test, which is case-insensitive like every other
pick in this plugin. `raw` is what the frontmatter literally holds, and that is the only
thing `expects` may carry: the writer compares it against the live raw value, so a note
spelling `status: " In progress "` would never match its own normalised reading and the
action would be offered and then always refused, with no concurrent edit anywhere. Two
readings, two jobs; the view supplies both because only it has the metadata cache.

**Why `role` moves:** `reconfiguredKey` compares each set's key against `ROLE_KEYS[write.role]`. A two-set write under one role would compare the date key against the status key and refuse every release. Per-set roles keep that check exactly as PR #211 built it — still per role, still catching the swapped-options case a union test let through — while letting one write carry two fields.

- [ ] **Step 1: Write the failing test for the planner**

```ts
it('plans the status and the date as ONE write with two sets', () => {
    const file = new TFile('0.9.md');
    const settings = settingsWithReleaseKeys({
        statusKey: 'status',
        releasedDateKey: 'released',
        releasedTransition: 'Released',
    });
    const writes = releaseClosureWrites(file, settings, { status: 'In progress', released: null }, { status: ' In progress ', released: undefined }, TODAY);

    // ONE write, because `applyPropertyWrites` opens one `processFrontMatter` per write:
    // two writes would be two saves, and a retype between them would land the status and
    // refuse the date — a release marked shipped with no record of when.
    expect(writes).toHaveLength(1);
    expect(writes[0].sets.map((s) => [s.key, s.value])).toEqual([
        ['status', 'Released'],
        ['released', '2026-08-29'],
    ]);
    // The role is on each SET now, so `reconfiguredKey` can still ask per role.
    expect(writes[0].sets.map((s) => s.role)).toEqual(['status', 'released']);
    expect(writes[0].requiresType).toBe('Release');
    // The RAW spelling, not the trimmed reading: this is the value the writer compares
    // against the live frontmatter, and a normalised one would never match it.
    expect(writes[0].sets[0].expects).toBe(' In progress ');
});

it('plans nothing when the release is already at the transition value', () => {
    const settings = settingsWithReleaseKeys({ statusKey: 'status', releasedDateKey: 'released', releasedTransition: 'Released' });
    // `sameValue`, case-insensitively, the rule every other pick in this plugin keeps.
    expect(releaseClosureWrites(new TFile('0.9.md'), settings, { status: 'released', released: null }, { status: 'released', released: undefined }, TODAY)).toEqual([]);
});
```

with, at the top of the file:

```ts
const TODAY: CivilDate = { year: 2026, month: 8, day: 29 };
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts -t 'ONE write with two sets'`
Expected: FAIL — `releaseClosureWrites` is not defined.

- [ ] **Step 3: Move `role` onto the set**

In `src/domain/releaseWritePlan.ts`:

```ts
/** One key to set, carrying the FIELD it was planned for. The role is per set rather than
 *  per write because one write may now carry two fields, and `reconfiguredKey` has to ask
 *  each key against its own role's key — a two-set write under a single role would compare
 *  the date key against the status key and refuse every release. */
export interface ReleaseSet extends PropertySet {
	role: ReleaseField;
}

export interface ReleaseWrite extends PropertyWrite {
	sets: ReleaseSet[];
}
```

and change `fieldWrite` to put the role on the set:

```ts
	return key === '' ? [] : [{ file, sets: [{ key, value, role }], requiresType: RELEASE_TYPE }];
```

- [ ] **Step 4: Make `reconfiguredKey` ask each set**

```ts
	for (const write of writes)
		for (const set of write.sets) if (set.key !== settings[ROLE_KEYS[set.role]]) return set.key;
```

- [ ] **Step 5: Add the planner**

```ts
/**
 * Closing a release: the transition status and today's date, as ONE write.
 *
 * Not a concatenation of `releaseStatusWrites` and `releaseReleasedWrites` — those return
 * a write each, and `applyPropertyWrites` opens a `processFrontMatter` per write, so the
 * two fields would be two saves. A retype landing between them refuses the second and
 * leaves a release marked shipped with no record of when, which is the one half of this
 * that cannot be reconstructed later.
 *
 * Both sets carry the raw value they EXPECT to find, and `applyPropertyWrites` refuses the
 * whole write if either has moved (Task 5). Deliberately not `ifMissing` on the date: that
 * asks whether the KEY IS PRESENT, and the question here is whether the note holds a
 * readable date — a bare `released:` is present and absent at the same time, which is the
 * commonest shape in a vault.
 */
export function releaseClosureWrites(
	file: TFile,
	settings: ReleaseSettings,
	current: { status: string | null; released: CivilDate | null },
	raw: { status: unknown; released: unknown },
	today: CivilDate,
): ReleaseWrite[] {
	if (settings.statusKey === '' || settings.releasedDateKey === '' || settings.releasedTransition === '') return [];
	// The NORMALISED reading, case-insensitively — the rule every other pick keeps.
	if (current.status !== null && sameValue(current.status, settings.releasedTransition)) return [];
	return [
		{
			file,
			requiresType: RELEASE_TYPE,
			sets: [
				// The RAW value, never `current.status`: the writer compares this against
				// what the frontmatter literally holds, and `readString` trims and coerces.
				// A note spelling `status: " In progress "` reads as valid and would never
				// equal its own normalised form, so the action would be offered and then
				// always refused with nothing concurrent happening at all.
				{ key: settings.statusKey, value: settings.releasedTransition, role: 'status', expects: raw.status },
				{ key: settings.releasedDateKey, value: formatCivil(today), role: 'released', expects: null },
			],
		},
	];
}
```

- [ ] **Step 6: Fix the three existing call sites**

`releaseEdits.ts` reads no `write.role`, so nothing changes there. Run the type checker to confirm:

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If one appears, it is a reader of `ReleaseWrite.role` — move it to the set it is about rather than restoring the field.

- [ ] **Step 7: Run the write-plan suite**

Run: `npx vitest run test/domain/releaseWritePlan.test.ts test/view/releaseWrites.test.ts`
Expected: PASS. `reconfiguredKey`'s existing swapped-options test must still pass — that is the PR #211 case, now asked of per-set roles.

- [ ] **Step 8: Watch the per-set role matter**

Temporarily change `ROLE_KEYS[set.role]` back to a single `ROLE_KEYS['status']` and run `test/domain/releaseWritePlan.test.ts`. Expected: FAIL — the date set's key is compared against the status key. Restore.

- [ ] **Step 9: Commit**

```bash
git add src/domain/releaseWritePlan.ts test/domain/releaseWritePlan.test.ts
git commit -m "Plan the status and the day it shipped as one save"
```

---

### Task 5: A set may state the value it expects

**Files:**
- Modify: `src/domain/estimationWritePlan.ts` (`PropertySet`)
- Modify: `src/storage/propertyWrite.ts` (`applyPropertyWrites`)
- Modify: `src/i18n/en.ts`
- Test: `test/storage/propertyWrite.test.ts`

**Interfaces:**
- Consumes: `ReleaseSet.expects` as planned in Task 4.
- Produces: `PropertySet.expects?: unknown` — when present, the live raw value at that key must equal it or the WHOLE write is refused, loudly, before anything is set.

**Why inside the callback:** the permission being asked is about the bytes being replaced, and only the `processFrontMatter` callback sees those. A check before the call narrows the window without closing it, and this module's own header already makes that argument about `read`-then-`modify`.

- [ ] **Step 1: Write the failing test**

```ts
it('refuses the whole write when a set’s expected value has moved', async () => {
    const vault = new FakeVault();
    vault.addFile('0.9.md', { frontmatter: { type: 'Release', status: 'In progress' } });
    const file = vault.file('0.9.md');

    // Another window marks it released while our dialog is open. The plan expected
    // 'In progress'; the note now says otherwise, so NEITHER set may land — writing
    // today's date over the day it actually shipped is the failure this prevents.
    vault.onNextProcess('0.9.md', (fm) => {
        fm.status = 'Released';
        fm.released = '2026-08-01';
    });

    const outcome = await applyPropertyWrites(vault.app, [
        {
            file,
            requiresType: 'Release',
            sets: [
                { key: 'status', value: 'Released', expects: 'In progress' },
                { key: 'released', value: '2026-08-29', expects: null },
            ],
        },
    ], 'type');

    expect(outcome.changed).toBe(false);
    expect(vault.frontmatter('0.9.md').released).toBe('2026-08-01');
});
```

If `FakeVault` has no `onNextProcess`, add it beside its `processFrontMatter` double: a one-shot callback run against the live frontmatter object immediately before the caller's own callback, which is what "the note moved between the plan and the write" means here.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/storage/propertyWrite.test.ts -t 'expected value has moved'`
Expected: FAIL — the date is overwritten with `2026-08-29`.

- [ ] **Step 3: Declare the field**

In `src/domain/estimationWritePlan.ts`:

```ts
/** One key to set. `value: null` REMOVES the key; `ifMissing` writes only when the
 *  live note lacks the key already — never overwriting an answer that is there. */
export interface PropertySet {
	key: string;
	value: unknown;
	ifMissing?: boolean;
	/**
	 * The raw value this set expects to find on the live note. When present and the live
	 * value differs, `applyPropertyWrites` refuses the WHOLE write — every set of it —
	 * rather than dropping this one: a batch whose fields have to land together is not
	 * improved by landing half of it.
	 *
	 * `applyRestores`' compare-and-swap, asked of a forward write. It exists because the
	 * live TYPE check beside it is not enough: a note can keep its type while the very
	 * field being written moves under an open dialog.
	 */
	expects?: unknown;
}
```

- [ ] **Step 4: Check it inside the callback**

In `applyPropertyWrites`, inside `processFrontMatter` after the `requiresType` check and before `const keys = ...`:

```ts
				// Asked HERE, not before the call: the permission is about the bytes being
				// replaced, and only this callback sees those. A set whose expected value
				// has moved refuses the whole write — the fields of one write are meant to
				// land together, so landing the rest is the split state, not a partial
				// success. `sameRaw` rather than `===`, the comparison `applyRestores`
				// already makes about the same question.
				const moved = sets.find(
					(s) => 'expects' in s && !sameRaw(rawValueOf(fm, s.key), { present: true, value: s.expects } as RawValue),
				);
				if (moved !== undefined) {
					refusal = t('gate.valueMoved', { property: moved.key });
					return;
				}
```

Note `expects: null` must compare equal to an ABSENT key as well as to a null-valued one — both are "no value here". Extend the comparison rather than special-casing at the call site:

```ts
/** Whether the live value is the one a set expected. `null` and `undefined` both expect
 *  ABSENT — a missing key and an explicit `released:` are the same answer to "is there a
 *  value here", and a presence-only test gets the second one wrong.
 *
 *  `undefined` is not a nicety: `readLabel` calls a missing key valid-and-absent, so the
 *  action is OFFERED on a release whose status property is not there, and `ownValue`
 *  hands that plan `undefined` as the value to expect. Treating it as a moved value
 *  refuses every such release forever — the note that most needs marking. */
function stillExpected(live: RawValue, expected: unknown): boolean {
	if (expected === null || expected === undefined) return !live.present || live.value === null;
	return live.present && sameRaw(live, { present: true, value: expected });
}
```

and use `!stillExpected(rawValueOf(fm, s.key), s.expects)` in the `find` above.

- [ ] **Step 5: Add the catalog key**

```ts
	'gate.valueMoved': 'Nothing was written: {property} changed while the dialog was open.',
```

- [ ] **Step 6: Run the storage suite**

Run: `npx vitest run test/storage/propertyWrite.test.ts`
Expected: PASS, including every existing estimation-view test — no existing planner sets `expects`, so they take the untouched path.

- [ ] **Step 7: Add and watch the explicit-null test**

```ts
it('treats a bare `released:` as absent, and fills it', async () => {
    const vault = new FakeVault();
    // The commonest shape in a vault, and the one a raw-presence guard gets wrong:
    // `hasOwnProperty` is true, every reading in the plugin calls it absent.
    vault.addFile('0.9.md', { frontmatter: { type: 'Release', status: 'In progress', released: null } });
    await applyPropertyWrites(vault.app, [
        { file: vault.file('0.9.md'), requiresType: 'Release', sets: [{ key: 'released', value: '2026-08-29', expects: null }] },
    ], 'type');
    expect(vault.frontmatter('0.9.md').released).toBe('2026-08-29');
});
```

Run it, then change `stillExpected`'s first branch to `return !live.present` and run again. Expected: FAIL — the write is refused on a note every reader calls dateless. Restore.

- [ ] **Step 7b: Add and watch the ABSENT-key test**

The sibling case, and the one that reaches this function as `undefined` rather than
`null`: a release with no status property at all. `readLabel` calls that valid absence, so
the action is offered, and `ownValue` then hands the plan `undefined`.

```ts
it('treats an absent key as the absence a set expected', async () => {
    const vault = new FakeVault();
    // No `status` key at all. `readLabel(undefined)` is valid-and-absent, so `closeOffer`
    // offers this release — and the raw value the plan captures is `undefined`.
    vault.addFile('0.9.md', { frontmatter: { type: 'Release' } });
    await applyPropertyWrites(vault.app, [
        { file: vault.file('0.9.md'), requiresType: 'Release', sets: [{ key: 'status', value: 'Released', expects: undefined }] },
    ], 'type');
    expect(vault.frontmatter('0.9.md').status).toBe('Released');
});
```

Run it, then drop `|| expected === undefined` from `stillExpected` and run again.
Expected: FAIL — the release can never be marked. Restore.

- [ ] **Step 8: Commit**

```bash
git add src/domain/estimationWritePlan.ts src/storage/propertyWrite.ts src/i18n/en.ts test/storage/propertyWrite.test.ts
git commit -m "Let a set state the value it expects, and refuse the batch when it moved"
```

---

### Task 6: The offer predicate — which options are missing, and whether the fields read

**Files:**
- Modify: `src/domain/releases.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releases.test.ts`

**Interfaces:**
- Consumes: `ReleaseRow` (`.status`, `.released`, `.item.file`), `ReleaseSettings` (Task 1).
- Produces:

```ts
export interface CloseOffer {
	/** Option keys the reader must bind, in the order the panel lists them. Empty when
	 *  everything this action needs is configured. */
	missing: string[];
	/** A field this release holds a value for that no reader can parse, or null. The
	 *  screen names it so the reader repairs the NOTE rather than the configuration. */
	unreadable: 'status' | 'released' | null;
	/** True only when the action may be pressed: nothing missing, nothing unreadable,
	 *  the release not already out, and no date to overwrite. */
	offered: boolean;
}
export function closeOffer(release: ReleaseRow, settings: ReleaseSettings): CloseOffer;
```

Task 8 draws from this. `missing` rather than a boolean is what lets the screen NAME the option to bind, which the withheld button cannot.

**The three answers:** every field this action reads carries `ReleaseFigure`'s unconfigured / invalid / value. A clause added for one field has twice been missed for the other, so the test asks both in one parameterised case.

- [ ] **Step 1: Write the failing tests**

```ts
describe('whether a release may be marked out', () => {
    const BOUND = {
        statusKey: 'status',
        releasedDateKey: 'released',
        releasedValues: ['Released'],
        releasedTransition: 'Released',
    };

    it('offers it on a configured release with a status and no date', () => {
        const offer = closeOffer(rowWith({ status: 'In progress', released: null }), settingsWithReleaseKeys(BOUND));
        expect(offer).toEqual({ missing: [], unreadable: null, offered: true });
    });

    it('names each unbound option rather than only withholding the action', () => {
        // Extension 3a asks the screen to say WHICH option to bind. A boolean cannot.
        expect(closeOffer(rowWith({}), settingsWithReleaseKeys({ ...BOUND, releasedValues: [] })).missing)
            .toEqual(['releasedStatusValues']);
        expect(closeOffer(rowWith({}), settingsWithReleaseKeys({ ...BOUND, releasedDateKey: '' })).missing)
            .toEqual(['releasedDateProperty']);
    });

    it('withholds it when the release is already out', () => {
        // 1a: nothing to write, and nothing to record twice.
        expect(closeOffer(rowWith({ status: 'Released' }), settingsWithReleaseKeys(BOUND)).offered).toBe(false);
    });

    // Both fields, one case: a clause added for one of them has twice been missed for the
    // other, so the check is over the category rather than per field.
    it.each([
        ['status', { status: { value: null, invalid: true, unconfigured: false } }],
        ['released', { released: { value: null, invalid: true, unconfigured: false } }],
    ])('withholds it when %s is present but unreadable', (field, figures) => {
        const offer = closeOffer(rowWith(figures), settingsWithReleaseKeys(BOUND));
        expect(offer.offered).toBe(false);
        expect(offer.unreadable).toBe(field);
    });

    it('withholds it when a date is already recorded', () => {
        // The compare-and-swap protects a date that ARRIVES later; this is the one that
        // was already there when the dialog opened, and it must not be replaced.
        const offer = closeOffer(rowWith({ released: { value: { year: 2026, month: 8, day: 1 }, invalid: false, unconfigured: false } }), settingsWithReleaseKeys(BOUND));
        expect(offer.offered).toBe(false);
    });
});
```

`rowWith` builds a `ReleaseRow` with the named figures overridden and everything else at a benign default — add it beside the file's existing fixtures if one does not exist.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/releases.test.ts -t 'may be marked out'`
Expected: FAIL — `closeOffer` is not defined.

- [ ] **Step 3: Implement it**

```ts
/**
 * Whether `Mark as released` may be pressed on this release, and what to say when not.
 *
 * Answers the MISSING OPTIONS rather than a boolean, because withholding a button is only
 * half of what extension 3a asks for: the screen has to name the option to bind, and a
 * predicate that answered yes/no could not.
 *
 * Every field it reads carries three answers, and both are asked the same way:
 * unconfigured is a configuration problem the reader fixes in the options panel, invalid
 * is a NOTE problem the reader fixes in the note, and only a readable value is an input.
 * The released date is the sharper of the two — it must read as ABSENT, not merely as
 * readable, because a date already there is a record this action must never replace.
 */
export function closeOffer(release: ReleaseRow, settings: ReleaseSettings): CloseOffer {
	const missing: string[] = [];
	if (settings.statusKey === '') missing.push('releaseStatusProperty');
	if (settings.releasedValues.length === 0) missing.push('releasedStatusValues');
	if (settings.releasedTransition === '') missing.push('releasedTransitionValue');
	if (settings.releasedDateKey === '') missing.push('releasedDateProperty');

	// A value no reader can parse is the note's problem, and this screen already refuses
	// to edit one: `drawStatus` draws a marker and no chip for exactly this. Writing over
	// what the control beside it will not touch would be the inconsistency, not the fix.
	const unreadable = release.status.invalid ? 'status' : release.released.invalid ? 'released' : null;

	const alreadyOut = release.status.value !== null && settings.releasedValues.some((v) => sameValue(v, release.status.value ?? ''));
	// ABSENT, not merely readable. A date already recorded is the half of this that cannot
	// be reconstructed, and recording one twice is what 1a withholds the action for.
	const dateFree = release.released.value === null && !release.released.invalid;

	return { missing, unreadable, offered: missing.length === 0 && unreadable === null && !alreadyOut && dateFree };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/domain/releases.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the date clause fail**

Change `dateFree` to `!release.released.invalid` and run. Expected: FAIL on "withholds it when a date is already recorded" — the case three separate write-side guards failed to stop. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/domain/releases.ts src/i18n/en.ts test/domain/releases.test.ts
git commit -m "Answer which options a release closing still needs, and which field cannot be read"
```

---

### Task 7: A confirm dialog

**Files:**
- Create: `src/ui/confirmDialog.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/ui/confirmDialog.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface ConfirmLink {
	label: string;
	open: () => void;
}
export interface ConfirmOptions {
	title: string;
	message: string;
	/** Rows the reader may open — rendered as buttons, never as text, so a keyboard
	 *  reader reaches each one. Empty draws no list at all. */
	links?: ConfirmLink[];
	cta: string;
	onConfirm: () => void;
	onCancel?: () => void;
}
export function openConfirm(app: App, options: ConfirmOptions): void;
```

Obsidian ships no confirm dialog, and every modal in `ui/prompts.ts` collects a value. This one collects a decision.

- [ ] **Step 1: Write the failing test**

```ts
it('confirms, cancels, and opens a listed row without deciding anything', () => {
    const opened: string[] = [];
    let decided: string | null = null;
    openConfirm(app, {
        title: 'Release 0.9?',
        message: '2 members are not finished',
        links: [{ label: 'A', open: () => opened.push('A') }],
        cta: 'Release',
        onConfirm: () => (decided = 'confirm'),
        onCancel: () => (decided = 'cancel'),
    });

    // Opening a row is navigation, not a decision: the dialog stays, nothing is decided.
    modalEl().querySelector<HTMLElement>('.pbl-confirm-link')!.click();
    expect(opened).toEqual(['A']);
    expect(decided).toBeNull();

    modalEl().querySelector<HTMLElement>('.pbl-confirm-cta')!.click();
    expect(decided).toBe('confirm');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/ui/confirmDialog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
import { App, Modal, Setting } from 'obsidian';

/**
 * A yes/no with something to read first — the one dialog shape `ui/prompts.ts` does not
 * cover, because every modal there collects a VALUE and this one collects a decision.
 *
 * `links` are buttons rather than text: each is a real tab stop, and a reader who cannot
 * use a pointer still reaches every row. Opening one is navigation and never a decision —
 * the dialog stays open, which is what lets somebody check three members and then answer.
 */
export function openConfirm(app: App, options: ConfirmOptions): void {
	const modal = new Modal(app);
	modal.titleEl.setText(options.title);
	modal.contentEl.createEl('p', { cls: 'pbl-confirm-message', text: options.message });
	for (const link of options.links ?? []) {
		const btn = modal.contentEl.createEl('button', { cls: 'pbl-confirm-link', text: link.label, attr: { type: 'button' } });
		btn.addEventListener('click', () => link.open());
	}
	let confirmed = false;
	new Setting(modal.contentEl).addButton((b) =>
		b
			.setButtonText(options.cta)
			.setCta()
			.onClick(() => {
				confirmed = true;
				modal.close();
			}),
	);
	// `onClose` rather than a cancel button's own handler, so the escape key and the
	// close box are the same answer as pressing Cancel — three ways out, one meaning.
	modal.onClose = () => (confirmed ? options.onConfirm() : options.onCancel?.());
	modal.open();
}
```

Add `.pbl-confirm-link` styling to `styles/` in the partial that already holds dialog rules — a bare `<button>` inherits nothing, which is the mistake `test/harness/theme.css` recorded on 2026-08-08.

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/ui/confirmDialog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/confirmDialog.ts test/ui/confirmDialog.test.ts styles/
git commit -m "Ask a yes or no with something to read first"
```

---

### Task 8: `Mark as released` — the action, its button, its focus handle and its busy state

**Files:**
- Create: `src/view/release/releaseClose.ts`
- Modify: `src/view/release/renderScope.ts` (an actions area drawn BEFORE both early returns)
- Modify: `src/view/release/releaseView.ts` (`FOCUS_HANDLE_CLASSES`, `syncBusy`)
- Modify: `src/i18n/en.ts`
- Test: `test/view/release/releaseClose.test.ts`

**Interfaces:**
- Consumes: `closeOffer` (Task 6), `releaseClosureWrites` (Task 4), `openConfirm` (Task 7), `ReleaseView.applyRelease`, `releaseScope`'s `ScopeRow[]`.
- Produces: `drawReleaseActions(view: ReleaseView, parentEl: HTMLElement, release: ReleaseRow, scope: ReleaseScope, planSettings: BacklogSettings): void` — the actions area, called from `renderScope`. Task 12 adds the second button to it.

**`planSettings` is a parameter, not a field.** `ReleaseView` builds its `BacklogSettings`
as a LOCAL inside `draw()` and hands it to `renderScope(view, scope, release, planSettings, index)`
— there is no `view.backlogSettings` to read. Thread it through the same way rather than
promoting it to a field: a second reader of that boundary is the defect, not the fix, which
is the reason `resolveReleaseSettings`' own comment already gives about `openIn`.

**Placement is load-bearing:** `renderScope` returns at the unconfigured-membership state and again at the empty-scope state, both above `drawScopeToolbar`. Drawing the actions in the toolbar would make generation unreachable on a release with no members — the one screen extension 1a is about — and would withhold marking for an unbound membership key it does not read. So the actions area goes above both returns.

- [ ] **Step 0: Add the three test helpers these suites share**

`test/helpers/release.ts` has `mountRelease`, `makeReleaseView`, `scopeVault` and
`mountFoldScope`, and none of the three below. Add them there rather than in either test
file — both Task 8's and Task 12's suites use all three, and a fixture written twice is
what `RELEASE_CONFIG`'s own comment warns a rename goes stale against:

```ts
/** A mounted release SCOPE screen, with the release's own frontmatter and any config
 *  overrides the test is about. The one entry point both closing suites use. */
export function releaseScreen(
	release: Record<string, unknown>,
	vault: FakeVault = scopeVault(),
	over: Record<string, unknown> = {},
): ReleaseHarness & { vault: FakeVault; lock: WriteLock } {
	vault.addFile('0.9.md', { frontmatter: { type: 'Release', version: '0.9.0', ...release } });
	const lock = new WriteLock();
	const harness = makeReleaseView(vault, { ...RELEASE_CONFIG, ...over }, { lock });
	harness.view.pick('0.9.md');
	return { ...harness, vault, lock };
}

/** One control by selector — never optional, because every caller already asserted it is
 *  there or is asserting that it is not. */
export function button(view: ReleaseView, selector: string): HTMLButtonElement {
	const el = view.viewEl.querySelector<HTMLButtonElement>(selector);
	if (!el) throw new Error(`control not found: ${selector}`);
	return el;
}

/** Press a control and let its own await settle — the redraw a write triggers is what
 *  every assertion after it reads. */
export async function click(view: ReleaseView, selector: string): Promise<void> {
	button(view, selector).click();
	await flush();
}
```

If `makeReleaseView` does not already accept a `lock`, add it as an option there: Task 8's
and Task 12's busy tests need a lock a SIBLING view can hold, which is the whole point of
those two cases.

Three fixtures beside them, in the same file. Each states only what its own tests are
about, so no test has to read another's vault to know why it passes:

```ts
/** A release whose members span TWO workflows — one ordinary PBI unfinished, one
 *  `Deliverable` finished by its OWN workflow. The fixture that tells `ownWorkflowReading`
 *  apart from `item.done`: a single-workflow vault passes against either. */
export function twoWorkflowVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Unfinished PBI.md', { frontmatter: { type: 'PBI', release: '[[0.9]]', status: 'Doing' } });
	vault.addFile('Done design.md', { frontmatter: { type: 'Deliverable', release: '[[0.9]]', docStatus: 'Published' } });
	return vault;
}

/** A base with no members naming the release at all — the screen `renderScope` returns
 *  early from, and the ONLY place extension 1a can be exercised. */
export function emptyReleaseVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Elsewhere.md', { frontmatter: { type: 'PBI' } });
	return vault;
}

/** The marker a file generated by THIS view for release `0.9` carries — so a test can
 *  plant one and assert it survives, or that another release's does. */
export function ourMarker(release = '0.9'): string {
	return readmeMarker(joinSource('Releases.base', 'Releases', release));
}

/** Press the confirm dialog's CTA and let the write settle. The dialog is mounted on the
 *  BODY, not in the view, so it is queried from `document` rather than `view.viewEl`. */
export async function confirmDialog(): Promise<void> {
	document.querySelector<HTMLElement>('.pbl-confirm-cta, .mod-cta')?.click();
	await flush();
}
```

- [ ] **Step 1: Write the failing tests**

```ts
it('marks a release out, writing the status and the date in one batch', async () => {
    const { view, vault } = releaseScreen({ status: 'In progress' });
    button(view, '.pbl-rel-close').click();
    await confirmDialog();

    expect(vault.frontmatter('0.9.md').status).toBe('Released');
    expect(vault.frontmatter('0.9.md').released).toBe(todayStamp());
});

it('lists the members that are not finished, and no others', async () => {
    // Two questions of the scope rows, not one: `context` false is the POPULATION, and
    // being done is a second question — asked of `ownWorkflowReading`, so a Deliverable
    // finished by its own workflow counts as finished.
    const { view } = releaseScreen({ status: 'In progress' }, twoWorkflowVault());
    button(view, '.pbl-rel-close').click();
    const names = [...document.querySelectorAll('.pbl-confirm-link')].map((el) => el.textContent);
    expect(names).toEqual(['Unfinished PBI']);
});

it('is offered on a release with no members at all', () => {
    // `renderScope` returns before the toolbar on this screen — the actions must be above
    // that return, or the one case extension 1a is about is unreachable.
    const { view } = releaseScreen({ status: 'In progress' }, emptyReleaseVault());
    expect(view.viewEl.querySelector('.pbl-rel-close')).not.toBeNull();
});

it('names the option to bind rather than only withholding the button', () => {
    const { view } = releaseScreen({ status: 'In progress' }, undefined, { releasedStatusValues: '' });
    expect(view.viewEl.querySelector('.pbl-rel-close')).toBeNull();
    expect(view.viewEl.textContent).toContain(en['release.option.releasedValues']);
});

it('refuses when the transition value changed to ANOTHER valid one mid-dialog', async () => {
    // The case a re-asked `closeOffer` cannot catch: the configuration is still perfectly
    // valid, just not the one the reader agreed to.
    const { view, vault } = releaseScreen({ status: 'In progress' }, scopeVault(), {
        releasedStatusValues: 'Released, Archived',
        releasedTransitionValue: 'Released',
    });
    button(view, '.pbl-rel-close').click();
    view.config.set('releasedTransitionValue', 'Archived');
    view.settings = resolveReleaseSettings(view.config);
    await confirmDialog();
    expect(vault.frontmatter('0.9.md').status).toBe('In progress');
});

it('writes to the key it confirmed against, never one remapped mid-dialog', async () => {
    // The KEY moves across this await as well as the value, and this case slips past
    // every guard that reads the live settings: remapped from one EMPTY property to
    // another, `closeOffer` stays valid, the row is unchanged, and `reconfiguredKey`
    // compares the planned key against the NEW role key and agrees with it. Planning
    // against the CAPTURED settings is what turns that check back into a refusal.
    const { view, vault } = releaseScreen({ status: 'In progress' }, scopeVault(), {
        releasedDateProperty: 'note.released',
        releasedStatusValues: 'Released',
        releasedTransitionValue: 'Released',
    });
    button(view, '.pbl-rel-close').click();
    view.config.set('releasedDateProperty', 'note.shipped'); // also empty on this note
    view.settings = resolveReleaseSettings(view.config);
    await confirmDialog();
    // Neither key is written: the batch named `released`, and `reconfiguredKey` refuses it
    // because that is no longer the released-date role's key.
    expect(vault.frontmatter('0.9.md').shipped).toBeUndefined();
    expect(vault.frontmatter('0.9.md').released).toBeUndefined();
    expect(vault.frontmatter('0.9.md').status).toBe('In progress');
});

// BOTH controls, in one parameterised case: registering one and forgetting the other is
// what the focus-handle list exists to prevent, and a test per button is how the second
// one gets forgotten.
it.each(['.pbl-rel-close', '.pbl-rel-notes'])('keeps focus on %s across a metadata refresh', (selector) => {
    const { view } = releaseScreen({ status: 'In progress' }, scopeVault(), { releaseNotesFolder: 'notes' });
    button(view, selector).focus();
    view.onDataUpdated();
    expect(document.activeElement).toBe(view.viewEl.querySelector(selector));
});

it('is disabled while a SIBLING view holds the write lock', () => {
    // A sibling's batch, not this view's: this view's own batch is the case that already
    // worked, and would pass against a guard that only checks local progress.
    const { view, lock } = releaseScreen({ status: 'In progress' });
    lock.begin();
    view.render();
    expect(button(view, '.pbl-rel-close').hasAttribute('disabled')).toBe(true);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/release/releaseClose.test.ts`
Expected: FAIL — no `.pbl-rel-close` in the DOM.

- [ ] **Step 3: Write the action**

`src/view/release/releaseClose.ts`:

```ts
/**
 * The release screen's closing actions. Drawn ABOVE `renderScope`'s two early returns,
 * because the empty-scope screen is the only place extension 1a can be exercised at all
 * and the unconfigured-membership screen withholds nothing that marking reads.
 *
 * Each action keeps its OWN gate: marking reads the release note alone, so membership is
 * none of its business; generation (Task 12) needs the membership key and three collision
 * reports.
 */
export function drawReleaseActions(
	view: ReleaseView,
	parentEl: HTMLElement,
	release: ReleaseRow,
	scope: ReleaseScope,
	planSettings: BacklogSettings,
): void {
	const areaEl = parentEl.createDiv({ cls: 'pbl-rel-actions' });
	drawClose(view, areaEl, release, scope);
	drawGenerate(view, areaEl, release, scope, planSettings); // Task 12 fills this in.
}

function drawClose(view: ReleaseView, areaEl: HTMLElement, release: ReleaseRow, scope: ReleaseScope): void {
	const offer = closeOffer(release, view.settings);
	if (!offer.offered) {
		nameWhatIsMissing(view, areaEl, offer);
		return;
	}
	const btn = areaEl.createEl('button', { cls: 'pbl-rel-close', text: t('release.close.action'), attr: { type: 'button' } });
	btn.disabled = view.gate.writing;
	btn.addEventListener('click', () => askThenClose(view, release, scope));
}
```

with the confirmation:

```ts
function askThenClose(view: ReleaseView, release: ReleaseRow, scope: ReleaseScope): void {
	// Captured BEFORE the await, the rule the root guide states: the batch's own refresh
	// rebuilds `scope` before it resolves.
	const outstanding = unfinishedMembers(release, scope);
	// The SETTINGS the reader is about to agree to — the whole object, not just the
	// transition value. `releaseView.ts` reassigns `this.settings` to a fresh object on
	// every config refresh, so this reference is the configuration as the screen showed
	// it, frozen for the life of the dialog.
	//
	// The whole object rather than the value, because the KEYS move across this await too.
	// A date key remapped from one empty property to another leaves `closeOffer` valid and
	// the row unchanged, and planning against the LIVE settings would then write the date
	// into a property nobody confirmed — with `reconfiguredKey` waving it through, since
	// the planned key would equal the new role key it is compared against. Planning
	// against the CAPTURED keys turns that same check into the refusal it exists to be.
	const confirmed = view.settings;
	// And the RAW frontmatter, which is what the write's own expectations compare against.
	const raw = rawFields(view, release);
	openConfirm(view.app, {
		title: t('release.close.title', { name: release.name }),
		message: outstandingMessage(release, outstanding),
		links: outstanding.map((row) => ({ label: row.item.title, open: () => openTarget(view.openContext(), row.item.file) })),
		cta: t('release.close.action'),
		onConfirm: () => void submitClose(view, release, confirmed, raw),
	});
}

/**
 * The members this release is still waiting on — TWO questions of the scope rows.
 * `context` false is the population (an excluded note naming this release is neither
 * listed nor counted), and each remaining row is then asked whether it is done through
 * `ownWorkflowReading`, never `item.done`: the requirements reading alone gets a
 * `Deliverable` or a test-catalog member backwards.
 */
function unfinishedMembers(release: ReleaseRow, scope: ReleaseScope): ScopeRow[] {
	if (release.done.unconfigured) return [];
	return scope.rows.filter((row) => !row.context && !ownWorkflowReading(row.item).done);
}
```

and the submit, which re-asks everything that can move across the await:

```ts
async function submitClose(
	view: ReleaseView,
	release: ReleaseRow,
	confirmed: ReleaseSettings,
	raw: { status: unknown; released: unknown },
): Promise<void> {
	// The CONFIGURATION moves across an await as well as the note. `reconfiguredKey`
	// compares keys, and this action's two options are VALUES, so it cannot see a
	// transition value edited while the dialog was open. Re-asked, and REFUSED rather
	// than substituted: the reader agreed to what the screen showed them.
	const offer = closeOffer(release, view.settings);
	// TWO questions, and the second is not implied by the first: `closeOffer` says the
	// configuration is still usable, and this says it is still the SAME. A transition
	// changed from one valid released value to another passes the first and fails here,
	// which is the case that would otherwise write a status nobody agreed to.
	if (!offer.offered || view.settings.releasedTransition !== confirmed.releasedTransition) {
		new Notice(t('release.close.changed'));
		return;
	}
	await view.applyRelease(
		releaseClosureWrites(
			release.item.file,
			// The CAPTURED settings, so the keys planned against are the keys confirmed
			// against. A remap since then makes `reconfiguredKey` refuse the batch at the
			// gate — which is the answer wanted here, and the one planning against the
			// live settings quietly loses.
			confirmed,
			{ status: release.status.value, released: release.released.value },
			raw,
			todayCivil(),
		),
	);
}

/** What the note's two closing fields LITERALLY hold right now, for the write's own
 *  expectations. Read from the metadata cache rather than from `ReleaseRow`, whose values
 *  are normalised — the distinction `releaseClosureWrites`' own header states. */
function rawFields(view: ReleaseView, release: ReleaseRow): { status: unknown; released: unknown } {
	const fm = view.app.metadataCache.getFileCache(release.item.file)?.frontmatter;
	return {
		status: ownValue(fm, view.settings.statusKey),
		released: ownValue(fm, view.settings.releasedDateKey),
	};
}
```

- [ ] **Step 4: Call it from `renderScope`**

In `renderScope`, immediately after `drawHeader(...)` and BEFORE the `membershipKey === ''` return:

```ts
	// Above both empty-state returns on purpose — see `releaseClose.ts`'s own header.
	drawReleaseActions(view, view.viewEl, release, scope, planSettings);
```

- [ ] **Step 4b: Watch the captured keys matter**

Change `submitClose`'s planner argument from `confirmed` back to `view.settings` and run
`npx vitest run test/view/release/releaseClose.test.ts -t 'remapped mid-dialog'`.
Expected: FAIL — the date lands in `shipped`, a property the reader never confirmed.
Restore.

- [ ] **Step 5: Register the focus handle and the busy state**

In `releaseView.ts`, add **both** action classes to `FOCUS_HANDLE_CLASSES` — `'pbl-rel-close'` here and `'pbl-rel-notes'` with it, even though Task 12 is what draws the second. Registering one and leaving the other is the exact defect this list exists to stop, and splitting the edit across two tasks is how it would happen: the list is one vocabulary, not a per-button registration.

```ts
	// The two closing actions, added with `releaseClose.ts`. Both are the sharp case this
	// list's header describes rather than the mild one: pressing either CAUSES the redraw
	// that detaches it, so without a handle a keyboard reader pays a lost place for every
	// release they close or write up.
	'pbl-rel-close',
	'pbl-rel-notes',
```

Then correct `syncBusy` — its comment currently states that this view has no write control to disable, which this task makes false:

```ts
	/**
	 * What this view publishes while a batch is in flight: `aria-busy` on the pane, and —
	 * since the closing actions — the actions themselves disabled.
	 *
	 * The premise this method used to state was that this view has no persistent write
	 * control: its two writers opened a menu and a dialog, both gone from the screen
	 * before their batch ran. `releaseClose.ts` is what made that false. A press during a
	 * SIBLING view's batch is the case that matters — `onDataUpdated` defers the model
	 * rebuild while the lock is held, so the press would act on a stale model.
	 */
	private syncBusy(): void {
		this.viewEl.toggleAttribute('aria-busy', this.gate.writing);
		for (const el of this.viewEl.querySelectorAll<HTMLButtonElement>('.pbl-rel-actions button')) {
			el.disabled = this.gate.writing;
		}
	}
```

- [ ] **Step 6: Add the catalog keys**

```ts
	'release.close.action': 'Mark as released',
	'release.close.title': 'Mark {name} as released?',
	'release.close.outstanding': '{count} of {total} members are not finished.',
	'release.close.allDone': 'Everything in this release is finished.',
	'release.close.progressUnreadable': 'Whether this release is finished cannot be read here.',
	'release.close.changed': 'Nothing was written: the release or its configuration changed while the dialog was open.',
	'release.close.bind': 'To mark a release as released, bind {options}.',
	'release.close.unreadableStatus': 'This release’s status cannot be read. Repair it in the note.',
	'release.close.unreadableDate': 'This release’s released date cannot be read. Repair it in the note.',
```

- [ ] **Step 7: Run the suite**

Run: `npx vitest run test/view/release/`
Expected: PASS.

- [ ] **Step 8: Watch the placement matter**

Move the `drawReleaseActions` call below the `scope.rows.length === 0` return and run. Expected: FAIL on "is offered on a release with no members at all". Restore. This is the case the toolbar placement would have lost silently.

- [ ] **Step 9: Commit**

```bash
git add src/view/release/releaseClose.ts src/view/release/renderScope.ts src/view/release/releaseView.ts src/i18n/en.ts test/view/release/releaseClose.test.ts
git commit -m "Close a release from its own screen, with what is unfinished in front of you"
```

---

### Task 9: A marker that names the release it came from

**Files:**
- Modify: `src/domain/readmeMarker.ts` (`joinSource`)
- Test: `test/domain/readmeMarker.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `joinSource(...parts: string[]): string` — variadic. Every existing two-argument call is unaffected. Task 10 joins three parts: base, view, release.

**Why:** Obsidian lets two releases in different folders share a basename, so two releases can want one output name. A marker naming only base › view cannot tell a regeneration from a collision; one naming the release can, as a plain string comparison.

- [ ] **Step 1: Write the failing test**

```ts
it('joins any number of parts, and keeps them apart', () => {
    // Injective with three parts for the same reason it is with two: a release called
    // `b › c` under view `a` must not produce the line view `a › b` release `c` does.
    expect(joinSource('work/P.base', 'Releases', '0.9')).not.toBe(joinSource('work/P.base', 'Releases › 0.9', ''));
    // And the two-argument callers are untouched.
    expect(joinSource('a', 'b')).toBe(joinSource('a', 'b'));
    expect(readmeSource(readmeMarker(joinSource('a', 'b', 'c')))).toBe(joinSource('a', 'b', 'c'));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/readmeMarker.test.ts -t 'any number of parts'`
Expected: FAIL — `joinSource` takes exactly two arguments.

- [ ] **Step 3: Widen it**

```ts
/**
 * The parts of a source, joined so the join can be undone. Each is escaped by
 * `sourceComponent` first, which is what keeps the mapping injective: a view called
 * `b › c` under base `a` must not produce the line view `c` under base `a › b` does.
 *
 * Variadic since the release notes joined a third part — the release the file was
 * generated from, which is what lets a regeneration tell itself from a collision between
 * two releases that share a basename.
 */
export function joinSource(...parts: string[]): string {
	return parts.map(sourceComponent).join(SOURCE_SEPARATOR);
}
```

- [ ] **Step 4: Run the suite**

Run: `npx vitest run test/domain/readmeMarker.test.ts test/storage/readmeFile.test.ts`
Expected: PASS — including every existing README marker test, which is the check that the two-argument callers are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/domain/readmeMarker.ts test/domain/readmeMarker.test.ts
git commit -m "Let a marker name as many parts as its file needs"
```

---

### Task 10: One generated-file writer, two callers

**Files:**
- Modify: `src/storage/readmeFile.ts` (extract the generic writer; `writeBacklogReadme` becomes a thin caller)
- Create: `src/storage/releaseNotesFile.ts`
- Test: `test/storage/readmeFile.test.ts`, `test/storage/releaseNotesFile.test.ts`

**Interfaces:**
- Consumes: `readmeSource`, `readmeMarker` from `domain/readmeMarker.ts`.
- Produces:

```ts
export type GeneratedOutcome = 'created' | 'updated' | 'unchanged' | 'foreign' | 'replaced';
export interface GeneratedWriteResult { outcome: GeneratedOutcome; path: string; previous?: string }
export async function writeGeneratedFile(
	app: App,
	path: string,
	content: string,
	mismatch: 'replace' | 'refuse',
): Promise<GeneratedWriteResult>;
```

and in `releaseNotesFile.ts`:

```ts
export function releaseNotesPath(folder: string, releaseBasename: string): string;
export async function writeReleaseNotes(app: App, folder: string, releaseBasename: string, content: string): Promise<GeneratedWriteResult>;
```

**The one behavioural difference:** README keeps `'replace'` — a renamed base or view must not brick regeneration, and the caller is told whose document it replaced. The notes pass `'refuse'`, because a whole-file write over another release's notes cannot be taken back by the undo slot.

- [ ] **Step 1: Write the failing test for the refusing branch**

```ts
it('refuses a file that becomes another release’s between the read and the write', async () => {
    const vault = new FakeVault();
    const mine = readmeMarker(joinSource('P.base', 'Releases', '0.9'));
    const theirs = readmeMarker(joinSource('P.base', 'Releases', '1.0'));
    vault.addRaw('notes/0.9 release notes.md', `${mine}\nold\n`);

    // Sync lands ANOTHER release's generated file at this path after the read. A callback
    // that only asks "does this parse as a marker" would overwrite the very file the
    // refuse mode exists to protect.
    vault.onNextProcess('notes/0.9 release notes.md', () => vault.setRaw('notes/0.9 release notes.md', `${theirs}\ntheirs\n`));

    const result = await writeGeneratedFile(vault.app, 'notes/0.9 release notes.md', `${mine}\nnew\n`, 'refuse');
    expect(result.outcome).toBe('foreign');
    expect(vault.raw('notes/0.9 release notes.md')).toContain('theirs');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/storage/readmeFile.test.ts -t 'between the read and the write'`
Expected: FAIL — `writeGeneratedFile` is not defined.

- [ ] **Step 3: Extract the generic writer**

Rename `writeBacklogReadme`'s body to `writeGeneratedFile(app, path, content, mismatch)`, taking `path` rather than deriving it, and thread `mismatch` into `replaceExisting`. In that function, the `process` callback becomes:

```ts
	await app.vault.process(existing, (live) => {
		const owner = readmeSource(firstLine(live));
		replaced.push(owner);
		if (owner === null) return live;
		// The REFUSE mode asks a second question here, and it has to be here: sync can put
		// another release's generated file at this path between the read above and this
		// callback, and a test for "is this a marker" would hand it to the writer. The
		// permission is about the bytes being replaced, and only this callback sees those.
		if (mismatch === 'refuse' && owner !== mine) return live;
		return content;
	});
```

with the outcome for a refused mismatch reported as `'foreign'` — the caller's answer is the same either way: this file is not ours to replace.

- [ ] **Step 4: Make `writeBacklogReadme` a thin caller**

```ts
export async function writeBacklogReadme(app: App, folder: string, content: string): Promise<GeneratedWriteResult> {
	const path = readmePath(folder);
	await ensureFolder(app, vaultFolder(folder));
	return writeGeneratedFile(app, path, content, 'replace');
}
```

- [ ] **Step 5: Run the README suite and watch it pass unchanged**

Run: `npx vitest run test/storage/readmeFile.test.ts`
Expected: PASS with no test edited. That is the check on the extraction — the README's behaviour is unchanged by it.

- [ ] **Step 6: Write the release-notes caller**

`src/storage/releaseNotesFile.ts`:

```ts
/**
 * The release notes file: named for the release, refusing anything that is not its own.
 *
 * The basename comes from a note that already exists, so it is already a legal file name
 * and nothing here sanitizes it. The fixed suffix is what keeps the output off the
 * release note itself when somebody points the notes folder at the releases folder — a
 * collision that would otherwise read as a permanent refusal rather than as a mistake.
 */
export function releaseNotesPath(folder: string, releaseBasename: string): string {
	const dir = vaultFolder(folder);
	const name = `${releaseBasename} ${NOTES_SUFFIX}.md`;
	return dir ? `${dir}/${name}` : name;
}

export async function writeReleaseNotes(app: App, folder: string, releaseBasename: string, content: string): Promise<GeneratedWriteResult> {
	const path = releaseNotesPath(folder, releaseBasename);
	// Created, not refused — every write path in this plugin makes its own folder, and a
	// notes file that would not is the only write in the plugin that fails on a folder
	// the reader just named. (A correction to extension 4e, recorded in the spec.)
	await ensureFolder(app, vaultFolder(folder));
	return writeGeneratedFile(app, path, content, 'refuse');
}
```

- [ ] **Step 7: Run both storage suites**

Run: `npx vitest run test/storage/`
Expected: PASS.

- [ ] **Step 8: Watch the refusal's placement matter**

Move the `owner !== mine` test out of the callback to just after the initial `read`, and run the Step 1 test. Expected: FAIL — the file is overwritten. Restore. A test that only arranges the file beforehand cannot tell these two writers apart, which is why this one drives the callback.

- [ ] **Step 9: Commit**

```bash
git add src/storage/readmeFile.ts src/storage/releaseNotesFile.ts test/storage/
git commit -m "One writer for the files this plugin owns, refusing another release's"
```

---

### Task 11: What the generated file says

**Files:**
- Create: `src/domain/releaseNotesText.ts`
- Modify: `src/i18n/en.ts`
- Test: `test/domain/releaseNotesText.test.ts`

**Interfaces:**
- Consumes: `ScopeRow[]` from `releaseScope`, `ALL_TYPES` from `domain/typeVocabulary.ts`, the helpers in `domain/readmeText.ts`, `readmeMarker`/`joinSource` (Task 9).
- Produces: `releaseNotesContent(release: ReleaseRow, rows: ScopeRow[], source: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
it('groups members by type in vocabulary order, keeping the tree’s sequence within each', () => {
    const text = releaseNotesContent(release, rows, SOURCE);
    expect(headings(text)).toEqual(['Feature', 'PBI', 'Bug']);
    // The tree's own sequence, read from the one derivation the reader just looked at —
    // never a second ordering key that could disagree with it.
    expect(text.indexOf('Second PBI')).toBeGreaterThan(text.indexOf('First PBI'));
});

it('files a type outside the vocabulary under other, rather than dropping it', () => {
    // A note that quietly omits work is worse than an untidy heading.
    expect(releaseNotesContent(release, [rowOfType('Sculpture')], SOURCE)).toContain('Sculpture');
});

it('lists no context row, and adding one changes no line', () => {
    const withContext = releaseNotesContent(release, [...rows, contextRow()], SOURCE);
    expect(withContext).toBe(releaseNotesContent(release, rows, SOURCE));
});

it('still writes a file for a release with no members', () => {
    // An empty release notes file is a fact; a missing one is ambiguous.
    expect(releaseNotesContent(release, [], SOURCE)).toContain(en['release.notes.empty']);
});

it('holds no date of its own, so two generations are byte-identical', () => {
    // The easy thing to get wrong, because this action sits beside one whose whole job is
    // writing today's date.
    expect(releaseNotesContent(release, rows, SOURCE)).toBe(releaseNotesContent(release, rows, SOURCE));
    expect(releaseNotesContent(release, rows, SOURCE)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/domain/releaseNotesText.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
/**
 * What the generated release notes say — beside `backlogReadme.ts` and shaped like it:
 * this decides what the document SAYS, `storage/releaseNotesFile.ts` decides whether it
 * may be written at all.
 *
 * **Nothing dated goes in the body.** That is what makes a regeneration over an unchanged
 * release byte-identical, and it is the easy thing to get wrong here because the action
 * beside this one exists to write today's date.
 *
 * It states its own POPULATION once — what this base returned — and never how many notes
 * it could not see, because nothing can count those: membership lives on the item, so an
 * excluded item is invisible to the view. A promise this can keep, in place of one it
 * cannot.
 */
export function releaseNotesContent(release: ReleaseRow, rows: ScopeRow[], source: string): string {
	const members = rows.filter((row) => !row.context);
	const lines = [readmeMarker(source), '', `# ${release.name}`, '', t('release.notes.generated'), '', t('release.notes.population'), ''];
	if (members.length === 0) return `${[...lines, t('release.notes.empty'), ''].join('\n')}`;
	for (const [heading, group] of groupByType(members)) {
		lines.push(`## ${heading}`, '');
		for (const row of group) lines.push(`- ${row.item.title}`);
		lines.push('');
	}
	return lines.join('\n');
}

/** Members by type, in `ALL_TYPES` order, each group keeping the sequence the tree drew.
 *  A type the vocabulary does not know gets its own heading rather than being dropped. */
function groupByType(members: ScopeRow[]): [string, ScopeRow[]][] {
	const known = ALL_TYPES.filter((type) => members.some((row) => sameValue(row.item.typeName, type)));
	const others = members.filter((row) => !ALL_TYPES.some((type) => sameValue(row.item.typeName, type)));
	const groups: [string, ScopeRow[]][] = known.map((type) => [type, members.filter((row) => sameValue(row.item.typeName, type))]);
	return others.length > 0 ? [...groups, [t('release.notes.otherTypes'), others]] : groups;
}
```

- [ ] **Step 4: Add the catalog keys**

```ts
	'release.notes.generated': 'This file is generated. Edits to it do not survive the next regeneration.',
	'release.notes.population': 'It lists what this base returned.',
	'release.notes.empty': 'This release contained nothing.',
	'release.notes.otherTypes': 'Other',
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/domain/releaseNotesText.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch the byte-identical claim fail**

Add `todayStamp()` to the header lines and run. Expected: FAIL on the byte-identical test — which is the claim most worth seeing red, because it reads as obviously true. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/domain/releaseNotesText.ts src/i18n/en.ts test/domain/releaseNotesText.test.ts
git commit -m "Say what a release contained, grouped the way its tree drew it"
```

---

### Task 12: `Generate release notes` — the second button and its three gates

**Files:**
- Modify: `src/view/release/releaseClose.ts` (a second control in the same actions area)
- Modify: `src/i18n/en.ts`
- Test: `test/view/release/releaseNotes.test.ts`

**Interfaces:**
- Consumes: `releaseNotesContent` (Task 11), `writeReleaseNotes` (Task 10), `membershipCollision` (Task 3), `releaseNoteProblems`, `configProblems`, `joinSource` (Task 9), `ReleaseView.gate.writing`.
- Produces: nothing later tasks read.

**Its gate is THREE reports plus membership, and none of them subsumes another:**

1. `configProblems` over the `BacklogSettings` this view already resolves for its model — every ITEM-side collision the file's own sequence depends on. `stateProperty` on the order key makes the model read workflow strings as ranks, and the file would list members in an order nothing can defend.
2. `releaseNoteProblems` — the release-note roles.
3. `membershipCollision` — the gap neither of the others can see.

Plus the membership key being **bound at all**: `membershipTarget` returns null for every item when it is unbound, so every scope reads empty and generation would write "this release contained nothing" over a file saying what shipped. Empty and unreadable are different answers.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes the notes, and opens them', async () => {
    const { view, vault } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes' });
    await click(view, '.pbl-rel-notes');
    expect(vault.raw('notes/0.9 release notes.md')).toContain('First PBI');
});

it('writes a file for a release with no members', async () => {
    // Extension 1a, and the screen `renderScope` returns early from — reachable only
    // because the actions area is drawn above that return.
    const { view, vault } = releaseScreen({ status: 'Released' }, emptyReleaseVault(), { releaseNotesFolder: 'notes' });
    await click(view, '.pbl-rel-notes');
    expect(vault.raw('notes/0.9 release notes.md')).toContain(en['release.notes.empty']);
});

it.each([
    ['configProblems', { stateProperty: 'note.order' }],
    ['releaseNoteProblems', { releasedDateProperty: 'note.target-date' }],
    ['membershipCollision (type)', { membershipProperty: 'note.type' }],
    ['membershipCollision (tags)', { membershipProperty: 'note.tags' }],
])('withholds generation for a collision only %s can see', async (_name, override) => {
    const { view, vault } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes', ...override });
    expect(view.viewEl.querySelector('.pbl-rel-notes')).toBeNull();
    expect(vault.raw('notes/0.9 release notes.md', { optional: true })).toBeNull();
});

it('does NOT withhold it on the shipped default, where both views name one release key', () => {
    // The exemption is the default configuration, not an edge case.
    const { view } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes' });
    expect(view.viewEl.querySelector('.pbl-rel-notes')).not.toBeNull();
});

it('leaves a valid generated file alone when membership is unbound', async () => {
    // The damage is the OVERWRITE, not the missing button, so the criterion is about the
    // file: every scope reads empty with the key unbound, and a file saying the release
    // contained nothing would replace one saying what shipped.
    const { view, vault } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes', membershipProperty: '' });
    vault.addRaw('notes/0.9 release notes.md', `${ourMarker()}\nwhat shipped\n`);
    expect(view.viewEl.querySelector('.pbl-rel-notes')).toBeNull();
    expect(vault.raw('notes/0.9 release notes.md')).toContain('what shipped');
    // Marking is still offered there: it reads the release note alone.
    expect(view.viewEl.querySelector('.pbl-rel-close')).not.toBeNull();
});

it('refuses while a sibling view holds the write lock', async () => {
    // Generation is NOT routed through `applyRelease` — it writes a file, not
    // frontmatter — so nothing else would stop it generating from a membership that is
    // about to change while `onDataUpdated` defers the model rebuild.
    const { view, lock } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes' });
    lock.applying = true;
    view.render();
    expect(button(view, '.pbl-rel-notes').hasAttribute('disabled')).toBe(true);
});

it('names the path it tried when the write fails', async () => {
    // The gate catches whatever its callback throws and reports a generic failure, so a
    // catch OUTSIDE it never runs — this asserts the notice the reader actually gets.
    const { view, vault } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes' });
    vault.failNextWrite('notes/0.9 release notes.md');
    await click(view, '.pbl-rel-notes');
    expect(lastNotice()).toContain('notes/0.9 release notes.md');
});

it('refuses another release\u2019s notes at the same output path', async () => {
    // Extension 4c, and the reason the marker gained a third part. Obsidian lets
    // `a/0.9.md` and `b/0.9.md` coexist, and the output path is built from the BASENAME,
    // so both want `notes/0.9 release notes.md`. The marker is what must tell them
    // apart — which it only does if it names the release by PATH: by name, both markers
    // are the same string and the second generation reads as the first's regeneration,
    // silently overwriting the notes this refusal exists to protect.
    const { view, vault } = releaseScreen({ status: 'Released' }, twoReleasesOneBasename(), { releaseNotesFolder: 'notes' });
    vault.addRaw('notes/0.9 release notes.md', `${markerFor('a/0.9.md')}\nwhat a shipped\n`);
    await click(view, '.pbl-rel-notes'); // the screen is showing b/0.9.md
    expect(vault.raw('notes/0.9 release notes.md')).toContain('what a shipped');
    expect(lastNotice()).toContain(en['release.notes.foreign']);
});

it('HOLDS the lock for the whole write, not just before it', async () => {
    // The disabled attribute and a `gate.writing` check both read the lock at an instant.
    // What this asserts is the window AFTER that: a sibling starting mid-write would land
    // this file from a membership that has since changed, and reading a lock is not
    // taking one.
    const { view, vault } = releaseScreen({ status: 'Released' }, scopeVault(), { releaseNotesFolder: 'notes' });
    let heldDuringWrite = false;
    vault.onNextProcess('notes/0.9 release notes.md', () => (heldDuringWrite = view.gate.writing));
    await click(view, '.pbl-rel-notes');
    expect(heldDuringWrite).toBe(true);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/release/releaseNotes.test.ts`
Expected: FAIL — no `.pbl-rel-notes` in the DOM.

- [ ] **Step 3: Add the control and its gate**

In `releaseClose.ts`, called from `drawReleaseActions` beside `drawClose`:

```ts
function drawGenerate(
	view: ReleaseView,
	areaEl: HTMLElement,
	release: ReleaseRow,
	scope: ReleaseScope,
	planSettings: BacklogSettings,
): void {
	const blocked = generationBlocked(view, planSettings);
	if (blocked !== null) {
		areaEl.createDiv({ cls: 'pbl-rel-actions-note', text: blocked });
		return;
	}
	const btn = areaEl.createEl('button', { cls: 'pbl-rel-notes', text: t('release.notes.action'), attr: { type: 'button' } });
	btn.disabled = view.gate.writing;
	btn.addEventListener('click', () => void generate(view, release, scope));
}

/**
 * Why generation may not run, or null. THREE reports and a binding, and none of the three
 * subsumes another: `configProblems` has no membership role, `releaseNoteProblems`
 * deliberately excludes the item side, and `membershipCollision` is the gap between them.
 */
function generationBlocked(view: ReleaseView, planSettings: BacklogSettings): string | null {
	if (view.settings.notesFolder === '') return t('release.notes.bindFolder');
	// Bound is not the same as READABLE, and this one is not a collision: with the key
	// unbound every scope reads empty, and a file saying the release contained nothing
	// would replace one saying what shipped.
	if (view.settings.membershipKey === '') return t('release.notes.bindMembership');
	const problems = [...configProblems(planSettings), ...releaseNoteProblems(view.settings)];
	const collision = membershipCollision(view.settings, planSettings);
	if (collision !== null) problems.push(collision);
	return problems.length === 0 ? null : t('config.fixFirst', { problems });
}
```

- [ ] **Step 4: Write the action**

First add the gate's thin public entry, in `src/view/writeGate.ts` beside `applySafely`:

```ts
	/**
	 * A vault write that is not a frontmatter batch — the release notes file today.
	 *
	 * Reading `writing` is not the same as HOLDING the lock: generation awaits a folder
	 * create and a file write, and a sibling batch starting inside that window would run
	 * concurrently, landing this file from a membership that has since changed. This takes
	 * the same exclusive section every batch takes.
	 *
	 * It installs no undo slot, because nothing here reports an inverse — a whole-file
	 * write has no per-key restore to offer, which is exactly why the notes writer refuses
	 * another release's file rather than replacing it.
	 */
	runFileWrite<T>(run: () => Promise<T>): Promise<T | null> {
		return this.runExclusively(1, () => run());
	}
```

Then the action, which no longer checks the lock itself — taking it IS the check:

```ts
async function generate(view: ReleaseView, release: ReleaseRow, scope: ReleaseScope): Promise<void> {
	// The same identity `commands/readme.ts` builds for the backlog README, plus the
	// release — `resolveViewIdentity` returns null for an embedded base, where the view
	// name stands alone, which is the fallback that file already states.
	const identity = resolveViewIdentity(view.app, view.viewEl, view.config.name ?? '');
	// `release.path`, never `release.name`. The name is `file.basename`, and the whole
	// reason this marker gained a third part is that two releases in different folders may
	// share a basename — and therefore share this file's OUTPUT path, since that is built
	// from the basename too. A marker naming the basename is identical for both, so the
	// refusing writer would read `b/0.9.md`'s generation as `a/0.9.md`'s regeneration and
	// overwrite the notes it exists to protect. The path is what tells them apart.
	const source = identity
		? joinSource(identity.base, identity.view, release.path)
		: joinSource(view.config.name ?? '', release.path);
	const content = releaseNotesContent(release, scope.rows, source);
	// Through the gate, so `applying` is held for the whole write rather than sampled
	// before it. A sibling batch cannot start underneath this one, and this one is
	// refused (loudly, by the gate) if a sibling got there first.
	//
	// The write's OWN failure is caught INSIDE the callback, not around this call:
	// `runExclusively` catches whatever the callback throws, logs it and shows the
	// generic `writeGate.applyFailed`, then returns null — so a `catch` out here never
	// runs, and extension 4e's "reports the path it tried" would be lost to a message
	// about backlog items. The gate's null then means only one thing: it refused.
	const result = await view.gate.runFileWrite(async () => {
		try {
			return await writeReleaseNotes(view.app, view.settings.notesFolder, release.name, content);
		} catch (err) {
			console.error('Product Backlog: release notes write failed', err);
			new Notice(t('release.notes.failed', { path: releaseNotesPath(view.settings.notesFolder, release.name) }));
			return null;
		}
	});
	if (result === null) return; // Refused by the gate, or failed and already reported.
	new Notice(noticeFor(result));
		// `noticeFor` is a switch over the five outcomes, spelled once here rather than at
		// each branch of the try: the reader is told which of them happened, and
		// `'foreign'` and `'replaced'` are the two that mean nothing was written for them.
		//
		//   function noticeFor(result: GeneratedWriteResult): string {
		//     switch (result.outcome) {
		//       case 'foreign':
		//       case 'replaced':
		//         return t('release.notes.refused', { path: result.path });
		//       case 'unchanged':
		//         return t('release.notes.unchanged', { path: result.path });
		//       default:
		//         return t('release.notes.written', { path: result.path });
		//     }
		//   }
	// Opening is a convenience, not part of the guarantee (5a).
	if (result.outcome !== 'foreign') openTarget(view.openContext(), view.app.vault.getFileByPath(result.path));
}
```

- [ ] **Step 5: Add the catalog keys**

```ts
	'release.notes.action': 'Generate release notes',
	'release.notes.bindFolder': 'To generate release notes, bind the release notes folder.',
	'release.notes.bindMembership': 'To generate release notes, bind the release membership property.',
	'release.notes.busy': 'A write is in progress. Try again when it finishes.',
	'release.notes.failed': 'The release notes could not be written to {path}.',
	'release.notes.written': 'Release notes written to {path}.',
	'release.notes.refused': '{path} was not written by this view and has been left alone.',
	'release.notes.unchanged': 'The release notes at {path} were already up to date.',
```

- [ ] **Step 6: Run the suite**

Run: `npx vitest run test/view/release/`
Expected: PASS.

- [ ] **Step 6b: Watch the marker\u2019s identity matter**

Change the source's third part from `release.path` back to `release.name` and run
`npx vitest run test/view/release/releaseNotes.test.ts -t 'same output path'`.
Expected: FAIL — the second release's generation overwrites the first's notes, because
both markers are the same string. Restore.

- [ ] **Step 7: Watch each gate on its own**

Remove `configProblems(planSettings)` from the spread and run the parameterised test. Expected: FAIL on the `stateProperty: 'note.order'` case only — which is the one a membership-only gate lets through. Restore, then repeat for `membershipCollision`, which fails only the `note.type` and `note.tags` cases.

- [ ] **Step 8: Commit**

```bash
git add src/view/release/releaseClose.ts src/i18n/en.ts test/view/release/releaseNotes.test.ts
git commit -m "Write up what a release shipped, and refuse where the population cannot be read"
```

---

### Task 13: The register, the changelog, and the whole gate

**Files:**
- Modify: `docs/requirements/Marking a release as released.md`
- Modify: `docs/requirements/Generating the release notes.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-08-29-closing-a-release-design.md` (one correction, below)

**Interfaces:** none — this task ships the documentation `docs-check.mjs` rule 7 requires and the changelog entry `RELEASING.md` requires.

- [ ] **Step 1: Name every new module in the two PBIs**

`docs-check.mjs` rule 7 requires every module in `src/` to be SPECIFIED by a use case's `## Where it lives` or an ADR's `## Decision`. A mention anywhere else counts for nothing. Add to `Marking a release as released.md`:

```markdown
## Where it lives

One host method on `src/view/release/releaseClose.ts`, planned in
`src/domain/releaseWritePlan.ts` and applied by `src/storage/propertyWrite.ts` over
`src/view/writeGate.ts`. The status key, its released values, the transition value and the
actual-date key are declared in `src/domain/releaseOptions.ts`, with the same-key refusal
and the transition-value check in `src/domain/settingsConsistency.ts`. Whether the action
is offered at all is `closeOffer` in `src/domain/releases.ts`. The confirmation is
`src/ui/confirmDialog.ts`, and the outstanding list is drawn by
`src/view/release/renderScope.ts`.
```

and to `Generating the release notes.md`:

```markdown
## Where it lives

The text is composed in `src/domain/releaseNotesText.ts`, beside `src/domain/backlogReadme.ts`
and shaped like it, from `src/domain/model.ts` and the vocabulary in
`src/domain/typeVocabulary.ts`. The marker that tells a generated file from a hand-written
one is `src/domain/readmeMarker.ts`. The file is written by `src/storage/releaseNotesFile.ts`
over the generic writer in `src/storage/readmeFile.ts` — the only directory that may put
bytes in the vault — and the output folder is declared in `src/domain/releaseOptions.ts`.
```

- [ ] **Step 2: Record the three corrections and the two narrowings**

In `Marking a release as released.md`, under the use case:

```markdown
**Two narrowings, recorded rather than quietly taken.** Flow 2 asks the confirmation to
state unsatisfied readiness criteria; readiness is [[Answering the readiness checklist]]
and is not built, so the confirmation states outstanding members only. Flow 4 asks for
"the action that moves them"; what shipped is an OPEN, so the per-member transition it
names is not built here — a `Set state` control per row needs a second batch and a second
undo slot beside the release's own.

**And a correction:** `## Where it lives` above named `configProblems`. This view's own
collision report is `releaseNoteProblems`, which did not exist when this note was written.
```

In `Generating the release notes.md`:

```markdown
**A correction to extension 4e.** It lists "the folder does not exist" as a failure to
report; the folder is CREATED instead, because every write path in this plugin makes its
own. What holds of 4e is its second half: a write that fails reports the path it tried and
leaves nothing partial behind.
```

- [ ] **Step 3: Correct the spec's one wrong file path**

The spec's `## Where it lives` says `src/domain/settingsResolve.ts` gains the three resolved fields. `resolveReleaseSettings` lives in `src/domain/releaseOptions.ts`. Fix the line.

- [ ] **Step 4: Add the changelog entries**

Under `## [Unreleased]` / `### Added` in `CHANGELOG.md`:

```markdown
- `Mark as released` on a release's own screen: one gated batch writing the configured
  released status and today's date to the release note and to nothing else, undoable as
  one entry. It asks first, listing the members that are not finished, each openable from
  the dialog. It is withheld — and says which option to bind — until the status property,
  the statuses that mean released, the status to write and the released-date property are
  all configured, and on a release that is already out, that carries a date already, or
  whose status or date cannot be read.
- `Generate release notes` beside it: one Markdown file per release, named for it, grouped
  by type in the order the release's own scope tree draws them. It is written whole and
  regenerating it is byte-identical, it says so at its top, and it refuses a file at that
  path that this view did not write or that belongs to another release. A release with no
  members still gets a file saying so.
```

- [ ] **Step 5: Run the whole gate**

Run: `npm run check`
Expected: PASS — build, lint, coverage-thresholded tests, fallow, and the docs register. Do NOT raise the coverage thresholds; the figure is not reproducible to a hundredth and `docs/issues/The coverage figure is not reproducible to a hundredth.md` records why a rise needs one that is.

- [ ] **Step 6: Commit**

```bash
git add docs/ CHANGELOG.md
git commit -m "Say where the closing actions live, and what they changed"
```

- [ ] **Step 7: Hand over what cannot be checked here**

Obsidian does not run in this repository. Run `npm run test-build` and say plainly in the PR that these three need a live vault:

- the two buttons in a themed vault, and the actions area's spacing against the header and the toolbar around it;
- the generated file as Obsidian renders it, including whether the marker comment is invisible in reading view;
- undo across a real `.base`, which is the only place the single-entry claim can be seen rather than asserted.

`npm run harness` answers the first at Obsidian's DEFAULT colours only, which is not the same question.

## Self-review notes

Checked against the spec, section by section:

- **Two new options + folder** → Task 1. **Two refusals** → Task 2. **Membership collision** → Task 3.
- **One write, both sets, role per set** → Task 4. **Expected-value check inside the callback** → Task 5.
- **Offer predicate, three answers per field, missing options named** → Task 6, drawn in Task 8.
- **Confirmation, outstanding list, two questions of the rows** → Tasks 7 and 8.
- **Marker naming the release** → Task 9. **One writer, two callers, refuse inside `process`** → Task 10.
- **Text, grouping, empty release, byte-identical** → Task 11.
- **Generation's three gates + membership binding + busy** → Task 12.
- **Focus handles + `syncBusy`'s corrected premise** → Task 8, for both buttons (Task 12's button is drawn into the same area, so `syncBusy`'s selector covers it without a second edit).
- **Register, changelog, corrections** → Task 13.

Two spec statements are deliberately NOT implemented, both recorded as narrowings in Task 13: the readiness half of the confirmation, and flow 4's per-member state control.

One spec line is wrong and Task 13 fixes it: `resolveReleaseSettings` is in `releaseOptions.ts`, not `settingsResolve.ts`.
