---
type: PBI
parent: "[[Putting work in a release]]"
order: 10
status: Active
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Setting an item's release

**As** a backlog owner, **I want** to put an item in a release, or take it out, from wherever
the item already is, **so that** committing one thing to a version does not mean opening
another screen to do it.

**Partly built.** `Set release` ships on the item's own menu, and the keyboard reaches the
same menu; the drag does not, and the acceptance criterion below records that rather than
dropping it. It is the shape [[Moving between horizons]] and [[Moving a card between slices]]
both specify — one host method, one gated batch — with two of the three inputs landing on it.
The write turned out to be a **link** rather than the label property this note first
predicted: a release is a note, and a plain name would resolve to the wrong one where two
release notes share a basename.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a release from an item's context menu, from the keyboard, or dropping the item on a release |
| **Preconditions** | The membership property is configured, and the item is **plan work** the Base returned |
| **Guarantee** | Exactly one value is written to the item's own membership property, through the same gate as every write, undoable as one batch. Nothing else about the item changes — not its parent, not its order, not its state. |

**Main flow**

1. The user picks a release for the item.
2. The one host method plans the one write: the picked release, into the membership property.
3. The gate applies it, and the item renders with its new membership on the write's own
   refresh.
4. The move is announced once, from that method.
5. Undo takes it back as one batch.

**Extensions**

- **1a — the item is already in the picked release.** No write is planned and the undo slot is
  not consumed. The menu entry is checked exactly when picking it would write nothing — asked
  of the plan, never of a comparison beside it. **"Already in" is a question about
  cardinality as well as identity**: the note names exactly one release and it is the picked
  one. A hand-written `release: [2.4, 2.5]` is not that note — the reader refuses the pair
  ([[The scope of a release as a tree]] 1c), so picking either release rewrites the key to the
  one value a membership is, and nothing is ticked as current until it holds one. Reading only
  the first entry made the release view call the note unresolved while the menu offered the
  first value as the current one and wrote nothing for it, which is the same two-ends
  disagreement 1f forbids. **How many the note names is counted in SLOTS**, which is what the
  reader counts: `release: [2.4, '']` names two as surely as `[2.4, 2.5]` does, and a count
  taken after the blank entry is parsed away reopens the disagreement one layer down. A list
  of ONE is an ordinary membership at both ends.
- **1b — the user picks "no release".** The key is removed rather than written empty, because
  an empty string is a value and an item in no release has none.
- **1c — the user cannot drag.** The keyboard and the context menu offer the same releases and
  write the identical batch.
- **1d — the target release note is outside the Base's filter.** It is not offered — by
  construction, `model.releases` excludes every `outsideFilter` row, so a menu built from the
  current model has no entry to pick. **A batch naming an excluded target is not refused**:
  `applySafely` (`src/view/writeGate.ts`) checks `writes.some((w) =>
  this.host.outsideFilter(w.file.path))`, which reads only the write's own `file` — the note
  being edited, never `release`, the target the write names. So a submenu opened before the
  model rebuilds, over a target that then leaves the filter while the menu is still open, can
  still commit a link to it on pick. [[A stale release or iteration target can still be
  committed]] records the gap; it is shared with `Set iteration`, unfixed here on purpose.
- **1e — the item is outside the Base's filter.** No such action is offered on it, and a batch
  naming it is refused whole — the context rule, at the entry point and again at the gate.
- **1f — the row is not plan work** — a `Milestone`, an `Iteration`, another `Release`, or a
  note from the test catalog. The action is not offered and a batch naming it is refused, the
  same eligibility `Set iteration` already applies. **The membership reader refuses it too**:
  a release property hand-written onto a marker does not put the marker in the scope, because
  a release holds work and those notes are not work. Refusing at only one of the two ends
  would let a hand-edit do what the menu will not. **And the writer asks the LIVE type**, so a
  note retyped to a marker between the pick and the write is refused there too: the menu that
  made the pick would never offer to clear the key it landed.
- **2a — the membership property is not configured.** The action is absent from every menu
  rather than present and inert, and the release view's empty state says which option to bind.
- **2b — several items are selected.** One batch names them all, planned by the same method,
  and it is refused whole if any of them is outside the filter — which is
  [[Bulk edits on a selection]]'s rule, not a second one here.
- **3a — the write takes the item out of the Base.** A filter may name the membership
  property, so a legitimate write can make its own row vanish. That is the open question
  recorded in [[The outcome report was built from one sentence]], and this use case does not
  reopen it.

## Acceptance criteria

- The menu, the keyboard and the drag produce byte-identical batches. **Met for two of the
  three, and the third is not built.** The menu and the keyboard cannot diverge by
  construction rather than by agreement: the keyboard's ContextMenu arm calls
  `showContextMenuFor`, which opens the same `buildItemMenu` a pointer opens, so there is one
  list of entries and one method behind every pick. `test/view/releaseMenu.test.ts` drives a
  real keystroke and compares the resulting batch to the one the method plans directly. The
  **drag waits on a surface that holds a release as a drop target**: the release view is
  narrowed to creation by design, with `test/view/releaseNeverEdits.test.ts` enforcing it, so putting
  drop targets there would retire that invariant rather than extend it.
  [[A release on the dated axis]] is where such a surface arrives, and the criterion is kept
  here rather than deleted so that it is met when it does.
- The batch names the membership property alone: `parent`, `order` and the state key are
  unchanged by it.
- Picking the release the item is already in plans nothing and leaves the undo slot untouched
  — where the note names that release and no other. A note naming two is rewritten to the one
  picked, and ticks nothing until it does.
- Picking "no release" removes the key; it never writes an empty value.
- A target release the Base excluded is not offered. **Met for the item; not for the
  target**: `applySafely` (`src/view/writeGate.ts`) refuses whole any batch naming an
  excluded item, the same check every write path in this view shares, but a batch naming
  an excluded target release is not refused — see [[A stale release or iteration target
  can still be committed]].
- No release action is offered on a `Milestone`, an `Iteration`, a `Release` or a test-catalog
  note, and such a note carrying a membership value by hand is in no release's member count.
- Two releases whose notes share a basename are distinguishable in the picker and resolve to
  the file that was picked — a fixture with `Releases/2.4` and `Archive/2.4` writes a link
  that resolves to the chosen one. **The resolution half is checked against the test double
  only**: `test/storage/releaseWrite.test.ts` writes through `FakeVault`'s `fileToLinktext`
  and reads back through its `getFirstLinkpathDest`, so what is proven is that the plugin
  hands Obsidian a qualified linkpath rather than a bare name. Obsidian's own resolver has
  not been asked — [[Smoke test the release view]] owns that.
- With the membership property unconfigured, no release action appears in any menu.

## Where it lives

The membership property is a declared optional property (`src/domain/optionalProperties.ts`),
named by the backlog view's **own** `releaseProperty` option in `src/domain/viewOptions.ts` and
resolved into `BacklogSettings.releaseKey` by `src/domain/settingsResolve.ts`. The release view
declares one of its own, which is [[Settings scoped to their view]]'s rule rather than an
oversight: sharing a suggested name is not sharing a setting. It is also the limitation this
increment ships with — the two can be bound apart, no code may compare them, and the symptom
of a mismatch is an empty scope, which is what an unassigned vault looks like too. That is
recorded here and given no warning on purpose.

It is read the way the iteration link already is — resolved to a file, not a name — by
`src/domain/readItems.ts`, landing on `RawItem.releaseEntry`. It is read as a **list** there,
where the iteration goes through `readFirstLinkEntry`, and the extra field that buys is
`RawItem.releaseMultiple` — cardinality, never a second reading of which release the note is
in. The planner needs it for extension 1a: both `[2.4]` and `[2.4, 2.5]` collapse to one
entry, and only the second is a note the menu has to repair.

Which types may hold one is `src/domain/itemTypes.ts`'s `mayHoldField`, which refuses `release`
for every marker AND for a test-catalog type: the reading end's own refusal (`membershipTarget`,
`src/domain/releases.ts`) stated at the writing end, so a hand-edit and a menu pick cannot
disagree about what a release holds. Both halves of that reader are here, because the writing
end asks this function alone — `refusesLiveType` holds a type NAME and no item — and a
membership planned against a `PBI` and applied after a retype to `Test case` would otherwise
land on a catalog note the reader reports as unresolved and no control can clear (Codex, PR
#201). What a name cannot answer is still the item question: `Task` is on both ladders, so a
task under a test suite is admitted by the field rule and refused by `inPlan` at the two doors
that hold an item. **The backfill stubs nothing here**, and that is this field's exception rather than a
consequence of the rule: ✨ Assign missing properties creates an empty key for every property a
type may hold, and `neverStubbed` (`src/domain/writePlan.ts`) refuses `release` because an empty
membership is not an empty slot — `membershipTarget` reads a present-but-blank value as an
UNRESOLVED membership, so a backfill would open the release view reporting the whole backlog as
broken. Adopting the property binds the option and writes no key to any note, which
`test/view/toolbar.test.ts` states as a whole-frontmatter `toEqual`. (Codex, PR #201: this
paragraph claimed the opposite while the code and that test both said otherwise.)

The write is planned by `src/domain/writePlan.ts`'s `computeReleaseWrites` — the membership key
alone, with no timeframe copied beside it the way joining an iteration copies one — and applied
over the gate in `src/view/writeGate.ts` by `src/storage/frontmatter.ts`, which spells it as a
**link**: `wikilinkTo` from the editing note's own path, exactly as it already does for the
parent and the iteration. `src/storage/writeKeys.ts` carries the membership key in
`touchedKeys`, and that line is load-bearing rather than bookkeeping — it is what captures the
write's inverse, so without it the write lands and undo restores nothing, silently. The
membership joins the keys `refusesLiveType` asks the LIVE type about, in the same file, for
extension 1f's second half: the key is unclearable once it is on a marker, so the refusal has
to be at the write and not only at the plan. `refusesLiveMembership` (`src/domain/releases.ts`), called beside it at the same
boundary, asks the one question a type NAME cannot reach, found by review on this branch
(Codex, PR #201) and the same shape — the TARGET's live type, because the plan carries the
`TFile` the picker was built from and a retyped target would be spelled as a release it no
longer is. It asked a second, the CARRIER's live ladder walked up the parent chain, and that
half was removed on 2026-08-24: which ladder a row is on is a MODEL decision chained off the
parent **as loaded**, so the walk refused writes that were never stale — a returned `Task`
whose `Test suite` parent the Base excluded is on the plan ladder in the model and was
classified on the catalog's by the vault. The reparent it was covering is
[[A carrier reparented into the catalog keeps its release]]. What neither asks is whether the target left the BASE —
that is the write gate's contract rather than a question about the vault, it is shared with
`Set iteration`, and it is recorded in
[[A stale release or iteration target can still be committed]]. Neither can they be asked
about a pick that plans NOTHING: `computeReleaseWrites` decides "already there" against the
captured item, so a membership changed while the submenu sat open makes a real pick read as a
no-op and no write reaches these guards at all. Recorded in
[[A pick compared against the model reads as a no-op]] — the horizon and the sprint decide it
the same way, and the register has already ruled that moving them is its own increment.

One host method carries the move: `performReleaseMove` on `src/view/host.ts`, implemented in
`src/view/cardMoves.ts` and delegated from `src/view/backlogView.ts`. Its announcement is a
helper in `src/view/interactions/cardDrag.ts` — a **sentence**, not a drag path: nothing in
that file drags a release, and the helper lives there because that is where this view keeps the
words a move says. What a row is offered is `src/view/interactions/labels.ts` — `canSetRelease`
and `addReleaseItems`, whose picker shares `namedTargets` with the iteration's — called from
`src/view/interactions/menu.ts`. `canSetRelease` asks KEY PRESENCE where `canSetIteration` asks
the parsed entry, and the difference is the backfill rather than a drift: ✨ stubs `iteration: ''`
on every eligible note, so presence there would put a `None`-only menu on every row, while
`neverStubbed` refuses a release stub, so presence here means somebody wrote the key. That is
what keeps a value the reader refuses (`release: ''`, a YAML number, an object) clearable in a
vault holding no `Release` note at all — it is reported as unresolved, so the action that takes
it off has to be reachable (Codex, PR #201). The iteration keeps that corner open, with its own
reason stated at `canSetIteration`. `src/view/interactions/keyboard.ts` is **unchanged**, and is
named here for what it does not do: its menu key calls `showContextMenuFor`, which opens the
one `buildItemMenu` a pointer opens, so the two inputs share a builder rather than two lists
somebody has to keep in step.

Several items at once is not built: `src/view/selection.ts` holds a single selection by design,
and extension 2b waits on [[Bulk edits on a selection]] rather than on anything here.
