---
type: Issue
order: 430
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
created: 2026-09-03
closed: 2026-09-03
source: the 2026-09-03 capacity-against-commitment increment
files:
  - scripts/docs-check.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A piped command reports its pipe's exit code

## The shape

`npm run check | tail -12` and `tsc … | tail -200` both report **`tail`'s** exit status, not
the command's. `tail` almost always exits 0, so a failing gate reads as exit 0 with its own
error text sitting right there in the visible output — a shell whose last command succeeded
and a report reading "all clean" from it, next to the failure it printed.

It happened **three times in one increment**, to two independent agents and to the
coordinator: a broken `typecheck:test` was certified clean in a task report from the pipe's
exit code, then missed again at the review gate the same way, and CI on both platforms was
what finally caught it.

`CLAUDE.md` already states the rule this meets — *measure with an instrument that can see
all of it, and test the instrument first* — under a spelling that rule does not name. The
fix is `cmd; echo "EXIT=$?"`, never a pipe, wherever an exit code is the answer.
`docs/issues/A gate that did not run looks like one that passed.md` records the same
spelling meeting the same rule once already, on 2026-09-02, from a `2>&1 | tail -40` that
hid a `fallow` failure for four minutes until CI's Windows leg reported it.

## Three more, same species

- **A shared temp directory.** Two concurrent `npm run check` runs collide on
  `coverage/.tmp`: one fails with `ENOENT` or "something removed the coverage directory".
  That is the collision, not a defect in the tree — deleting the directory to "fix" it only
  produces the next collision. `pgrep -f vitest` before running `check` is the check that
  sees the whole machine instead of the one process about to run.
- **A census scoped to a folder.** A count of a parent's children run over `docs/bugs/`
  reported no sibling-order collision while every actual sibling sat in
  `docs/requirements/`. The census was correct about the folder it read and wrong about the
  question it was asked, which was about the parent's *whole* set of children —
  `docs-check.mjs` would have refused the note the narrow census had just called clean.
- **A pipe's exit code**, the entry above, met three times.

## What the four have in common

Each measurement was scoped to where the answer was expected to be rather than to where it
actually was: the pipe's own status stood in for the command's, one process's coverage
directory stood in for the machine's, one folder stood in for the register. `CLAUDE.md`
already states the rule; these are four spellings it does not name, which is the argument
for this note existing at all rather than folding into the one above it.

## Outcome

Recorded so the next agent that reaches for `| tail` to shorten a report reads this first.
No code changed: the fix in every case is the command actually run
(`cmd; echo "EXIT=$?"`, never through a pipe), not a new check — the existing gates
(`npm run check`, CI on both platforms) already catch what the piped read-out hid.
