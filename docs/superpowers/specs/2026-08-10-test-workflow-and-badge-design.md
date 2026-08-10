# A workflow for the tests, and a hue for the case

**Date** 2026-08-10 · **Status** approved, not yet planned

Three changes, arriving together because they are the same complaint: the test catalog
shipped as a family of items with no state of their own, no place in the view options to
configure one, and two types wearing one colour.

1. A **third workflow**, selected by ladder rather than by type name.
2. A **`Test management` options group** holding it.
3. **`Test case` on cyan**, `Test suite` staying on orange, both keeping the test axis.

The right-click menu is unchanged. That was the request this design started from and it
was withdrawn: a catalog row keeps Set horizon, Schedule, Set risk, Set assignee and the
dependency entries, which is what
[[Tests stay out of the plan]]'s acceptance criteria already say and what stays true.

## What the register says, and where this contradicts it

Two Done notes claim things this change makes false. They are rewritten by the
implementation rather than amended in the margin, because in both cases the *reasoning*
changes and not only the outcome.

- **`Tests stay out of the plan`** — extension 4a and the completed-toggle paragraph both
  turn on *"this epic gives tests no workflow"*. After this they have one. What survives
  unchanged is the conclusion each was supporting: a test's state is still never read by
  a projection it is excluded from, still cannot mint a plan board column, and still
  cannot appear in a plan row's Set state menu. The reason is now *the workflows are
  separate*, where it used to be *there is no second workflow*.
- **`A badge when the palette is full`** — main flow step 2 says both test types take
  **one** borrowed hue and are told apart by the axis, the icon and the rung. They now
  take two. The note's own criterion for a borrowed hue survives and is what picked cyan
  (below); what dies is the claim that one hue covers both.

Neither note's guarantee about shipped types is touched: no existing type changes colour.

## 1 · The third workflow

### The rule it extends

*An item's workflow follows its type* is stated in exactly two places — `stateKeyFor`
for the KEY and `ownWorkflowReading` for the value-and-done pair, both in
`src/domain/board.ts` — and the comment on the second records why it is two places and
not five. It becomes **an item's workflow follows its type, or its ladder**, and stays in
those two places.

The two selectors are **disjoint by construction** and this is worth stating because it
is what makes a three-way branch safe without an ordering argument: `isDeliverableType`
asks a type NAME, `inCatalog` asks the ladder, and a `Deliverable` is an extra type whose
`ladderFor` answer is always `LEVELS`. No item can satisfy both.

`inCatalog` and not a list of test type names, for the reason the whole increment rests
on: a typeless child of a `Test suite` and a `Task` under a `Test case` are both catalog
members, and a predicate written as `isTestType(item.typeName)` gets both wrong while
passing every other fixture.

### The pieces

| module | change |
| --- | --- |
| `domain/optionalProperties.ts` | a `testState` row — `option: 'testStateProperty'`, `suggested: 'status'`, `settingsKey: 'testStateKey'` — declared AFTER `state`; and `resolvedTestStateKey` beside `resolvedDeliverableStateKey` |
| `domain/settings.ts` | `testStateKey`, `testStates`, `testDoneValues` on `BacklogSettings`, with their fallback defaults |
| `domain/settingsResolve.ts` | `resolveDeliverableWorkflow` generalised to serve both (see below) |
| `domain/settingsConsistency.ts` | the `deliverable*` fixture assertions gain their test twins, and `STATE_KEY_SHARING_EXEMPT` changes shape (below) |
| `domain/readItems.ts` | `testStateValue` and `testDone` on `RawItem`, read through the resolved key |
| `domain/board.ts` | the catalog branch in `stateKeyFor` and `ownWorkflowReading` |
| `domain/vocabulary.ts` | `collectObservedTestStates` |
| `domain/model.ts` | `vocabularyOf` uses it for the catalog's population |
| `domain/viewOptions.ts` | `testManagementGroup` |

### `status` by default, and the fallback that delivers it

The requirement *"test items rely on `status` as their default property"* is met by an
existing mechanism rather than a new one, and the Deliverable workflow's own comment
already explains it: `adoptableProperties` refuses a suggestion whose key another
property has claimed, and `state` is declared first. So on a first-run setup (the
toolbar's ✨), `state` takes `status`, `testStateProperty` is left **unbound**, and
`resolvedTestStateKey` falls back to `settings.stateKey`. Tests read `status` because
they share the plan's property, not because a second option was written to point at it.

Declaring `testState` after `state` in `PROPERTY_TABLE` is therefore load-bearing, not
formatting.

### Generalising the resolver rather than copying it

`resolveDeliverableWorkflow` is forty lines of carefully argued fallback: the key's own
fallback condition named once, the done values falling back to the requirements
workflow's EFFECTIVE list only while the key is also falling back, the declared states
doing the same over the vocabulary. Every one of those arguments is true of the test
workflow, word for word, with `test` substituted.

This is the case the root `CLAUDE.md` names under **absence is a value**: `applyLabels`
was extracted when the assignee arrived rather than copied, "so a fifth label is a row in
that list". Same here. `resolveDeliverableWorkflow` becomes
`resolveSecondaryWorkflow(inputs, names)`, where `names` carries the three option keys
and the three fallback fields, and it is called twice. A third secondary workflow is then
a call, not a third copy of an argument that took a bug to get right.

What is NOT generalised: `resolvedDeliverableStateKey` and `resolvedTestStateKey` stay two
one-line functions. They are read by name at a dozen call sites and a
`resolvedSecondaryKey(settings, 'test')` would make every one of them worse.

### The collision exemption stops being a pair

`configProblems` lets exactly one pair share a key today — `['state', 'deliverable state']`
— tested as *this many users and all of them these*. A third workflow makes that shape
wrong in a way that fails closed rather than open, which is why it needs saying: with
`status` shared by all three, the key has three users, the length test fails, and the view
reports a collision that **blocks every write**.

So the exemption becomes a SET question: a key is exempt when **every** label using it is
a workflow-state label. Its existing comment's warning survives unchanged and is what the
new shape must keep true — one more label on the key (order, tags, an axis key) reports as
a collision again, these three named in it like any other clash. The reasoning behind the
exemption is unchanged too: the workflows keep independent vocabularies whatever they
share, so the usual reason a shared key is a mistake never applies.

Sharing by FALLBACK still never reaches this map at all, because `ownedProperties` reads
the RAW keys and an unbound one resolves to `''` — which is the default configuration, so
the common case is untouched either way.

### The vocabulary

`collectObservedTestStates` is `collectObservedDeliverableStates`'s mirror, and mirrors
its one non-obvious decision: **scope before the walk, not after**. The Deliverable's
filters `isDeliverableType` first so a non-Deliverable's coincidental value in the shared
key cannot mint a stray column; the test's filters `inCatalog` first for the identical
reason, which matters more here because the key is shared by default.

That filter is redundant for the one caller this change adds — the catalog's population
holds catalog members and context rows and nothing else — and it is still where the
correctness lives. A collector is correct over the list it is handed or it is correct by
luck: `vocabularyOf`'s guarantee is about the POPULATION, and the next caller to pass a
mixed list is exactly the one that would find out.

`VocabularySource` gains `ladder: string[]` and `testStateValue`. That is legitimate:
`vocabularyOf` runs on `BacklogItem[]`, where the ladder is assigned, and the structural
shape exists precisely so a collector can name the fields it depends on.

`vocabularyOf` in `model.ts` currently calls `collectObservedStates` for whichever
population it is handed. It gains one parameter — which workflow this population's states
come from — supplied by `projectionForest`'s two call sites, which are the two places
that already know which projection they are computing. The plan's population keeps
`collectObservedStates`, so a Deliverable in the plan keeps contributing its shared-key
value exactly as it does today; nothing about the plan's vocabulary moves.

### What follows without being written

The chip, `Set state`'s offers, its checkmarks and `pbl-done` on a row all read
`ownWorkflowReading` or `stateKeyFor` already. They start honouring the test workflow
because those two functions changed, which is the whole reason the rule lives in two
places.

## 2 · The `Test management` group

Three controls, mirroring `deliverablesGroup` minus its colour section:

- `testStateProperty` — *Test state property*
- `testStateValues` — *Test workflow states (in order)*, placeholder `Draft, Ready,
  Approved` — a vocabulary about whether a case is fit to be WALKED, deliberately not the
  plan's `New, Active, Done` and deliberately not `Pass, Fail`, which would be a result
  and the epic refuses those. A placeholder suggests; it configures nothing
- `testDoneValues` — *Test states that count as done*

**No per-state colour boxes**, and the consequence is recorded rather than discovered:
`stateColors` is keyed by the state VALUE, so a test state spelled the same as a
requirements or Deliverable state already picks up that state's colour — it is one
setting either way. What a test-ONLY state gives up is the override; it takes the
positional colour its place in the ordered list earns, which is what every state had
before per-state colours existed. `colourProblem`'s allowed key set therefore stays
`states ∪ deliverableStates` and does **not** gain `testStates`: adding it would permit a
`stateColor.<test state>` key that nothing renders.

## 3 · The badge

`Test suite` keeps orange (Epic's). `Test case` takes **cyan** (Milestone's). Both keep
the test axis.

The criterion is `A badge when the palette is full`'s own — *not whichever looks least
crowded, but the one whose existing wearer a test is least likely to sit beside* — and
cyan wins it: a `Milestone` is a marker with no rung, no children and no parent, drawn as
a line on the timeline, and it can never be a catalog member. The two cannot co-occur
where a test case is actually read. They can meet in the plan tree, where a test case
appears only as an advisory mis-drag.

Two things this changes about what the stylesheet claims:

- The documented sharing goes from **one pair to three** — Idea + Task on yellow, Epic +
  Test suite on orange, Milestone + Test case on cyan. The comment in `styles/badges.css`
  currently reads *"nine badges, eight theme tokens, so one pair has to share"*. It
  becomes the rule the register asked for rather than a count that will be wrong again at
  the twelfth type: **hue is identity; where two types share one, the test axis or the
  icon separates them, and which pair shares is a decision recorded here.**
- The axis stops being a bonus signal and becomes load-bearing. With both test types on
  one hue it merely reinforced the icon; now it is what distinguishes a `Test case` from
  a `Milestone`, so `A badge when the palette is full`'s guarantee *"no two types are
  distinguishable by icon alone"* depends on it for two pairs where it depended on it for
  none.

## Testing

**`test/domain/`** — the selector, asked of the three rows that get it wrong differently:
a typeless child of a `Test suite` (raw type and effective type disagree), a `Task` under
a `Test case` (a plan type name on a catalog member), and a `Deliverable` (the other
secondary workflow, which must be unaffected in both directions). The vocabulary split
both ways: a test on a state no plan row carries is offered to another test and to no
plan row, and the mirror. The resolver's fallback ladder — unbound key shares `stateKey`
and the requirements EFFECTIVE done list; an own distinct key with no lists of its own
takes the shipped defaults and never the requirements customization.

**`test/view/`** — the chip and `Set state` in the catalog offering the test vocabulary
and checking the test workflow's current value; the plan's chip and menu unchanged by any
of it; a test whose state is done wearing `pbl-done` while the catalog's completed toggle
stays absent and nothing hides.

**`test/domain/backlogReadme.test.ts` / `test/docs/`** — the generated README and the
register gate, which both read the vocabulary and the option list.

**Not testable here, and named rather than assumed:** whether the group reads correctly
in Obsidian's own options pane, and whether cyan and orange with the test axis are
actually distinguishable in a real theme. `npm run harness` answers the layout half of
the badge question and is explicitly not evidence about colour (ADR 0020). Both belong on
the smoke-test checklist beside the existing `typeFolder.test suite` question.

## Out of scope

- The completed toggle in the catalog, and suite rollups. Both stay withheld; `3c` in
  `Tests stay out of the plan` priced the rollup pass and declined it, and that reasoning
  is untouched by tests having states.
- A board for the catalog. The test workflow gives it columns it could have; nothing here
  builds them.
- Test results — pass, fail, run history. The epic refuses them and this changes nothing
  about that: a state is what a case IS, not how it last ran.
