---
type: Test case
order: 140
parent: "[[Smoke test the tree]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-31
source: the global-rank epic — five notices whose whole job is to be read, never seen as toasts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A refused rank names its remedy

A verification to run.

## Why this exists

The global rank refuses rather than making room, and every refusal names the one command
that fixes it. That design only pays off if the sentence is READ — and a notice is the
one surface jsdom cannot judge, because `Notice` there is a captured string with no
width, no duration and nothing else on screen competing with it. Several of these run to
two lines at Obsidian's notice width, and one of them lists note titles.

The refusals are also the place a wrong remedy does real harm: sending someone to a
command that cannot help is worse than saying nothing, and two of the sentences below
were corrected during review for exactly that.

**Preconditions** — the plugin is installed by `npm run test-build` and this repository
is open as a vault with `docs/Product Backlog.base` showing the tree. Each check below
needs frontmatter edited by hand to contrive its case; **commit first**, and revert
between checks so one contrivance does not produce another's refusal.

## How to check

Give two adjacent items in one focused list the **same** `order`, then drag a third
between them:

- Nothing is written, and the notice names **Seed ranks from the hierarchy**. This is the
  unmigrated-vault case, so it is the one most likely to be met for real.

Give two adjacent items orders a whisker apart — `1000` and `1000.000001` — and drag a
third between them:

- Nothing is written, and the notice names **Respace ranks**. Run that command and repeat
  the drag: it now succeeds, which is what makes the advice worth printing.

Clear one item's `order` entirely and drag another beside it:

- Nothing is written, and the notice points at the toolbar's ✨ set-up button — *not* at
  either palette command, neither of which fills a blank rank the way the backfill does.

Break the view options — set two properties to the same key — and run **Respace ranks**:

- The notice names the **configuration**, not a ranking remedy. Every rank write is
  blocked while the options collide, so any other advice would send you in a circle.

Finally, check a refusal costs nothing: after any of the above, press the toolbar's undo
arrow. It should take back whatever change came *before* the refused drag — a refusal must
not have spent the undo slot.

## Acceptance criteria

- All four notices seen as real toasts, each legible at Obsidian's notice width.
- The Respace advice verified by following it and retrying the drag.
- No refusal consumed the undo slot.
