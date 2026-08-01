---
type: Issue
order: 70
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P1
area: process
created: 2026-08-01
source: 2026-08-01, on merging PR #24
---

# Two spec branches predate the use-case gate

## The decision

PR #24 merged first, and the two spec branches open against the same base convert their own
PBIs to use cases before they land:

| Branch | Adds | Shape |
| --- | --- | --- |
| PR #26 — Cross-cutting concerns (Multilang, Theming) | 1 Epic, 2 Features, **19 PBIs** | prose + acceptance criteria |
| PR #27 — Backlog as folder notes | **1 PBI** | prose + acceptance criteria |

Both were written before `npm run docs` required the use-case shape, and both will fail it
on rebase. That failure is correct and expected — it is the gate doing its job on work
written against an older rule.

## Why in that order

The alternative was to exempt notes that arrived from another branch, and an exemption for
where a note came from is the by-name carve-out this whole feature spent its review
removing. The gate cannot mean anything if it applies to the notes that happen to be in
front of it.

Doing the conversion in #24 was the other option, and it was already how the Kanban epic's
15 use cases got written — see [[Make the register check itself]]. Repeating it would have
put four branches' specification work in one pull request and grown a 29-commit branch
further, with each conversion arriving mid-review rather than getting a clean CI signal of
its own.

## What the conversion involves

Established, and it pays for itself. From the board epic: the shape asks questions prose
does not have to answer, and the answers were already buried in acceptance criteria as
one-line consequences — what a filter does to a WIP signal, what happens to a card created
into a state the base excludes. Each became an extension beside the step it complicates.

For unbuilt work, `## Where it lives` says **nothing yet** and names the module the work
will extend. That keeps faith with the check that every source path a requirement names
must exist, and it makes the seam a claim a reviewer can argue with before any code does.

## Acceptance criteria

- #26 and #27 rebase onto `main` and their 20 PBIs carry the use-case shape.
- `npm run check` green on both branches before either merges.

## If a third branch appears

Same answer. The cost is per branch and does not compound, and it falls due at the moment
the specification is written — which is the moment the extensions are worth the most.
