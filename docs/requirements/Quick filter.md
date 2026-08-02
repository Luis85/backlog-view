---
type: PBI
parent: "[[Finding work]]"
order: 10
status: Done
---

# Quick filter

**As** someone with a backlog too big to scan, **I want** to type a word and see the
matches *with their place in the tree*, **so that** I find the item and can still tell
what it belongs to — which a flat list of matches cannot say.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Typing in the toolbar's filter box, or pressing `/` in the tree |
| **Preconditions** | The tree has rows |
| **Guarantee** | The filter is **session state**: never written to the `.base` file, never to local storage, never anywhere. Clearing it returns the tree exactly as it was. |

**Main flow**

1. The user types a word into the filter box.
2. Titles are matched against it, case-insensitively.
3. Every match renders with its **ancestors** — so its place is visible — and with its
   whole subtree.
4. The matched substring is highlighted in each title.
5. The user clears the filter with the clear button or by emptying the box; collapse state
   comes back as it was.

**Extensions**

- **1a — the user tries to drag while filtering.** Rows are not draggable: visual
  neighbours under a filter are not siblings ([[Drag and drop]]).
- **1b — the collapse-all / expand-all controls.** Genuinely `disabled` while the filter
  overrides collapse state — not merely styled as such, since a focusable control disabled
  only in CSS still answers the keyboard.
- **2a — nothing matches.** A "no match" state renders, naming what was searched for and
  offering to clear it, rather than an empty pane that looks like a broken view.
- **3a — a match is inside a collapsed branch.** Collapse state is ignored while filtering:
  everything on a match path renders expanded. Nothing is *changed* — the stored state is
  untouched and returns when the filter clears.
- **3b — finished work is hidden.** Hiding is suspended while filtering, so a search can
  find completed items.

## Acceptance criteria

- Ancestors of a match render even when they do not match.
- Collapse state is ignored while filtering, and restored after.
- The filter is session state: it is never written anywhere.
- Typing re-renders the tree only, so the toolbar input keeps focus.

## Where it lives

`src/view/backlogView.ts` (`filterText`, `setFilter`, `isFiltering`) ·
`src/view/filterState.ts` (the needle, the match-path walk, and the two sets it
keeps — see [[The quick filter on the board]] for why one set cannot answer both
questions) ·
`src/view/render/toolbar.ts` (the input, `syncFilterUi`) ·
`src/view/render/rows.ts` (`renderTitleText` highlighting) ·
`src/view/render/emptyStates.ts` (the no-match state).
Tests: `test/view/filter.test.ts`, `test/view/toolbar.test.ts`.
