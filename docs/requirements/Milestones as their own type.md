---
type: PBI
parent: "[[Milestones]]"
order: 10
status: Done
priority: P2
created: 2026-08-02
closed: 2026-08-02
source: user request
files:
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
  - src/domain/model.ts
  - test/domain/milestones.test.ts
  - src/domain/viewOptions.ts
  - src/domain/roadmap.ts
  - src/domain/writePlan.ts
  - src/view/interactions/menu.ts
  - src/view/interactions/plan.ts
  - src/view/render/rows.ts
  - src/view/render/toolbar.ts
  - styles/badges.css
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
5. On the dated axis it renders as a diamond **at its date**, with no open end, because
   nothing is missing — and only where that date is inside the drawn window, since a
   diamond anywhere else would be a date the milestone does not have
   ([[A milestone line across the plan]] settles the off-window row).
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
- **2f — the milestone is placed by a gesture rather than by the row's entries.** The same
  answer, because the rule belongs to the **type** and not to the control: every path that
  writes a placement writes the target alone and leaves any start where it found it. The
  row's menu is simply the path that exists first — the roadmap's gestures are specified in
  siblings still unbuilt, and each has a both-ends shape a marker has to narrow:
  - A shelf card dropped on the grid writes start **and** target spanning the cell
    ([[Drag from the shelf to schedule]]). A milestone takes the target alone, anchored
    where a target's kind already anchors it — the cell's **last** day. That is the note's
    own 2c shape, reached by the type rather than by the configuration.
  - A bar dropped back on the shelf removes the configured date keys. A milestone's drop
    removes the target key alone, exactly as 2e requires of Unschedule, because the two are
    the same act reached by two hands.
  - A bar's body slides both dates together and an end handle moves one
    ([[Move and resize a bar]]). A diamond has no ends to resize — a point has no duration
    to change, so it offers no end grip — and its body slide moves the target alone. On the
    2c note the ignored start is *not* carried along: sliding a date the projection ignores
    would write a plan the reader was never shown.
  - The keyboard equivalents ([[Keyboard and menu on the roadmap]]) mirror those gestures
    and inherit the narrowing with them, which is the point of stating it once here: a rule
    written per control is a rule that is one control out of date the moment a fourth path
    is added.

  And narrowing to one key makes that key load-bearing: on the start-only vault of 2a there
  is **no legal batch left** — the target has no key to receive a write and the start is a
  key this type may not touch — so every one of these affordances is **absent** there, not
  offered and then refused. No grip on the shelf card, no lift, no menu entry (2d), the
  same answer 4a gives the add button and the register gives an unconfigured axis. A
  gesture that can only end in nothing must not start, and a milestone in that vault is a
  row on the shelf until a target property exists, which is exactly what 2a already says.
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
- **Every** path that places a milestone writes its target alone and never touches a start:
  the row's Schedule and Unschedule entries, a shelf card dropped on the grid, a bar dropped
  back on the shelf, a bar gesture, and each of their keyboard equivalents. A milestone is
  never given a start it did not have, and never loses one the feature only promised to
  ignore, whichever hand does the placing.
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
- On the dated axis it draws as a diamond at its date with no open end, and a diamond is
  drawn nowhere else: a date outside the drawn window leaves the row marked as lying past
  that edge rather than clamped onto it; an unreadable date shelves it with the reason
  visible; on the bucket axis it places by its horizon or shelves, and its date is never
  read as one.
- It survives `hierarchyOnly` with no parent, because a supported type is what admits a
  note to the hierarchy — and it is focusable by name, like every other declared type:
  named in the toolbar's focus picker, not merely honoured once a saved view already
  carries it.

## Where it lives

`MARKER_TYPES = ['Milestone']` in `src/domain/settings.ts`, beside `LEVELS` and
`EXTRA_TYPES` rather than inside either — a declared type is not an extra type by adding
its name to the wrong list, and `MARKER_TYPES` is the third category this note asked for
rather than a widened `EXTRA_TYPES`. `ALL_TYPES` is `[...LEVELS, ...EXTRA_TYPES,
...MARKER_TYPES]`, the union that admits the name to `hierarchyOnly`, accepts it as a
`focusTarget` and offers it a folder without any of those rules learning a special case.
`DEFAULT_TYPE_SUBFOLDERS` gains `milestone: 'milestones'`, and `typeFolderKey` picks it up
for free because it already generates one option per name in `ALL_TYPES`
(`src/domain/viewOptions.ts` needed no change at all — it was already generic over the
vocabulary).

`src/domain/itemTypes.ts` gained the predicate the note said it would need:
`isMarkerType(typeName)`, matched case-insensitively like `isExtraType`, and deliberately a
**second** predicate rather than a widened one — the two answer opposite questions about
rank, children and parents, and the four sites that already asked `isExtraType` mean the
pinned-rank container specifically. `LadderPosition` gained a `typeName` field, because a
marker has no rung and therefore no position that could tell it apart from an ordinary item
at the same effective level — the name on the note is the only thing that can. And
`childTypeChoices` narrows in both directions at once: called with a marker parent it
returns `[]` (no rung below it, no extra type beside it), and called with no parent it
returns the ladder's top plus every name in `MARKER_TYPES` — a milestone hangs from
nothing, and offering it only under a real parent would leave no way to create the case
this whole feature is about.

The autoType cascade needed one boundary, not two. `computeTypeChanges` in
`src/domain/writePlan.ts` declares a single `stopsAt(item)` predicate —
`item.outsideFilter || isMarkerType(item.typeName)` — applied in exactly two places: as an
early return on the **dragged** item (a marker dropped anywhere keeps its type, and so does
its whole subtree, because nothing beneath a rankless item can be ranked from it), and as
the walk guard inside the descent (`if (stopsAt(child)) continue`), so a marker hand-nested
inside a moved subtree stops the branch under it exactly as an `outsideFilter` row already
does. There is no separate `isDeclaredNonRung` — the brief predicted one, and the shipped
shape is one early-return predicate covering both the dragged-item exemption and the
branch stop, because the two needed the same answer for the same reason. It pointedly does
not reach the ladder: `Epic`, `Feature`, `PBI` and `Task` are declared *as* rungs and must
keep being retyped by position, which is the whole of [[Assigning type on a move]].

Focus needed one change: `renderFocusPicker` in `src/view/render/toolbar.ts` now builds its
menu by iterating `ALL_TYPES` directly, one `for` loop over the whole vocabulary rather than
`LEVELS` then `EXTRA_TYPES` by hand — so a saved view can hold any declared name and a user
can always pick it, with no third list to keep in step. `collectFocusRoots` needed nothing:
it already never lists a rungless name as a root for a *level*, and still finds one when the
focus target is the name itself.

Rollup exclusion is one line in `assignAll` (`src/domain/model.ts`), beside the context-row
skip it resembles: `const self = child.outsideFilter || isMarkerType(child.typeName) ? 0 :
1;` — stated once and read by every quantity the walk gathers from that point on, so it
holds for the progress count, the done-subtree state and the date evidence alike without a
second exclusion at any of their call sites. [[Rollups and hiding finished work]] and
[[Spans roll up the tree]] both name it as the second exception to "a rollup counts every
descendant the Base returned," the first being the context row.

The point reduction lives in `src/domain/bars.ts`: `placeMarker(item, target)` reads
the same target property a bar's end is read from, the same tolerant civil way, shelves an
absent or unreadable target exactly as a span end does, and otherwise answers a bar whose
`span` is `{ start: target, target }` — the equal pair `barGeometry` already draws as a
diamond, reached by the type rather than by a coincidence of two dates agreeing. `placeItem`
calls it **before** the ordinary span rules (unreadable / reversed / inferred) ever run
against a milestone, which is what lets a stale start later than the target still draw as
the point it is instead of shelving as a reversed span — the rendering seam that reduction
was written to avoid needing. `deriveBars` (also `src/domain/bars.ts`) is the walk that
calls `placeItem` for every row.

`src/domain/itemTypes.ts` narrows per **type**, not per control, exactly as specified:
`placementEnds(typeName)` returns `['target']` for a marker and both ends otherwise, taking
the type name rather than an item so `storage/` can ask it of a live note without reaching
into `view/`. `src/view/interactions/plan.ts` and `src/domain/bars.ts`'s `barHolds` both call
it with `item.typeName`: `scheduleFields`, `validateSchedule`, `carriesDates` and `unschedule`
all read it rather than each re-deciding which ends exist. `canSchedule(settings, item)`
answers whether any of `placementEnds`' fields has a configured key at all — the entry is
**withheld**, not opened empty, on a milestone in a start-only vault, because there is no
legal batch left for it to write. `src/view/interactions/menu.ts` gates `addScheduleItems` on
`canSchedule` rather than `hasDateAxis` for exactly that reason: the two agree for ordinary
work and diverge for a milestone whose only writable end is the target.

`src/view/render/rows.ts` carries the badge table as `NON_RUNG_STYLE` (the brief predicted
`EXTRA_TYPE_STYLE`; it ships as the more accurate name, since a marker is not an extra
type) — `{ icon: 'diamond', badge: 'pbl-lvl-milestone' }` beside `issue` and `bug`,
deliberately with no fallback, so the badge is the one seam a missing name breaks loudly.
The colour is `.pbl-lvl-milestone { --color-cyan-rgb }` in `styles.css`, beside the other
badge classes — **cyan**, not purple: purple is already `.pbl-lvl-1` (Feature).
`renderRowTrailing` withholds the row's add button with `if (childTypes.length === 0)
return;` rather than building a label from the first of no choices, and `New <child>`
disappears from the context menu with it, by having nothing to loop over.

Driven in `test/domain/milestones.test.ts` — the marker's own rollup and roadmap-placement
cases, split out of `model.test.ts` and `roadmap.test.ts` by subject — beside
`test/domain/itemTypes.test.ts`, `test/domain/settings.test.ts`,
`test/domain/writePlan.test.ts` (the cascade cases proving a rung's name *is* still retyped
by position, which the `stopsAt` boundary must not undo), `test/view/rendering.test.ts`,
`test/view/menu.test.ts`, `test/view/plan.test.ts` and `test/view/toolbar.test.ts`. The
diamond's own geometry and the line drawn from it belong to
[[A milestone line across the plan]].
