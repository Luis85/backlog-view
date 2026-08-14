---
type: PBI
parent: "[[Verifications a device has to answer]]"
order: 30
status: Done
area: docs
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The sweep query rests on a checked convention

**As** whoever cuts a release, **I want** the convention the pre-tag sweep queries to be
gated by `docs-check.mjs`, **so that** a verification cannot drop out of the checklist by
being written slightly differently.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone adding or editing an `Issue` or `Test case` note |
| **Trigger** | `npm run check`, on every commit and in CI |
| **Preconditions** | `RELEASING.md` derives the sweep by querying for `## How to check` and reading `cadence:` |
| **Guarantee** | A note that declares itself a verification is findable by the sweep, and a note the sweep finds declares when it is due. Neither can be left to be guessed. |

**Main flow**

1. The checker walks every `Issue` and `Test case` in the register.
2. For each, it asks two independent questions: does it carry `## How to check` as a whole
   heading line, and does it declare a `cadence:`.
3. The two must agree, and a declared cadence must be one the sweep reads.
4. `npm run check` is green, and the release sweep can be trusted to be complete.

**Extensions**

- **2a — the three documented `Issue` shapes are enforced instead.** Refused, and this is
  the decision that shaped the whole item. `docs/README.md` documents a decision, a
  limitation and a verification as three section sequences, and **most of the folder does
  not match the shape its own opening heading implies** — the reader can derive the split
  rather than trust a figure here, which is why none is written down. Two of those notes
  head sections (`## The failure mode`, `## The defect`) belonging to no documented shape at
  all. A gate failing that much of the corpus is answered by editing the corpus, and the
  README's shapes have never been what anything depends on.
- **2b — `## Outcome` is required of a verification.** Refused for a stronger reason than
  corpus size: it would be *wrong*. `docs/README.md` says an outcome is written **after**
  the work, and most verifications here have not been run — an unrun check legitimately has
  no outcome, and demanding one would be answered by writing an empty section that says
  nothing, which is worse than its absence.
- **2c — only the missing-cadence direction is checked.** Then the drift that started this
  is still invisible. Three notes headed their section `## What to look at`; the sweep
  dropped them silently, one being the note that owns the mobile drag verdict
  [[Smoke test the touch paths on a phone]] delegates to. The rule is a biconditional
  because a note can fall out of the sweep from either side.
- **2d — the heading is matched as a prefix.** Then
  [[A gate that did not run looks like one that passed]] is swept in — it heads a section
  `## How to check, properly` about a CI gate that never ran, which no device can run — and
  the gate then demands a `cadence:` of a note that has no business carrying one. The same
  `sectionHits` matcher every other section rule uses is what makes it whole-line.
- **3a — a verification declares itself nowhere.** Not detected, and the guarantee above is
  written to exclude it rather than around it. A note with no cadence and a freely spelled
  heading is indistinguishable from a note *about* a check, and a heuristic separating them
  would gate on a guess. What is checked is that a note which declares itself one way
  cannot contradict itself the other.

## Acceptance criteria

- A note carrying `## How to check` without a `cadence:` fails, and a note declaring a
  `cadence:` without that heading fails.
- A cadence outside the vocabulary `RELEASING.md` reads fails.
- Each of those three report sites is planted in `test/docs/checkerRejects.test.ts` and
  **watched failing alone** — neutered one at a time, with exactly the case named after it
  going red.
- The accept direction covers an `Issue` that is not a verification and one heading
  `## How to check, properly`, and neither is vacuous: widening the rule to "every `Issue`
  is a verification" turns both red, and making the matcher a prefix turns the second red.
- `Epic`, `Feature`, `Task`, `Bug` and `Test suite` stay ungated, and the `Issue` *section*
  shapes with them; `Test case` joined `Issue` as gated by the 2026-08-11 test catalog
  migration, which widened the check by type rather than by folder. Scope promised is
  scope checked.
- `npm run check` passes with no note in `docs/issues/` edited to satisfy the gate.

## Where it lives

`docs-check.mjs` · `test/docs/checkerRejects.test.ts` · `test/docs/checkerAccepts.test.ts`
