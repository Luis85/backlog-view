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
- Every placeholder readable as prose rather than as a fragment. **The ten cannot all be on
  screen at once**, so this part is staged rather than read in one pass:
  1. On a **fresh** `product-backlog` view, seven of the ten show — a placeholder is visible
     only while its input is empty, and the register's own `Backlog` view fills four of them
     (`stateValues`, `deliverableStateValues`, `resourceNames`, `homeFolder`), so a fresh
     view is the shorter route than clearing those four.
  2. **Home folder is the eighth and a fresh view does not give it either**: the option
     declares `default: DEFAULT_HOME_FOLDER`, which is `docs`, so its input shows `docs`
     rather than its hint even where nothing has been stored. Clear that one input to read
     it.
  3. The **WIP limit** and **column policy** hints are the last two, and they cannot appear
     yet: those inputs are generated one per configured state
     (`settings.states.flatMap` in `src/domain/viewOptions.ts`), so with no workflow there
     are none. Configure at least one **non-done** state — a done state gets a policy input
     but no WIP input — and read the two boxes that appear, which arrive empty and so show
     their hints.
- The **`Open the note in`** dropdown offers its three choices — active pane, new tab,
  split. Those were English literals in `src/domain/itemHandling.ts` until 2026-08-22 and
  are keyed now, so they are the newest text on this surface and the likeliest to be wrong.
- Narrow the Obsidian window until the panel is at its own minimum, and read it again.

## Acceptance criteria

- The whole panel read at a normal width and at its minimum.
- The three dropdown choices seen rendered rather than assumed from the catalog.
- Nothing yet checked.
