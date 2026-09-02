# Joining a release dates the work — execution plan

## Goal

Make `Set release` write a start and a due date beside the membership link, so an item
committed to a release draws on the dated axis instead of needing two dates typed by hand.

The single source of requirements is
`docs/requirements/Joining a release dates the work.md` and the child note this plan points
at. **This plan carries no execution detail** — every task names the note that holds it, and
a task brief is a pointer, not a snapshot. Read the note, not this file, for what to build.

## Architecture

Two layers, one deliverable, one commit. `src/domain/writePlan.ts` carries the two
candidate values it alone can know — the release's own date, and today. `src/storage/`
decides which of them land, against the note as the write goes in. `src/view/` passes today
down from the two entry points and nothing else.

The decision behind that split is
`docs/adrs/0033-a-stale-rule-is-decided-at-the-writer.md`, and it stands at
`status: Proposed` because this repository reserves `Accepted` for a record the code
follows. Flipping it is part of Task 1's definition of done.

## Not tasks

- `docs/adrs/0033-a-stale-rule-is-decided-at-the-writer.md` — **prose, already written** by
  the decomposition and repaired by the refinement pass. Context to build against, not work.
  Task 1 flips its status; nothing else touches it.
- `docs/tests/cases/Making a release, and putting work in one.md` — **the human's.** A walk
  in a live vault, which no subagent reaches: Obsidian cannot run here. It stays `Open`
  after this run, and its `Test suite` stays `Open` because its cases are re-walked at each
  release.
- `docs/requirements/Joining a release dates the work.md` — **not closed by this run or the
  next.** Whether its guarantee holds is read against a walk only the human makes.

## Global Constraints

Every implementer reads, before writing anything:

- Root `CLAUDE.md` — the layer rule, the write boundary, the context-row rule, and
  **"an invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing"**.
- `test/CLAUDE.md` — the jsdom harness, its helpers, and the limits of the substitute.
- The layer guide named in the task.
- `superpowers:test-driven-development`.

**The cycle, for a task that writes code:** red, green, `npm run check`, then commit. Every
step passes before the commit, never after. `npm run check` is all seven steps — build,
test typecheck, lint, markdown, coverage-thresholded tests, fallow, docs register — not one
of them.

**Every task in this plan writes code.** There is no prose-only task here, so no task runs
the write-`npm run check`-commit variant.

**`CHANGELOG.md` gains an `[Unreleased]` entry** in the same pull request, per
`RELEASING.md`.

**Closing the note is part of the task's definition of done, in the same commit as the
work:** `## Outcome` written, `status: Done`, `closed:` dated. Close **only** the note the
task dispatched you to. The ADR and the `Test case` above are context: the ADR takes
`status: Accepted` from Task 1 and never a `closed:` key or an `## Outcome`, and the
`Test case` is closed by nobody in this run.

## Task 1

Read `docs/tasks/Dates ride the release join.md` and do what it says.

Layer guides that bind: `src/domain/CLAUDE.md` and `src/storage/CLAUDE.md` — this task
crosses both, and the second is the one that governs the half most likely to go wrong.
`src/view/CLAUDE.md` for the two call sites.

Read `## Global Constraints` in this file, above, before starting.

Its `## Risks` names a measurement to take first: `src/storage/frontmatter.ts` is close to
the `max-lines` cap, and the extraction is step one rather than a surprise at lint time.
