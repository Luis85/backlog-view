---
type: Feature
parent: "[[Product Roadmap]]"
order: 60
status: Done
created: 2026-08-02
closed: 2026-08-02
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-02
risk: ""
assignee: ""
---

# Milestones

A date that matters to the plan, as a note. `Milestone` joins the fixed vocabulary as the
seventh name — the first that hangs from nothing and holds nothing — files into its own
folder, states one date in the property the timeline already reads, and draws on the
roadmap as the point in time it is: a diamond on its row, and a line down the plan at its
date.

**Outcome** — A deadline is an ordinary backlog note, filed and ranked and undoable like
every other, and the roadmap draws it as a point rather than borrowing the shape of work
that has duration.

## Use cases

- [[Milestones as their own type]] — the type, its date, its folder, and what it is not.
- [[A milestone line across the plan]] — the date read across every bar, not just its own row.

## Landmines, and where each was answered

A seventh name in a vocabulary six things were written against is not one change, and the
review of this specification found more traps than the specification did. They are
collected here rather than in either use case because the **order** is the thing, and
order belongs to neither one of them.

**The first landmine is the obvious move.** `EXTRA_TYPES` looks like where a seventh
declared name belongs, and it is not: that list means *pinned at `EXTRA_TYPE_RANK`,
children are Tasks, hangs from Epic, Feature or PBI* ([[Types beside the ladder]] states
it and ships it), and a milestone is the opposite on all three counts. Putting the name
there would not extend the contract but falsify it, and `isExtraType` would silently mean
two different things at four call sites — `computeLevel` and `collectFocusRoots` in
`src/domain/model.ts`, and twice in the re-typing cascade that lived in
`src/domain/writePlan.ts` until 2026-08-11.

The vocabulary takes a **third category** instead — a declared marker, no rung, no
children, no parent — with `ALL_TYPES` as the union, which is what earns the name its
folder, its admission to the hierarchy and its acceptance as a focus without any of those
rules learning a special case. Getting this backwards is what the rest of this list is
downstream of.

**The second landmine is the word "declared".** The cascade's retype exemption widens to
the declared **non-rung** types — the extra types and the markers — and stopping the
sentence one word early exempts the ladder as well, which would leave a PBI dropped under
an Epic a PBI and undo [[Assigning type on a move]] wholesale. `Epic`, `Feature`, `PBI` and
`Task` are declared *as rungs*; "declared pins" was only ever a rule about names that
occupy none.

**The third is that the union carries less than it looks like it does.** `ALL_TYPES`
membership is a domain fact, and two of the things this feature promises are not domain
facts at all: what a picker offers, and what a menu offers. Both enumerate the categories
by hand.

**The quiet ones.** Each does something plausible and wrong, and no test fails:

| Where | What it does to a milestone | Answered by |
| --- | --- | --- |
| ~~The re-typing cascade's `rankOf` (`src/domain/writePlan.ts`)~~ | Recognised only extra types, so a marker nested in a moved subtree took the positional rung and its descendants were retyped from a rank it does not have | Answered by a `stopsAt` early return at the dragged item and every node of the walk; **moot since 2026-08-11**, when the cascade was deleted whole ([[Assigning type on a move]]). Nothing re-runs this row |
| `renderFocusPicker` (`src/view/render/toolbar.ts`) | Builds its menu from `LEVELS` then `EXTRA_TYPES`, so the name a saved view may hold is one no user can pick | `renderFocusPicker` reading `ALL_TYPES` |
| `addScheduleItems` (`src/view/interactions/menu.ts`) | Offers Schedule whenever *either* date key is configured, so narrowing the fields to the target alone opens a modal with nothing in it | `canSchedule` |
| The date rollup ([[Spans roll up the tree]], `src/domain/model.ts`) | Gathers evidence from every result descendant, so a hand-nested milestone's target becomes a dateless ancestor's inferred end — a deadline reported as work | The `self` line in `assignAll` |
| `deriveBars` (`src/domain/bars.ts`) | Shelves it as a reversed span when a stale start sits after the target — before any rendering seam runs | `placeMarker` |
| `barGeometry` (`src/domain/timeline.ts`) | Clamps both ends into the window and still reports `milestone`, so a date beyond the clamped 60-month edge arrives as a one-day diamond at day 0 or the last day — a marker at a date nobody set. The same clamp misdraws any span lying wholly outside; the marker is the case this feature has to settle, because a diamond claims a date where a clipped end only claims a direction | `BarGeometry.outside` |
| `scheduleFields`, `validateSchedule` (`src/view/interactions/plan.ts`) | Offers both ends and applies the span rule, so the entry can refuse a milestone the timeline draws, and can accept a start that leaves it shelved | `placementEnds` |
| `carriesDates`, `unschedule` (same file) | Gates on either key and removes both, so Unschedule appears on a milestone with no milestone date, and deletes a start the feature only promised to ignore | `placementEnds` again |
| `renderRowTrailing` (`src/view/render/rows.ts`) | Renders an add button labelled from the first of no choices | The `childTypes.length === 0` guard |
| `test/docs/surfaces.test.ts` | Asserts the generated `typeFolder.<type>` keys for a hand-written list of six names, so a seventh is simply uncovered | `ALL_TYPES` in `surfaces.test.ts` |

The middle two are one trap wearing two coats, and worth naming as a rule rather than a
pair: **a placement action must answer for the type it is acting on, on both the offering
side and the writing side.** Narrowing the prompt and leaving Unschedule alone was the
first version of this specification's own mistake — and narrowing both while leaving the
*gestures* alone was the second, so the rule is now written per **type** rather than per
control: every path that places a milestone writes its target alone, the row's entries and
the shelf drop and the bar slide and each keyboard equivalent
([[Drag from the shelf to schedule]], [[Move and resize a bar]],
[[Keyboard and menu on the roadmap]] each carry it). Those three are unbuilt, which is the
only reason this is cheap: a rule stated per control is one control out of date the moment
a fourth path appears.

**The loud one is a gift.** `NAMED_TYPE_STYLE` in `src/view/render/badges.ts` deliberately
has no fallback for a declared type, and a test asserts the table covers the vocabulary —
so the badge is the one seam that refuses to be forgotten. That is what the others would
look like if the same discipline reached them, which is the argument for adding a
vocabulary-driven test rather than another remembered list.

**Records and sibling specs settled in the same change**, none of which was wrong before
it:
[ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md) was titled for six names
and listed the extra types by hand — amended to seven, keeping its filename and its
number;
[ADR 0014](../adrs/0014-rank-extra-types-by-type-not-by-position.md) *defined* an extra
type as "a declared type that is not a rung" and pinned that definition at
`EXTRA_TYPE_RANK`, which classified a marker as the thing it is not — everything it
decides about `Issue` and `Bug` survives, and the amendment is to the definition's reach,
not to the decision; the register's own checker (`docs-check.mjs`) held a
legal-parent table of six types and a root rule naming only `Epic`, so the register could
not file a milestone of its own until it knew the name — it now does, and its own tests
plant that case in both directions; and `docs/README.md`'s hierarchy table now has the row
for a type whose parent is nothing and whose children are nothing. [[Type names are data]],
[[What counts as a work item]], [[Types beside the ladder]] and [[Multilang]]'s own data
table each pinned the count and no longer do, and both rollups now name the marker as an
exception — the progress count in [[Rollups and hiding finished work]] and the date
evidence in [[Spans roll up the tree]] — stated in each note's guarantee rather than only
in its criteria, since a criterion that contradicts its own use case is not a
specification. Unpinning was the fix everywhere it was available, because a requirement
that states a number goes stale in silence while one that reads the vocabulary fails out
loud; the two rollups are the exception to the unpinning, because a second exclusion is
something a walk genuinely gained rather than a count that went out of date.
