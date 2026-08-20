---
type: PBI
parent: "[[Resources as notes]]"
order: 10
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/typeVocabulary.ts
  - src/domain/itemTypes.ts
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/backlogReadme.ts
  - src/view/render/rows.ts
  - src/view/manual/setupSection.ts
started: ""
finished: ""
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
  not to a progress bar, not to a count, not to a level breakdown. This is the same rule
  [[Milestones as their own type]] states for a point in time, for the same reason: the thing
  contains no work.
- **4b — the focus level is set.** A `Resource` is not a rung, so no level selects it and no
  level hides it. It is accepted as a focus root exactly as the other markers are.
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
- It gets a creation folder key, a badge hue and a row in the generated README and the in-app
  manual, all from the vocabulary — no second list anywhere.
- **Nothing about `assignee` changes in this use case.** A vault upgrading to this step alone
  sees new type, same rows, same roster, same chips. That is what makes it landable first.
- A `Resource` contributes to no rollup, no count and no level breakdown, and is selected by
  no focus level.

## Where it lives

**Nothing yet — this note is design.** Every module it names exists; none of them knows the
name.

`src/domain/typeVocabulary.ts` declares the name and adds it to `MARKER_TYPES` ·
`src/domain/itemTypes.ts` is where marker semantics already live, so it needs the name and no
new concept · `src/domain/settings.ts` and `src/domain/viewOptions.ts` carry the per-type
creation folder key · `src/domain/backlogReadme.ts` and `src/view/manual/setupSection.ts`
document it from the vocabulary · `src/view/render/rows.ts` and `styles/badges.css` draw the
badge.
