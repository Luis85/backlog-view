---
type: PBI
parent: "[[Release readiness]]"
order: 20
status: Open
created: 2026-09-02
source: deferred out of the readiness increment, 2026-09-02
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

# Testing complete as a readiness criterion

**As** someone deciding what ships, **I want** the readiness checklist to say whether the
release's scope has been tested, **so that** the one criterion a release is most often held
for is on the same row as the other three.

Deferred out of the 2026-09-02 increment deliberately, and the reason is the shape rather than
the difficulty: the other three criteria are each **a figure the summary already needed**, so
the predicate and the number are one piece of work. This one maps to no figure, and it costs
two more options — a testing property and the values that count as complete — plus a fifth
vocabulary the vault has to write before the criterion answers at all.

## Use case

| | |
| --- | --- |
| **Actor** | Someone deciding whether to ship |
| **Trigger** | A release being open |
| **Preconditions** | The membership property is configured, a testing property is bound, and the values that count as complete are declared |
| **Guarantee** | The testing criterion is evaluated over the same denominator as the other three — the members — and reports satisfied, partly or not, with the count behind it. It blocks nothing, and evaluating it writes nothing. |

**Main flow**

1. The view takes the members as the denominator, the same one every other criterion uses.
2. It reads each member's testing property and asks whether the value is one of the declared
   complete values.
3. It reports satisfied when every member clears it, not when none do, and partly otherwise —
   with how many cleared.
4. It reports separately the members it could not read.
5. The chip joins the other three in the readiness row, drawn in the same shapes.

**Extensions**

- **2a — the testing key is unconfigured, or bound with no complete values.** The criterion is
  listed as unconfigured, the same answer as no key at all: a key says where a value lives and
  nothing about which of its values clears anything. With all four unconfigured the row
  collapses to one chip naming four rather than three.
- **2b — a member has no testing value.** It does not clear. Absence is an answer for the risk
  and the dependency criteria and it cannot be one here: "nobody has recorded a result" is the
  state this criterion exists to find, and reading it as a pass reports an untested release as
  tested.
- **5a — the criterion is not satisfied and the user ships anyway.** Nothing refuses it, exactly
  as [[Answering the readiness checklist]] says of the other three.

## Acceptance criteria

- The criterion states satisfied, partly with a count, or not, over the member set alone.
- A bound testing key with no complete values reads as unconfigured, never as nothing complete.
- A member with no testing value does not clear it, and is reported separately rather than
  folded into a plain outstanding count.
- No control anywhere in the view is disabled by its verdict.
- Adding a context ancestor to the fixture changes no count.

## Where it lives

Nothing yet. When it is built it is two more options on `src/domain/releaseOptions.ts` and one
more `ReleaseCriterion` out of the walk `src/domain/releaseReadiness.ts` already makes — the
chip row in `src/view/release/renderReadiness.ts` draws whatever criteria that walk returns, so
a fourth costs it no branch. The testing property is not a candidate for the ✨ in
`src/view/release/init.ts` until [[A catalog of tests]] settles what a vault calls it, and the
complete values could never be one, for `criticalRiskValues`' own reason: a vocabulary is not a
key, and there is no key to hand out.
