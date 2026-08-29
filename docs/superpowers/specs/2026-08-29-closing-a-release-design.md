# Closing a release: marking it released, and writing up what shipped

Covers [[Marking a release as released]] and [[Generating the release notes]], the two
PBIs under [[Shipping a release]] and [[Release notes from its own scope]]. Both are
`Nothing yet` in the register; everything either of them writes with already exists.

## The problem

The release view can be read and its scope shaped, but a release never ends. Status is
picked by hand from a menu that knows nothing about shipping, the released date is typed
into a prompt beside it, and the two can be set apart — a release marked out with no
record of when, which is the half nobody can reconstruct later. And what shipped can only
be handed to somebody outside the vault by retyping the backlog.

## The change

Two actions on the release screen's scope toolbar, beside collapse and expand: **Mark as
released**, one gated batch on the release note alone, and **Generate release notes**, one
file the plugin owns, written whole.

They stay two actions with two triggers. Marking a release out is a fact about the plan;
generating a hand-out is a report, and a vault that wants one without the other gets it.

## Marking as released

### Two new options

In `domain/releaseOptions.ts`'s release group, beside the status pair already there:

- **`releasedStatusValues`** — text, a comma list, no default. Which of this vault's
  release statuses mean *already out*. Empty is **unconfigured**, not "none": extension 3a
  says a key with no value list is unconfigured, and the action is absent either way, so
  the distinction is only ever read as "say which option to bind".
- **`releasedTransitionValue`** — the one value this action writes. A **dropdown built
  from `releasedStatusValues`**, which is what `getReleaseViewOptions`' so-far-unused
  `_config` parameter is for. A list is not a choice (3d): a view that picked from the
  list would write a different status depending on how somebody ordered it.

The dropdown makes 3d's second half — a transition value outside the released list is
refused where it is entered — structural rather than a sentence. It does not make it
true: a hand-edited `.base` stores what it likes, which is the pair
`domain/itemHandling.ts` already documents for a dropdown, so the read-back check below
is the half that holds.

### Two refusals, in `releaseNoteProblems`

`domain/settingsConsistency.ts`, not `configProblems`. The PBI's `## Where it lives`
names `configProblems` because it was written on 2026-08-21, before this view had a
collision report of its own; `releaseNoteProblems` is that report and the PBI is
corrected rather than followed.

- **`releasedDateKey` equal to `targetDateKey`** (3c). A record that overwrites the plan
  destroys the only evidence a release slipped.
- **A transition value outside the released values** — the hand-edited case the dropdown
  cannot see.

### When the action is offered

Absent unless the status key, the released values, the transition value and the
released-date key are all bound (3a, 3b), and absent when the release already carries a
value in the released list (1a). Absent, not disabled: the shape `scopeToolbar.ts`
already uses for the hide-done toggle it withholds on an unconfigured workflow.

One new predicate in `domain/releases.ts` answers all of it, so the toolbar asks a
question rather than restating four.

**Absent is only half of what 3a asks for, and a predicate cannot supply the other
half.** Extension 3a says the screen *names the option to bind*, and today the release
screen has guidance for exactly one gap — an unconfigured membership key. A hidden button
and no sentence is a screen that says nothing, which is what the extension exists to
prevent. So the predicate answers with the *missing options*, not a boolean, and the
actions area draws a line naming them.

Where a missing prerequisite is a PROPERTY, the existing `renderReleaseInit(view, el,
'empty', fixes)` is offered beside that line, narrowed to the options the line names —
the mechanism the `noMembership` state already uses, and `releasedDateProperty` is
already among `RELEASE_SUGGESTED_KEYS`, so ✨ binds it with no new candidate.

Where it is **not** a property, no button is offered and the line names the option alone.
The released values, the transition value and the notes folder are the reader's own
vocabulary and their own path; nothing can suggest them, and a ✨ that appeared beside a
sentence it cannot act on would be the dishonest offer `initControl.ts`'s own `fixes`
rule exists to refuse.

### The batch

**Not a concatenation of the two existing planners, and this is the one place the
increment costs a change to a module it would rather only call.** `fieldWrite` returns one
`ReleaseWrite` per field, and `applyPropertyWrites` opens one `processFrontMatter` per
write — so status and date would be two saves, and a retype landing between them would
refuse the second and leave a release marked shipped with no record of when. That is
exactly the half extension 3b says cannot be reconstructed later, produced by the action
meant to prevent it. `storage/propertyWrite.ts`'s own header already states the rule this
breaks: one file's sets land, or fail to land, together.

So a third planner in `domain/releaseWritePlan.ts` returns **one** `ReleaseWrite` carrying
**both sets**, which is the shape the writer was built for — `sets` is a list, and the loop
inside the callback is what makes a score, its total and its stamp one save.

That costs one move: **`role` goes from the write onto the set.** `reconfiguredKey` asks
each set's key against `ROLE_KEYS[write.role]`, so a two-set write under one role would
compare the date key against the status key and refuse every release. Per-set roles keep
that check exactly as PR #211 left it — still per role, still refusing the swapped-options
case the union test let through — while letting one write carry two. Nothing else reads
`ReleaseWrite.role`.

The planner is then handed to `ReleaseView.applyRelease`, which gives, with no other new
plumbing:

- one gate, one undo slot, and one `captureInverse` over both keys rather than two, so
  the two fields are one entry in the undo history rather than two — **but not an atomic
  restore, and the first draft of this line claimed one.** `restoreInto` compares and
  swaps PER KEY: an entry whose live value is no longer what the batch wrote is skipped
  and counted as a conflict while the others are restored. So a status hand-edited after
  marking, with the date untouched, undoes to the newer status and no released date — the
  state extension 3b is about, reached from the other direction. Undo restores each field
  it can still safely restore and reports what it could not; that is the sentence the
  check supports, and the wider one was written ahead of it. Making it all-or-nothing
  means grouping the conflict test in `restoreInto`, which serves every undo in this
  plugin and where a partial restore is sometimes right — its own change with its own
  note, not a line in this increment;
- `reconfiguredKey`'s check, which covers the keys being remapped while the dialog is
  open, and the write gate's own refusal of a batch naming a note outside the base (1b);

  **but `reconfiguredKey` compares KEYS, and this action's two new options are VALUES.**
  That is PR #211's lesson one level over: it fixed a captured key outliving its
  configuration, and the transition value and the released-value list can outlive theirs
  the same way — the confirmation dialog is an await, and both are editable while it is
  open. A submit that wrote the captured value would write a status this vault no longer
  declares, and one that skipped the second check would mark a release out that has since
  become released by a widened list — the very case 1a withholds the action for.

  So the submit re-asks the offer predicate against the settings as they are NOW, and
  refuses when the transition value it captured is no longer the configured one. Refuses
  rather than substituting: the reader confirmed against what the screen showed them, and
  writing a different status than the one they agreed to is worse than asking again.

  **And the NOTE moves across that await as well as the configuration.** Another window,
  or sync, can mark the release released while the dialog is open, and re-reading the
  settings does not see that. `applyPropertyWrites` checks the live TYPE and nothing else,
  so the submit would write today's date over the date it actually shipped — a second
  record of a release that already has one, which is what 1a withholds the action to
  prevent. So the planned write carries the status it expects to find, and the check is
  made **inside** the frontmatter callback beside the type check, where the bytes being
  replaced are the bytes being judged. That is `applyRestores`' compare-and-swap asked of a
  forward write, and it is one more field on `PropertyWrite` rather than a new mechanism;
- the empty-batch return, so a release already at the transition value writes nothing and
  redraws nothing.

The batch names the release note alone. No member is written to by releasing.

### The confirmation

A small `ui/confirmDialog.ts` — Obsidian ships no confirm, and every existing prompt in
`ui/prompts.ts` collects a value. It takes a title, a sentence, an optional list of
links, and a CTA.

It states how many members are not finished and lists them by name, each opening its note
through `view/openTarget.ts`.

**That is a narrowing of flow 4 rather than a reading of it, and it is recorded as one.**
The flow asks for "the action that moves them"; an open is navigation, so the per-member
transition it names is not built here. It was weighed against a `Set state` control per
row and the open was chosen: that control needs a second batch and a second undo slot
beside the release's own, and it puts a member write on the screen whose whole point is
that releasing touches the release note alone. The PBI keeps its criterion and gains a
line saying which half landed, exactly as the readiness half above does.

Nothing outstanding, and the dialog says so instead of drawing an empty list (2b).
Cancelling writes nothing and spends no undo slot (2c).

The outstanding list is **two** questions of `releaseScope`'s rows, not one. `context`
false is the population — which is 4a, an excluded note naming this release is neither
listed nor counted, falling out of the data rather than being a rule to remember — and
each remaining row is then asked whether it is done. That second question is
`ownWorkflowReading`'s, **never `item.done`**: the requirements reading alone gets a
`Deliverable` or a test-catalog member backwards, which is the rule `ReleaseRow.done`
already states about its own numerator. Population and predicate are two questions, and a
list that asked only the first would report every member as outstanding.

Where the members span a workflow nobody configured, `ReleaseRow.done` is unconfigured and
there is no answer to give. The confirmation then says the release's completion cannot be
read here rather than listing every member as unfinished, and still refuses nothing — the
same three-answer rule `ReleaseFigure` exists for, and an extension the PBI does not
cover, so it gains one.

**One narrowing.** Flow 2 also asks the confirmation to state any unsatisfied readiness
criterion. Readiness is [[Answering the readiness checklist]] and is not built, so the
confirmation states outstanding members only, and the PBI gains a line saying which half
is waiting on which note. Extension 2a — a criterion refuses nothing — is unreachable
until then, and so is not claimed as covered.

## Generating the release notes

### Identity

`joinSource` in `domain/readmeMarker.ts` becomes variadic (`...parts: string[]`). Every
existing two-argument call is unaffected, `sourceComponent` already escapes each part, and
the mapping stays injective. The marker's source becomes base › view › release.

That is extension 4c for the price of one line: a generated file whose marker names a
different release differs in the whole marker line, so telling a regeneration from a
collision is the string comparison the writer already makes. It matters because Obsidian
lets two releases in different folders share a basename, and therefore share an output
name.

The marker prefix and its wording are reused rather than forked. A release-notes file's
first line parses as a marker for the README reader too, which costs nothing: the README's
own path is a fixed name in a configured folder, so the two files can never be each other.

### The writer

`storage/readmeFile.ts` carries real subtlety — the read-then-`process` race close, the
BOM and CR trim on the first line, the four outcomes — and copying it would duplicate
exactly the part that is hard to get right, which is also the part fallow's duplication
gate would notice.

So the generic half is extracted in place: one writer over `(path, content, mismatch)`,
where `mismatch` is `'replace'` or `'refuse'`. `writeBacklogReadme` becomes a thin call
keeping `'replace'` — a renamed base or view must not brick regeneration — and
`storage/releaseNotesFile.ts` is the second caller, passing `'refuse'`, because a whole-file
write over another release's notes cannot be taken back by the undo slot (4c). A file
with no marker at all is refused by both (4b). One flag, two shipped products, no third
caller invented for it.

**The refuse branch asks its question inside `process`, not before it.** Today's callback
re-reads the live first line and accepts anything that PARSES as a marker — the right test
for replace-and-report, where another view's file may legitimately be taken, and the wrong
one for refusing: sync can put another release's generated notes at that path between the
`read` and the `process`, and a callback asking only "is this a marker" would overwrite the
file it exists to protect. So `'refuse'` compares the live source against the INTENDED
source inside the callback and hands the file back unchanged on a mismatch. That is this
module's own rule about content, kept: the permission is about the bytes being replaced,
and only the callback sees those.

The path is the configured folder plus the release note's own basename and a fixed
suffix — `Eratic Skunk release notes.md`. The basename is already a legal file name, so
nothing is sanitized, and the suffix keeps the file off the release note itself where
somebody points the output folder at the releases folder — a collision that would
otherwise read as a permanent refusal rather than a mistake.

### The text

`domain/releaseNotesText.ts`, beside `domain/backlogReadme.ts` and shaped like it, on
`domain/readmeText.ts`'s helpers. It takes `releaseScope`'s rows, drops the context ones,
groups by each note's own type in `ALL_TYPES` order, and keeps the tree's sequence within
each group — the sequence the reader just looked at, read from the one derivation rather
than from a second ordering key of its own. A type outside the vocabulary gets an "other"
heading rather than being dropped (2a).

The file opens with the marker, says it is generated and that edits do not survive, and
states its own population once: it lists what this base returned. It never says how many
notes it could not see, because nothing can count those (1b). A release with no members
still produces a file, saying it contained nothing (1a).

**Nothing dated goes in the body.** That is what makes "regenerating twice over an
unchanged release is byte-identical" true, and it is the easy thing to get wrong here,
since the action sits beside one whose whole job is writing today's date.

### Options and gate

One new **`releaseNotesFolder`** — a folder option with **no default**. 4d says the action
does not choose a folder on the user's behalf; unconfigured means absent and named.

The action is also absent while `releaseNoteProblems` is non-empty, not merely while its
own two keys are bound (4d): generation is a write path and is gated like every other one.
**A correction to 4e.** It lists "the folder does not exist" as a failure to report. The
folder is *created* instead, through `ensureFolder`, because that is what every write path
in this plugin already does — `createNote.ts` for each of the three note kinds it makes,
and `writeBacklogReadme` for the document this one is modelled on. Refusing here would
make the release notes the only write in the plugin that will not make its own folder, and
would fail the first generation in every vault whose folder option names one not yet
created. What survives of 4e is its second half, which is the part that matters: a write
that fails reports the path it tried and leaves nothing partial behind.

The note is opened after writing, and a failure to open is not a failure of the action
(5a).

## Where it lives

`src/domain/releaseOptions.ts` — `releasedStatusValues`, `releasedTransitionValue` and
`releaseNotesFolder`, with the transition dropdown reading the config. `ReleaseSettings`
and `src/domain/settingsResolve.ts` gain the three resolved fields.

`src/domain/settingsConsistency.ts` — the two refusals in `releaseNoteProblems`, and the
membership-collision check beside it. That one is NOT added to `releaseNoteProblems`: that
function is over the keys read and written on the release NOTE, and its exemption of the
item-side keys is load-bearing — folding this in would refuse the legal status/state
sharing the release view is built around.

`src/domain/releases.ts` — the predicate that answers whether a release may be marked out.

`src/domain/releaseWritePlan.ts` — the combined planner, and `role` moved from
`ReleaseWrite` onto its sets.

`src/domain/releaseNotesText.ts` — new: what the generated file says.

`src/domain/readmeMarker.ts` — `joinSource` widened to N parts.

`src/storage/readmeFile.ts` — the generic writer extracted, `writeBacklogReadme` a thin
caller of it.

`src/storage/releaseNotesFile.ts` — new: the second caller, refusing on a mismatch.

`src/ui/confirmDialog.ts` — new: title, sentence, links, CTA.

`src/view/release/scopeToolbar.ts`, `src/view/release/renderScope.ts` and a new
`src/view/release/releaseClose.ts` — the two buttons, and the two actions behind them.
`scopeToolbar.ts` draws; the actions do not live in it.

**The actions cannot go behind `renderScope`'s early returns, and the toolbar is behind
both of them.** `renderScope` returns at the unconfigured-membership state and again at
the empty-scope state, before `drawScopeToolbar`. That would make `Generate release notes`
unreachable for a release with no members — the exact case extension 1a says still writes
a file, because an empty release notes file is a fact and a missing one is ambiguous — and
would withhold `Mark as released` on an unbound membership key, which is not one of its
prerequisites: marking a release out reads the release note alone.

So the actions area is drawn **before** both returns, and each action keeps its own gate.
Marking needs its four release-note options and nothing else: it reads the release note
alone, so it is offered on both of those screens. Generation needs the notes folder, a
clean configuration **and the membership key**.

**And membership being bound is not the same as membership being readable.**
`releaseNoteProblems` cannot answer this one: its own header says the item-side keys are
DELIBERATELY absent from it, because the release's status and an item's workflow state may
legitimately name one property — they are read of different notes. So a hand-edited `.base`
pointing `membershipProperty` at the type, parent or order key passes that gate with a
non-empty key, and `membershipTarget` then reads `type: PBI` as a release link. Every scope
reads empty again, by a different route, and generation overwrites a valid file with the
same false report.

So generation's gate is **three** reports, not one, and picking only the second of them was
a mistake this spec made twice before getting here:

1. `configProblems` over the `BacklogSettings` the release view already resolves for its
   model (`releaseView.ts` calls `resolveSettings` and hands the result to `buildModel`).
   That is what catches every ITEM-side collision the generated file's own sequence depends
   on — `stateProperty` on the order key makes the model read workflow strings as ranks, and
   the file would then list members in an order nothing can defend. Extension 4d says any
   view-configuration problem withholds the action, and this is the report that sees most of
   them.
2. `releaseNoteProblems`, for the release-note roles.
3. The membership-collision check — the membership key against the type, parent, order and
   item-state keys — which is the one gap neither of the other two can see, since
   `configProblems` has no membership role and `releaseNoteProblems` deliberately excludes
   the item side.

None of the three subsumes another, which is why all three are named rather than one being
chosen. It stays generation's gate rather than the whole screen's: widening it changes what
the index and the scope tree refuse, which this increment has no mandate for — though the
same collisions quietly mislead those read screens too, and that is worth its own note.

That last one is not symmetry, it is the difference between empty and unreadable.
`membershipTarget` returns null for every item when `membershipKey` is unbound, so every
release's scope reads as empty — and generation there would write a file saying the
release contained nothing, and would overwrite a previously valid one to say it. Extension
1a is about a release that genuinely has no members, with membership bound and nobody
having named it; a population nothing can read is the other answer entirely, which is the
distinction `ReleaseFigure` exists to keep — unconfigured is not zero, and a report that
counts it as zero is the failure this epic's definition of done names first. So the
unconfigured-membership screen offers marking and names the membership option beside a
withheld generation, rather than offering both.

The two empty states keep their own guidance beside the actions — `guidanceShell` and the
actions are two rows on one screen, not alternatives.

`src/i18n/en.ts` — the option names, the two refusals, the confirmation, the generated
file's own sentences and the outcome notices.

`docs/requirements/Marking a release as released.md` and
`docs/requirements/Generating the release notes.md` — their `## Where it lives` sections
name the new modules, which `docs-check.mjs` rule 7 requires of every module in `src/`;
the first also records the readiness narrowing and the `configProblems` correction, and
the second the 4e correction above.

`CHANGELOG.md` — an `[Unreleased]` entry for each action.

## Acceptance criteria

Both PBIs' own criteria hold as written, with the one narrowing recorded above. What this
design adds to them:

- The transition dropdown offers exactly the configured released values, and a `.base`
  spelling one outside that list is reported by `releaseNoteProblems` — the offer and the
  check are asked separately, because only the second survives a hand edit.
- Marking a release out writes the status and the date in **one** `processFrontMatter`
  call: a note retyped inside that callback writes neither field, and there is no input
  that leaves a released status without its date. The check is a test that retypes the
  note from within the write, not two assertions about two writes.
- Undoing once takes both back where neither field has been edited since; where one has,
  it restores the other and reports the conflict. Asserted in both directions, so the
  narrowing above is a checked statement rather than a caveat.
- A release whose status already equals the transition value writes nothing and spends no
  undo slot.
- Changing the transition value, or widening the released-value list to cover this
  release's current status, WHILE the confirmation is open makes the submit refuse rather
  than write. So does the NOTE reaching a released status across that await, asserted by
  changing it from inside the callback — the only place that can tell a writer which checks
  the live value from one which checked it a moment earlier.
- A release already carrying an actual date never has it replaced by this action, on any
  path. Both are driven from inside the await, because a test that changes the
  configuration before the dialog opens passes against a submit that never re-reads.
- Generation is withheld, naming the problem, for a collision seen by ANY of its three
  reports: `stateProperty` on the order key (`configProblems`), two release-note roles on
  one key (`releaseNoteProblems`), and `membershipProperty` on the type, parent, order or
  item-state key (the new check) — and the criterion is again about the
  file: a release with valid generated notes, opened under that `.base`, still has them.
- `reconfiguredKey` still refuses a write whose key is not its own role's, with the status
  and description options swapped mid-dialog — the PR #211 case, asked of a two-set write.
- The outstanding list and its count come from non-context scope rows that are not done,
  so adding a context ancestor to a fixture changes neither, and a finished member appears
  in neither. A `Deliverable` member finished by its own workflow counts as finished — the
  criterion is asked of `ownWorkflowReading`, so a fixture whose release spans two
  workflows is what checks it.
- With a member's workflow unconfigured, the confirmation says completion cannot be read
  and still offers the action.
- Every unbound prerequisite is NAMED on the screen, not merely absent: a fixture with each
  one unbound in turn draws a line naming that option, and the ✨ appears beside it only
  for the ones that are properties.
- Both actions are reachable on a release with no members — the screen `renderScope`
  returns early from, and the only place extension 1a can be exercised at all, since a
  release with members never reaches it.
- With the membership key unbound, marking is still offered and generation is NOT, with
  that option named. The check is that no file is written on that screen: a fixture whose
  release already has a valid generated file, opened with membership unbound, must still
  have that file's contents afterwards — a criterion about the file, because the damage
  here is the overwrite rather than the refusal.
- `writeBacklogReadme`'s behaviour is unchanged by the extraction — its existing tests are
  the check, and they are watched passing before and after.
- A release-notes file whose marker names another release is refused and named; one whose
  marker names this release is overwritten; one with no marker is refused.
- That refusal holds when the file CHANGES between the read and the write: a fixture that
  swaps in another release's generated notes from inside `process` keeps its contents. The
  check drives the callback, because a test that only arranges the file beforehand passes
  against a writer that asks the question too early.
- Two releases sharing a basename in different folders resolve to one output path, and the
  second is refused rather than silently replacing the first.
- The generated file holds no date of its own, and two generations over an unchanged
  release are byte-identical.

## Verification

`npm run check`. New node tests for `releaseNotesText.ts` (grouping, sequence, the empty
release, a context row changing no line) and for the two `releaseNoteProblems` refusals;
storage tests for the writer's outcomes from both callers; view tests for the
offered/absent matrix on both buttons and for the confirmation's two shapes. The i18n
catalog's new keys are covered by `test/i18n/projections.test.ts`, which marks the whole
catalog and asserts what renders unmarked is data.

Every invariant asserted in a comment gets a test watched failing first — in particular
the byte-identical claim and the single-batch undo, both of which read as obviously true
and are the two most worth seeing red.

Not verifiable here: the toolbar's two buttons in a themed vault, the generated file as
Obsidian renders it, and the undo across a real `.base`. `npm run harness` answers the
first at Obsidian's default colours only. `npm run test-build` is the handover for the
rest, and it goes on the smoke-test checklist.
