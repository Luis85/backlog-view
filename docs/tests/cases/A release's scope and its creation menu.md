---
type: Test case
order: 30
parent: "[[Smoke test the release view]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review; the scope tree and its context menu, neither opened in Obsidian
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A release's scope and its creation menu

A verification to run.

## Why this exists

The scope tree is a second tree, drawn by different code from the backlog's, with its own
toolbar, its own keyboard walk and — since this release — its own context menu that
**creates notes**. jsdom drives every one of those and lays out none of them.

**Preconditions** — as [[Release view registration and options]], with a release that holds
members at more than one level, at least one of them finished, and at least one member whose
parent the base filter excludes, so a context ancestor is drawn.

## How to check

- **Context ancestors read as scaffolding**: dimmed, with the corner marker, and a tooltip
  saying the row is in the base but not in this release. They are not write targets — check
  that the menu on one offers no `Set` action.
- With a screen reader, the tree is announced **as a tree** — levels and sibling positions —
  rather than as a flat list.
- The **back control** is reachable and returns to the index.
- **Title text can be selected and copied**, and a drag across a title does not open the
  note. Read-only rows must show no pointer cursor and no hover highlight.
- The toolbar's three controls work: collapse all, expand all, hide done.
- **The context menu creates into the release.** Right-click a row, pick `New <type>`, name
  it: the note hangs from that row, ranks after that row's existing children, and joins the
  open release **in the same write** — so it appears under the row it was made from rather
  than being filed and lost. Undo takes all of that back as one entry.
- The same menu opens from the **keyboard**, with the Menu key or Shift+F10, on the row the
  tree marks.
- A **test-catalog row is offered no menu at all** — every child it could hold is a catalog
  note, which a release does not hold. Confirm on a `Test suite` row if the vault has one.
- A **finished member reads as finished**: its state chip carries the done treatment.
- Delete the release, or retype it, while a `New <type>` title is being entered. The creation
  is refused rather than making a note whose membership cannot be resolved.

## Acceptance criteria

- The scope reads as a tree, creates into the open release from both inputs, and refuses the
  creation when the release moved on underneath it.

## Outcome

Not yet run.
