---
type: Task
order: 10
parent: "[[A fixture backlog worth looking at]]"
status: Open
priority: P2
area: testing
created: 2026-08-30
source: PR review of the global-rank branch, plus a measurement on the fixture
files:
  - test/helpers/fixtures.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Seed the demo vault's ranks, so the harness demonstrates a migrated vault

## Evidence

`demoVault()` was written against the sibling-scoped `order` of ADR 0008: `order: 10`
recurs under every parent, by design, because that is what the scheme meant. ADR 0033
made `order` one rank over the whole population, so the fixture is now a **legacy vault**
— and `npm run harness` is the tool this repository reaches for when the question is what
a change looks like.

Measured on the fixture as it stands, rather than assumed. Every before-drop and
after-drop of every result row against every other row's sibling slot, plus a new last
child under every row:

| | Placed | Refused |
| --- | --- | --- |
| Drops (1934 of them) | 1539 | 395, all `tied` |
| Child creations (32) | 32 | 0 |

So **one drop in five refuses** with a notice telling the user to run *Seed ranks from the
hierarchy*, and creations all succeed. That corrects an earlier report of this finding,
which said most drops and creations refuse: they do not, and the honest number is the one
above. The rate is also a floor rather than a fixed figure — each drop that succeeds
consumes a number the peer fallback would otherwise reach for, so a session of dragging
degrades from here.

## Why it matters

The harness is where a layout, a spacing and a gesture are argued about before there is a
vault to look at (ADR 0020). A gesture that refuses one time in five in the harness and
works in a seeded vault is the harness answering a question about the FIXTURE while
reading as an answer about the change — which is the failure mode the harness exists to
avoid, wearing the opposite face.

## Approach

1. Give every note in `demoVault()` a rank that is distinct across the whole fixture,
   keeping the drawn order each sibling group has today. The two ties WITHIN a group
   (`Offline-first sync` and `Onboarding guide` both at 30 under `Onboarding`) are
   decided by `entryIndex` today and must be decided deliberately, not by whichever
   number the rewrite happens to hand out first.
2. Run the three suites separately. Any test asserting a literal `order` from this
   fixture, or a rendered sequence that ties currently decide, fails here and is the
   inventory of what the fixture's ranks are load-bearing for.
3. Keep a legacy fixture. `edgeCaseVault()` or a small dedicated one has to keep
   demonstrating the sibling-scoped state, or the peer fallback and the tree-order read
   path lose the only fixture that exercises them from the view side.

## Risks

The blast radius is unknown until step 2 runs, and it is the reason this is a Task rather
than part of the register change that found it. A fixture edited until the tests pass is
how an invariant quietly stops being tested — that happened once already on this branch,
with a re-spaced `mixedView` — so each failure is read before it is fixed.

## Acceptance criteria

- No two notes in `demoVault()` share an `order`.
- Each sibling group draws in the same order as before the change.
- A drop between any two rows in the harness places rather than refusing.
- Some fixture still holds sibling-scoped ranks, and a test still drives the peer fallback
  and the tree-order fallback through it.
