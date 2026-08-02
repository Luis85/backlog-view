---
type: Issue
order: 120
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-02
source: PR #47 — four workflow runs, and three attempts at counting them
files:
  - .github/workflows/ci.yml
---

# A gate that did not run looks like one that passed

## The failure mode

`ci.yml` triggers on `pull_request` — no branch filter, no path filter — and runs
`npm run check` on **Ubuntu and Windows**.
[[Unfreeze the compiler config and run CI on Windows]] added the second leg because a
Windows-only defect had already made `docs-check.mjs` reject the entire register, and
the argument it made was that a class of failure produces more than one member.

The finding that survives everything below is this: **a check that did not run is
indistinguishable, on the pull request page, from a check that ran and passed.** The
checks tab shows the HEAD commit's checks. A PR whose gate last ran four commits ago
looks exactly like one checked a minute ago — there is no absent row to notice, because
there is nothing to draw. A red build is information; a missing one is silence that
reads as consent.

That is the whole content of this note, and it is why every claim under it needs to be
checked rather than read off a page.

## Three attempts at the count, and what each got wrong

This note has said "CI never ran", then "once in eight commits", then "three of eleven
commits". All three were wrong, and the third was wrong in a more interesting way than
the first two.

1. **"Never ran"** — from the checks tab, which had nothing on it. It had nothing on it
   because the head commit had no run; earlier commits did.
2. **"Once in eight"** — from a truncated API page that happened to contain one run on
   this branch. It also read the branch as if it identified the PR: this branch NAME has
   carried 33 runs across more than one pull request, because a merged PR's branch
   restarts from `main` under the same name. "The newest run on the branch" answers a
   question about whichever PR last used it.
3. **"Three of eleven commits"** — from a proper join at last, the PR's own commit list
   against every `ci.yml` run on the branch, matched on SHA. The join was right and the
   **unit was wrong.**

`pull_request.synchronize` fires once per **push**, not once per commit. Three commits
pushed together produce one event and therefore one run, on the head — which is correct
behaviour and not a miss. That was then demonstrated directly: `282cccd`, `d581772` and
`7053f94` went up in a single push and produced exactly one run, #338, green on both
legs.

So the commit-based table counted pushes that carried more than one commit as failures.
How much of the earlier gap it explains is **not established**, because the pushes were
never enumerated — only the commits were.

## What is actually known

| | |
| --- | --- |
| Runs on PR #47 | four: #318 `6e605bb`, #324 `5740be1`, #327 `670b111`, #338 `7053f94` |
| All four | green on Ubuntu **and** Windows |
| Current head | `7053f94`, run #338 — so the merged tree IS verified on Windows |
| Commits with no run of their own | eight, of which at least two are explained by sharing a push |
| Pushes with no run | **unknown — nobody has enumerated them** |

The last row is the open question, and it is the only one worth chasing. If every push
produced a run, there is no defect here at all and this note keeps only its title. If
some did not, the gap is real and the four runs' distribution is the evidence.

## How to check, properly

```bash
# Every run of ci.yml on the branch, newest first.
gh run list --branch <branch> --workflow ci.yml --limit 50 --json headSha,conclusion,createdAt
# Every commit the PR contains.
gh pr view <n> --json commits
# The unit that actually triggers: pushes, from the ref's update events.
gh api repos/<owner>/<repo>/events --jq '.[] | select(.type=="PushEvent") | {ref:.payload.ref, head:.payload.head, size:.payload.size, at:.created_at}'
```

Join the runs against the **pushes**, not the commits. A push with no run is a miss; a
commit with no run may be nothing at all. The branch name is not a key — only the PR's
own commit range is.

## Acceptance criteria

- Pushes are enumerated against runs, and the question "did every push produce a run?"
  is answered from data rather than inferred from the commit list. Whatever the answer,
  it settles whether the rest of this note describes a defect.
- If it does: the cause is identified rather than worked around, and the honest
  follow-up is a **required** status check on `main`, so an unrun gate blocks a merge
  instead of resembling a passed one — the same shape as the branch-protection item
  [[Two spec branches predate the use-case gate]] is still waiting on, and both the
  maintainer's to enable.
- ~~PR #47's head is verified on Windows by a run rather than by argument.~~ Done —
  run #338 on `7053f94`, both legs green, on the merged tree.

## Outcome

Open, downgraded to P2, and kept for the title rather than for the count. The count was
asserted three times before it was measured with the right unit, which is a better
argument for the habit than for the defect: **name the unit that triggers the thing you
are counting, then enumerate both sides and join them.**

Every other verification note in this folder assumes the gate runs. This is the one that
says to confirm it did — for the commit in hand, rather than for the branch, and against
the event that would have caused it.
