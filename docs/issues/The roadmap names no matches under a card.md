---
type: Issue
order: 60
parent: "[[Children on the card]]"
status: Open
priority: P3
area: usability
created: 2026-08-15
source: Found while narrowing [[Drop the per-child entries from the card menu]] after review (Codex, PR #137)
files:
  - src/view/render/board.ts
  - src/view/interactions/menu.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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

## What would close it

A decision on the surface, then `cardedPaths`-style plumbing that is already written:
`addMatchSection`'s `carded` could come from `cardedPaths` rather than from the board
alone, which is the whole of the menu half.
