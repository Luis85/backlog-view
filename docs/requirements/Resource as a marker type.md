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
  - src/domain/bars.ts
  - src/view/render/badges.ts
  - src/view/manual/typesSection.ts
started: 2026-08-21
finished: 2026-08-21
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Resource as a marker type

**As** a delivery lead, **I want** each person on my team to be a note the plugin recognises
as a resource, **so that** a colleague is something the vault can hold facts about and the
view can list, rather than a spelling that happens to recur.

This is the step that lands **alone**. It adds a name to the vocabulary and changes nothing
about how an item says who is on it: every existing string assignee keeps working exactly as
it does today, and the roadmap's roster is untouched. What it buys on its own is small and
real — a person is a note with a badge and a folder, creatable from the view, and everything
after it has something to point at.

`Resource` is a **marker**, the third category `src/domain/itemTypes.ts` already describes:
no rung, no children, no parent, no `levelIndex`, and therefore nothing to re-type it by
position. `Milestone` and `Iteration` are the precedent and the whole of the argument — the
epic states why an eighteenth name is being added against an open P1 direction
([[Ten capabilities want seventeen new types]]), and that reasoning is not restated here.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Creating an item from the toolbar with no row selected, or setting an existing note's type |
| **Preconditions** | None. The type exists whether or not any resource property is configured |
| **Guarantee** | A `Resource` is never a rung and never a parent's child: it holds nothing, hangs from nothing, counts for nothing in any rollup, and no drag, drop, indent or reparent changes its type or gives it one |

**Main flow**

1. The user opens the toolbar's top-level creator, which offers every name in `ALL_TYPES`.
2. The user picks `Resource`, names it, and the note is written with `type` and nothing else
   — no `parent`, no `order`, since a marker has neither.
3. The note is filed in the `Resource` folder, from the per-type folder key the other
   declared types already have ([[Where new items are filed]]).
4. The row renders with its own badge and hue, ranked nowhere, with no disclosure and no
   count.
5. The in-app manual and the generated README list `Resource` among the declared types, from
   the same vocabulary rather than a second list.

**Extensions**

- **2a — the user drops a `Resource` onto an `Epic`, a `Feature` or a `PBI`.** Refused, the
  same way a `Milestone` is: a marker hangs from nothing, so there is no legal target. The
  refusal is the existing one and needs no new rule.
- **2b — the user opens a `Resource` row's own creator.** It offers nothing. A marker holds no
  children, and `childTypeChoices` already answers that for the two markers that exist.
- **4a — a `Resource` sits in a subtree something is rolling up.** It contributes nothing —
  not to a progress bar, not to a count of the work below it, not to a done-subtree state.
  This is the same rule [[Milestones as their own type]] states for a point in time, for the
  same reason: the thing contains no work. It says nothing about the TOOLBAR's item total or
  its level-breakdown tooltip, which report what the base returned rather than what has been
  done — see the acceptance criterion below, which used to be wide enough to read as both.
- **4b — the focus level is set.** A `Resource` is not a rung, so no level selects it and no
  level hides it. It is accepted as a focus root exactly as the other markers are.
- **4c — the note carries something under a date property.** Nothing is drawn. A
  `Resource` is the first marker that is not a date, and until this note said so the
  category answered the DATE questions as well as the structural ones: a person carrying
  the configured target key drew a diamond on the timeline, a milestone LINE across the
  grid, and a row in the resources axis's own `Milestones` lane — which also minted that
  lane on a base holding no milestone. It is refused at `placeItem`, the one call every
  axis makes, and `placementEnds` answers NEITHER end for the type, so no schedule, no
  drop, no grip and no writer can put a date on a person either. The narrowing is this
  type's and not the category's: a `Milestone` still reduces to its target point.
- **5a — the badge palette is full.** It already is. The hue comes from the second axis
  [[A badge when the palette is full]] introduced, not from a colour taken off another type.

## Acceptance criteria

- `Resource` is in `MARKER_TYPES` and in `ALL_TYPES`, and in neither `LEVELS`, `TEST_LEVELS`
  nor `EXTRA_TYPES`. Putting it in `EXTRA_TYPES` would pin it at `EXTRA_TYPE_RANK` and let it
  hold Tasks, which is the opposite of every rule above.
- It has no `levelIndex`, so `computeLevel` leaves it alone and no move re-types it.
- It is a root: a `Resource` with a parent is as wrong as a `Milestone` with one, and the
  register's own gate says so — `LEGAL_CHILDREN` gains `Resource` with an empty child set and
  `ROOT_TYPES` gains it too, or the register cannot hold the type the plugin ships.
- The hierarchy table in `docs/README.md` gains the same pair, since `docs-check.mjs` reads
  that table against `LEGAL_CHILDREN` in both directions.
- It gets a creation folder key (`typeFolder.resource`, shipped default `resources` under
  the home folder), a badge hue and a row in the generated README and the in-app manual, all
  from the vocabulary — no second list anywhere.
- **Nothing about `assignee` changes in this use case.** A vault upgrading to this step alone
  sees new type, same rows, same roster, same chips. That is what makes it landable first.
- A `Resource` contributes to no ROLLUP: no progress figure, no count of the work below it,
  no done-subtree state, no inferred span. It is selected by no focus level. **Never counted
  is a rule about aggregation, not about visibility** — the sentence [[Milestones as their
  own type]] states for the first marker, and it holds here word for word. The toolbar's own
  item total and its level-breakdown tooltip are the reader's view of what this base
  returned, not an aggregation of progress, so a `Resource` appears in both exactly as a
  `Milestone` already does. An automated reviewer read the wider sentence this criterion used
  to carry and asked for the opposite; excluding one declared type from the toolbar's total
  would make it the one number on screen that lies about what the base holds.
- **A `Resource` is never placed on either roadmap axis and never takes a date.** Not an
  extra criterion this note started with — it is 4c, found by automated review on the
  increment itself, and it is the one place the marker precedent did NOT carry: every
  marker before this one was a date.

## Where it lives

`src/domain/typeVocabulary.ts` is the whole of the declaration: `RESOURCE_TYPE` joins
`MARKER_TYPES` — which puts it in `ALL_TYPES` by construction — and `resources` joins
`DEFAULT_TYPE_SUBFOLDERS`. It is exported for exactly one reader — `isResourceType` in
`itemTypes.ts`, which 4c needs — and that predicate is itself module-local for the reason
the constant would otherwise be: an export with no consumer outside its file is what
`npm run analyze` calls dead, and it says so rather than leaving it to review.

**Every STRUCTURAL marker rule is already asked of `isMarkerType`** — no rung, no children,
no parent, no rollup, no dependency, no re-type by position — so those needed the concept
`src/domain/itemTypes.ts` already had and not a line of code. **The DATE questions did
not**, and that is 4c: `isResourceType` joins the predicates there for the same reason each
of the others is its own, and `drawsAsPoint` and `placementEnds` each except this one type —
the first so nothing draws a person at a point, the second so no gesture and no writer puts
a date on one. `src/domain/bars.ts` asks the second of those at `placeItem`, which is the
one call both axes make: a guard beside the dated axis alone would still have drawn a person
in the resources axis's own marker lane. The surfaces needed nothing:
`src/domain/settings.ts` and `src/domain/viewOptions.ts` generate the folder option per type
from `ALL_TYPES`, and `src/domain/backlogReadme.ts` and `src/view/manual/typesSection.ts`
document the vocabulary rather than a list beside it. `setupSection.ts`, which this note
predicted, turned out not to be the manual's types surface at all.

`src/view/render/badges.ts` gains the icon-and-class row (`user`, `pbl-lvl-resource`) and
`styles/badges.css` the rule it names — cyan, the marker hue, plus a PILL radius, which is
this type's answer to the second-axis rule [[A badge when the palette is full]] states for a
lone type: a separator recorded beside the hue it shares. It is the fourth cyan wearer and
the only one of them that is not a date, so the shape is what carries that and neither the
icon nor the name is asked to carry it alone.

`src/view/manual/typesSection.ts` gains the English explanation. That directory is
deliberately outside the message-catalog sweep, so an English literal there is the
convention rather than a miss.

Outside `src/`: `scripts/docs-check.mjs` gains `Resource` in `LEGAL_CHILDREN` with an empty
child set and in `ROOT_TYPES`, and `docs/README.md` gains the matching hierarchy row, the
folder row and the marker paragraph — the register cannot hold a type the plugin ships until
both sides say so, in both directions.
