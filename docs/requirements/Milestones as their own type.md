---
type: PBI
parent: "[[Milestones]]"
order: 10
status: Open
priority: P2
created: 2026-08-02
source: user request
files:
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
  - src/domain/model.ts
  - src/domain/viewOptions.ts
  - src/domain/roadmap.ts
  - src/domain/writePlan.ts
  - src/view/render/rows.ts
  - styles.css
---

# Milestones as their own type

**As** someone planning around fixed dates, **I want** a milestone to be its own kind of
note with a single date and a description, **so that** a point in time states itself once
instead of being spelled as a span whose two ends happen to agree.

The vocabulary is fixed on purpose ([[Level ladder and implied types]]), so a seventh name
has to earn the rules it brings. This one earns them on a gap the timeline already has:
[[Bars from two dates]] renders an item with **one** date open-ended, because for work with
duration a missing end really is a gap in the plan — and for a deadline it is not. Today
the only way to say *point, not span* is to write the same date into two properties, which
is a user performing a workaround for a renderer. The type is what makes one date complete.

Two rules follow from what a milestone *is*, and both are new to this vocabulary. It hangs
from **nothing**: a release date is owned by the plan, not by an epic, and an `Epic` is a
root by position on the ladder while a `Milestone` is a root by nature. And it holds
nothing and counts for nothing: a point in time contains no work, so it must never enter a
rollup — the same argument the context-row rule makes for a different reason, that a
number reporting progress must only ever count work.

The description is the note body, as it is for every other kind here. No new field: a
milestone that needs a paragraph has one, and a milestone that does not is a title and a
date.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user creates a milestone, or the view builds the tree over a note typed `Milestone` |
| **Preconditions** | None for the type itself; drawing it on the dated axis needs the target property the roadmap already configures ([[Horizons or dates]]) |
| **Guarantee** | A milestone is a marker and never work: it takes no children, and it aggregates into nothing — no ancestor's rollup, progress figure or done-subtree state, wherever it sits — so its own status can neither advance a bar nor hide work that has not moved. Its own row is a separate question with the ordinary answer: it narrows under the reader's visibility controls exactly as any other row does. Nothing about its date is inferred, swapped or written by rendering it. |

**Main flow**

1. `Milestone` is a name in the fixed vocabulary beside `Issue` and `Bug` — a declared
   type that is not a rung on the ladder, so nothing ever retypes it by position. It takes
   the shipped opinion every declared name gets: a folder, an **icon and a badge colour**.
   The badge renderer has no fallback for a declared type on purpose
   ([ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md)), so the seventh name
   is not optional styling — a milestone left out of that table renders as an unknown type,
   and the test asserting the table covers the vocabulary fails. That ADR is also the one
   record this type dates: it is titled for **six** names and lists the two extra types by
   hand, and while a seventh does not reverse its decision — the vocabulary stays fixed,
   which was the whole point — the record's own text stops being true the moment this
   ships. Resolving it belongs to the change that makes it wrong, not to this note.
2. Its date is the roadmap's configured target property — the same key a bar's end is read
   from, read the same tolerant civil way — and its note body is its description.
3. It files into its own folder, picked per view like every other type's
   (`typeFolder.milestone`), shipping as `milestones` under the home folder.
4. It is offered at the **top level only**, and offers no child types of its own.
5. On the dated axis it renders as a diamond at its date, with no open end, because
   nothing is missing.
6. Everywhere else it is an ordinary row that **aggregates** into nothing: no ancestor's
   rollup, progress figure or done-subtree state is ever computed from it. Its own status
   remains its own, and its own row narrows under the ordinary visibility controls.

**Extensions**

- **1a — a milestone is dragged under a work item.** Nothing refuses it. The ladder has
  always guided rather than refused, and `childTypeChoices` decides what is *offered*,
  never what is legal ([[Assigning type on a move]]) — so the rule lives in the creation
  affordances, and a milestone put somewhere by hand keeps its type and renders where it
  was put. Step 6 still holds there: having a parent does not make it countable.
- **2a — no target property is configured.** There is nowhere to state the date. The
  milestone is an ordinary note in the tree, and on the roadmap it shelves like anything
  else the axis cannot place ([[The unplaced shelf]]). A date property of its own was
  refused deliberately: a deadline and a span's end are the same fact, and a second key
  for it would be two places to look and a seventh collision rule to write.
- **2b — the value cannot be read as a date.** Unreadable is unplaced: it shelves with the
  reason on its card, exactly as a span end does. A guessed date on a deadline is
  indistinguishable from a commitment nobody made.
- **2c — the note also carries a start date.** The milestone ignores it and still draws as
  a point. The type is the stronger statement, and reading the pair as a span would let a
  stray property turn a deadline into a duration. This has to happen in **derivation**,
  not in drawing: a milestone is reduced to its target point *before* the ordinary span
  checks run, or a stale start later than the target shelves it as a reversed span and no
  rendering seam is ever reached.
- **3a — the milestone folder is cleared.** It falls through to the home folder, like
  every other type whose folder is unset — one rule, no special case.
- **4a — the row has no child type to offer.** Every create affordance is **absent**, not
  empty: no add button on the row, and no `New <child>` in its context menu. A button
  whose label is built from the first of no choices reads `New undefined` and opens a
  modal with nothing in it, which is the shape this row would take if "offers no child
  types" were left to the type list alone — so the affordance has to answer for the empty
  case itself, the same way the context-row rule makes the UI withhold a control rather
  than let it fail at the end.
- **5a — the bucket axis is the active one.** The milestone is an ordinary result there:
  it places by the horizon property if it carries one, and shelves if it does not. Its
  date is never read as a horizon — the epic's own rule, and the reason the axis is
  declared rather than detected.
- **6a — the milestone is marked done.** Nothing *around* it moves: no ancestor's progress
  advances because a date passed, and no subtree hides because the marker in it is
  finished ([[Rollups and hiding finished work]]). The milestone's **own** row is the other
  question and takes the ordinary answer — with "Show completed items" off it hides like
  any finished row, because that control states what the reader wants on screen rather
  than what counts as progress. Never counted is a rule about aggregation, never an
  exemption from the reader's own controls; the context-row rule draws the same line for
  the same reason, and a marker that outlived every control would be the one row a filter
  could not clear.

## Acceptance criteria

- `Milestone` is a name in the fixed vocabulary, present without configuration, and is
  never a user-typed type name.
- Its date is the configured target property; there is no milestone-specific date option,
  nothing is picked by name-matching, and a start date on a milestone changes nothing
  about how it draws.
- It files into `typeFolder.milestone` — shipped default `milestones` under the home
  folder, moving with the home folder like every other type's, and falling through to it
  when cleared.
- It is offered only at the top level and offers no child type. Nothing refuses one placed
  elsewhere by hand, and none is ever retyped by position.
- It occupies **no rung**: it never appears as a focus root for a level, its untyped
  children imply no level from it, and moving a subtree that contains one never retypes
  that milestone's descendants from a rank it does not have. Focusing `Milestone` by name
  still lists them, which is a different question and the one worth keeping.
- A milestone row shows **no** create affordance — no add button, no `New <child>` menu
  entry — rather than one built from an empty list of choices.
- It renders with an icon and a badge colour of its own, like every other declared type,
  and the test that asserts the badge tables cover the whole vocabulary covers seven names
  rather than six.
- It contributes to no ancestor's rollup, progress figure or done-subtree state, wherever
  it sits in the tree — while its own row narrows under "Show completed items" and the
  quick filter exactly as any other row does, and its line goes with it
  ([[A milestone line across the plan]]). The two are different rules and the note must
  not be read as one: never counted is about aggregation, not about visibility.
- On the dated axis it draws as a diamond at its date with no open end; an unreadable date
  shelves it with the reason visible; on the bucket axis it places by its horizon or
  shelves, and its date is never read as one.
- It survives `hierarchyOnly` with no parent, because a supported type is what admits a
  note to the hierarchy — and it is focusable by name, like every other declared type.

## Where it lives

Nothing is built yet. The vocabulary is `EXTRA_TYPES` and `ALL_TYPES` in
`src/domain/settings.ts`, where `DEFAULT_TYPE_SUBFOLDERS` gains the folder and
`typeFolderKey` generates the per-view option declared in `src/domain/viewOptions.ts`.
The hard part is that **`isExtraType` does two jobs**, and a milestone wants one of them.
"Declared, therefore never retyped by position" is right for it; "pinned at
`EXTRA_TYPE_RANK`, a container whose children are Tasks" is exactly wrong. Adding the name
to `EXTRA_TYPES` without splitting the predicate silently buys the second, in four places:

- `computeLevel` (`src/domain/model.ts`) gives it `EXTRA_TYPE_RANK`, so `childLevelIndex`
  reports Task for its children — a leaf implying a child level.
- `collectFocusRoots` (same file) treats `EXTRA_TYPE_RANK === focusIdx` as "focus the
  rung", so a **PBI-focused** view lists milestones as roots. Focusing the type by *name*
  is the other path and is correct as it stands: "show me the milestones" should work.
- `computeTypeChanges` (`src/domain/writePlan.ts`) descends the moved subtree from that
  rank, so a milestone nested by hand and moved inside a subtree rewrites its descendants
  as Tasks — while the same file's `!isExtraType(dragged.typeName)` exemption is the job
  worth keeping, since a dropped milestone must stay a milestone.

So the split is the work, and `childTypeChoices` in `src/domain/itemTypes.ts` — refusing
every extra type at top level today — is only the most visible part of it. Rollup
exclusion belongs to `assignAll` in `src/domain/model.ts`, beside the context-row skip it
resembles.
The diamond itself already exists and needs a second way to be true: `barGeometry` in
`src/domain/timeline.ts` and `barClasses` in `src/view/render/timeline.ts` derive it from
equal stated ends today. Reaching them at all is `deriveBars` in `src/domain/roadmap.ts`,
which is where a milestone must be reduced to its target point — it shelves a reversed
span before any rendering runs, so a milestone carrying a stale start later than its
target never gets as far as the geometry that would ignore it. Creation and filing are `src/view/interactions/create.ts`, and the
menu entry that has to disappear with the button is `src/view/interactions/menu.ts`.

Two seams in `src/view/render/rows.ts` are easy to miss and both fail loudly rather than
quietly, which is the argument for naming them here. `EXTRA_TYPE_STYLE` carries the icon
and badge colour for every declared non-rung type and deliberately has **no** fallback, so
a seventh name absent from it takes the unknown-type look and breaks the test that asserts
the table covers the vocabulary; the colour itself is `styles.css`, beside the other badge
classes. And `renderRowTrailing` renders the add button unconditionally, labelling it from
the first of the type choices — with none, that label is built from nothing. Driven in
`test/domain/itemTypes.test.ts`, `test/domain/settings.test.ts`,
`test/domain/model.test.ts`, `test/view/rendering.test.ts`, `test/view/creation.test.ts`,
`test/view/menu.test.ts` and `test/view/roadmapFrame.test.ts`.
