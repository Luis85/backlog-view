---
type: PBI
parent: "[[Steps between a use case and its tasks]]"
order: 10
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
---

# Steps as their own type

**As** someone breaking a use case down, **I want** its steps to be notes under it, **so
that** the tasks I write can hang from the step they serve instead of from one flat list.

An extra type: it hangs from a PBI, it holds Tasks, and it is never re-typed by where it
sits. Those three are the `EXTRA_TYPES` contract as declared, which is why this costs a list
entry and a hue rather than a fifth rung — see [[Storymaps]] for what the rung would have
cost instead.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing `New step` under a use case |
| **Preconditions** | A use case exists |
| **Guarantee** | A step is created under its use case, ranked among that use case's other steps, and offered `Task` as its child type. Its type is never changed by a later move. |

**Main flow**

1. The user picks `New step` from a use case's child-type menu.
2. The plugin creates the note with `parent` set to the use case and an `order` after its
   last step, through the existing creation path and gate.
3. The step draws indented under its use case, with its own badge.
4. `New task` under that step creates a task whose parent is the step.

**Extensions**

- **1a — the menu offers `New step` under an Epic or a Feature too.** It does, because extra
  types travel as one set repeated at every rung. Accepted and documented rather than fixed;
  a step created there ranks and holds tasks like any other extra type.
- **1b — the use case has no steps yet.** The first step is created at the start of an empty
  sibling set, and the use case's existing tasks are left exactly where they are.
- **2a — the configuration gate refuses.** Nothing is created and the reason is shown.
- **3a — the step is dragged under a different use case.** It stays a step and re-ranks among
  its new siblings. Nothing re-types it.
- **4a — a task is dragged from a step back onto the use case.** Allowed: a `Task` may hang
  from a PBI directly, exactly as it does today.

## Acceptance criteria

- `Step` is in `EXTRA_TYPES` and `LEVELS` is unchanged, asserted by a test that fails if a
  later edit inserts a rung.
- A typeless child of a PBI still reads as a `Task`, not as a `Step` — the behaviour that a
  rung would have changed, pinned by a test.
- A step ranks at `EXTRA_TYPE_RANK` and still renders one level deeper than its use case;
  both are asserted, because reading the rung to decide the indent passes a one-step fixture.
- A step's children list is `Task`, and its legal parents are the same set every other extra
  type has, checked both ways against the hierarchy table.
- Every existing task parented directly to a use case keeps drawing and keeps its parent. No
  migration runs.

## Where it lives

The name joins `EXTRA_TYPES` in `src/domain/typeVocabulary.ts`. `src/domain/itemTypes.ts` owns
what that means — `EXTRA_TYPE_RANK`, `isExtraType` and `childTypeChoices` — and
`src/domain/model.ts` is where an extra type's rank is pinned while its depth still follows its
parent, the one distinction a fifth rung would have collapsed. The badge is
`src/view/render/badges.ts` with `styles/badges.css`, the creation folder is
`src/domain/settings.ts`, and the hierarchy table in `docs/README.md` gains its row under the
same two-way check.
