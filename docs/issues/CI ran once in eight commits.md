---
type: Issue
order: 120
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P1
area: verification
created: 2026-08-02
source: PR #47 — one workflow run across eight commits, while sibling branches ran normally
files:
  - .github/workflows/ci.yml
---

# CI ran once in eight commits

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

It then ran, once, on the seventh commit — both legs, both green — and has not run on
either commit since. **One run out of eight**, which is the more useful reading than
either "it is broken" or "it started working": the trigger is intermittent, so a green
PR page can mean the gate passed, or that it last passed several commits ago and has
been silent since. Neither the checks tab nor the mergeability state distinguishes them.

That is a worse failure than a red build and a quieter one. A red build is information;
**a gate that does not run looks exactly like a gate with nothing to say**, and the PR
page shows no missing check to notice. It was found by asking the Actions API which runs
existed, not by reading the PR — and the intermittency was found the same way, by
checking again after a later push rather than by trusting the one green result.

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
   workflows triggering themselves. That sibling branches *did* run weakens this, and
   the one run on this branch weakens it further: a blanket restriction would not fire
   once.
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
  `ci.yml` on both platforms, **on every commit**. One run in eight is the symptom to
  explain; a single green result is not evidence the cause is gone.
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
ran presents as a check that had nothing to say — and an intermittent one presents as a
check that passed, several commits ago, with nothing on the page to say which.

Every other verification note in this folder assumes the gate runs. This is the one that
says to confirm it did — and the title is the reminder: not "CI is broken", which would
have been noticed, but a rate nobody checks.
