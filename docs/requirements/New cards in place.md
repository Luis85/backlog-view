---
type: PBI
parent: "[[Hierarchy on the board]]"
order: 30
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/interactions/create.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# New cards in place

**As** someone who has just noticed a missing piece of work while looking at a column,
**I want** to create it right there, already in that state, **so that** capturing it
costs one gesture instead of a note, a parent, a type and a status.

Every surveyed board creates in place — GitHub Projects pre-fills the column's field,
Linear creates in the column's status — and two prior Obsidian boards taught the
failure mode from the other side: a new card that lands in the wrong folder, or outside
the base's filter, is a note the board writes and then cannot show.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing to create from a column, by pointer, menu or Enter on a selected column |
| **Preconditions** | Board mode is on and the config-problems gate is clear |
| **Guarantee** | Creation writes the new note and nothing else — never a sibling. If the result is not visible on the next render, the view says so rather than letting it vanish. |

**Main flow**

1. The user creates from a column.
2. The existing gated creation flow runs with the column's state preset, so everything
   that governs creation today still governs it: type folders, folder mode, the
   config-problems gate.
3. The note is written in one call, with its hierarchy properties and its state.
4. The next render places its card in that column.

**Extensions**

- **1a — the column is the no-state column.** Creation writes no state at all, rather than
  writing an empty one. Absence is a value here.
- **4a — the next render does not show it.** Folder rules cannot rescue a note from a
  *state* filter: a base can exclude a state the workflow still names —
  `status != Done` beside a Done column — and a filter is opaque to the view, so
  compatibility is detected by outcome rather than predicted. The view says so and offers
  to open the note.
- **4b — the card was born done and hiding finished work swallowed it.** Same answer, for a
  different reason: the outcome that matters is *visibility*, not result membership alone.
  Both cases end with the note existing, correct, and reachable — never silently gone.

## Acceptance criteria

- Each column offers creation. The new note goes through the existing gated flow with
  the column's state preset, so everything that governs creation today still governs
  it: type folders, folder mode, the config-problems gate.
- Folder rules cannot rescue a note from a *state* filter: a base can exclude a state
  the workflow still names — `status != Done` beside a Done column — and a filter is
  opaque to the view, so compatibility is detected by outcome, not predicted. The
  outcome that matters is visibility, not result membership alone: when the next
  render does not show the note just created — the filter excluded it, or hiding
  finished work swallowed a card born done — the view says so and offers to open it,
  rather than letting it silently vanish.
- The no-state column creates without writing a state at all.
- Creation writes the new note only — never a sibling.

## Where it lives

**Nothing yet — this note is design.** The gated flow, the folder inference and the
context-parent exception are already `src/view/interactions/create.ts`; what the board
adds is a preset state and creation from a column.

The **visibility check** this note specifies — 4a and 4b, "created but not shown" turned
from a silent outcome into a reported one — is the part to write the extensions for
before writing it. It was built once, for moves, by [[Moving between horizons]]'s
extension 3b, and taken back out after eleven review findings across seven rounds: every
rule it needs was discovered by a reviewer after the code existed, and the last of them
could not be settled without a design decision this note is the place to make. The
account, the rules found so far and the open question are
[[The outcome report was built from one sentence]]. Whoever builds it should read that
first and add the extensions here — which pass answers, what two overlapping writes
mean, what a second write to the same note does, and which of the two ways out of the
view a message names.
