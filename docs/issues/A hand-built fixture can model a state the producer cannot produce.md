---
type: Issue
order: 150
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-08
source: PR #91 — four expectations in one file were modelling an unreachable configuration
files:
  - src/domain/settings.ts
  - test/domain/statePalettes.test.ts
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

`test/domain/statePalettes.test.ts` now resolves through `resolveSettings` via
`FakeViewConfig`, with the reason stated on the helper so the next edit does not undo it.
That is one file. The other domain suites still build literals, correctly for what they
test today, and incorrectly the moment one of them starts reading a relationship.

## What is unresolved

Whether anything can catch the next one. Three candidates, none of them taken:

- **A lint rule against `{ ...defaultSettings(), … }` in tests.** It cannot tell the two
  cases apart, so it would refuse the majority use it is right about.
- **A `resolveSettings` round-trip assertion in the helper** — resolve the literal and
  check it comes back unchanged. This actually would have caught this instance, but only
  where a helper is used at all, and the failing fixtures were inline object literals.
- **Making the invariants of `BacklogSettings` a type.** The relationships are between
  *values*, not shapes, so the compiler cannot hold them.

Recorded rather than solved, because the general form is the one this register keeps
meeting from a new direction: an instrument that cannot see the thing it is measuring. See
[[A comment that states a rule is not a check]] for the same failure with prose as the
instrument, and the root guide's **Measure a set with an instrument that can see all of
it** for the rule this is an instance of.
