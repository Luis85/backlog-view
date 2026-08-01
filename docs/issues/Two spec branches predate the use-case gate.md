---
type: Issue
order: 80
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P1
area: process
created: 2026-08-01
source: 2026-08-01, on merging PR #24 — and what happened two minutes later
---

# Two spec branches predate the use-case gate

## The decision

PR #24 merged first, and the spec branches open against the same base convert their own
PBIs to use cases before they land. The alternative was to exempt notes for **where they
came from**, and an exemption by provenance is the by-name carve-out that whole feature's
review spent fifteen rounds removing. A gate cannot mean anything if it applies only to the
notes that happen to be in front of it.

## What happened instead

**PR #27 merged two minutes after #24, from a base that predated it, and `main` went red.**

That is not a hypothetical this note is guarding against — it is the event, and it is why
this note is `P1` rather than a tidy record of a decision:

```
docs/requirements/Backlog as folder notes.md: use case has no ## Use case
docs/requirements/Backlog as folder notes.md: use-case table has no | **Actor** | row
docs/requirements/Backlog as folder notes.md: **Extensions** block could not be parsed
… and six more
```

GitHub merges into `main` as it is *now*, not into the base the PR was opened against, so
a green check on a stale base says nothing about the merge. Neither PR was wrong on its own
and the combination was broken — the same shape as the Kanban collision a few hours
earlier, except that one was caught by the PR's own CI because #24 was still open to
receive it. A merged PR has nothing left to run.

Fixing it also turned up a second defect the pre-gate branch could not have caught: the new
note took `order: 40` under `[[Creating items]]`, already held by
[[Scaffolding a backlog]]. A duplicate sibling order is the one ranking limitation this
plugin has, and the register is not allowed to demonstrate it.

## Where each branch stands

| Branch | State | Shape |
| --- | --- | --- |
| #27 — Backlog as folder notes | **merged**, broke `main`, converted here | 1 PBI |
| #26 — Cross-cutting concerns | open, base still pre-#24 | 19 PBIs, pre-gate |
| #28 — User manual | open, based on post-#24 `main` | 6 PBIs, **already use cases** |

#28 is the evidence that the cost is a one-off. It was written after the gate landed,
carries the shape without anybody converting anything, and reports the register consistent
in its own description.

## What would have prevented it

A branch protection rule requiring branches to be up to date with `main` before merging —
GitHub's "Require branches to be up to date". That is the mechanism for exactly this class,
it is a repository setting rather than code, and it is the maintainer's to enable.

Worth stating plainly because it is the honest limit of everything in this feature: the
gate runs on a *tree*, and no check that runs on a tree can see a merge that has not
happened yet. `npm run check` was green on both branches and green on neither result.

## Acceptance criteria

- `main` passes `npm run docs`. Closed by the conversion in this change.
- #26 rebases onto `main` and its 19 PBIs carry the use-case shape before it merges.

## What the conversion involves

Established twice now, and it pays for itself. From the board epic and again here: the
shape asks questions prose does not have to answer, and the answers were already buried in
acceptance criteria as one-line consequences. Converting #27's note turned nine paragraphs
of criteria into eleven extensions, each beside the step it complicates — what happens when
the parent is not itself a folder note, when the target folder is not empty, when the
creation fails halfway.

For unbuilt work, `## Where it lives` says **nothing yet** and names the module the work
will extend. That keeps faith with the check that every source path a requirement names
must exist, and it makes the seam a claim a reviewer can argue with before any code does.
