---
type: Issue
order: 80
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P1
area: process
created: 2026-08-01
source: 2026-08-01, on merging PR
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Two spec branches predate the use-case gate

## The decision

PR #24 merged first, and the spec branches open against the same base convert their own
PBIs to use cases before they land. The alternative was to exempt notes for **where they
came from**, and an exemption by provenance is the by-name carve-out that whole feature's
review spent fifteen rounds removing. A gate cannot mean anything if it applies only to the
notes that happen to be in front of it.

The decision held. Every branch converted its own notes and the gate never grew a
provenance exemption. What follows is what the decision cost, recorded because the cost was
paid four times in one afternoon and the mechanism that would have prevented it is still
not enabled.

## What happened instead

**PR #27 merged two minutes after #24, from a base that predated it, and `main` went red.**

That is not a hypothetical this note is guarding against — it is the event:

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

## The fix was raced too

Three branches converted the same note inside five minutes, none able to see the others:

| Time | Branch | Commit |
| --- | --- | --- |
| 16:35 | #29 — this branch | `Fix main: convert #27's PBI, and its duplicate sibling order` |
| 16:38 | #26 — Cross-cutting concerns | `write every PBI as a use case, and unblock main's docs gate` |
| 16:40 | #30 — Backlog folder organization | `Make main green: give the folder-notes PBI its use-case shape` |

Two of them landed, and `main` needed a further commit at 16:51 —
`Deduplicate the folder-notes use case after two parallel conversions` — to clear what the
overlap left behind. This branch's conversion was the third and is now dropped as
redundant: `main` fixed the same defect, chose `order: 60` where this branch chose `45`,
and reached a fuller note than either conversion alone.

**A red `main` is the one condition that guarantees this collision.** Everyone who notices
fixes it, each from the base they already have, and the fixes cannot see each other. The
breakage produces the race, so the mechanism that stops the breakage stops both.

## The fourth instance is in this branch

While this PR sat open, `main` gained
[[Check that a feature lists its use cases]] at `order: 40` under the same parent as the
issues filed here — and a sibling filed in this branch,
[[A claim in four notes and nothing to check it]], already held `order: 40`. The gate
caught it on the merge, which is the design working. Nothing caught it while the branch sat
open, which is the point. Renumbered to 50–80.

A duplicate sibling order is the one ranking limitation this plugin has, and the register
is not allowed to demonstrate it. That it recurred here, in the notes filed *about* this
failure mode, is the most honest evidence available that the mode is structural rather than
anyone's carelessness.

## Where each branch stands

| Branch | State | Shape |
| --- | --- | --- |
| #27 — Backlog as folder notes | merged, broke `main`, fixed on `main` | 1 PBI |
| #26 — Cross-cutting concerns | **merged**, converted its own 19 PBIs first | 19 PBIs, converted |
| #28 — User manual | **merged**, based on post-#24 `main` | 6 PBIs, **already use cases** |

#28 is the evidence that the cost is a one-off. It was written after the gate landed and
carried the shape without anybody converting anything. Every branch opened since has done
the same, which is the decision paying out: the shape is now simply how a note is written.

## What would have prevented it

A branch protection rule requiring branches to be up to date with `main` before merging —
GitHub's "Require branches to be up to date". That is the mechanism for exactly this class,
it is a repository setting rather than code, and it is the maintainer's to enable. It is
the only item in this note still open.

Worth stating plainly because it is the honest limit of everything in this feature: the
gate runs on a *tree*, and no check that runs on a tree can see a merge that has not
happened yet. `npm run check` was green on both branches and green on neither result.

## Acceptance criteria

- ~~`main` passes `npm run docs`.~~ Done on `main` rather than here — `Make main green`
  (#30) and the deduplication that followed it.
- ~~#26 carries the use-case shape before it merges.~~ Done — its 19 PBIs were converted on
  the branch, and it merged green.
- **Branch protection requiring branches to be up to date before merging.** Open, and the
  maintainer's to enable. It is why this note stays `P1` with `main` currently green: the
  class fired four times in one afternoon and nothing in the repository prevents a fifth.

## What the conversion involves

Established three times now, and it pays for itself. The shape asks questions prose does
not have to answer, and the answers were already buried in acceptance criteria as one-line
consequences: converting the folder-notes note turned nine paragraphs of criteria into
eleven extensions, each beside the step it complicates — what happens when the parent is
not itself a folder note, when the target folder is not empty, when the creation fails
halfway.

For unbuilt work, `## Where it lives` says **nothing yet** and names the module the work
will extend. That keeps faith with the check that every source path a requirement names
must exist, and it makes the seam a claim a reviewer can argue with before any code does.
