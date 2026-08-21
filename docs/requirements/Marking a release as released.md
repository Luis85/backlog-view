---
type: PBI
parent: "[[Shipping a release]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Marking a release as released

**As** someone who has just shipped, **I want** to mark the release as released and have the
day recorded, **so that** the plan closes and the date it actually happened survives the plan
it happened against.

Nothing yet. It is one small batch against the release note alone, through the same gate as
every write.

## Use case

| | |
| --- | --- |
| **Actor** | Someone who has just shipped |
| **Trigger** | Choosing to release the open release |
| **Preconditions** | The release status key, the **one** value this action writes, the values that count as released, and the actual-date key are all configured |
| **Guarantee** | One batch writes the released status and the actual date to the release note and to nothing else. The planned target date is never written. Undo takes both back together. |

**Main flow**

1. The user chooses to release the open release.
2. The view states what is outstanding — unfinished members, and any readiness criterion not
   satisfied — and asks for confirmation.
3. One batch writes **the configured transition value** and today's date, into the two keys
   this view names.
4. The unfinished members are listed by name, with the action that moves them.
5. Undo takes the batch back as one.

**Extensions**

- **1a — the release is already at a released value.** The action is not offered; there is
  nothing to write and nothing to record twice.
- **1b — the release note is outside the Base's filter.** The action is not offered, and a
  batch naming it is refused whole.
- **2a — a readiness criterion is not satisfied.** It is stated, and it refuses nothing. The
  checklist informs the judgement and does not make it.
- **2b — nothing is outstanding.** The confirmation says so rather than showing an empty list.
- **2c — the user cancels.** Nothing is written and no undo slot is spent.
- **3a — the status key, the transition value or the released-value list is unconfigured.**
  The action is not offered at all, and the release screen says which option to bind. A key
  with no value list is unconfigured, not empty.
- **3b — the actual-date key is unconfigured.** The action is not offered either: a release
  marked shipped with no record of when is the half of this that cannot be reconstructed
  later.
- **3c — the actual-date key is the same key as the target date.** The configuration is
  refused where it is entered, because a record that overwrites the plan destroys the only
  evidence a release slipped.
- **3d — several values count as released** — `Released` and `Archived`, say. That list answers
  only "is this release already out"; **which value to write is its own option, holding one
  value**, because a list is not a choice and a view that picked from one would write a
  different status depending on how somebody ordered it. A transition value that is not among
  the released values is refused where it is entered.
- **4a — a member is outside the Base's filter.** It is named in the outstanding list, since
  the user can see it, and the action offered on it is withheld — the context rule, which is
  also why this batch never spans the members.

## Acceptance criteria

- The batch names the release note alone: no member is written to by releasing.
- The actual date is written to its own key and the target date is unchanged by the batch.
- Binding the actual-date key to the target-date key is refused at configuration.
- With the status key, the transition value, the released-value list, or the actual-date key
  unconfigured, the action is absent and the missing option is named.
- With two released values configured, the batch writes the configured transition value and no
  other, and a transition value outside the released list is refused at configuration.
- Releasing with an unsatisfied readiness criterion succeeds, and the criterion is stated
  before the confirmation.
- Cancelling writes nothing and leaves the undo slot untouched.
- Undo restores both the previous status and the absence of the actual date.

## Where it lives

One host method in `src/view/host.ts`, planned in `src/domain/writePlan.ts` and applied by
`src/storage/frontmatter.ts` over `src/view/writeGate.ts`. The status key, its released values, the
transition value and the actual-date key are declared in `src/domain/viewOptions.ts`, with the
same-key refusal and the transition-value check in `src/domain/settingsConsistency.ts`. The confirmation reuses `src/ui/prompts.ts`, and the
outstanding list is drawn by the release view's render module in `src/view/render/`.
