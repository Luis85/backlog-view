---
type: Issue
order: 120
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P1
area: verification
created: 2026-08-02
source: PR #47 — three workflow runs across eleven commits, enumerated against the PR's own commit list
files:
  - .github/workflows/ci.yml
---

# CI does not run on every commit

## Why this exists

`ci.yml` triggers on `pull_request` — no branch filter, no path filter — and runs
`npm run check` on **Ubuntu and Windows**.
[[Unfreeze the compiler config and run CI on Windows]] added the second leg because a
Windows-only defect had already made `docs-check.mjs` reject the entire register, and
the argument it made was that a class of failure produces more than one member.

On PR #47 it ran on **three of eleven commits**. The PR was opened at 05:04, one minute
after its first commit, so every commit after that was a `synchronize` on an open PR and
every one of them should have fired:

| Commit | Pushed | Run |
| --- | --- | --- |
| `ff1c5ee` | 05:03 | — |
| `688746e` | 05:16 | — |
| `8ef581a` | 05:24 | — |
| `1fcff42` | 05:31 | — |
| `b47bb08` | 05:42 | — |
| `6e605bb` | 05:45 | #318, green both legs |
| `5740be1` | 05:58 | #324, green both legs |
| `670b111` | 06:05 | #327, green both legs |
| `243a4f2` | 06:17 | — |
| `521d3d7` | 06:24 | — |
| `277a6bd` | 06:26 | — |

The shape is the finding, and it is not "flaky": the three runs are **contiguous**.
Silent for five commits, fired for three consecutive, silent for three more. Something
with state changed twice, which is a narrower thing to look for than a coin that lands
badly. In the same window the same workflow ran normally for sibling branches —
`claude/readme-product-backlog-odzek3`, `claude/plugins-docs-review-639qpn`,
`claude/backlog-horizon-roadmap-props-7sxo7b` — several of them minutes apart.

That is a worse failure than a red build and a quieter one. A red build is information;
**a gate that does not run looks exactly like a gate with nothing to say**, and the PR
page shows no missing check to notice. The checks tab shows the HEAD commit's checks, so
a PR whose gate last ran four commits ago is indistinguishable there from one checked a
minute ago.

## The rate was asserted twice before it was counted

This note said "never ran", then "once in eight", and both were wrong. Both came from
reading a listing rather than enumerating: the first from the checks tab, which had
nothing on it; the second from a truncated API page that happened to contain one run on
this branch. The evidence that settles it took two queries — the PR's own commit list,
and every `ci.yml` run filtered to the branch — joined on the commit SHA.

**The branch name is not a key.** This name has carried 33 runs across more than one
pull request, because a merged PR's branch is restarted from `main` under the same name.
Filtering runs by branch and reading the newest one answers a question about whichever
PR last used the name. Only the join against *this* PR's commits is an answer about this
PR.

That is worth more than the count it corrects. A verification note that gets its own
evidence wrong twice is an argument for the habit rather than against the finding:
**enumerate both sides and join them; do not read a rate off a page.**

## How to check

```bash
# Every run of ci.yml on the branch, newest first.
gh run list --branch <branch> --workflow ci.yml --limit 50 --json headSha,conclusion,createdAt
# Every commit the PR actually contains.
gh pr view <n> --json commits
```

Join on the SHA. A commit with no row has never been checked, whatever the checks tab
implies, and the newest run is only evidence about the commit it names.

The trigger side is a repository setting rather than code, so the fix is not in this
tree. Candidates, in the order worth eliminating — the contiguity narrows them:

1. **A concurrency, queue or spending limit** dropping runs while several branches are
   active. This fits the shape best: it predicts windows rather than a uniform rate.
2. **Actions restricted for the actor** that pushed — pushes made with some tokens
   deliberately do not trigger workflows, to stop workflows triggering themselves. The
   three runs weaken this: a blanket restriction fires zero times, not three.
3. **A transient GitHub-side miss.** Cheapest to rule out, and least consistent with a
   contiguous window.

Adding `workflow_dispatch:` to `ci.yml` would make an unrun commit re-checkable on
demand. That is a real suggestion and deliberately not taken here: it treats the
symptom, and the first thing to learn is *which* of the three it was.

## What this cost PR #47

Three of its commits are verified on both platforms; the other eight were verified only
by `npm run check` locally, which cannot see Windows. That includes the head, and the
head is what merges. The two things this repository has already been bitten by there —
path separators and CRLF checkouts, both in `docs-check.mjs` — are exactly the class a
local run is blind to.

## Acceptance criteria

- The cause is identified rather than worked around: a PR opened the same way runs
  `ci.yml` on both platforms **on every commit**. Any single green result is evidence
  about one commit and nothing else.
- PR #47's head is verified on Windows by a run rather than by argument.
- If the class turns out to be "runs can silently not happen", the honest follow-up is a
  **required** status check on `main`, so an unrun gate blocks a merge instead of
  resembling a passed one. That is the same shape as the branch-protection item
  [[Two spec branches predate the use-case gate]] is still waiting on, and both are the
  maintainer's to enable.

## Outcome

Open. Recorded rather than fixed because the lever is outside the tree, and because the
finding worth keeping is not "CI was flaky" but **the failure mode**: a check that did
not run presents as a check that had nothing to say, and no page distinguishes them.

Every other verification note in this folder assumes the gate runs. This is the one that
says to confirm it did — for the commit in hand, rather than for the branch.
