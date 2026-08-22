---
type: PBI
parent: "[[Resources as notes]]"
order: 10
status: Done
created: 2026-08-20
source: user request
files:
  - src/domain/typeVocabulary.ts
  - src/domain/itemTypes.ts
  - src/domain/readItems.ts
  - src/storage/frontmatter.ts
  - src/domain/estimationItems.ts
  - src/domain/estimationSettings.ts
  - src/view/estimation/init.ts
  - src/domain/estimationOptions.ts
  - src/storage/propertyWrite.ts
  - src/domain/scoringModel.ts
  - src/storage/absenceNotes.ts
  - src/view/interactions/absences.ts
  - src/i18n/en.ts
started: 2026-08-21
finished: 2026-08-22
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A resource is not a backlog item

**As** a delivery lead, **I want** a person to be a note the plugin recognises and never
shows me among my work, **so that** the roadmap can draw a row for a colleague without the
backlog pretending a colleague is something to be done.

`Resource` joins the vocabulary as the **second name recognised in order to be refused** —
`Absence` ([[Resource absences]]) is the first and the whole of the precedent. A resource
note is dropped in `readItems` before a `BacklogItem` exists, so it appears in no
projection this plugin draws: not the tree, not either board, not either roadmap axis, not
the shelf, not the toolbar's count, and in no menu that offers a type.

**It was declared as a MARKER first, and that was wrong.** As a marker it inherited the
structural rules correctly — no rung, no children, no parent — and then the DATE questions
had to be carved back out of it one surface at a time, because every marker before it was a
date. Six review rounds went into that carving, and what it kept producing was a type that
still appeared in the tree, in the New menu, in Set type, in the toolbar's total and on the
shelf, none of which is where a person belongs. The refusal is one line instead, and it
replaces every one of those narrowings.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | A base returns a note whose `type` is `Resource` |
| **Preconditions** | None. The name is recognised whether or not any resource property is configured |
| **Guarantee** | No projection of the backlog view ever draws, counts, ranks or offers a `Resource` note, and no FORWARD write lands on one. Undo is the stated exception — see 2e |

**Main flow**

1. A base returns a note carrying `type: Resource`.
2. `readItems` recognises the name and returns no item for it, beside the gate that already
   does this for an `Absence`.
3. Every projection is unaffected, and none of them needed an edit: they all read
   `BacklogItem`s.

**Extensions**

- **2a — `hierarchyOnly` is off.** Still refused, and this is the case the gate exists for.
  With the setting on, a note whose type this vocabulary does not know and which hangs from
  nothing is dropped by `pruneOutsideHierarchy` anyway — so a check written without this
  case passes with the gate deleted. Off is the vault where every note a folder-scoped base
  returns becomes an item, and where a resource would otherwise sit in the tree as a
  real-looking task. `Absence` records the identical trap, and this note's own test was
  written wrong once and caught by watching it fail.
- **2b — an item names a resource as its `parent`.** The resource is not loaded as a
  context row: the gate returns null, which is `addItem`'s "no ancestor to seed", so
  `loadOutsideParents` is never handed one. The child keeps its unresolved parent link, as
  it would for any note the base does not hold.
- **2c — the user asks for a new `Resource` from the view.** No surface offers one. The
  name is out of `ALL_TYPES`, which is what `childTypeChoices`, `focusTarget`, the shelf's
  grouping, the generated README and the in-app manual all read — so each of them refuses it
  by construction rather than by an exclusion somebody has to remember.
- **2e — a note is retyped to `Resource` after this view wrote to it, and the user presses
  undo.** The restore lands, and that is deliberate rather than a hole in the guarantee
  above. `undoLast` replays through `applyRestores`, which skips the forward gate's refusals
  for the reason the register already states of the `outsideFilter` one: **its authorization
  came at capture time**, and it restores RAW captured keys per key by compare-and-swap
  rather than planning against these settings. So it writes back exactly what this view's own
  write changed and nothing else, on a note the user could act on when they acted on it.
  Refusing it would stop a user taking back their own edit, and spend the one undo slot on
  nothing. Raised by automated review against the wider sentence this note used to carry; the
  sentence is narrowed rather than the replay gated.
- **2d — a resource note carries dates, a horizon, a state or an assignee.** All read by
  nothing and written by nothing. There is no item to place, so there is no placement rule
  to state and none of the narrowing the marker version needed.
- **2f — an absence's edit modal is open against a note the user retypes to `Resource`
  before submitting.** `editAbsence`/`updateAbsenceNote` share none of `applyWrites`'
  path — no batch, no `configProblems` gate, no undo slot — so they were the one write
  this note's own Guarantee did not yet cover. `updateAbsenceNote` now asks the live
  type inside its `processFrontMatter` callback, the same `readString(ownValue(fm,
  settings.typeKey))` + `isResourceType` shape, and writes nothing when it answers
  `Resource`; `editAbsence` skips the rename on that refusal too, since renaming a note
  the write refused would still rename a resource. `deleteAbsenceNote` was weighed
  against the same race and left ungated on purpose: the Guarantee is about a forward
  WRITE, and a trash changes no field — it is the coarser, immediately visible failure
  of the two, and its own recovery path (the user's "deleted files" setting) was already
  named before this note existed. Raised by automated review against this note's own
  Guarantee.

## Acceptance criteria

- `Resource` is in **no** vocabulary list: not `LEVELS`, not `TEST_LEVELS`, not
  `EXTRA_TYPES`, not `MARKER_TYPES`, and above all not `ALL_TYPES`. That last one is the
  criterion the others follow from, and it is stated at the LIST rather than at its
  consumers — the same sentence [[Resource absences]] is checked by.
- It has **no creation folder**. Nothing in this view makes one, so there is no filing
  decision to ship an opinion about, exactly as an absence has none.
- **A `Resource` note produces no item**, asserted with `hierarchyOnly` OFF so the gate is
  what refuses it rather than the scope prune.
- **Nothing about `assignee` changes.** A vault upgrading to this step sees the same rows,
  the same roster and the same chips. That is what still makes this the step that lands
  first; [[Linking an item to a resource]] is the breaking one.
- **The ESTIMATION view refuses one too, and its own gate is what does it.** A second
  Bases view ships from the same plugin (`product-estimation`), and it never goes through
  `readItems`: `buildEstimationModel` reads the base's results straight into its own item.
  So a person in a base opened with that view was a scoreable row, ✨ stubbed every
  configured estimation key onto their note, and the score actions could write to it
  through `applyPropertyWrites` — a path `applyWrites`' refusal does not cover either.
  It asks the type itself now, before its item exists, from a `typeKey` resolved off the
  same `typeProperty` option the backlog reads. **The backfill is the half that bites
  twice**: its writes were built from the RAW results, so refusing the resource in the
  model alone would have made `applySafely`'s outside-filter check refuse the WHOLE batch,
  and one person in the base would have made ✨ silently do nothing for anybody. The
  writes come from the model now, so the two cannot disagree. Found by automated review.
  **Its type property is an OFFERED option, not only a read one.** Bases options are per
  view, so the backlog view's own `typeProperty` pick cannot answer for this one — a vault
  keeping item types under `kind` would sit on the shipped fallback and score its people.
  And its writer takes the same live-type refusal `applyWrites` does: `applyPropertyWrites`
  shares none of that path, and the row a score was planned from is the MODEL's, which is
  exactly what is stale about a note retyped since the last Bases pass. Refused per FILE
  there rather than stopping the batch, because a batch here is one note's own scores and
  ✨'s many-file batch has no ordering between its files. And its type property joins the
  COLLISION check while staying out of the fingerprint: pointed at a dimension's own
  property it passed validation, and the next score pick then wrote a number over the
  note's type — which either misclassifies the note or takes it out of the backlog
  entirely. Out of `model` so a stored total cannot be invalidated by it, in the check so a
  configuration that would destroy a type is refused.
- **A `Resource` is never WRITTEN to either, and the model gate cannot promise that on
  its own.** A gesture in flight holds the `BacklogItem` it was captured from, so retyping
  a note to `Resource` mid-move leaves a plan aimed at it — and its live shape gives
  nothing away, since a resource is no marker and so answers both ends, which is the shape
  an ordinary item was captured under. `applyWrites` asks the LIVE type and refuses every
  write to one, beside the axis check that could not see it. Found by automated review on
  the increment that made the refusal, against this note's own Guarantee.
- **Nothing this step ships may promise the roster.** `deriveLanes` still builds its rows
  from the declared names, the assignees the results carry and the absences, and enumerates
  no `Resource` note.
- **A `Resource` is never written by an absence edit either, and `editAbsence` must not
  rename one the write refused.** `updateAbsenceNote` shares none of `applyWrites`' path —
  no batch, no `configProblems` gate, no undo slot — so it asks the live type again rather
  than inheriting the refusal, using the same reader `applyWrites` and
  `applyPropertyWrites` do. `deleteAbsenceNote` was weighed against the identical race and
  left ungated, deliberately: see 2f. Found by automated review, against this note's own
  Guarantee.

## Where it lives

`src/domain/typeVocabulary.ts` declares `RESOURCE_TYPE` beside `ABSENCE_TYPE` and joins it
to none of the lists — which is the whole of the criteria above, since every consumer reads
those lists.

`src/domain/itemTypes.ts` gains `isResourceType`, the same shape and the same polarity as
`isAbsenceType` next to it: a predicate whose one call site decides whether a note becomes
an item at all, rather than where it ranks once it is one.

`src/storage/frontmatter.ts` is the second gate and the one the first cannot stand in for:
`applyWrites` reads the live type inside the frontmatter callback — the only place it is
readable before the file is touched — and refuses every write to a resource, not the axis
alone. What makes a resource unwritable is what the note IS, not which property a batch
names.

`src/domain/estimationItems.ts` is the third gate, and it exists because the second Bases
view builds its own items and shares none of the first two paths. `src/domain/estimationSettings.ts`
gives that view the one thing it never needed before — the property a note's type is read
from — and deliberately outside `model`, since `modelFingerprint` hashes that object to
decide whether a stored total can still be trusted and a key unrelated to the score must not
be able to invalidate one. `src/view/estimation/init.ts` builds ✨'s writes from the model
rather than the raw results, so the refusal and the batch agree.

`src/domain/estimationOptions.ts` offers that view's type property, and
`src/storage/propertyWrite.ts` is the fourth gate — the estimation view's own writer, which
asks the live type for the same reason `applyWrites` does and cannot inherit it.

`src/storage/absenceNotes.ts` is the fifth gate, and the one an absence's own edit needed:
`updateAbsenceNote` asks the live type inside its `processFrontMatter` callback, the same
shape as the other four, and returns whether it wrote so `src/view/interactions/absences.ts`
can skip the rename on a refusal rather than rename a note the write just refused to touch.
`deleteAbsenceNote` in the same file states, in its own comment, why it carries no such
guard — see 2f. Neither act shares `applyWrites`' batch, `configProblems` gate or undo
slot, which is why each of the five gates above asks the live type again rather than one
of them standing in for the rest. `src/i18n/en.ts` carries the one new sentence this gate
reports through — `absence.becameResource` — since every string in this swept directory
goes through `t()`.

`src/domain/readItems.ts` is the first gate, one line in `addItem` beside the absence
divert.
Nothing is KEPT yet, which is the only difference between the two — [[Rows from the
Resource notes]] is what will collect resources here, at this same gate, so the roster
comes from the base's own results and no second read path into the vault is opened.

Two fixes made while `Resource` was briefly a marker are kept, because both are real and
neither is about resources: ✨ no longer creates the START key on a `Milestone` (the one
the generated README says this view never places a milestone by), and the resources axis's
keyboard ladder no longer writes an assignee for a marker that is drawn in the milestones'
row whatever the note says. Both are `Milestone` defects that predate this epic and had no
test. They live in `src/domain/writePlan.ts`, `src/domain/itemTypes.ts` (`schemaEnds`) and
`src/view/interactions/keyboard.ts`, and are specified by [[Milestones as their own type]].

The start-key narrowing above was a PLAN-time answer only, and carried the identical race
this note's own Guarantee already refuses for a resource: a large ✨ batch plans a start
stub against an ordinary item, the note is retyped to `Milestone` before that file's write
lands, and `applyInto`'s stub loop asked only whether the live note already held the key,
never what the live note now WAS — so it created an empty start property the new type may
not carry. Closed the same way the five gates above are, and by the same rule read twice
rather than restated: `applyInto` asks `schemaEnds` of the live type `applyWrites` already
reads for the resource refusal, and drops a start or target stub the live note's type does
not answer for. Lives in `src/storage/frontmatter.ts` beside the resource gate. Found by
automated review.
