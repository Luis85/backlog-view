---
type: PBI
parent: "[[Work item hierarchy]]"
order: 80
status: Done
priority: P2
area: feature
created: 2026-08-08
closed: 2026-08-08
source: user request
files:
  - src/domain/settings.ts
  - src/domain/backlogReadme.ts
  - src/view/render/rows.ts
  - styles/badges.css
---

# Ideas as a type beside the ladder

**As** someone who has a thought before they have a plan, **I want** to type an item as
`Idea` and hang it at any level of the backlog — or at none — **so that** a thought
raised against an Epic and one raised against a PBI are the same kind of thing, filed
where it occurred to me, without pretending either is a Feature.

An `Idea` is an **extra type**: the category [[Types beside the ladder]] already
defines, whose rank is a property of the TYPE rather than of where it sits. That is what
"lives at every level" means here, and it is the whole reason this is not a fifth rung —
a ladder rule is always "one rung below the parent", and an Idea's position and its
contents are independent.

This is the third name in that category, and the first since it stopped being two.
Nothing about the category changed to admit it; what changed is prose that had counted
on there being two ([[A guide is prose, not an inventory]] is the standing rule, and the
generated README's `Issue and Bug and Idea` is what it reads like when the count is
assumed rather than derived).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an item under a row, creating one from the toolbar with no row selected, or setting an existing item's type |
| **Preconditions** | None |
| **Guarantee** | An `Idea`'s rank is `EXTRA_TYPE_RANK` wherever it sits, exactly as an `Issue`'s or a `Bug`'s — no drag, reparent or auto-type cascade changes it, whether or not it has a parent. |

**Main flow**

1. The user opens the **+** on an `Epic`, `Feature` or `PBI` row.
2. `childTypeChoices(item)` offers `Idea` beside the ladder's own child, `Issue` and
   `Bug`; `promptCreateItem` asks which, since there is more than one choice.
3. The user names it; the view writes `type`, `parent` and `order`, filing the note in
   the `Idea` folder ([[Where new items are filed]]).
4. The Idea renders with its own icon and colour, ranked as though it were a PBI
   wherever it hangs.
5. Opening **+** on that Idea offers `Task` alone, and asks nothing.

**Extensions**

- **1a — the user instead uses the toolbar's "pick another type" menu, with no row
  selected.** It iterates the whole vocabulary, so `New Idea` appears there the moment
  `Idea` is declared — no code of its own. The note it writes carries no `parent`.
- **2a — the row is a `Task`.** Nothing hangs below a Task; the modal is skipped.
- **2b — the row is itself an `Issue`, `Bug` or `Idea`.** Its only children are Tasks,
  so again nothing is asked.
- **3a — the user drags an existing Idea to a different parent, or to the top level.**
  Its type is left alone: `levelIndex === -1` means "not a rung", as it already does for
  `Issue` and `Bug`.
- **4a — the Idea has no parent at all**, whether created that way or dropped there. It
  stays in the model: a declared type is enough to belong
  ([[Parentless extra type dropped from the model]]).

## Acceptance criteria

- `Idea` joins the fixed vocabulary as an extra type, pinned at `EXTRA_TYPE_RANK`; its
  children are `Task`s under an Epic exactly as under a PBI.
- It is offered under an `Epic`, `Feature` or `PBI`'s own **+** beside `Issue` and `Bug`,
  and by the toolbar's top-level creator and the context menu's `Set type`, both of which
  read the whole vocabulary and needed no change.
- It is never re-typed by a move, whichever parent it lands under or whether it lands
  with none, and a parentless `Idea` is never pruned by `hierarchyOnly`.
- It files into its own folder (`typeFolder.idea`, shipped default `ideas` under the home
  folder), like every other declared type.
- It renders with its own icon and badge colour, distinct from every level's and from
  every other extra type's; the test asserting the badge table covers the whole
  vocabulary covers it too.
- The generated README names the extra types in a sentence a third name does not break:
  `Issue`, `Bug` and `Idea`, not `Issue and Bug and Idea`.
- The three rank, pruning and choice criteria above are asked of `EXTRA_TYPES` rather
  than of the name `Idea`, so a fourth name cannot join the category without answering
  them.

## Where it lives

`src/domain/settings.ts` — `Idea` joins `EXTRA_TYPES` and `DEFAULT_TYPE_SUBFOLDERS`
gains `idea: 'ideas'`. That is the whole of the behaviour: `ALL_TYPES`, the per-type
folder option in `src/domain/viewOptions.ts`, `childTypeChoices` and `EXTRA_TYPE_RANK` in
`src/domain/itemTypes.ts`, the scope test in `src/domain/model.ts`, the cascade's
exemption in `src/domain/writePlan.ts`, the shelf grouping in `src/domain/shelf.ts`, the
toolbar's creator in `src/view/render/toolbar.ts` and the `Set type` submenu in
`src/view/interactions/menu.ts` are all already generic over the vocabulary.

`src/view/render/rows.ts` — the non-rung badge table gains an `idea` entry (a
`lightbulb` icon and the badge class); `styles/badges.css` gains the colour, green, clear
of the four levels and of pink, red and cyan.

`src/domain/backlogReadme.ts` — `andList` joins a category's names as English rather than
with ` and ` between every pair. Two sentences in the generated README name a whole
category, and both read as a list only while the category holds two; `Intl.ListFormat` is
the stdlib answer and is out of reach, its typings arriving in `ES2021.Intl` where
`tsconfig.json` sets `lib` to `ES2020`.

## What is deliberately NOT here

`childTypeChoices(null)` still answers `Epic` and the markers, not the whole vocabulary.
Making it agree with the toolbar — which creates any type at the root today — is a
documentation-accuracy fix owned by [[Deliverables as a rootable extra type]], and it
belongs to that PBI whether or not `Deliverable` is ever built. An `Idea` is already
root-creatable through the toolbar without it.

`docs-check.mjs`'s `LEGAL_CHILDREN` does not name `Idea` either. That table is the
schema of *this register*, and no note here is typed `Idea`; it grows when one is.

## Verification

`npm run check`. The vocabulary gates caught every place a name had been counted rather
than derived — nine failures across six suites from the one-line change, which is what
the badge table's comment claims and had not been asked since `Milestone`.

Not verifiable here, as ever: the badge itself. Added to the
[smoke-test checklist](../issues/Smoke%20test%20the%20visual%20changes.md).
