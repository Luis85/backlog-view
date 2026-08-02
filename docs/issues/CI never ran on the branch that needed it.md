---
type: Issue
order: 120
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P1
area: verification
created: 2026-08-02
source: PR #47 — six commits, zero workflow runs, while sibling branches ran normally
files:
  - .github/workflows/ci.yml
---

# CI never ran on the branch that needed it

## Why this exists

`ci.yml` triggers on `pull_request` and runs `npm run check` on **Ubuntu and Windows**.
[[Unfreeze the compiler config and run CI on Windows]] added the second leg because a
Windows-only defect had already made `docs-check.mjs` reject the entire register, and
the argument it made was that a class of failure produces more than one member.

On PR #47 the workflow did not run **at all**. Six commits between 05:04 and 05:45,
zero runs; the newest run on the branch was 04:06, belonging to the previous,
already-merged pull request. In the same window the same workflow ran normally for
`claude/readme-product-backlog-odzek3` (05:19, 05:24, 05:30) and
`claude/backlog-horizon-roadmap-props-7sxo7b` (05:28). The only check that reported was
GitGuardian.

That is a worse failure than a red build and a quieter one. A red build is information;
**a gate that does not run looks exactly like a gate with nothing to say**, and the PR
page shows no missing check to notice. It was found by asking the Actions API which runs
existed, not by reading the PR.

The consequence for #47 specifically: everything reported green was
`npm run check` run locally, so the **Windows leg is unverified** — the one leg this
repository has already been bitten by twice, for path separators and for line endings.

## How to check

```bash
# Does a run exist for the head commit of an open PR?
gh run list --branch <branch> --workflow ci.yml --limit 5
```

Or, without the CLI, the Actions API filtered by branch: compare the newest run's
`head_sha` against the PR's head. A PR whose newest run predates its first commit has
never been checked, whatever the checks tab implies.

The trigger side is a repository setting rather than code, so the fix is not in this
tree. Candidates, in the order worth eliminating:

1. **Actions disabled or restricted for the actor** that pushed and opened the PR —
   pushes made with some tokens deliberately do not trigger workflows, to stop
   workflows triggering themselves. That sibling branches *did* run weakens this but
   does not eliminate it, since they may have been opened differently.
2. **A concurrency or spending limit** silently dropping runs. Visible in the Actions
   tab as skipped or queued runs; there were none.
3. **A transient GitHub-side miss.** The cheapest thing to rule out: closing and
   reopening the PR re-fires `pull_request.opened`, and `ci.yml` has no
   `workflow_dispatch` to trigger directly.

Adding `workflow_dispatch:` to `ci.yml` would make the third option a button instead
of a PR state change. That is a real suggestion and deliberately not taken here: it
treats the symptom, and the first thing to learn is *which* of the three it was.

## Acceptance criteria

- The cause is identified rather than worked around — a PR opened the same way runs
  `ci.yml` on both platforms.
- PR #47's tree is verified on Windows before it merges, by a run rather than by
  argument. Nothing in this repository can check that locally, which is the whole
  reason the leg exists.
- If the class turns out to be "runs can silently not happen", the honest follow-up is
  a **required** status check on `main`, so an unrun gate blocks a merge instead of
  resembling a passed one. That is the same shape as the branch-protection item
  [[Two spec branches predate the use-case gate]] is still waiting on, and both are the
  maintainer's to enable.

## Outcome

Open. Recorded rather than fixed because the lever is outside the tree, and because the
finding worth keeping is not "CI was flaky" but **the failure mode**: a check that never
ran presents as a check that had nothing to say. Every other verification note in this
folder assumes the gate runs; this is the one that says to confirm it did.
