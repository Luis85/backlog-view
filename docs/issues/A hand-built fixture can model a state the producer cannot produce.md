---
type: Issue
order: 150
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
created: 2026-08-08
source: PR #91 — four expectations in one file were modelling an unreachable configuration
files:
  - src/domain/settings.ts
  - src/domain/model.ts
  - test/domain/statePalettes.test.ts
  - test/domain/settings.test.ts
  - test/domain/board.test.ts
  - test/domain/stamps.test.ts
---

# A hand-built fixture can model a state the producer cannot produce

## The limitation

Most domain tests here build settings as `{ ...defaultSettings(), stateKey: 'status', … }`.
That literal can express combinations `resolveSettings` never emits, because the resolver
is where the *relationships between fields* live: the Deliverable state lists follow a
falling-back key only while they are EMPTY, `clearablePropKey` tells "never set" from
"cleared", `tagsKey` yields to any of the four keys it could collide with. A literal
carries the fields and none of the rules.

That is invisible while a function reads one field at a time. It becomes wrong the moment
one reads a *relationship* — and then the fixture is asserting behaviour for a vault that
cannot exist, in both directions: a passing test that proves nothing, and a failing test
that blames correct code.

Found on PR #91. `statePalettes` moved from asking "is there a second state key?" to asking
"did the settings declare a second workflow?", and four expectations in
`test/domain/statePalettes.test.ts` broke at once. Every one of them was a fixture holding
`deliverableStateKey: ''` beside a `deliverableStates` that had not followed it — which
`resolveSettings` cannot produce, since the empty list follows the key. The code was right
and the fixtures were describing a vault nobody could configure.

## Why it is not simply "always resolve"

The literal is genuinely better for most tests. It names exactly the two fields a case is
about, it does not require knowing which view option produces which settings key, and it
does not drag the whole resolver into a test of one predicate. Requiring `resolveSettings`
everywhere would make every domain test a settings test.

The distinction that actually matters is what the code under test READS:

- one field, or several independent ones — a literal is fine and clearer
- a RELATIONSHIP between fields — the fixture has to come from the producer, or it is
  asserting against a state the producer forbids

Nothing checks which kind a given test is, and nothing can: "does this function's answer
depend on two fields agreeing" is the judgement the rule exists by making.

## What was done

The relationships are now a predicate — `settingsInconsistency` in `src/domain/settings.ts`,
stating the four guarantees `resolveSettings` establishes — and `buildModel` asserts it
(`assertResolvedSettings`). A fixture the resolver could not have produced throws where it
is used, with a message naming the broken relationship and pointing at the fix.

It throws unconditionally rather than under a development flag. In production the throw is
unreachable: `resolveSettings` is the only producer, and its one spread in
`view/backlogView.ts` touches none of the checked fields. That claim is a CHECK rather than
an argument — a sweep resolves fourteen option shapes and asserts every result is
consistent, and breaking the resolver's own copy rule reddens it.
**Checked by** `test/domain/settings.test.ts` — "names each relationship it can see broken, so the message points at the fixture"

Three suites had to change: `statePalettes`, `board` and `stamps` now resolve their
fixtures through `resolveSettings` via `FakeViewConfig`, with the reason on each so the
next edit does not undo it.

## What the measurement got wrong

Before building this, a grep screened every suite for the unproducible shape and reported
**two files, neither of them live**. The assertion found **three files and 35 tests**.

Both halves of that gap are worth keeping:

- The grep was **per file**, and the property is **per fixture**. `board.test.ts` was
  excluded because it mentions `deliverableStateKey` *somewhere* — in a different,
  perfectly producible fixture further down. An instrument at the wrong granularity, which
  is the root guide's **measure a set with an instrument that can see all of it**, failed
  on its own example.
- The grep asked "is this fixture's wrongness reaching the code under test *today*", and
  the assertion asks "is this fixture producible at all". The second is the right question:
  the first is a property of today's readers, and the whole failure mode is a reader
  arriving later.

## What is still not caught

The assertion sits at `buildModel`, the widest choke point a settings object passes
through — so it holds for tests nobody has written yet, which the alternatives could not.
It does **not** catch a bad fixture in a test that only calls a pure settings function:
`backlogReadme.test.ts` holds one right now and passes, because it builds no model. There
is no seam on a `BacklogSettings` literal itself, and inventing one would be a seam built
for the test.

Three earlier candidates, all still declined:

- **A lint rule against `{ ...defaultSettings(), … }` in tests.** It cannot tell the two
  cases apart, so it would refuse the majority use it is right about.
- **A round-trip assertion in a shared helper.** Only reaches fixtures that use the helper,
  and the failing ones were inline literals.
- **Making the invariants of `BacklogSettings` a type.** The relationships are between
  *values*, not shapes, so the compiler cannot hold them.

See [[A comment that states a rule is not a check]] for the same failure with prose as the
instrument.
