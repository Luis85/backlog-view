---
type: PBI
parent: "[[Capacity against commitment]]"
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

# Commitment against declared capacity

**As** someone deciding what ships, **I want** the committed effort set against whatever
capacity the release declared, in the unit my team uses, **so that** an over-commitment is
legible as a sentence rather than as two bare numbers.

Nothing yet. The commitment is the estimate summed over the members
[[The scope of a release as a tree]] resolves; the capacity is one number on the release note.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a release |
| **Trigger** | A release being open |
| **Preconditions** | The membership key, the estimate key, the capacity key and the unit string are all configured |
| **Guarantee** | Capacity, commitment, difference and utilization are all in one unit, which is stated on screen, and nothing is converted between units. No figure is written to any note. |

**Main flow**

1. The view reads the capacity from the release note's own capacity key.
2. It sums each member's own estimate, counting every member once.
3. It shows capacity, commitment, the difference and the utilization, with the unit named.
4. It names beside the figure any member carrying an estimate while a descendant in the same
   release carries one, as possible double counting.

**Extensions**

- **1a — the capacity key is unconfigured, or the release carries no number there.** There is
  no comparison for that release: the commitment is still shown, and the missing half is
  named.
- **1b — the capacity is negative.** It is refused where it is entered, since no unit this
  feature names can be less than none.
- **1c — the capacity is zero.** Capacity, commitment and difference are shown; utilization is
  not, and it says a percentage needs a capacity. Zero is a real statement, not an error, and
  dividing by it would print an infinity.
- **2a — a member's estimate is not a finite number.** It is not summed and it is counted as
  unestimated, which is the figure [[Summing up a release]] states rather than a second one
  here.
- **2b — the estimate key is unconfigured.** There is no commitment and therefore no
  comparison; both halves are named as unconfigured.
- **3a — the unit string is not set.** No comparison is shown at all, and the unit is listed as
  missing exactly like an unbound key. Unlabelled arithmetic is two numbers whose meaning the
  reader supplies, which is the thing this feature exists to prevent.
- **4a — nothing in the release double counts.** The note is absent rather than present and
  empty.

## Acceptance criteria

- With capacity 40, commitment 52 and the unit "points", the screen names all four figures and
  the unit, and the difference is +12 in the same unit.
- With capacity 0, utilization is absent and named as needing a capacity; the other three
  figures still show.
- A negative capacity is refused at entry.
- With the unit unset, no comparison is rendered and the unit is reported missing.
- An epic and its feature both in the release contribute both estimates, and the possible
  double count is named beside the figure rather than resolved.
- Nothing computed here is written to the release note or to any member.

## Where it lives

The same new `src/domain/` derivation as the summary, from the model in
`src/domain/model.ts`. The capacity key, the estimate key and the unit string are declared in
`src/domain/viewOptions.ts`, and the negative-capacity refusal belongs with the option
validation there and in `src/domain/settingsConsistency.ts`. The panel is the summary's own
render module in `src/view/render/`.
