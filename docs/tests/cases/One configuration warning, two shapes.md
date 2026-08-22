---
type: Test case
order: 30
parent: "[[Smoke test the message catalog]]"
status: Open
priority: P2
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

# One configuration warning, two shapes

A verification to run.

## Why this exists

Every surface that refuses a bad configuration now states it over one fragment
(`settings.sharedKey`) behind one lead, where each used to carry its own whole sentence.
That is a change in English, and the fragments are what a translator will see.

The trap this note exists to disarm: the surfaces do **not** all say the same thing, and a
tester expecting them to would report the intended behaviour as a failure — which is
exactly what the first draft of this check did (PR #189). `config.fixAll` lists every
problem and has two surfaces; `config.fixFirst` names the first problem only and is
everything else, the write gate among them. The comment above both keys in `src/i18n/en.ts`
is the statement of record.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, and
the repository is open as a vault with `docs/Product Backlog.base` showing the tree.

## How to check

In the view options, point two options at one property — parent and order at the same key is
the quickest — and then a second pair at another key, so there are **two** collisions to
tell the two shapes apart.

- **The toolbar's warning chip** — its tooltip and its accessible name. Both problems, joined:
  `Fix the view options first: the parent and order properties share the key "rank", and
  the …`.
- **The readme command** (`Write backlog readme`) — refuses with the same both-problems
  sentence.
- **A refused write** — drag a row to a new parent. The notice names **one** collision and
  stops. That is `config.fixFirst` and it is correct.

Read all three for the shared lead and the fragment shape rather than for the same list:
each should close as one sentence, with no whole sentence run into another and no doubled
full stop where the fragment meets the lead's own.

## Acceptance criteria

- Both `config.fixAll` surfaces and at least one `config.fixFirst` surface read with two
  collisions configured.
- The single-problem gate notice recorded as correct rather than as a defect.
- Nothing yet checked.
