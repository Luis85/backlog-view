---
type: Issue
parent: "[[User manual]]"
order: 80
status: Open
priority: P2
area: docs
created: 2026-08-10
source: the first merge with main after the manual shipped — 2026-08-09-user-manual plan
files:
  - src/view/manual/sections.ts
  - test/docs/surfaces.test.ts
---

# A manual's prose has no compiler

## What happened

The manual shipped, and the first `main` it met had moved eighteen commits. That
increment removed the `showProperties` view option and made the Bases properties menu
the only switch for what a row shows.

Git reported one conflict, in `vitest.config.mts`. **Everything about the manual merged
clean**, and two of its sentences were wrong the moment it did:

- The setup section's `keys` still claimed `showProperties`, an option that no longer
  exists.
- "What the Base still owns" still said *this view only decides whether those render as
  columns* — a sentence describing a switch the increment had deleted.

Only the first had anything behind it. `test/docs/surfaces.test.ts` resolves every
`keys` claim against `getViewOptions()`, so an option that vanishes fails a test. The
second sentence is ordinary prose: nothing reads it, nothing checks it, and it would
have shipped saying the opposite of what the plugin does.

## Why it matters

This is a new maintenance surface, not a one-off. Every sentence in
`src/view/manual/sections.ts` is a claim about behaviour, and the plugin's behaviour is
the thing this repository changes every week. The claims degrade silently and in one
direction: the code moves, the prose stays, and the reader is told something that used
to be true.

The scale is already established rather than speculative. Building these five sections
took roughly forty corrections — six the implementer caught while writing, six from the
task review, three from an independent reviewer, six more across five fix rounds, three
from the whole-branch review, and more after — in a repository whose suite is otherwise
excellent. **Not one of them was catchable by a test.** They were caught by people
reading the module beside the sentence.

That was the cost of writing it once, with every reviewer's attention on it. The cost
of keeping it true, with nobody's, is the open question.

## What is already checked, and what is not

| Claim | Checked by |
| --- | --- |
| Every declared view-option key is explained | `test/docs/surfaces.test.ts` — exact key or `prefix.*` family, both directions |
| Every type in `ALL_TYPES` has an explanation | `test/view/manualTypes.test.ts` |
| Every section has entries, with a term and text | `test/view/manualSections.test.ts` |
| **What any sentence actually says about behaviour** | **nothing** |

The gate covers *options*. It is structurally blind to an *action* — the ✨ backfill went
unmentioned in the manual for two fix rounds while the coverage test stayed green — and
blind to whether an explained option is explained *correctly*.

## The same gap, found again the next day, outside the manual

Splitting `toolbar.ts` moved `renderFilterBox`, `syncFilterUi`, `revealFilter`,
`renderIgnoredNote` and `countedPopulation` into three new modules. `npm run docs` passed.
Three current notes went on naming `src/view/render/toolbar.ts` as the home of symbols
that had left it — [[Quick filter]], [[What counts as a work item]], and an OPEN task
still asking for a decision the split had already made.

Rule 4 checks that a path a note names **exists**. It cannot check that the symbol named
beside it is still in that file, so a pure move passes the gate while silently falsifying
every note that located the code. That is the same defect as the manual's stale sentence,
one layer out: the register makes claims about the code, and only some of them are
checked.

Worth stating because it changes the scope of this note. The question is not "how do we
keep the manual true" but **"which of the register's claims about code have checks, and
which are prose that rots"** — rule 7's specified-somewhere, rule 4's path-exists, and
`surfaces.test.ts`'s key coverage are the three that hold. A symbol's location is not one
of them.

## What would help, and what would not

- **A toolbar-action gate was considered and rejected**, for the reason recorded during
  the work: unlike `getViewOptions()` and the command registry, toolbar buttons have no
  structured registry to enumerate. A check over them means either refactoring the
  toolbar to have one, or hand-writing a list — the exact staleness the option check
  exists to avoid.
- **Coupling a sentence to a symbol** is the shape that would work where it fits: the
  `keys` field is the worked example, and it caught the one claim that broke. What else
  in the manual could name the thing it describes, so that renaming or deleting that
  thing fails a test?
- **A cadence, not a gate**, for the rest. The register already has
  [[A cadence for the checks CI cannot run]] for verification a machine cannot do; prose
  accuracy after a behaviour change may belong to the same family — read the manual
  against the diff when an increment lands, rather than pretending a test can.

## Acceptance criteria

None yet — this note records a problem and its evidence, not an agreed fix. It closes
when the register decides which of the three directions above it wants, or records that
it accepts the drift and why.
