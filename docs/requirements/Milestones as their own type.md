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
  - src/view/interactions/menu.ts
  - src/view/interactions/plan.ts
  - src/view/render/rows.ts
  - src/view/render/toolbar.ts
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
| **Guarantee** | A milestone is a marker and never work: it takes no children, and it aggregates into nothing — no ancestor's rollup, progress figure, done-subtree state or inferred span, wherever it sits — so its own status can neither advance a bar nor hide work that has not moved, and its date can neither stretch nor invent an ancestor's. Its own row is a separate question with the ordinary answer: it narrows under the reader's visibility controls exactly as any other row does. Nothing about its date is inferred, swapped or written by rendering it. |

**Main flow**

1. `Milestone` is a name in the fixed vocabulary — a declared **marker**, a third category
   beside the ladder and the extra types, since it is neither a rung nor the pinned
   container an extra type is ([[Types beside the ladder]]). Being declared is what stops
   anything retyping it by position. It takes
   the shipped opinion every declared name gets: a folder, an **icon and a badge colour**.
   The badge renderer has no fallback for a declared type on purpose
   ([ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md)), so the seventh name
   is not optional styling — a milestone left out of that table renders as an unknown type,
   and the test asserting the table covers the vocabulary fails. **Two** accepted records
   are dated by this type, and neither is reversed by it — both are accurate about the code
   as it stands, and both stop being true the moment a marker ships, which is why resolving
   them belongs to the change that makes them wrong rather than to this note:
   [ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md) is titled for **six**
   names and lists the two extra types by hand, while the vocabulary stays fixed, which was
   its whole point; and
   [ADR 0014](../adrs/0014-rank-extra-types-by-type-not-by-position.md) opens its decision
   by *defining* an extra type as "a declared type that is not a rung", which a marker also
   is — so the definition, left as it stands, classifies a milestone as the very thing this
   note says it is not, and pins it at `EXTRA_TYPE_RANK` by that classification alone.
   Everything 0014 decides stays true of `Issue` and `Bug`; what dates is the definition's
   reach, and the amendment is one clause — declared-not-a-rung is the genus, and the pinned
   rank is what makes an extra type the species of it that holds Tasks.
2. Its date is the roadmap's configured target property — the same key a bar's end is read
   from, read the same tolerant civil way — and its note body is its description.
3. It files into its own folder, picked per view like every other type's
   (`typeFolder.milestone`), shipping as `milestones` under the home folder.
4. It is offered at the **top level only**, and offers no child types of its own.
5. On the dated axis it renders as a diamond at its date, with no open end, because
   nothing is missing.
6. Everywhere else it is an ordinary row that **aggregates** into nothing: no ancestor's
   rollup, progress figure, done-subtree state or inferred span is ever computed from it.
   Both rollups this model runs are covered, and for the same reason — a marker is not
   work, so it is neither a unit of progress nor evidence of when work happens
   ([[Rollups and hiding finished work]], [[Spans roll up the tree]]). Its own status
   remains its own, and its own row narrows under the ordinary visibility controls.

**Extensions**

- **1a — a milestone is dragged under a work item.** Nothing refuses it. The ladder has
  always guided rather than refused, and `childTypeChoices` decides what is *offered*,
  never what is legal ([[Assigning type on a move]]) — so the rule lives in the creation
  affordances, and a milestone put somewhere by hand keeps its type and renders where it
  was put. Step 6 still holds there, and hand-nesting is the case it is *for*: having a
  parent makes a marker neither countable nor datable evidence — a release date under an
  epic must not become the end of that epic's inferred bar, which is precisely the reading
  a dateless ancestor would otherwise take from it.
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
- **2d — the row's Schedule entry is opened on a milestone.** It asks for the **target
  alone**, and the span rule does not apply to it. Offering both ends would contradict the
  type twice over: a milestone carrying a stale start after its target draws correctly by
  2c but could not be reopened and saved unchanged, because the entry refuses a target
  before a start; and a user entering only a start would leave believing the milestone is
  scheduled while it stays on the shelf, since the type ignores that date. A prompt must
  not be able to produce a state the projection contradicts. Narrowing the entry narrows
  what offers it: Schedule is reached today whenever *either* date key is configured, so on
  a start-only vault (2a) a milestone's entry would open asking for nothing at all. The
  entry is **withheld** in that configuration rather than opened empty — the same answer 4a
  gives the add button, for the same reason.
- **2e — Unschedule is reached on a milestone.** It answers for the **target alone** as
  well: offered only while the target key is present, and removing only that key. Both
  halves of the general rule are wrong here for the same reason 2d is — offered on a
  start-only milestone it would take away a key that was never the milestone's date, and
  taken on the 2c note it would delete a start the feature promised to ignore. Ignoring a
  value and deleting it are different acts, and only the first was specified.
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
- It is **not an extra type** and is absent from `EXTRA_TYPES`, so every rule that list
  carries stays exactly as [[Types beside the ladder]] states it. It occupies no rung: it
  never appears as a focus root for a level, and moving a subtree that contains one never
  retypes that milestone or its descendants from a rank it does not have. Focusing
  `Milestone` by name still lists them, which is a different question and the one to keep.
- The row's Schedule entry asks a milestone for its target alone and does not apply the
  span rule to it — and is offered at all only where a target key is configured, never
  opened onto no fields — so no entry can leave a milestone in a state its own projection
  contradicts — neither an unsavable-but-drawable stale start, nor a start-only write that
  reads as scheduled while the item stays shelved. Unschedule answers for the target alone
  too: gated on that key's presence, removing that key only, so no placement action ever
  deletes a date the feature merely ignores.
- A milestone row shows **no** create affordance — no add button, no `New <child>` menu
  entry — rather than one built from an empty list of choices.
- It renders with an icon and a badge colour of its own, like every other declared type,
  and the test that asserts the badge tables cover the whole vocabulary covers seven names
  rather than six.
- It contributes to no ancestor's rollup, progress figure, done-subtree state or inferred
  span, wherever it sits in the tree: both the progress count
  ([[Rollups and hiding finished work]]) and the date evidence
  ([[Spans roll up the tree]]) skip it, so a milestone nested under a dateless epic leaves
  that epic's bar exactly as its work left it — while its own row narrows under
  "Show completed items" and the
  quick filter exactly as any other row does, and its line goes with it
  ([[A milestone line across the plan]]). The two are different rules and the note must
  not be read as one: never counted is about aggregation, not about visibility.
- On the dated axis it draws as a diamond at its date with no open end; an unreadable date
  shelves it with the reason visible; on the bucket axis it places by its horizon or
  shelves, and its date is never read as one.
- It survives `hierarchyOnly` with no parent, because a supported type is what admits a
  note to the hierarchy — and it is focusable by name, like every other declared type:
  named in the toolbar's focus picker, not merely honoured once a saved view already
  carries it.

## Where it lives

Nothing is built yet. The vocabulary is `EXTRA_TYPES` and `ALL_TYPES` in
`src/domain/settings.ts`, where `DEFAULT_TYPE_SUBFOLDERS` gains the folder and
`typeFolderKey` generates the per-view option declared in `src/domain/viewOptions.ts`.
**A milestone is not an extra type, and must not be put in `EXTRA_TYPES`.** That list has
a precise meaning this register already states and ships ([[Types beside the ladder]]): a
declared type pinned at `EXTRA_TYPE_RANK`, whose children are Tasks wherever it hangs, and
which hangs from an Epic, a Feature or a PBI. A milestone is the opposite on all three
counts. Adding the name there would not extend that contract, it would falsify it — and
`isExtraType` would start meaning two things at four call sites.

So the vocabulary gains a **third category** beside the ladder and the extra types: a
declared **marker**, which occupies no rung, holds nothing, and hangs from nothing.
`ALL_TYPES` is the union of all three, which is what admits the name to `hierarchyOnly`,
accepts it as a `focusTarget` and offers it a folder without any of those rules learning a
special case.

Two things the union does *not* carry on its own, and both are places that enumerate the
categories by hand rather than reading the union. The first is the autoType cascade,
`computeTypeChanges` in `src/domain/writePlan.ts`, which names `isExtraType` **twice** and
needs the marker at both:

- The dragged item is exempted from retyping while `isExtraType(dragged.typeName)`. That
  exemption widens to the declared **non-rung** types — the extra types and the markers —
  and pointedly not to the ladder itself: `Epic`, `Feature`, `PBI` and `Task` must keep
  being retyped by position, which is the whole of [[Assigning type on a move]]. "Declared
  pins" is a rule about names that occupy no rung; a rung's name is declared *as* that
  rung.
- `rankOf` gives every node in the moved subtree the rung it carries on from, and today a
  name it does not recognise takes the positional one. A marker has no rung to descend
  from, so the walk **stops** at it: the milestone is not retyped (it has no `levelIndex`,
  as the ladder already treats an unrecognised type in `computeLevel`) and neither is
  anything hand-nested beneath it, rather than that subtree being renumbered from a rank
  the marker does not have. This is the failure the existing comment there describes for
  extra types — the item left alone, its children silently corrupted — reached by the new
  name, and it needs the same explicit boundary. `outsideFilter` is the precedent for the
  shape: where the cascade cannot say what a rung is, it stops rather than guesses.

The second is focus. `collectFocusRoots` needs nothing — it never lists a rungless name as
a root for a *level*, and still finds it when the focus target is the name itself — but
being *acceptable* as a focus is not being *offerable*: `renderFocusPicker` in
`src/view/render/toolbar.ts` builds its menu from `LEVELS` and then `EXTRA_TYPES`, so a
name in neither list is one a user cannot pick, however well the model would honour it.
The picker enumerates the third category too, and the test asserting its exact contents
(`test/view/rendering.test.ts`) names eight entries rather than seven.

What genuinely is new is two things. `childTypeChoices` in `src/domain/itemTypes.ts` has
to offer the name at the top level and nothing beneath it — the inverse of the rule it
applies to extra types today. And rollup exclusion belongs to `assignAll` in
`src/domain/model.ts`, beside the context-row skip it resembles: it is the **second**
exception to "a rollup counts every descendant the Base returned", and
[[Rollups and hiding finished work]] names it as such. That exception is stated once and
holds for *every* quantity that walk gathers, which is the reason to put it there rather
than at a call site: the date evidence [[Spans roll up the tree]] adds to the same walk is
gathered from every result descendant with only the context-row exclusion, so a marker not
named there would extend a dateless ancestor's inferred bar with a date belonging to no
work — the same walk, the same skip, one more quantity.
The diamond itself already exists and needs a second way to be true: `barGeometry` in
`src/domain/timeline.ts` and `barClasses` in `src/view/render/timeline.ts` derive it from
equal stated ends today. Reaching them at all is `deriveBars` in `src/domain/roadmap.ts`,
which is where a milestone must be reduced to its target point — it shelves a reversed
span before any rendering runs, so a milestone carrying a stale start later than its
target never gets as far as the geometry that would ignore it. Creation and filing are
`src/view/interactions/create.ts`. The write side of the date is
`src/view/interactions/plan.ts`, where `scheduleFields` offers every configured end and
`validateSchedule` applies the span rule to whatever it finds — both of which a milestone
has to narrow rather than inherit.

`src/view/interactions/menu.ts` withholds **two** entries, and the second is the one the
narrowing above creates. `New <child>` disappears with the row's add button, as 4a says.
And `addScheduleItems` is reached whenever `hasDateAxis` holds — which is either date key,
not the target — so on a start-only vault it would offer a milestone a Schedule entry whose
field list, narrowed to the target alone, is empty. The entry is gated on the target key
for a milestone: a control that opens onto nothing is the failure 4a and the context-row
rule both answer by removing the control, not by opening it and apologising.

Two seams in `src/view/render/rows.ts` are easy to miss and both fail loudly rather than
quietly, which is the argument for naming them here. `EXTRA_TYPE_STYLE` carries the icon
and badge colour for every declared non-rung type and deliberately has **no** fallback, so
a seventh name absent from it takes the unknown-type look and breaks the test that asserts
the table covers the vocabulary; the colour itself is `styles.css`, beside the other badge
classes. And `renderRowTrailing` renders the add button unconditionally, labelling it from
the first of the type choices — with none, that label is built from nothing. Driven in
`test/domain/itemTypes.test.ts`, `test/domain/settings.test.ts`,
`test/domain/model.test.ts`, `test/domain/roadmap.test.ts`,
`test/domain/writePlan.test.ts` — beside the cascade cases that already prove a rung's name
*is* retyped by position, which is what the widened exemption must not undo —
`test/view/rendering.test.ts`, `test/view/creation.test.ts`, `test/view/menu.test.ts`,
`test/view/plan.test.ts` and `test/view/roadmapFrame.test.ts`.
