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

**The first landmine is the obvious move.** `EXTRA_TYPES` looks like where a seventh
declared name belongs, and it is not: that list means *pinned at `EXTRA_TYPE_RANK`,
children are Tasks, hangs from Epic, Feature or PBI* ([[Types beside the ladder]] states
it and ships it), and a milestone is the opposite on all three counts. Putting the name
there would not extend the contract but falsify it, and `isExtraType` would silently mean
two different things at four call sites — `computeLevel` and `collectFocusRoots` in
`src/domain/model.ts`, and `computeTypeChanges` twice in `src/domain/writePlan.ts`.

The vocabulary takes a **third category** instead — a declared marker, no rung, no
children, no parent — with `ALL_TYPES` as the union, which is what earns the name its
folder, its focusability and its admission to the hierarchy without any of those rules
learning a special case. Exactly one predicate then changes, by *widening*: the cascade's
retype exemption belongs to every **declared** type rather than to extra types alone.
Getting this backwards is what the rest of this list is downstream of.

**The quiet ones.** Each does something plausible and wrong, and no test fails:

| Where | What it does to a milestone |
| --- | --- |
| `deriveBars` (`src/domain/roadmap.ts`) | Shelves it as a reversed span when a stale start sits after the target — before any rendering seam runs |
| `scheduleFields`, `validateSchedule` (`src/view/interactions/plan.ts`) | Offers both ends and applies the span rule, so the entry can refuse a milestone the timeline draws, and can accept a start that leaves it shelved |
| `carriesDates`, `unschedule` (same file) | Gates on either key and removes both, so Unschedule appears on a milestone with no milestone date, and deletes a start the feature only promised to ignore |
| `renderRowTrailing` (`src/view/render/rows.ts`) | Renders an add button labelled from the first of no choices |
| `test/docs/surfaces.test.ts` | Asserts the generated `typeFolder.<type>` keys for a hand-written list of six names, so a seventh is simply uncovered |

The middle two are one trap wearing two coats, and worth naming as a rule rather than a
pair: **a placement action must answer for the type it is acting on, on both the offering
side and the writing side.** Narrowing the prompt and leaving Unschedule alone was the
first version of this specification's own mistake.

**The loud one is a gift.** `EXTRA_TYPE_STYLE` in `src/view/render/rows.ts` deliberately
has no fallback for a declared type, and a test asserts the table covers the vocabulary —
so the badge is the one seam that refuses to be forgotten. That is what the others would
look like if the same discipline reached them, which is the argument for adding a
vocabulary-driven test rather than another remembered list.

**Records and sibling specs to settle in the same change**, none of which is wrong today:
[ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md) is titled for six names
and lists the extra types by hand; the register's own checker (`docs-check.mjs`) holds a
legal-parent table of six types, so the register cannot file a milestone of its own until
it knows the name; and `docs/README.md`'s hierarchy table has no row for a type whose
parent is nothing and whose children are nothing. [[Type names are data]],
[[What counts as a work item]] and [[Types beside the ladder]] each pinned the count and no
longer do, and [[Rollups and hiding finished work]] now names the marker as the second
exception to "a rollup counts every descendant the Base returned" — unpinning was
the fix, because a requirement that states a number goes stale in silence while one that
reads the vocabulary fails out loud.
