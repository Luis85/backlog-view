---
type: Test case
order: 40
parent: "[[Smoke test the message catalog]]"
status: Open
priority: P3
area: verification
cadence: release
created: 2026-08-22
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The view options menu at its own labels

A verification to run.

## Why this exists

Every group name, option name and prose placeholder in the view options now comes from the
catalog (`src/domain/viewOptions.ts`). The panel is the densest text surface the plugin
has, and it is the one where a label that is a few characters longer than its box shows
first — which is what a translation will be.

It is only **partly** answerable in English, and saying so is the point: this check can find
a label already clipped at today's lengths, and it cannot find one that will clip at a
translated length. The second half waits on a second catalog existing.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

Open the view options panel for the base and read it top to bottom.

- No option label clipped or truncated, and no group heading wrapping oddly.
- Every placeholder readable as prose rather than as a fragment.
- The **`Open the note in`** dropdown offers its three choices — active pane, new tab,
  split. Those were English literals in `src/domain/itemHandling.ts` until 2026-08-22 and
  are keyed now, so they are the newest text on this surface and the likeliest to be wrong.
- Narrow the Obsidian window until the panel is at its own minimum, and read it again.

## Acceptance criteria

- The whole panel read at a normal width and at its minimum.
- The three dropdown choices seen rendered rather than assumed from the catalog.
- Nothing yet checked.
