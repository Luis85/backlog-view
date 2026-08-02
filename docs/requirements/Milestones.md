---
type: Feature
parent: "[[Product Roadmap]]"
order: 60
status: Open
created: 2026-08-02
source: user request
---

# Milestones

A date that matters to the plan, as a note. `Milestone` joins the fixed vocabulary as the
seventh name — the first that hangs from nothing and holds nothing — files into its own
folder, states one date in the property the timeline already reads, and draws on the
roadmap as the point in time it is: a diamond on its row, and a line down the plan at its
date.

**Outcome** — A deadline is an ordinary backlog note, filed and ranked and undoable like
every other, and the roadmap draws it as a point rather than borrowing the shape of work
that has duration.

## Use cases

- [[Milestones as their own type]] — the type, its date, its folder, and what it is not.
- [[A milestone line across the plan]] — the date read across every bar, not just its own row.

## Landmines, before implementation

A seventh name in a vocabulary six things were written against is not one change, and the
review of this specification found more traps than the specification did. They are
collected here rather than in either use case because the **order** is the thing, and
order belongs to neither one of them.

**Add the name last.** `Milestone` in `EXTRA_TYPES` is what switches every `isExtraType`
branch on, and `isExtraType` answers two questions that have travelled together only
because nothing yet needed them apart: *"is this declared, and therefore never retyped by
position?"* — which a milestone wants — and *"is this pinned at `EXTRA_TYPE_RANK`, a
container whose children are Tasks?"* — which it must not have. Split that predicate
first; adding the name first buys the second answer everywhere, silently.

**The quiet ones.** Each does something plausible and wrong, and no test fails:

| Where | What it does to a milestone |
| --- | --- |
| `computeLevel`, `collectFocusRoots` (`src/domain/model.ts`) | Gives it the PBI rung — so its untyped children imply Task, and a **PBI-focused** view lists it as a root |
| `computeTypeChanges` (`src/domain/writePlan.ts`) | Descends a moved subtree from that rank, retyping a nested milestone's descendants |
| `deriveBars` (`src/domain/roadmap.ts`) | Shelves it as a reversed span when a stale start sits after the target — before any rendering seam runs |
| `renderRowTrailing` (`src/view/render/rows.ts`) | Renders an add button labelled from the first of no choices |
| `test/docs/surfaces.test.ts` | Asserts the generated `typeFolder.<type>` keys for a hand-written list of six names, so a seventh is simply uncovered |

**The loud one is a gift.** `EXTRA_TYPE_STYLE` in `src/view/render/rows.ts` deliberately
has no fallback for a declared type, and a test asserts the table covers the vocabulary —
so the badge is the one seam that refuses to be forgotten. That is what the other five
would look like if the same discipline reached them, which is the argument for adding a
vocabulary-driven test rather than another remembered list.

**Records and sibling specs to settle in the same change**, none of which is wrong today:
[ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md) is titled for six names
and lists the extra types by hand; the register's own checker (`docs-check.mjs`) holds a
legal-parent table of six types, so the register cannot file a milestone of its own until
it knows the name; and `docs/README.md`'s hierarchy table has no row for a type whose
parent is nothing and whose children are nothing. [[Type names are data]] and
[[What counts as a work item]] both pinned the count and no longer do — unpinning them was
the fix, because a requirement that states a number goes stale in silence while one that
reads the vocabulary fails out loud.
