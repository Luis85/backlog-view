---
type: Issue
order: 120
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-02
source: PR #47 — five pushes recorded as they were made, three of which produced no run
files:
  - .github/workflows/ci.yml
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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

## The open question, answered by watching the right unit

Once pushes were the unit, the answer came from *making* some. Five pushes went up in a
row, each one recorded as it happened rather than reconstructed afterwards:

| Push | Commits | Run |
| --- | --- | --- |
| `277a6bd..7053f94` | three | #338, green both legs |
| `7053f94..ad70dbe` | one | #341, green both legs |
| `ad70dbe..803ee6d` | one | **none** |
| `803ee6d..2052860` | one | **none** |
| `2052860..e03b3ea` | one | **none** |

**So the gap is real, and push-grouping does not explain it.** Three consecutive
single-commit pushes to an open PR produced no `ci.yml` run at all, over roughly twenty
minutes, while other checks on those same commits did fire — GitGuardian reported, and
the review bot reviewed `2052860` by name, so the pushes plainly arrived.

And the distribution ALTERNATES in stretches, which is the strongest single fact here.
Taking the whole PR in push order, runs fired on three, then none on three, then two,
then none on three:

```
6e605bb ✓  5740be1 ✓  670b111 ✓   243a4f2 ✗  521d3d7 ✗  277a6bd ✗
7053f94 ✓  ad70dbe ✓               803ee6d ✗  2052860 ✗  e03b3ea ✗
```

Nothing that decided independently per event would produce that. It points at something
with state — a concurrency limit, a queue, a spending cap — and away from anything about
the pushes themselves, which were indistinguishable from the ones that ran. (The first
three columns are reconstructed from commit times, so they assume one push per commit,
which is how those rounds were made; the last five rows were recorded as they happened.)

The cost is immediate rather than theoretical: the runs that fired covered the merge
commit, and the four commits *after* it — three of them review fixes to `domain/`,
`view/` and the stylesheet — are verified only by a local `npm run check`, which cannot
see Windows.

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

- ~~Pushes are enumerated against runs, and "did every push produce a run?" is answered
  from data rather than inferred from the commit list.~~ Answered: **no.** Three
  consecutive single-commit pushes produced none, recorded as they happened.
- The cause is identified rather than worked around. The contiguity is the lead: it comes
  and goes in stretches, so look for something with state — a concurrency, queue or
  spending limit — before anything about the pushes, which were indistinguishable from
  the ones that ran.
- **A required status check on `main`**, so an unrun gate blocks a merge instead of
  resembling a passed one. This was the conditional follow-up; the condition is now met,
  so it is the recommendation. Same shape as the branch-protection item
  [[Two spec branches predate the use-case gate]] is still waiting on, and both the
  maintainer's to enable. Note what it does *not* do: a required check that never runs
  blocks forever rather than passing silently, which is the right failure — loud and
  fixable, instead of quiet and wrong.
- PR #47's **head** is verified on Windows by a run. Met at `7053f94` and `ad70dbe`, and
  no longer true: four commits have landed since, none with a run.

## Outcome

Open at P2 — the defect is confirmed but the lever is outside this tree, and every
consequence of it is visible rather than silent now that the note says which commits are
unchecked.

The method is the part worth keeping. The count was asserted three times before anyone
measured it with the right unit, and the answer only arrived once the unit was named and
the evidence was collected *forward* — recording each push as it was made — instead of
reconstructed from a listing afterwards. **Name the unit that triggers the thing you are
counting; enumerate both sides; and where you can, watch it happen rather than infer it.**

Every other verification note in this folder assumes the gate runs. This is the one that
says to confirm it did — for the commit in hand, rather than for the branch, and against
the event that would have caused it.
