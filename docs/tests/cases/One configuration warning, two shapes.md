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

In the view options, make **two** collisions, so the two shapes can be told apart. Point one
member of each pair at the **other member's existing key**, which is what keeps each group
to exactly two roles:

- **parent** at the order property's key;
- **start** at the target property's key.

Do not pick a free-standing key such as `status`, `risk` or `priority`: `configProblems`
groups by KEY and names **every** role using it, so a key another option already owns
produces one problem naming three or more properties — correct output that this check would
read as a failure.

Those two pairs are named rather than left to choice, because not every pair collides. The
three workflow states — state, Deliverable state and test state — are exempt by design
(`WORKFLOW_STATE_ROLES` in `src/domain/settingsConsistency.ts`): they may share one key on
purpose, and the shipped default has them doing it. Picking one of those as the second pair
yields one problem, at which point `config.fixAll` and `config.fixFirst` say the same thing
and the case can check nothing.

- **The toolbar's warning chip** — its tooltip and its accessible name. Both problems, joined:
  `Fix the view options first: the parent and order properties share the key "<the key you
  pointed them at>", and the start and target properties share the key "<the other>".` The
  key is whichever property was picked — `settings.sharedKey` prints the real one — so read
  the joining and the fragment shape, not a particular word.
- **The readme command** (`Write backlog readme`) — refuses with the same both-problems
  sentence.
- **A refused write** — drag a row to a new parent. The notice names **one** collision and
  stops. That is `config.fixFirst` and it is correct.

Read all three for the shared lead and the fragment shape rather than for the same list:
each should close as one sentence, with no whole sentence run into another and no doubled
full stop where the fragment meets the lead's own.

**Then put the bindings back, before running anything else.** The collisions are saved in
the `.base`, not held for the length of this check, and while they stand `configProblems`
refuses every write in the view — including the tree, board and roadmap suites this one
sits beside in the sweep. Left in place, a deliberate failure here reads as a broken plugin
three checks later. Restore a distinct property for each option and confirm the toolbar's
warning chip has gone.

## Acceptance criteria

- Both `config.fixAll` surfaces and at least one `config.fixFirst` surface read with two
  collisions configured.
- The single-problem gate notice recorded as correct rather than as a defect.
- The bindings restored and the warning chip gone, so the rest of the sweep runs against a
  working configuration.
- Nothing yet checked.
