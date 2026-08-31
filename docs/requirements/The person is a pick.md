---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 20
status: Open
created: 2026-08-31
source: user request, 2026-08-31
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# The person is a pick

**As** the contributor who registers this view against a `.base` for the first time,
**I want** it to read its own type, parent, order, assignee and state properties — never
borrow the backlog view's saved choices — **so that** two views open on the same vault
can legitimately point at two different schemes, and everything downstream (the tree,
the picker, the one write this surface offers) is built against settings that already
tell the truth about what is bound and what is not.

## Use case

| | |
| --- | --- |
| **Actor** | The my-work view's own configuration surface — Bases' options panel, and the code that reads the stored config back |
| **Trigger** | Bases asks this view for its options panel, or resolves the view's stored config into settings before every render |
| **Preconditions** | None — this is the view's options bag, resolved before a model can be built or a note opened |
| **Guarantee** | `getMyWorkViewOptions` offers a type, a parent, an order, an assignee, a state, a done-values list, the Deliverable and test workflows' own state properties and done-values lists, the started-states vocabulary, the started/finished stamp pair and the open-target dropdown — each key exactly once. `resolveMyWorkSettings` reads each back into a `MyWorkSettings`, telling a property the reader cleared from one nobody has touched: the three model mappings and the assignee/state pair keep the backlog view's own suggested keys until cleared, the Deliverable and test workflows' own keys fall back to the requirements `stateKey` exactly the way the backlog view's own `resolveSettings` falls back for the same two workflows, and a cleared one resolves to `''`, never back to the suggestion. |

**Main flow**

1. Bases calls `getMyWorkViewOptions` to draw this view's own options panel — never the
   backlog view's, even though the two happen to offer the same suggested keys for the
   type, parent, order, assignee and state properties — `type`, `parent`, `order`,
   `assignee` and `status` (the state property's own suggestion, sourced from the same
   `PROPERTY_TABLE` the backlog view reads, never re-typed as the field's own name).
2. The reader leaves the three model mappings at their suggested keys, or points them at
   whatever properties this vault actually uses for hierarchy.
3. The reader names an assignee property (so the view knows whose work this is) and,
   optionally, a state property, a done-values list and the started-states vocabulary.
4. `resolveMyWorkSettings` turns the stored config into one `MyWorkSettings`, which is
   the only settings shape every other module in this Feature reads.
5. When this view's own write path (Task 9) marks a note done, it stamps the same
   frontmatter keys a backlog-view write would — because they were resolved here, not
   invented at the point of the write.

**Extensions**

- **2a — the assignee property is cleared.** `assigneeKey` resolves to `''` rather than
  back to `assignee`; the view has no way to know whose work it is showing, which is a
  state a later task's empty screens must answer for, not this one.
- **3a — no state property is named.** `stateKey` is `''`, `doneValues` still resolves
  (to the shipped default when the box is untouched), and nothing here decides what an
  unconfigured state property means for the tree — that reading belongs to this
  Feature's own domain module for the tree itself (Task 2 of [[Assigned work in the
  sidebar]], not yet written).
- **3b — done values, or the started-states list, are left blank.** `doneValues` falls
  back to `DEFAULT_DONE_VALUES`; `startedStates` falls back to an empty list, exactly as
  the backlog view's own `resolveSettings` does for the same two keys.

A design decision, recorded here because this is where the behaviour is specified: the
brief for this task bound only `parentKey`/`orderKey`/`typeKey`/`assigneeKey`/
`stateKey`/`doneValues`/`openIn`. That leaves the started/finished stamp keys and the
started-states vocabulary unresolved, and this Feature's write path (Task 9) cannot
stamp a `finished` date without them. `MyWorkSettings` was widened to include
`startedDateKey`, `finishedDateKey` and `startedStates`, resolved the same way
`resolveSettings` resolves them for the backlog view (`propKey` with an empty default
for the two date keys, `dedupe(list(...))` for the vocabulary), rather than leaving a
note marked done from this sidebar with different frontmatter than one marked done
from the backlog view. The three keys are `notePropsOnly` like every other property
option here, matching the backlog view's own definitions rather than inventing new
ones.

**Task 3b (added 2026-08-31, after a confirmed P1 on PR #234): the bag was widened again,
for a gap Task 2's own membership predicate opened.** `assignedRows`
(`domain/assignedWork.ts`) admits `inPlan(item) || inCatalog(item)`, so this view's tree
carries Deliverables and test-catalog rows (a `Test suite`, a `Test case`, and a `Task`
chained onto either) alongside plan items — but `ownWorkflowReading` (`domain/board.ts`)
reads a Deliverable's or a catalog member's done-ness through the DELIVERABLE and TEST
workflows, never through `stateKey`. With no way to bind those two workflows' own
properties, a vault that separates them from the requirements state property had every
Deliverable and test row read at the wrong key here — reporting a finished item as open,
which is wrong for both Hide done and the next-item marker on exactly the item types this
view's own widening admitted. `deliverableStateProperty`, `deliverableDoneValues`,
`testStateProperty` and `testDoneValues` join the bag to close it — the two property keys
`ownWorkflowReading` actually reads, plus the done-values list each needs to answer "is
this done" at all. Not the state-value LADDER (`deliverableStateValues`/
`testStateValues`): nothing this view builds yet reads a workflow's declared vocabulary —
that is a `Set state` menu's own question, and this surface has no such menu until a later
task writes one. Resolved through `resolveSecondaryWorkflow`, exported from
`settingsResolve.ts` for exactly this reuse, rather than a second, hand-written version of
"falls back to the requirements key and done values only when both are unconfigured": the
two views read the identical option keys, so sharing the function is what keeps their
fallback rule from drifting the moment either is edited.

`MyWorkView.draw()`'s own `planSettings` layering — already overriding six fields —
needs no fifth-through-eighth entry for these four, and that is a fact about THIS
function rather than a rule this task got to skip. The six existing overrides exist
because `resolveSettings`'s plain `propKey` cannot tell a cleared option from an untouched
one for those six, while `resolveMyWorkSettings` draws that distinction with
`clearablePropKey` and a real per-field default — so the two resolvers, called on the
same config, would genuinely disagree without the override. These four have no such
default to protect: `resolveSecondaryWorkflow` resolves them with plain `propKey` on
BOTH sides, the identical option keys, and the identical `fallback: defaultSettings()` —
so `resolveSettings(this.config)` above already computes the exact answer
`resolveMyWorkSettings` would. A first draft of this task added the four fields to the
override anyway, on the mistaken belief that omitting them would leave the new options
unreachable; review found that belief false (the two calls agree, so nothing was ever at
risk) and the untested extra scope was removed rather than kept and justified after the
fact.

## The pick itself, and where it lives

Task 4 of [[Assigned work in the sidebar]] registers the view this options bag describes
(`product-my-work`, `registerMyWorkView`) and gives it the one thing a saved view owes a
returning reader: which person's tree was on screen last stays on screen, across a close
and reopen of the same `.base`.

**The pick is device UI state, never a `.base` setting — ADR 0011's rule, stated here
because this is where it is spent a third time.** A `.base` file is shared: every teammate
who opens it sees the same saved view, the same options, the same filter. Which PERSON a
reader was looking at is not a fact about the base, it is a fact about that reader's own
working session — so it is written to the vault-scoped view-state store
(`storage/viewStateStore.ts`), keyed to this saved view's own identity, exactly the way
the release view's open release and the board's scoped iteration already are. `prefs.person`
is the third path-valued preference in that store (`PATH_PREFS`), which is what makes
renaming the picked `Resource` note keep the panel on the same person rather than
silently emptying it — `renamePathPrefs` walks all three the same way.

**An embedded base has no such identity, and the pick is session-only there rather than
absent.** `resolveViewIdentity` returns null for a base embedded in a note, and
`MyWorkView` reads that as "nothing to restore from" without ever writing `null` back —
assigning `null` in that branch would reset the pick on every ordinary Bases data update,
which arrives far more often than a reader would expect their choice to be forgotten.

## The toolbar

Task 8 gives this options bag and the pick above a way to be operated: a native
`<select>` over `namedTargets(model.resources)` for the pick itself, plus collapse-all,
expand-all and hide-done once somebody is picked.

The `<select>` rather than a menu of ours, for the same reason a later task in
[[Assigned work in the sidebar]] wants every control here to give way in a narrow pane:
it collapses to nothing on its own, and it is reachable by keyboard and screen reader
with no code here to get wrong. Its options are named the way every other surface in this codebase names a
resource — `namedTargets` (`domain/readItems.ts`), the basename for everybody and the
path-minus-extension for the pair that happens to share one — and the VALUE is always
the file's own path, never the label, so two people sharing a name still resolve to two
different picks.

Collapse-all and expand-all are withheld until somebody is picked: a control asking
about a tree that does not exist yet is worse than none. Hide-done is withheld a second
time, on `anyWorkflowConfigured` (`view/mywork/renderTree.ts`) — no requirements,
Deliverable or test workflow bound to a state property at all — the release scope
toolbar's own `release.done.unconfigured` gate (`view/release/scopeToolbar.ts`), asked
here of this view's settings rather than of one release row. Its ON/OFF reading comes
from `hidesDone`, the SAME function the tree's own hide-done pass reads
(`view/mywork/renderTree.ts`) — both exported for exactly this second caller, so the
toolbar can never disagree with the tree about what hiding means.

`MyWorkView.syncBusy` — until now an empty stub — publishes `aria-busy` on the whole
pane from the shared `WriteLock` (ADR 0030), the same question `ReleaseView.syncBusy`
and the estimation view's own ask: a sibling view's batch changes the very notes this
tree reads. No control here is disabled alongside it: every control this toolbar draws
touches only view state (a pick, a fold, the hide-done flag), never a note, so none of
them is a write a concurrent batch could corrupt. Task 9's own write control is what
will give `syncBusy` a second half.

## Acceptance criteria

- `getMyWorkViewOptions` declares `typeProperty`, `parentProperty`, `orderProperty`,
  `assigneeProperty`, `stateProperty`, `doneValues`, `deliverableStateProperty`,
  `deliverableDoneValues`, `testStateProperty`, `testDoneValues`, `startedStates`,
  `startedDateProperty`, `finishedDateProperty` and `openIn` — fourteen keys, each
  exactly once.
- `resolveMyWorkSettings` resolves `parentKey`/`orderKey`/`typeKey` to `parent`/`order`/
  `type` and `assigneeKey` to `assignee` when nothing is configured — the same
  suggestions the backlog view offers, read through this view's own option keys.
- A cleared `assigneeProperty` (or any other property option here) resolves to `''`,
  never back to its suggestion.
- `doneValues` falls back to `DEFAULT_DONE_VALUES` when unconfigured.
- `deliverableStateKey` and `testStateKey` resolve from an explicit
  `deliverableStateProperty`/`testStateProperty` binding, resolve to `''` when
  unconfigured or cleared (never back to a suggestion — sharing the requirements
  property by fallback is the default, not an adopted key), and `deliverableDoneValues`/
  `testDoneValues` resolve from an explicit binding or fall back to
  `DEFAULT_DONE_VALUES`.
- A Deliverable (or test-catalog member) carrying its OWN configured state property,
  distinct from the requirements one, reads as done through this view's resolved
  settings — the defect PR #234 found, closed at the resolver rather than only in the
  view's own layering.
- `startedDateKey`, `finishedDateKey` and `startedStates` resolve exactly the way the
  backlog view's `resolveSettings` resolves the same three keys, and are empty when
  nothing is configured.
- `openIn`'s dropdown default and `resolveMyWorkSettings`'s own fallback agree —
  `'split'` — so an unset pick opens where the box already says it will.
- `registerMyWorkView` registers `product-my-work` with `getMyWorkViewOptions` as its
  options and a factory that builds a `MyWorkView` over the shared `WriteLock`.
- `MyWorkView.pick` persists the chosen person's path to `prefs.person`, keyed to this
  view's own identity, and clears the roving row (a row selected in one person's tree is
  not where the next person's should start).
- Reopening the same `.base` (a fresh `MyWorkView` instance, same identity) restores
  `pickedPerson` from `prefs.person` before the first render.
- An embedded base — no view identity — keeps the pick in memory for the session and
  never resets it on an ordinary data update; it is gone once the base closes.
- Renaming the picked `Resource` note (or a folder above it) updates the stored
  `prefs.person` rather than leaving it naming a path that no longer resolves.
- With no assignee property bound, the stale model and settings from the last configured
  render are cleared rather than retained, so a write attempted against them is refused.
- The toolbar's `<select>` lists every `Resource` note the base returned, named through
  `namedTargets` — a shared basename told apart by path, everybody else by their own —
  and changing it calls `MyWorkView.pick`.
- Collapse-all and expand-all are drawn once a person is picked, and act on that
  person's own tree only.
- Hide-done is withheld with no requirements, Deliverable or test state property bound
  (`anyWorkflowConfigured`), and its ON/OFF reading and its effect on the tree never
  disagree — both read the same `hidesDone`.
- Every toolbar control survives the redraw its own activation causes: a keyboard user
  who picks a person, or presses collapse-all, expand-all or hide-done, lands back on
  that same control rather than on `document.body`.
- `MyWorkView.syncBusy` toggles `aria-busy` on the pane from the shared write lock,
  agreeing with every other view in the plugin about what a concurrent batch means.

## Where it lives

`src/domain/myWorkOptions.ts` — `getMyWorkViewOptions`, `resolveMyWorkSettings` and the
`MyWorkSettings` interface (`parentKey`, `orderKey`, `typeKey`, `assigneeKey`,
`stateKey`, `doneValues`, `deliverableStateKey`, `deliverableDoneValues`, `testStateKey`,
`testDoneValues`, `startedDateKey`, `finishedDateKey`, `startedStates`, `openIn`). It
reads `configReaders`/`resolveSecondaryWorkflow`/`DELIVERABLE_NAMES`/`TEST_NAMES` from
`src/domain/settingsResolve.ts` (the last three exported there for this reuse, Task 3b),
`notePropsOnly`/`optionalProperty` from `src/domain/optionalProperties.ts`,
`DEFAULT_DONE_VALUES`/`defaultSettings` from `src/domain/settings.ts`, and
`openTargetOptions`/`resolveItemHandling`/`defaultItemHandling` from
`src/domain/itemHandling.ts` — the same primitives every other view's options bag in this
codebase is built from. Nothing here renders or writes; this is the settings surface
every other module in this Feature (the tree, the picker, the write path) is resolved
against.

`src/view/mywork/myWorkView.ts` — `MY_WORK_VIEW_TYPE`, `MyWorkView`: the `BasesView`
that builds the model from this options bag, resolves and persists the picked person,
and draws the states that come before a tree (unbound assignee, an empty roster, nobody
picked yet). Its `draw()` layers six of this bag's fields onto `resolveSettings(this.config)`
before building the model, wherever the two resolvers could disagree (a cleared option
this bag's own `clearablePropKey` reports as unbound, that `resolveSettings`'s plain
`propKey` would still resolve to its default). Task 3b's four fields need no such
override: `resolveSecondaryWorkflow` resolves them identically on both sides (see the
Task 3b paragraph above), so `resolveSettings(this.config)` alone already carries them
correctly. Its `syncBusy` toggles `aria-busy` on `viewEl` from the shared `WriteLock`
(ADR 0030).

`src/view/mywork/toolbar.ts` — `drawMyWorkToolbar`: the person `<select>` (named
through `namedTargets`, `domain/readItems.ts`), and — once somebody is picked —
collapse-all and expand-all (`setAllFolds`, `view/scopeFolds.ts`) and hide-done
(`setScopeFlag`), withheld with `anyWorkflowConfigured` false. Reads `hidesDone` and
`anyWorkflowConfigured` from `view/mywork/renderTree.ts`, the tree's own gate, so the two
screens can never disagree about what hiding means. Its three buttons are drawn through
`src/view/scopeToolbarButton.ts` — `scopeIconButton`, one `clickable-icon` button with an
`aria-label`/tooltip pair from a single `label` — which this toolbar shares with
`view/release/scopeToolbar.ts` (fix round 1 on this task): the two toolbars' buttons were a
byte-for-byte duplicate, not two views converging on one pattern the way
`renderTree.ts`/`scopeTree.ts` and `myWorkView.ts`/`releaseView.ts` do, and `scopeIconButton`
lives directly under `view/` — `scopeFolds.ts`'s and `scopeKeys.ts`'s own reason — because
neither `release/` nor `mywork/` may import the other's directory.

`src/view/mywork/register.ts` —
`registerMyWorkView`, this view's own registration, composed behind the plugin's one
shared `WriteLock` in `src/main.ts` (ADR 0030). `src/storage/viewStateStore.ts` —
`prefs.person` in `ViewPrefs`, its `PREF_READERS` row and its `PATH_PREFS` entry, which is
what gives it the rename walk every other note-path preference here already has.
