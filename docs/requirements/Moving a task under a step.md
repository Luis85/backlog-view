---
type: PBI
parent: "[[Steps between a use case and its tasks]]"
order: 20
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
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

# Moving a task under a step

**As** someone who wrote the tasks before the steps, **I want** to move a task under the step
it serves, **so that** the map can draw it in the right column without me making the note
again.

This is the existing re-parent, on one new pair of types. It earns a use case of its own
because it is the path that makes the previous one useful: a vault that adopts steps has
tasks already, and re-typing or re-creating them is the outcome to avoid.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Dragging a task onto a step, or picking the step from the task's parent action |
| **Preconditions** | The task and the step exist, and both are inside the base's results |
| **Guarantee** | The task's `parent` becomes the step and its `order` places it among that step's tasks. Nothing else about the task changes — not its type, not its state, not its release. One batch, one undo. |

**Main flow**

1. The user drags a task onto a step.
2. The view plans the re-parent: the new `parent` link and one `order` among the step's
   existing tasks.
3. The gate applies it and the tree redraws with the task under the step.
4. Undo takes it back as one batch, restoring the previous parent and order.

**Extensions**

- **1a — the task is already under that step.** No write is planned and the undo slot is not
  consumed.
- **1b — the user cannot drag.** The context menu's parent action and the keyboard's lift and
  move reach the same step and write the identical batch.
- **1c — the drop would make a cycle.** Refused, by the existing check, with nothing written.
- **1d — the target step is outside the base's filter.** The move is withheld: a context row
  parents what is drawn beneath it and is never a write target or a ranking peer.
- **2a — the step has no tasks yet.** The task takes the first order in an empty sibling set.
- **3a — the task's own children come with it.** They keep their parent, which is the task,
  so the subtree moves as one and nothing is re-typed.

## Acceptance criteria

- After the move the task's type is unchanged, and so are its state, its release and every
  other property the move did not name — asserted field by field, not by eye.
- A drag onto a step that is a context row writes nothing and the whole batch is refused.
- The task's descendants keep their parents and their types.
- One undo restores both the previous parent and the previous order.
- The same three inputs — drag, keyboard, menu — produce byte-identical batches.

## Where it lives

No new module. The re-parent is `src/view/interactions/structure.ts`, reached from
`src/view/interactions/dragDrop.ts`, `src/view/interactions/keyboard.ts` and
`src/view/interactions/menu.ts`; the legal targets come from `src/domain/dropTargets.ts`, the
batch from `src/domain/writePlan.ts`, and the gate from `src/view/writeGate.ts`. What this use
case adds is a pair of types those modules have not seen, which is why its criteria are about
what the batch does *not* name.
