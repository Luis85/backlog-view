---
type: Test suite
order: 32
status: Open
created: 2026-08-02
source: user request
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

# Smoke test the board

The board projection over the same backlog: columns, cards, and state writes gated the
same way the tree's are, checked once against a real vault.

**Outcome** — **Run by the maintainer on 2026-08-02** in an `npm run test-build` vault
ahead of the `0.4.0` release: nothing on the list needed adjusting. That is a run of the
whole list and not a per-case record — each `Test case` below still asks for its own
points written down as pass or fail, and each stays open until they are, so a stale check
is visible rather than assumed. [[Smoke test the board in a live vault]] joined this suite
in the 2026-08-11 test catalog migration and was not part of that run.

## Use cases

- [[Board columns read as a workflow]] — a column per configured state plus the
  no-state column, and a header count legible beside the longest title.
- [[Board card carrying hidden matches]] — **dropped** with the quick filter on
  2026-08-17, kept as the check that would come back with the affordance.
- [[Board card moves]] — dragging a card between columns, Alt+Left/Right, and the card
  menu's Set state offering the rendered columns.
- [[Smoke test the board in a live vault]] — the mode toggle, drag, touch, keyboard and
  screen reader, collapse persistence, themes and render scale, all against a real vault.
