---
type: Issue
order: 50
parent: "[[Dependencies]]"
status: Open
priority: P3
area: accessibility
created: 2026-08-09
source: found while building [[Draw a dependency between bars]]
files:
  - src/view/interactions/dependencies.ts
  - src/view/interactions/cardDrag.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A dependency write is announced to nobody

Every card move announces into the drag library's live region — a board move, a horizon
move, a schedule move, whether the input was a drag, a key or a menu pick. A dependency
write announces nothing, and never has: `Linking two items` shipped the menu path silent,
and `Draw a dependency between bars` kept parity deliberately rather than giving one
input a voice the other lacks.

So nothing regressed, and the drag's acceptance criterion — the same batch, refusals,
announcement and undo as the menu path — is met. What is true anyway is that a
screen-reader user gets no confirmation from either path that an ordering was recorded,
on the one write where the RESULT is a line drawn between two rows they cannot see.

**Why it was not fixed in that increment.** The fix belongs in `applyDependencyWrite`,
which both inputs share — so it changes shipped menu behaviour, which is a change to
`Linking two items` and not a gap in the drag. Doing it there quietly, inside a PBI about
a gesture, is how one note comes to own a decision another note is specified by.

**What it would take.** A sentence naming both notes and what changed — the vocabulary
question is which end to name first, since the write lands on the DEPENDENT and the drag
runs from the prerequisite, and `announceHorizonMove` already shows how two functions were
needed to keep "where it was" and "where it was sent" from collapsing into one wrong
answer. The undo path needs its own words or it says nothing when the link comes back off.
