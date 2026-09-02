---
type: Task
order: 330
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-09-02
closed: 2026-09-02
source: the last open item of [[Close the holes the test typecheck cannot see through]]
files:
  - test/helpers/obsidian-mock.ts
  - test/helpers/vault.ts
  - test/helpers/doubles.test.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The bet a declared member makes is loud now

## Evidence

[[Close the holes the test typecheck cannot see through]] closed with three things left,
and this is the third: **the doubles are widened rather than verified**. They assert a
shape — `asApp`, `captureRegistrations`, and seven `declare`d members across `TFile`,
`TFolder`, `FakeQueryResult` and `FakeViewConfig` — and nothing checks that what they claim
behaves like the real thing.

It was posed as a DESIGN question rather than a sweep, and the honest first answer is that
**most of it cannot be checked here at all**. Obsidian does not run in this repository; a
double's fidelity to `App`, to `Plugin`, or to the metadata cache is exactly the class of
claim [ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md) and
[[The fake vault can hold a cache Obsidian would not produce]] already refuse to assert
from a jsdom suite. Widening `asApp` to prove something would be proving it against the
typings, which `typecheck:test` already does.

**One part of the claim can be checked, and it is the part that has already gone wrong.**
`declare` emits no code. A declared member is a bet that `src/` never reads it, and reading
one answers `undefined` rather than failing — so the failure lands somewhere else, possibly
in a truthiness test that quietly answers no. That is not hypothetical here:
[[A declared member is a bet, and one was lost]] is `groupedData`, declared on
`FakeQueryResult`, read by `detectIgnoredGrouping`, and therefore `undefined` in every test
in the suite while the three cases that needed a real value cast past the double to plant
one.

## Approach

Each of the seven becomes a getter that throws, through one shared `unimplemented(owner,
member)` in `obsidian-mock.ts` — so the rule is stated once and every message names itself.

Two properties of that spelling are the whole design, and both are checked:

- **On the PROTOTYPE, so it costs nothing until read.** A getter declared with `get x()` is
  not an own property, so a spread, a `JSON.stringify` and the own-property walk vitest
  prints a failure diff with all still skip it. The bet is unchanged; only losing it
  changed.
- **Loud where the reader is standing.** The stack points at the `src/` module that reached
  for the member, rather than at whatever downstream line an `undefined` finally broke.

The walk over `src/` was re-run before doing it: nothing reads `TFolder.children`,
`TFolder.vault`, `TFolder.parent`, `TFile.vault`, `BasesQueryResult.properties`,
`BasesQueryResult.getSummaryValue` or `BasesViewConfig.getEvaluatedFormula` today. So the
change is inert on the current tree by construction — which is the point, and also why it
needed watching fail rather than watching pass.

## Acceptance criteria

- `test/helpers/doubles.test.ts` covers every unimplemented member, and **was watched
  failing**: `TFile.vault` put back to a `declare` turns its row red
  (`expected [Function] to throw an error`) with nothing else touched. Restored, green.
- `npm run check` passes whole: 295 files, 4623 tests, no coverage floor moved.

## What the check reaches, and what it does not

Written narrow on purpose, because the wider sentence is the one this register keeps
catching itself in.

**It is a check at the forbidden thing** for the shape that has bitten: turn any of the
seven back into a `declare` and its row goes red on a suite nobody edited. **It is not a
check that finds a member added tomorrow** — nothing walks the real typings to discover an
eighth, and nothing could usefully: `App` alone describes far more surface than these
doubles have any reason to carry, so such a walk would report hundreds of members whose
absence is correct.

So the guarantee is exactly: *every member this suite knows to be unimplemented fails loudly
rather than answering `undefined`.* Adding an eighth is still a decision somebody makes by
hand — and the getter is now the cheaper spelling of it, which is the best a convention gets
without a rule behind it.

## What is left

`asApp` and `captureRegistrations` are unchanged, and this note is the argument that they
should be: what they assert is a shape against the typings, which the compiler reads, and a
behaviour against Obsidian, which nothing here can run. There is no third thing for a test
to say about them.
