---
type: Task
order: 140
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P3
area: tooling
created: 2026-08-08
source: PR #79 whole-branch review
files:
  - eslint.config.mjs
  - src/view/render/toolbar.ts
  - test/view/deliverableWorkflowByType.test.ts
---

# Follow-ups from enforcing the Deliverables invariants

## Evidence

Three rules the Deliverables board's review found broken a surface at a time are now
checked at the call (`ALL_TYPES_IMPORT`, `CHILD_TYPE_CHOICES_NULL`,
`DELIVERABLE_FIELD_READ` in `eslint.config.mjs`, and a watched test for
`countedPopulation`). The whole-branch review that accepted them named four places the
checks stop short of the rule they enforce. None is a defect on any path the code walks
today; each is a spelling a next surface could reach with lint green — which is the exact
failure mode the three rules exist to close, so leaving them unwritten would be the same
mistake one level up.

They are recorded together because they are small and share one cause: a
`no-restricted-syntax` selector sees a spelling, not a category.

## What is owed

**The raw child-type list.** `childTypeChoices(item)` returns the rung below plus
`EXTRA_TYPES`, and `Deliverable` is one of those — the route the requirements board's
type button took to offering Deliverables. All three view call sites now hand the result
to `offerableTypes`, but nothing checks that a fourth would. `CHILD_TYPE_CHOICES_NULL`
sees only the `null` argument; a selector for "the call's result reaches something other
than `offerableTypes`" is not expressible in `no-restricted-syntax`, so this needs
either a call-site spy in the view tests or a narrower API (`childTypeChoices` taking the
host, or the view calling one function that composes both).

**The naive state read.** `DELIVERABLE_FIELD_READ` bans the dotted
`item.deliverableStateValue` / `item.deliverableDone`. The original defect's form was the
opposite — `item.stateValue` / `item.done` on a Deliverable — and that spelling stays
legitimate in `view/` by decision, so no selector can separate the two. `ownWorkflowReading`
is the answer; nothing enforces reaching for it.

~~**`countedPopulation` is module-private** to `src/view/render/toolbar.ts`. A readout
added in any other view file is structurally forced to duplicate it. Either export it or
keep readouts in that one file deliberately, and say which.~~ **Answered by the toolbar
split (2026-08-10), and by the first of the two options**: the readouts are now their own
subject in `src/view/render/toolbarStatus.ts`, and `countedPopulation` is exported from
it. Not chosen for this reason — the split was about churn — but it settles the question
the same way, so the choice is on record rather than left open.

**Split `test/view/deliverableWorkflowByType.test.ts`.** 572 raw lines, ~378 against the
450 budget that skips blanks and comments, holding 15 `describe` blocks across six
subjects under a header naming one. It passes the budget and fails the reason
`CLAUDE.md` gives for it — "split by subject before a file becomes the place tests hide".
The condition predates the branch that surfaced it (544 lines before), which is why the
split was not forced inside a lint increment.

## Not owed

Three findings from the same review were ruled no-fix, so they are not re-raised:
`DELIVERABLE_FIELD_READ`'s comment says "read" while the selector also matches a write
(the safe direction — nothing in `view/` writes those fields); the new toolbar test's
tooltip half was not separately watched failing (the count assertion fails first and
shadows it, and the reviewer reproduced the tooltip failure independently against a
reverted copy); and `doneDeliverable()`'s name promises a done-ness that test does not
exercise (the sibling test that does drive it shares the fixture).
