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
  - eslint.config.mjs
  - test/helpers/settings.ts
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

Three suites had to change for that alone: `statePalettes`, `board` and `stamps`.

Then the hazard was closed at the CONSTRUCTOR rather than left to a runtime net.
`test/helpers/settings.ts` holds the two ways to build a fixture — `settingsFrom(options)`,
which runs the real resolver, and `settingsWith(fields)`, which spreads the defaults and
then **applies the resolver's own derivations** before checking the result. Deriving rather
than rejecting is the point: a caller naming `states` is saying "this base has these
states", and the resolver's answer to that includes copying them to the Deliverable
workflow while its key falls back. Making 41 call sites restate that would be asking each
of them to remember the rule the helper exists to hold — and a fixture corrected into
existence cannot be one that could not exist.

`no-restricted-syntax` in `eslint.config.mjs` then bans the raw spread across `test/**`,
so the helper is the way in rather than the way most people happen to use. All 41 sites
across 13 files were converted; the helper itself carries the one `eslint-disable`, since
it is the thing the rule points at.

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

The lint rule was declined once, on the grounds that it "cannot tell the two cases apart,
so it would refuse the majority use it is right about". That was wrong, and worth naming:
there is no majority use it is right about. EVERY hand-built fixture is at risk, so
refusing all of them is correct — and it only became a cheap change once the helper existed
to be refused *in favour of*. A rule with no replacement to point at is what made it look
unaffordable.

## The relationships, and how the list stopped being guesswork

`settingsInconsistency` began with four. Review found a fifth and a sixth on the same day:
`wipLimits` and `columnPolicies` are built by `nameTable` over the CONFIGURED states, and
limits drop the done ones besides — so a limit keyed to a state the workflow does not have
is one the resolver would have discarded. A board test was relying on exactly that, setting
a limit on `draft` while the requirements workflow had no `Draft` state at all: it was
staging the collision it claimed to reproduce. Naming `states` too makes the fixture real
and the test better.

That is this note's own subject arriving as a review finding, and it is the argument for
the drift detector rather than for trusting the list. `settingsWith` applies the resolver's
relationships by hand, so it can fall behind — and the way that shows is a fixture quietly
missing a derivation, not a failure. A table of `{ fields, options }` pairs now asserts the
two constructors agree in full, so a derivation the resolver has and the helper lacks makes
the pair disagree.
**Checked by** `test/domain/settings.test.ts` — "a workflow, so the Deliverable lists follow it"

## What is still not caught

- **Spreading a settings object under any other name.** `{ ...settings, states: [...] }`
  breaks the same relationships and is invisible to a syntactic rule, which sees
  `defaultSettings()` and not the type of an arbitrary identifier. **Measured before
  building anything for it**: with the constructors in place, asserting at three further
  boundaries (`configProblems`, `backlogReadmeContent`, `applyWrites`) catches nothing —
  every remaining spread in the suite is producible. A lint rule over a hand-maintained
  list of relationship-carrying field names would cost ~40 conversions to catch a class
  with no members, so it is declined on evidence rather than on principle. If one appears,
  `assertResolvedSettings` in `buildModel` is the net wherever a model is built.
- **A relationship nobody has added to the table.** The pair table catches drift for the
  relationships listed; nothing forces a NEW one to be listed. That is the residue, and it
  is smaller than it was — the predicate now rejects a fixture the moment one of the six is
  broken, so a missing seventh is the only way through.

**Making the invariants of `BacklogSettings` a type** stays declined and stays the only
complete answer: the relationships are between *values*, not shapes, so the compiler
cannot hold them. TypeScript cannot refuse a spread-with-override.

See [[A comment that states a rule is not a check]] for the same failure with prose as the
instrument.
