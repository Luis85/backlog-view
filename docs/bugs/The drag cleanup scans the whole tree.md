---
type: Bug
parent: "[[The render path states its costs as checks]]"
order: 20
status: Open
area: performance
priority: P2
created: 2026-08-03
source: Codex review on PR #61, verified against the source
files:
  - src/view/interactions/dragDrop.ts
  - src/view/CLAUDE.md
---

# The drag cleanup scans the whole tree

## What happened

`src/view/CLAUDE.md` states, as one of the four things that keep rendering cheap: *"the
view keeps a path → row element index (`rowEls`) plus the selected row, so **no
interaction scans the DOM**."*

One does. `DragDropController.clearDragState` ends with

```ts
this.els.treeEl.querySelectorAll('.pbl-drag-source').forEach((el) => el.classList.remove('pbl-drag-source'));
```

a full-tree query, run on every `dragend`. There are **two** registrations that reach it,
which is worth stating precisely because a search of `interactions/` alone finds only one:
`dragDrop.ts` wires `dragend` on each rendered row inside `wireRow`, and `backlogView.ts`
additionally wires it on **`document`** via `registerDomEvent`. So the scan runs after a
tree-row drag — twice, since the row listener and the document listener both fire — and it
also runs on a `dragend` that never involved the tree at all. On a several-hundred-row
backlog each of those is a walk of every row to clear a class from exactly one.

The mechanism is that the controller already tracks its *other* transient element by
reference — `activeDropRow` is held, cleared explicitly, and nulled in `onRenderStart`
because a render detaches it — and the drag source was left to be found again instead of
held the same way. Nothing about the source made that necessary; it is the one piece of
drag state that was not given a field.

A sweep of `src/` finds no other violation: `render/rows.ts:75` searches within one row,
and `render/toolbar.ts:129,150` search the toolbar, both bounded and both fine.

Found by review of the plan that proposed *testing* the invariant, not by anything the
plugin did — which is the point. Nothing measures this, nobody reported it, and the guide
has been asserting the opposite since the index was introduced.

## Fix

Hold the drag source the way `activeDropRow` is already held: a field set when the drag
starts, cleared in `clearDragState`, nulled in `onRenderStart`. A mid-drag rebuild detaches
the stale element and makes it irrelevant, which is the same reasoning that already
justifies doing this for `activeDropRow` — so the fix adds no new argument, only a second
use of one the file already makes.

The test that fails without it is the spy in [[Cost claims are spies, not comments]],
driving drag cleanup rather than only selection. **Fix this first**: written the other way
round the spy fails on `main`, which reads as a broken test rather than a found defect.

## Lesson

**An invariant that names a whole category — "no interaction does X" — needs a check that
sweeps the category, not one that visits the examples the author had in mind.** The claim
here was written when `rowEls` was introduced and was true of selection and subtree
refresh, the two paths that motivated the index. The drag was a third path nobody
re-asked the question of, and prose cannot notice a third path arriving.

That generalises past this file: the review that found this had first proposed a test
driving selection and subtree refresh only — the same two paths, tested at the same
blind spot. A category invariant is checked by spying the forbidden **call**, which every
path must go through, rather than by enumerating the paths, which is the list that goes
stale.
