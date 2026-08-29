---
type: Issue
order: 60
parent: "[[Children on the card]]"
status: Done
priority: P3
area: usability
created: 2026-08-15
closed: 2026-08-15
source: Found while narrowing [[Drop the per-child entries from the card menu]] after review (Codex, PR
files:
  - src/view/render/board.ts
  - src/view/childrenList.ts
  - src/view/interactions/menu.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The roadmap names no matches under a card

## Evidence

`renderCardMatches` (`src/view/render/board.ts`) is called from the board's own column
card and from nowhere else, and `addMatchSection` (`src/view/interactions/menu.ts`)
returns as soon as `activeBoard(host)` is null — which it is on every roadmap. So a card
on the roadmap names no matches on its face and offers none in its menu, on either axis.

Measured in the jsdom harness on 2026-08-15: a horizon roadmap focused on Feature, with
the quick filter naming a grandchild, drew `match links: 0`.

## Why it is usually invisible, and where it is not

Unfocused, `roadmapRows` is `model.results` — so every visible result becomes a bucket
card, a bar or a shelf card, and `hiddenMatches` has nothing left to find. The gap opens
only under a **focus**, where the cards are the focus level's alone:

- a **direct** child that matches is now offered as `Open child "…"`
  ([[Drop the per-child entries from the card menu]]), so it is reachable;
- a **deeper** match — a grandchild — is named nowhere and reachable by nothing, pointer
  or keyboard. On the board it would be an `Open match "…"` entry and a link on the card
  face.

This is older than the task that found it: the roadmap has never drawn match links.

## What makes it more than a missing call

The board's face links and its menu entries are one feature with two surfaces and one
dedup rule (`undisclosedMatches`, for both). Adding only the MENU half to the
roadmap would make the menu the sole place a match is named, which is a different feature
and a different rule — the menu is currently specified as the keyboard path to something
the face shows. Adding both means deciding where a roadmap card puts a match list: a
bucket card has the room, a timeline row is a bar in a grid and does not.

So this is a design question, not a one-line fix, which is why it is filed rather than
folded into the task that surfaced it.

## Answered by main, hours after it was filed

`da15f5b` and the increment around it, merged 2026-08-15. It answered the design question
this note said had to come first — a bucket card and a shelf card name their matches like
a board card, and a timeline ROW, which has no room for a list, draws a COUNT instead and
puts the titles in its menu.

Both halves landed together, which is what this note asked for. `matchesFor` in
`childrenList.ts` is the plumbing it predicted, and arrived at the same shape from the
other side: it asks whichever projection drew the row — `cardPaths` on the board, the
`placed` register the render fills on the roadmap, because `RoadmapModel` is not what the
roadmap draws.

Kept rather than deleted, for the reason `docs/README.md` gives: what it records is that
the gap was real and older than the change that surfaced it, and that both surfaces had
to move together. The one thing it got wrong is worth keeping too — it called the
timeline row's lack of room a blocker, and the answer was a count rather than nothing.
