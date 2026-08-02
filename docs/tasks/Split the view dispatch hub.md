---
type: Task
order: 40
parent: "[[One file per concern]]"
status: Open
priority: P2
area: refactor
created: 2026-08-02
source: fix wave over the per-column agreements increment
files:
  - src/view/backlogView.ts
---

# Split the view dispatch hub

## Evidence

`src/view/backlogView.ts` measures **400 effective lines** (`skipBlankLines`,
`skipComments` — the same counting `max-lines` uses), against the lint cap this
repository holds every `src/` file to. Zero headroom: the next line added to this file
fails `npm run lint` before it fails anything else.

The per-column agreements increment felt that directly. Reaching a column's context
menu from the keyboard needed `showColumnMenuFor` to report whether it actually opened
one, which needed the `showAtPosition` call it shares with `showContextMenuFor` pulled
out into its own method (`showMenuBelow`) rather than duplicated. That refactor is
correct on its own merits — one anchoring decision instead of two copies of it — but it
was made *to buy the line back*, not because the shape asked for it. The reviewer's
judgement, which this task exists to act on: that is not a sustainable way to make
design decisions about the file every projection increment touches.

A second fix in the same review wave — making `showColumnMenuFor` report whether it
opened anything, so the keyboard path stops swallowing a `ContextMenu` key on a column
with nothing agreed — needed one more line here and could not be made at all: there was
nowhere to put it without either shrinking something else under the same pressure or
leaving the dead end unfixed. It was skipped for exactly that reason, which is the
second and sharper piece of evidence that the cap is no longer slack this file can
absorb.

## Why it matters

`backlogView.ts` is named in this repository's own architecture table as "the
`BasesView` subclass: state, lifecycle, projection dispatch, write gate" — the one file
every interaction module (`keyboard.ts`, `menu.ts`, `cardDrag.ts`, `dragDrop.ts`,
`structure.ts`, `plan.ts`, `create.ts`, `tags.ts`, `undo.ts`) ultimately calls into
through `BacklogViewHost`, and the one file every render module's output flows back
through. A hub with no room left does not stay still — it forces the next change to
choose between two bad options: shrink something nearby under time pressure (what
happened this increment) or leave a real fix undone (what also happened this
increment). Neither is a decision anyone should be making file-size-first.

## Approach

Not prescribed here — the point of filing this as its own task rather than doing it
inside the fix wave that found it is that a cut made under pressure is exactly what
this task exists to stop repeating.

What the evidence does point at: the **menu trio** — `showContextMenuFor`,
`showColumnMenuFor` and `showMenuBelow` — reads as one cohesive block already (a
private anchoring helper behind two public openers), and a module boundary drawn
around opening menus is a plausible seam. That is a starting observation for whoever
picks this up, not a commitment to cut there: `One file per concern`'s own rule is that
a file at its cap is split along a **real seam**, never at a line number, and the menu
trio is one candidate seam among however many the file actually has. Read the file
fresh before choosing — the write gate (`runExclusively`, `applySafely`, `undoLast`),
the render orchestration (`render`, `renderTreeContent`), and the card-move plumbing
(`applyCardMove`, `performBoardMove`, `performHorizonMove`) are each large enough to be
their own candidate, and whichever cut is made has to leave `BacklogViewHost` still
answerable by one class, per the write-gate and lifecycle rules in
[`src/view/CLAUDE.md`](../../src/view/CLAUDE.md).

## Acceptance criteria

- `src/view/backlogView.ts` has real headroom under the 400-line cap once this lands —
  enough that the next projection increment does not immediately meet this task again.
- The split follows a named seam a reader can point to, not a line-count cut.
- `BacklogViewHost` still resolves to one implementation; modules that reach view state
  still go through it, and `host.ts` stays free of runtime code.
- `npm run check` green, with no test rewritten to match the new shape rather than to
  keep asserting the same behaviour.

## Risks

The write gate (`runExclusively`, `applySafely`, `undoLast`) is the most
consequence-bearing code in this file — the compare-and-swap undo bookkeeping and the
context-row refusal both live in its `try`/`finally`. A split that moves it without
moving its invariants intact (documented in the root `CLAUDE.md`'s "The write path")
would be a correctness risk disguised as a line-count fix. Whatever seam is chosen,
prove the gate's behaviour is unchanged with the existing test suite before trusting a
smaller file to mean a safer one.
