---
type: PBI
parent: "[[Release readiness]]"
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
priority: ""
iteration: ""
---

# Answering the readiness checklist

**As** someone deciding whether to ship, **I want** each readiness criterion answered over the
release's own members with a count behind it, **so that** the decision is made against stated
criteria instead of a feeling.

Nothing yet. Each criterion reads keys and value lists this view names for itself, over the
membership [[The scope of a release as a tree]] resolves.

## Use case

| | |
| --- | --- |
| **Actor** | Someone deciding whether to ship |
| **Trigger** | A release being open |
| **Preconditions** | The membership property is configured |
| **Guarantee** | Every criterion is evaluated over one denominator — the members — and reports satisfied, partly or not, with the count behind it. No criterion blocks anything, and evaluating them writes nothing. |

**Main flow**

1. The view takes the members as the denominator for every criterion.
2. For each configured criterion it evaluates every member against that criterion's own key
   and its own value list.
3. It reports satisfied when all members clear it, not when none do, and partly otherwise —
   with how many cleared.
4. It reports separately the members the criterion could not read.
5. The verdict is advisory: nothing on the screen is disabled by it.

**Extensions**

- **1a — the release has no members.** Every criterion reads as having nothing to check. An
  empty release satisfies nothing.
- **2a — a criterion's key is unconfigured.** It is listed as unconfigured — neither passed nor
  failed — and it is not counted in any total of criteria met.
- **2b — a criterion reads a vocabulary and has no value list.** Unconfigured, not empty, and
  the same answer as no key at all: a key says where a value lives and nothing about which of
  its values clears anything.
- **2c — the dependency criterion has an edge key but no prerequisite state key or clearing
  values.** Unconfigured. An edge says what a thing waits for and nothing about whether the
  wait is over.
- **2d — the estimate criterion meets a non-finite value.** It does not clear: `TBD`, an empty
  string and anything non-numeric are the missing estimate wearing a value.
- **2e — a member has no risk value, or a non-critical one.** It clears the risk criterion.
  The criterion asks whether *critical* risks are addressed, so only a critical value that is
  not among the addressed ones costs it an item.
- **2f — a member has no dependency edges.** It clears the dependency criterion: an empty edge
  list is removed rather than stored, so absence there means nothing outstanding.
- **4a — a member cannot be read by a criterion that does not treat absence as an answer.** It
  is counted as not clearing and reported separately, because an unanswered item is not a
  passing one.
- **5a — a criterion is not satisfied and the user ships anyway.** Nothing refuses it. The
  outstanding count is stated at the moment of the decision — see [[Marking a release as
  released]] — and that is all.

## Acceptance criteria

- Each criterion states satisfied, partly with a count, or not, over the member set alone.
- An unconfigured key, and a bound key with no value list, both read as unconfigured, and
  neither appears as a pass or a fail.
- A member with a `Low` risk and a member with no risk value both clear the risk criterion; a
  member with an unaddressed critical value does not.
- A member with no dependency edges clears the dependency criterion.
- A member whose estimate is `TBD` does not clear the estimate criterion.
- An empty release reports every criterion as having nothing to check.
- No control anywhere in the view is disabled by a criterion's verdict.

## Where it lives

The criteria are evaluated in `src/domain/releaseReadiness.ts`, beside the summary's figures
— over the population `releaseScope` (`src/domain/releases.ts`) already resolved out of the
model in `src/domain/model.ts`, rather than a second walk of it — reading
`src/domain/dependencies.ts` for the edges. Every
key and every value list is declared in `src/domain/viewOptions.ts`, checked for consistency
in `src/domain/settingsConsistency.ts`, and the checklist is drawn by the release view's
render module in `src/view/render/`.
