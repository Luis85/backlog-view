---
type: PBI
parent: "[[User manual]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/render/toolbar.ts
  - src/domain/model.ts
  - src/view/render/emptyStates.ts
---

# Help for finding work

The manual section on narrowing a backlog too large to read — and, just as importantly,
on why a row you expected is not on screen.

## What the section says

Three controls narrow the tree, and each one hides differently:

- **The quick filter** (toolbar box, or <kbd>/</kbd> in the tree) keeps a match's
  ancestors and its whole subtree, ignores collapsed state while it is active, and is
  never written anywhere. Escape clears it.
- **Focus** re-roots the tree at one type: pick *Feature* and every feature becomes a
  top-level row. Extra types are on the same menu, so focusing *Bug* is a list of every
  bug. The button shows the active type with a `✕` back to everything.
- **Show completed items** (the eye) hides subtrees that are entirely done, and only
  when a state property is configured. It hides — the items are still ranked, still
  counted, still written to.

And the two things on screen that explain an absence rather than a match:

- **`N notes ignored`** — notes the Base returned that are not backlog items (no
  supported `type`, no parent). The option that brings them back is named in the tooltip.
- **A context row** (`↳`) — an ancestor the Base's filter excluded, loaded so matches keep
  their place. It renders and it parents; it is never counted, never written to, and the
  view withholds the controls that would try.

## Acceptance criteria

- Each control says what it hides *and* what it leaves intact, since all three look the
  same from the outside — rows missing — and only one of them is about the data.
- The context row is explained by its marker, so the `↳` on screen is answerable without
  leaving the view.
- The section states that the filter is session state and reaches no file, because "will
  this change my notes" is the question a first-time user actually has.
- Empty states point here: no match, all done and empty backlog are three different
  screens with three different answers.

## Evidence

- `src/view/render/toolbar.ts` — the filter box, the focus picker, the completed toggle
  and the ignored-notes advisory, with the wording each already uses.
- `src/view/render/emptyStates.ts` — the screens this section has to agree with.
- [[Quick filter]], [[Focus level]], [[Filtered bases keep their tree]],
  [[Rollups and hiding finished work]] — the built behaviour.
- `README.md`, sections *Focus on one type*, *Filtered bases keep their tree* and
  *View options*.
