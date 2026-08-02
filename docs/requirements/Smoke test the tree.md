---
type: Feature
parent: "[[Feature Test]]"
order: 10
status: Open
created: 2026-08-02
source: user request
---

# Smoke test the tree

The tree projection is the plugin's default view, and the one everyone opens first —
badges, columns, drag, keyboard and the menu, checked once against a real vault rather
than jsdom's classes.

**Outcome** — **Run by the maintainer on 2026-08-02** in an `npm run test-build` vault
ahead of the `0.4.0` release: nothing on the list needed adjusting. That is a run of the
whole list and not a per-case record — each `Issue` below still asks for its own points
written down as pass or fail, and each stays open until they are, so a stale check is
visible rather than assumed.

## Use cases

- [[Tree badges and icons]] — all seven types, including the new milestone diamond badge.
- [[Tree columns and narrowing]] — the header lining up with row cells, and `pbl-hide-*`
  dropping columns in order as the pane narrows.
- [[Tree drag between siblings, into a parent and onto the root strip]] — the three drop
  shapes a drag can land in.
- [[Tree keyboard moves]] — Alt+arrow move, indent and outdent.
- [[Tree context menu]] — Set type, Set state and Edit tags.
- [[Tree quick filter and Show completed items]] — the filter highlighting matches, and
  Show completed items hiding a done subtree.
- [[Tree undo]] — undo taking a whole batch back.
