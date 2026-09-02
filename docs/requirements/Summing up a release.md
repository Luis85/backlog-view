---
type: PBI
parent: "[[The release summary]]"
order: 10
status: Active
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Summing up a release

**As** someone deciding what ships, **I want** the release's numbers on one line each with the
population and the unit stated, **so that** I can read the state of a release in seconds and
know what every figure counted.

The item count and the items-denominator progress shipped first (2026-08-28), as a summary
strip on the single-release screen — one bar, one percentage, one sentence, drawn from the
same `ReleaseRow` the index's own band already computed rather than a second derivation. The
rest shipped 2026-09-02: the estimated and completed effort, the estimate-denominator
progress, the blocked and risk counts, and the unestimated figure, each of them a criterion
of [[Release readiness]] counted or the same predicate read for a sum. The figures derive
from the same membership [[The scope of a release as a tree]] resolves; nothing here is
stored.

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
5. Every figure names its property and vocabulary where there is one; a figure computed over
   a population spanning several workflows names the workflows instead. **Amended
   2026-08-28, the author's call**: this line read "Every figure names the property and the
   vocabulary it read" until then, and it promised what no figure on this screen can
   deliver — the progress figure's `done` reads through `ownWorkflowReading`
   (`src/domain/board.ts`), so a release mixing ordinary work with Deliverables has no single
   property to name for it. This sentence predates that reading; it is a requirement
   catching up with a case it never anticipated, not a rule being relaxed to fit an
   implementation.

**Extensions**

- **1a — the release has no members.** Every figure reads as nothing to count, and none of them
  reads as zero. A release nobody has filled is not a release that is done.
- **2a — the estimate key is unconfigured.** The effort figures, the estimate denominator
  **and the unestimated figure** are absent and named as unconfigured; the item count and the
  item-denominator progress still answer. **Amended 2026-09-02**: this read "the effort figures
  and the estimate denominator" until the harness drew an unestimated count beside `Effort is
  not configured` — the count reads the same key as the sums, so a screen showing one without
  the others contradicts itself.
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
- A figure names its property and vocabulary where there is one; a figure computed over a
  population spanning several workflows — the progress figure, whose `done` reads through
  `ownWorkflowReading` — names the workflows instead. **Amended 2026-08-28** alongside main
  flow 5, for the identical reason: this bullet read "names the property and the vocabulary
  it read" until then, which no figure on this screen with a mixed population could satisfy.
- Unestimated scope is its own figure and is never folded into the effort total.
- Rendering the summary plans no write, and no figure is written to any note.

## Where it lives

**Corrected 2026-08-28** against what actually shipped for the item count and the
items-denominator progress; the paragraph below described a module and a location that were
never built, for figures that were: the item count and the progress figure are
`src/domain/releases.ts`'s `ReleaseRow.members` and `.done` — the SAME row
[[Every release in one list]]'s index band draws, counted once in `releaseIndex`'s own walk —
and the summary strip that draws them is `src/view/release/renderScope.ts`, not a module in
`src/view/render/`. This view's own options (the membership, version and target-date keys) are
`src/domain/releaseOptions.ts`, never `src/domain/viewOptions.ts`, which is the backlog view's
own options module and reaches no property this screen reads.

**Corrected 2026-09-02** for the REST of this note's figures, which have now shipped. They are
`src/domain/releaseReadiness.ts`, which walks the population `releaseScope`
(`src/domain/releases.ts`) already resolved rather than the model a second time, and which
returns the criteria and the figures together from one call — the effort sums, the unestimated
count, the blocked count and the critical-risk count. The blocked and critical-risk figures ARE
their criterion's own outstanding count, so neither can become a second opinion about a number
with one right answer. The effort sums and the unestimated count are their own pass over the
members, but through the same predicate the estimate criterion reads (`estimateValue` and
`isEstimated`), so a total and a verdict cannot disagree about which members are estimated.

They are drawn by `src/view/release/renderReadiness.ts`, called from
`src/view/release/renderScope.ts` — the chip row from `drawHeader`, the figures from the
`drawSummary` that `drawHeader` calls.

The estimate-denominator progress is **one figure with its denominator inside it** — `9 of 15
pts (60%)` — rather than a sum and a second percentage beside the items bar: two percentages on
one strip read as competing, and the strip wraps.

The **double-count qualifier** — a member carrying an estimate while a descendant in the same
release carries one — is NOT here and is deliberately deferred to [[Capacity against
commitment]], which owns that figure. Until it lands the effort total is wrong in a vault whose
parent estimates are aggregates; `releaseReadiness.ts` carries a `ponytail:` comment saying so
at the sum rather than leaving the gap silent.
