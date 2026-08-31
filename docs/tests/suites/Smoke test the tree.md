---
type: Test suite
order: 31
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

# Smoke test the tree

The tree projection is the plugin's default view, and the one everyone opens first —
badges, columns, drag, keyboard and the menu, checked once against a real vault rather
than jsdom's classes.

**Outcome** — **Run by the maintainer on 2026-08-02** in an `npm run test-build` vault
ahead of the `0.4.0` release: nothing on the list needed adjusting. That is a run of the
whole list and not a per-case record — each `Test case` below still asks for its own
points written down as pass or fail, and each stays open until they are, so a stale check
is visible rather than assumed.

**Three cases added on 2026-08-31 are outside that run and have never been checked**, and
they are the largest gap this suite has: the global rank
([ADR 0033](../../adrs/0033-order-is-a-global-rank.md)) shipped with its commands, its
dialogs, its notices and its cross-parent drag driven in jsdom alone, and every pull
request in the epic said so rather than letting a green build stand in for eyes.

## Use cases

- [[Tree badges and icons]] — all seven types, including the new milestone diamond badge.
- [[Tree columns and narrowing]] — the header lining up with row cells, and `pbl-hide-*`
  dropping columns in order as the pane narrows.
- [[Tree drag between siblings and into a parent]] — the two drop
  shapes a drag can land in, and the background that takes none.
- [[Tree keyboard moves]] — Alt+arrow move, indent and outdent.
- [[Tree context menu]] — Set type, Set state and Edit tags.
- [[Show completed items in the tree]] — the toggle hiding a done subtree, and putting it
  back where it was.
- [[Tree undo]] — undo taking a whole batch back.
- [[Seeding and respacing a vault's ranks]] — the two palette commands, both
  confirmation dialogs, and Respace's second paragraph, which no test has ever rendered.
  **Run this first**: this register is an unmigrated vault, and the two cases below are
  invisible until it is seeded.
- [[Ranking a focused backlog by hand]] — the feature the global rank exists for: a
  cross-parent drag at a focus level, one note written, and the three inputs agreeing.
- [[A refused rank names its remedy]] — the four refusal notices as real toasts, each
  checked by following the advice it gives.
- [[Parent links Obsidian parsed, and ones it did not]] — which of `resolveParent`'s two
  paths a real cache actually takes, and whether the hand-rolled bracket stripper behind
  the second one is reachable at all. **Never checked**, and it decides whether that code
  is deleted or kept.
