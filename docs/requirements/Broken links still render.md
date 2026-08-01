---
type: PBI
parent: "[[Work item hierarchy]]"
order: 60
status: Done
---

# Broken links still render

**As** someone who mistyped a parent link, or made a loop by dragging carelessly, **I
want** the tree to render anyway with the damage marked, **so that** I can see and fix the
problem — instead of losing the notes from the one view that could have shown me what went
wrong.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner with a malformed hierarchy |
| **Trigger** | Building the model, before levels and rollups |
| **Preconditions** | None. Malformed data is the normal case this handles. |
| **Guarantee** | No note is ever hidden for being badly linked, and nothing is repaired on disk without the user asking. The view marks; it does not tidy. |

**Main flow**

1. Parent links are resolved. An item whose `parent` value resolves to nothing is an
   **orphan**: it renders at top level with a marker.
2. Everything reachable from a root is walked. Anything left unreachable is in a cycle.
3. For each, the view finds the item that actually **closes the loop** — walking up from
   an unreachable item always ends there — cuts that one link, and re-roots that item as
   an orphan.
4. The tree renders in full, with the broken items visible at top level.

**Extensions**

- **1a — the orphan is dropped at top level.** The stale link is **cleared**, even when
  the position did not change. Otherwise the drop appears to do nothing: the link that
  made it an orphan is still there, and the next render puts the marker straight back.
- **1b — the backfill runs over an orphan.** Its type is never guessed. The parent it
  names cannot be read, so any implied level would be a guess about a note the view cannot
  see.
- **2a — the cycle is entirely inside context rows.** Handled identically: cycle breaking
  runs over the linked tree before anything cares which rows are results.
- **3a — the unreachable item is a healthy note hanging below the cycle.** It is not the
  one re-rooted. An item is unreachable as soon as *any* ancestor is looping, and cutting
  the item itself would strand a perfectly good parent link — which matters most in a
  filtered base, where the unreachable item is usually a match and the cycle is above it
  in context rows.

## Acceptance criteria

- An item whose parent link resolves to nothing renders at top level, marked, never hidden.
- A cycle is broken at the link that closes it, not at whichever item was found first.
- Breaking a cycle leaves every healthy parent link below it intact.
- Dropping an orphan at top level clears the stale link even when nothing else changed.
- An orphan's type is never backfilled.

## Where it lives

`src/domain/model.ts` (`breakCycles`, `cycleEntry`, the `orphan` flag) ·
`src/domain/writePlan.ts` (`clearsStaleLink`) · `src/view/render/rows.ts` (the marker).
Tests: `test/domain/model.test.ts`, `test/domain/writePlan.test.ts`,
`test/view/rendering.test.ts`.
