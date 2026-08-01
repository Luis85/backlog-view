---
type: PBI
parent: "[[Finding work]]"
order: 30
status: Done
---

# Filtered bases keep their tree

**As** someone who filters a Base down to *my* items or *this sprint*, **I want** the
results still to render as a tree, **so that** narrowing the question does not cost me the
structure that makes the answer mean anything.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner with a filtered Base |
| **Trigger** | The Base returns results whose parents it filtered out |
| **Preconditions** | The missing ancestors exist as notes in the vault |
| **Guarantee** | **The view never writes to a note the Base excluded.** It renders and it parents; that is all it does. |

**Main flow**

1. The Base returns matches — say every note tagged `sprint-12` — without their parents.
2. Rather than flattening, the view walks each match's parent chain and loads the missing
   ancestors **from the vault**.
3. Those load as **context rows**, marked `outsideFilter`.
4. The tree renders with its real shape: results in their places, context rows holding
   them there.

**Extensions**

- **4a — a context row's children all hide** (finished, or filtered away). The context row
  hides too. It exists only to place a visible result and must not leave an empty scaffold.
- **4b — anything would write to a context row.** The **whole batch** is refused, loudly.
  Not the offending write alone: dropping one write and applying the rest would leave the
  hierarchy half-updated, which is worse than refusing.
- **4c — the user looks for a control that would produce such a write.** It is not there.
  The state chip renders as static text, and Set type, Set state and the parent-link
  actions are absent from the menu. `New <child>` stays — it writes a *different* note.
- **4d — undo replays a batch across the filter boundary.** Allowed, deliberately: an undo
  batch can only name files its forward batch wrote **while they were results**, and the
  write being undone may itself be what moved one out of the filter. Authorization came at
  capture time ([[Undo and redo]]).

**Guarantees** — a context row is never any of these:

| | |
| --- | --- |
| A write target | Refused structurally, not by remembering |
| A ranking peer | Never renumbered — though its `order` is **read**, so nothing lands above something visible |
| Counted in a rollup | Traversed *through*, never counted |
| A source of vocabulary | Not in the states, the tags, the level breakdown or the creation folder |

## Acceptance criteria

- A context row renders and parents, and does nothing else: never written to, never ranked,
  never counted, never a source of the base's vocabulary.
- The view refuses a whole write batch that would touch one, rather than dropping the
  offending write and half-applying the rest.
- Controls that would produce such a write are withheld from the UI.
- Every write entry point is driven against a fixture with context rows above, beside and
  between results, so a new write path fails without anyone predicting the surface.

## Where it lives

`src/domain/model.ts` (loading ancestors, the `outsideFilter` flag) ·
`src/view/backlogView.ts` (`applySafely`'s refusal) · and every interaction module, which
is the point.
Tests: **`test/view/contextRowWrites.test.ts`** is the stress suite;
`test/view/contextRows.test.ts`, `test/domain/modelContextRows.test.ts`,
`test/domain/writePlanContextRows.test.ts`.
