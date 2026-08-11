---
type: Test suite
order: 31
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
whole list and not a per-case record — each `Test case` below still asks for its own
points written down as pass or fail, and each stays open until they are, so a stale check
is visible rather than assumed.

## Use cases

- [[Tree badges and icons]] — all seven types, including the new milestone diamond badge.
- [[Tree columns and narrowing]] — the header lining up with row cells, and `pbl-hide-*`
  dropping columns in order as the pane narrows.
- [[Tree drag between siblings and into a parent]] — the two drop
  shapes a drag can land in, and the background that takes none.
- [[Tree keyboard moves]] — Alt+arrow move, indent and outdent.
- [[Tree context menu]] — Set type, Set state and Edit tags.
- [[Tree quick filter and Show completed items]] — the filter highlighting matches, and
  Show completed items hiding a done subtree.
- [[Tree undo]] — undo taking a whole batch back.
- [[Parent links Obsidian parsed, and ones it did not]] — which of `resolveParent`'s two
  paths a real cache actually takes, and whether the hand-rolled bracket stripper behind
  the second one is reachable at all. **Never checked**, and it decides whether that code
  is deleted or kept.
