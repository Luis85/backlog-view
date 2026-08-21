---
type: PBI
parent: "[[The release summary]]"
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

# Summing up a release

**As** someone deciding what ships, **I want** the release's numbers on one line each with the
population and the unit stated, **so that** I can read the state of a release in seconds and
know what every figure counted.

Nothing yet. The figures derive from the same membership [[The scope of a release as a tree]]
resolves; nothing here is stored.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a release |
| **Trigger** | A release being open |
| **Preconditions** | The membership property is configured |
| **Guarantee** | Every figure is computed over one population — the notes whose own property names this release — and states what it counted and in what unit. No figure is persisted, and computing them writes nothing. |

**Main flow**

1. The view takes the members as its one denominator.
2. It states the item count, the estimated effort, the completed effort and the progress,
   naming which denominator the progress used — items, or estimate.
3. It counts the blocked members and the members carrying an unaddressed critical risk, each
   member counted once however many edges or values it holds.
4. It states how much of the scope carries no estimate at all, as its own figure.
5. Every figure names the property and the vocabulary it read.

**Extensions**

- **1a — the release has no members.** Every figure reads as nothing to count, and none of them
  reads as zero. A release nobody has filled is not a release that is done.
- **2a — the estimate key is unconfigured.** The effort figures and the estimate denominator
  are absent and named as unconfigured; the item count and the item-denominator progress still
  answer.
- **2b — a member's estimate is not a finite number.** It is unestimated, whatever it says —
  the same predicate [[A definition of ready]] uses, and for the same reason: a `TBD` counted
  as an estimate reports a release as sized on the strength of a placeholder.
- **2c — the state key or the done values are unconfigured.** Progress is absent and named as
  unconfigured, rather than computed against a guess at what done means.
- **3a — the dependency predicate is unconfigured** — no edge key, or no prerequisite state and
  clearing values. The blocked figure is absent and named, exactly as [[Release readiness]]
  says, and not shown as zero blocked.
- **3b — the risk predicate is unconfigured** — no risk key, or no critical and addressed value
  lists. The risk figure is absent and named, and no member is counted as risky by default.
- **4a — every member is unestimated.** The unestimated figure equals the item count and the
  effort figures say there is nothing to sum, which is a different statement from a total of
  zero.
- **5a — a figure's population differs from the member count** — for instance because a
  criterion could not read some members. Both numbers are stated, and the unreadable ones are
  reported separately rather than folded into either.

## Acceptance criteria

- Every figure on the screen is computed over the member set alone: adding a context ancestor
  to the fixture changes no number.
- Progress states which denominator produced it, and the two denominators are separately
  configurable.
- A member with three unmet prerequisites adds one to the blocked count, not three; a member
  with three risk values adds at most one to the risk count.
- An unconfigured predicate makes its figure absent and named, never zero.
- Unestimated scope is its own figure and is never folded into the effort total.
- Rendering the summary plans no write, and no figure is written to any note.

## Where it lives

The figures are derived in the same new `src/domain/` module as the scope, beside
`src/domain/board.ts`, from the model in `src/domain/model.ts`; the dependency predicate reads
`src/domain/dependencies.ts` rather than a second idea of blocked. The keys, the value lists
and the progress denominator are declared in `src/domain/viewOptions.ts`, and the panel is a
new render module in `src/view/render/`, beside `src/view/render/board.ts`.
