---
type: PBI
parent: "[[Work item hierarchy]]"
order: 70
status: Open
priority: P2
created: 2026-08-06
source: user request
files:
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
  - src/view/render/rows.ts
  - src/domain/backlogReadme.ts
  - styles/badges.css
---

# Deliverables as a rootable extra type

**As** someone tracking concepts, designs and other things the team must produce, **I
want** to type an item as `Deliverable` and create it with or without a parent, **so
that** a design doc isn't forced to invent a parent it doesn't have, while a deliverable
that genuinely belongs to a Feature or a PBI can still hang from it.

`Issue` and `Bug` already sit beside the ladder ([[Types beside the ladder]]), pinned at
`EXTRA_TYPE_RANK` and holding Tasks wherever they hang — and, like every declared type,
already creatable with no parent through the toolbar's own top-level creator: its "pick
another type" menu lists every name in `ALL_TYPES` unconditionally, `Deliverable`
included the moment it joins that vocabulary. Nothing in this PBI has to build that;
tracing `renderToolbar` is what corrects an earlier draft of this note, which wrongly
described a top-level modal gated by `childTypeChoices` that does not exist. What
`childTypeChoices` *does* gate is a **row's own +** — the child a `Deliverable` gets
under a real parent — and that is where this PBI's one real behavioural addition lives:
`Deliverable` joins the choices offered under an `Epic`, `Feature` or `PBI`, beside
`Issue` and `Bug`.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an item under a row, from the toolbar with no row selected, or setting an existing item's type |
| **Preconditions** | None |
| **Guarantee** | A `Deliverable`'s rank is a property of the type, fixed at `EXTRA_TYPE_RANK` wherever it sits, exactly as an `Issue`'s or a `Bug`'s is — no drag or reparent ever changes it, whether or not it has a parent. |

**Main flow**

1. The user opens the **+** on an `Epic`, `Feature` or `PBI` row.
2. `childTypeChoices(item)` offers `Deliverable` beside the ladder's own child, `Issue`
   and `Bug`; `promptCreateItem` asks which when there is more than one choice.
3. The user names it; the view writes `type`, `parent` and `order`, filing the note in
   the `Deliverable` folder ([[Where new items are filed]]).
4. The Deliverable renders with its own icon and colour, ranked as though it were a PBI
   wherever it hangs.
5. Opening **+** on that Deliverable offers `Task` alone.

**Extensions**

- **1a — the user instead uses the toolbar's "pick another type" menu, with no row
  selected.** Already offers `Deliverable`, unconditionally, the moment it is declared
  — that menu iterates the whole vocabulary and needed no change for this PBI. The note
  it writes carries no `parent` at all.
- **2a — the row is a `Task`.** Nothing hangs below a Task; the modal is skipped.
- **2b — the row is itself an `Issue`, `Bug` or `Deliverable`.** Its only children are
  Tasks, so again nothing is asked.
- **3a — the user drags an existing Deliverable to a different parent, or to the top
  level.** Its type is left alone — `levelIndex === -1` means "not a rung", exactly as
  it already does for `Issue` and `Bug`.
- **4a — the Deliverable has no parent at all**, whether created that way or dropped
  there. It stays in the model: a recognised type is enough to belong
  ([[Parentless extra type dropped from the model]]).

## Acceptance criteria

- `Deliverable` joins the fixed vocabulary, pinned at `EXTRA_TYPE_RANK`; its children
  are `Task`s under an Epic exactly as under a PBI or at the top level.
- It is offered under an `Epic`, `Feature` or `PBI`'s own **+** beside `Issue` and
  `Bug`, and it is offered by the toolbar's top-level creator with no code change
  required there — both are asserted, not just the second one assumed from the first.
- It is never re-typed by a move, whichever parent it lands under or whether it lands
  with none.
- It files into its own folder (`typeFolder.deliverable`, shipped default
  `deliverables` under the home folder), like every other declared type.
- It renders with its own icon and badge colour, and the test asserting the badge table
  covers the whole vocabulary covers it too.
- A parentless Deliverable is never pruned by `hierarchyOnly`.
- The generated README's hierarchy table describes `Deliverable` as able to have no
  parent (`childTypeChoices(null)` includes it) — a documentation-accuracy criterion,
  not a functional one; nothing in the interactive UI depends on it.
- The generated README's **prose above that table** agrees with it: it must not claim
  every member of `EXTRA_TYPES` "hangs from any rung" once `Deliverable` is one of them
  and does not. A generated document contradicting its own table is a defect in the
  generator, not an acceptable inconsistency to leave for the reader to reconcile.

## Where it lives

`src/domain/settings.ts` — `Deliverable` joins `EXTRA_TYPES`, and
`DEFAULT_TYPE_SUBFOLDERS` gains `deliverable: 'deliverables'`; `ALL_TYPES`, the
per-type folder options in `viewOptions.ts`, and the toolbar's top-level "pick another
type" menu (`view/render/toolbar.ts`, `ALL_TYPES`-driven) are all already generic over
the vocabulary and need no change of their own — this is where a `Deliverable` becomes
root-creatable, for free.
`src/domain/itemTypes.ts` — `childTypeChoices`' **under-a-parent** branch (`Epic`,
`Feature`, `PBI`) offers `Deliverable` beside `Issue` and `Bug`; its top-level branch
(`!parent`) also gains `Deliverable`, but only for `domain/backlogReadme.ts`'s
`parentsOf` check — the generated README, not the interactive creator.
`src/view/render/rows.ts` — the badge table gains a `deliverable` entry (icon and badge
class); `styles/badges.css` gains the colour.
`src/domain/backlogReadme.ts` — beyond the `parentsOf`/`childTypeChoices(null)` table fix
above, `typeSection`'s opening paragraph also names `EXTRA_TYPES` as a uniform group that
"hangs from any rung above the deepest"; it needs to read the same per-type
`childTypeChoices(null)` question the table already asks rather than assume every extra
type answers alike, and say so explicitly once `Deliverable` is the exception.
