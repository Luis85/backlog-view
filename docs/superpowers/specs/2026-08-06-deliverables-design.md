# Deliverables — a rootable extra type, and a board of its own

**Date** 2026-08-06
**Delivers** two PBIs, both registered before this increment (see Register work):
`[[Deliverables as a rootable extra type]]` under `[[Work item hierarchy]]`, and
`[[A board scoped to Deliverables]]` under the new `[[A Deliverables board]]` Feature
(sibling of `[[Columns from the workflow]]` under `[[Product Kanban]]`).

## Why this increment, and why now

Teams using this backlog need to track concepts, designs and other artifacts a team must
*produce*, distinct from the requirements ladder (Epic → Feature → PBI → Task): a
deliverable is not a plan for work, it is a thing the work makes. It can relate to a
Feature or PBI, or stand alone — a style guide, a research write-up, nothing forces it
under a requirement. And its review process (say Concept → Draft → Review → Published) is
not the same shape as the requirements board's workflow (say Backlog → Active → Done), so
forcing both through one `stateValues` list means either the list grows to describe two
unrelated processes at once, or Deliverables borrow a workflow that doesn't fit them.

`Issue` and `Bug` already prove the "pinned rank, holds Tasks, sits beside the ladder"
shape works (`[[Types beside the ladder]]`). `Deliverable` reuses that shape wholesale
and adds exactly one capability neither has: creatable with **no parent**, because unlike
a defect a deliverable does not necessarily concern anything already in the tree.

## Scope

**In:**
- `Deliverable` joins `EXTRA_TYPES`: pinned at `EXTRA_TYPE_RANK`, `Task` children, valid
  under `Epic`/`Feature`/`PBI` — and, like every `EXTRA_TYPES` member, already creatable
  at the top level today through the toolbar's "pick another type" menu (confirmed
  against `renderToolbar`, see Architecture §1 — this corrects the first draft of this
  spec, which wrongly attributed root offering to `childTypeChoices`).
- Its own folder (`typeFolder.deliverable`, default `deliverables`), badge and icon —
  the shipped opinion every declared type gets.
- A fourth board projection, `Deliverables`, alongside Tree/Board/Roadmap: cards are
  every `Deliverable`-typed result, columns come from a **separate** workflow (its own
  state property, ordered states, done values) configured in a new "Deliverables"
  view-options group.
- A move on that board (drag, Alt+arrow, card menu) writes only the Deliverable state
  property, through the existing write gate and undo history.
- Every other property a Deliverable might carry — `parent`/`order`/`type`, tags, the
  roadmap's horizon/start/target — is the same property every other type already uses.
  Nothing new is invented for those; a Deliverable is a first-class citizen of the tree
  and the roadmap with zero extra code there.

**Out (explicitly, per the scoping conversation):**
- WIP limits, column policies, and started/finished date stamps on the Deliverables
  board. The requirements board carries all three; this one ships with columns and a
  workflow only. Each is additive later without reshaping anything here, because it
  would reuse the same `OptionalField`/per-state-key machinery the requirements board
  already uses — just keyed by a `deliverable` prefix instead of the bare one.
- A separate roadmap axis, folder-mode rule, or tag property for Deliverables — the
  existing ones already apply, unmodified.
- Enforcing the type on drops or writes. Like every other type here, the rules are
  advisory (`[[The type rules are advisory, never enforced]]`, ADR 0009): nothing stops
  a Deliverable being dragged anywhere, or a non-Deliverable being hand-typed onto the
  Deliverables board's folder.
- A dedicated `.base`/example vault change. The two new backlog notes describe the
  feature; wiring `docs/Product Backlog.base` to open a second, Deliverables-scoped view
  is a follow-up, not a precondition — the toggle works in any base with the type and
  the new view options configured.
- "Show completed items" on the Deliverables board (added during review — see
  Architecture §4). It would need its own rollup over the Deliverable workflow, the same
  shape of cost already ruled out for WIP limits/policies/stamps; every Deliverable
  result renders regardless of either workflow's done state, narrowed only by the quick
  filter.

## Architecture

### 1. Type vocabulary — `src/domain/settings.ts`, `src/domain/itemTypes.ts`

`EXTRA_TYPES` gains `'Deliverable'`. `DEFAULT_TYPE_SUBFOLDERS` gains
`deliverable: 'deliverables'`. Both `ALL_TYPES` and the per-type folder options in
`viewOptions.ts` are already generic over the vocabulary (`ALL_TYPES.map(...)` in
`newItemsGroup`), so they need no change — this is the same "free" reuse
`[[Milestones as their own type]]` documents for the same reason.

**Root creation needs no `itemTypes.ts` change at all — corrected from the first draft.**
That draft assumed `childTypeChoices(null)` gates what the top-level **+** offers, the
way it gates a row's own **+**. It does not: `renderToolbar` (`view/render/toolbar.ts`)
wires the top-level creator itself, and its "pick another type" menu already iterates
`ALL_TYPES` unconditionally, calling `promptCreateItem(host, [type], null)` for every
declared name — `Issue` and `Bug` are already offered at the root there today, a fact
this spec had not traced before its first draft. So the moment `Deliverable` joins
`EXTRA_TYPES`, that menu offers it at the root for free, with **zero** view-layer change.

`childTypeChoices(null)` governs something narrower and unrelated to that menu: only
`domain/backlogReadme.ts`'s generated-README root detection reads it
(`childTypeChoices(null).includes(typeName)`, in `parentsOf`). Adding `Deliverable` to
its top-level branch is a one-line, **documentation-accuracy-only** change — it makes
the generated README's **table** correctly describe a Deliverable as able to have no
parent. Whether to make it is folded into Acceptance criteria below rather than called
out as a UI mechanism.

**That table isn't the only prose reading `EXTRA_TYPES` there — missed in the first
correction.** `typeSection`'s opening paragraph (`backlogReadme.ts`, the sentence above
the table) interpolates the whole `EXTRA_TYPES` list into one uniform claim: "`Issue` and
`Bug` sit beside it — they hang from any rung above the deepest." Once `Deliverable`
joins that list the sentence is no longer true of all of it — it also hangs from
nothing at all — so fixing the table alone leaves the paragraph directly above it
contradicting it. The generator needs to read the same root-capability question the
table already asks (`childTypeChoices(null).includes(t)`) rather than assume every extra
type answers alike, and say so: something in the shape of "`Issue` and `Bug` sit beside
it — they hang from any rung above the deepest… `Deliverable` is the same shape, but may
also stand alone with no parent." A generated document contradicting itself between one
paragraph and the table beneath it is exactly the failure mode `docs-check.mjs`'s own
"counted, not merely found" rule (root `docs/README.md`, rule 6) was written to catch in
this repository's own register — the same principle applies to a register this plugin
generates for someone else's vault.

Everywhere else `Deliverable` is matched by the existing `isExtraType` — no second
predicate, unlike `Milestone`'s `isMarkerType`, because a Deliverable's
rank/children/hangs-from rules are exactly `Issue`/`Bug`'s.

`src/view/render/rows.ts`'s badge table gains a `deliverable` entry (icon + badge
class), and `styles/badges.css` gains the colour — the same "no fallback for a declared
type" table `[[Milestones as their own type]]` already relies on to fail loudly if
forgotten.

### 2. The second workflow — `src/domain/settings.ts`, `src/domain/viewOptions.ts`

A new `OptionalField`, `'deliverableState'`, joins `PROPERTY_TABLE`:

```ts
deliverableState: {
  option: 'deliverableStateProperty',
  suggested: 'deliverableStatus',
  label: 'deliverable state',
  settingsKey: 'deliverableStateKey',
},
```

This is the same table `horizon`/`start`/`target` already extended for the roadmap axis
— joining it means `configProblems`, `adoptableProperties` and the backfill's stubs all
cover the new property for free, with no new code in any of those four readers.

Two plain list fields join `BacklogSettings` beside it, mirroring `states`/`doneValues`:
`deliverableStates: string[]` (default `[]`, falls back to observed values exactly as
`stateMenuValues` does) and `deliverableDoneValues: string[]` (default
`DEFAULT_DONE_VALUES`, same shipped default as the requirements board's). A new
"Deliverables" group in `getViewOptions` exposes the three: the state property picker
(`optionalPropertyOption('deliverableState', 'Deliverable state property')`), the
workflow states text box, and the done values text box — no WIP limit or policy boxes,
per Scope.

### 3. Model — `src/domain/model.ts`

`BacklogItem` gains `deliverableStateValue: string | null`, and `BacklogModel` gains
`observedDeliverableStates: string[]`, built in `assignAll` the same way `stateValue`
and `observedStates` already are — a second, parallel field rather than a generalized
loop, matching how `plannedStart`/`plannedTarget`/`horizon` are already three separate
fields rather than one map. This is a deliberate non-abstraction: the model already has
precedent for "one field per optional property," and a generic loop over "state-like
fields" would touch a tested, working phase for one caller.

### 4. Columns — `src/domain/board.ts`

`boardColumns` currently reads `settings.stateKey`, `stateMenuValues(settings, ...)`,
`settings.doneValues`, `settings.wipLimits` and `settings.columnPolicies` directly. It
becomes parametrized over a small `Workflow` shape instead:

```ts
interface Workflow {
  stateOf(item: BacklogItem): string | null;
  values: string[];          // stateMenuValues' result — the configured list, or the
                              // observed⋃done fallback when nothing is configured
  observedValues: string[];  // the RAW observed values, always — corrected below
  doneValues: string[];
  wipLimits: Record<string, number>;   // {} for the Deliverables board
  columnPolicies: Record<string, string>; // {} for the Deliverables board
}
```

**`observedValues` is not redundant with `values` — corrected from the first draft**,
which precomputed only `values` and dropped this. `workflowColumns` today does two
things with the observed set, not one: `stateMenuValues` folds it in only as a
*fallback* (when no `stateValues` are configured); separately, and unconditionally, it
walks `model.observedStates` a second time to mint a stray column for any observed value
the configured list didn't already name — the "never lose a card to an unmapped status"
guarantee. A `Workflow` carrying only `values` cannot reproduce that second pass once a
workflow *is* configured, since at that point `values` no longer contains the observed
set at all. Both call sites pass their own raw list — `model.observedStates` for the
requirements board, `model.observedDeliverableStates` for the Deliverables board — so
`boardColumns`' stray-column pass reads `observedValues` exactly where `workflowColumns`
reads `model.observedStates` today, unchanged in behavior for the requirements board.

The requirements board's call site builds this from `settings.stateKey` /
`item.stateValue` / `model.observedStates`, unchanged in behavior. The Deliverables
board's call site builds it from `settings.deliverableStateKey` /
`item.deliverableStateValue` / `model.observedDeliverableStates`, with empty
`wipLimits`/`columnPolicies`. Card population for the Deliverables board additionally filters to
`item.typeName?.toLowerCase() === 'deliverable'` — a plain type-name match, not
`isExtraType` (which also matches `Issue`/`Bug`). One implementation, two callers, zero
duplicated column logic — this is the reuse the scoping conversation asked for ("we
don't need extra logic for properties we already track").

**The candidate set is also a parameter now, not `boardColumns`' own
`model.focused ? model.roots : model.results` — corrected from the first draft**, which
left that internal and assumed it would just work for a type-filtered call too. It does
not, for two compounding reasons traced against `model.ts`: under an active hierarchy
focus, `model.roots` is the synthetic top row *at the focus level* (e.g. every `Feature`,
if focus is `Feature`), so filtering it to `Deliverable` finds nothing even when
Deliverables sit nested inside that very subtree; and `model.results` itself is already
narrowed to the focused subtree by that point (`buildModel`'s `shown()` re-derives it
from `assignVisualDepth(focusRoots)`), not the whole base. The fix is not "make
Deliverables immune to focus" — that would make this board inconsistent with the tree
and the requirements board, which are *both* already scoped by an active focus, and
narrowing this board's own promise below is what stays honest instead of building around
that. The requirements board's call site keeps passing
`model.focused ? model.roots : model.results` exactly as today (unchanged); the
Deliverables board's call site always passes `model.results` — never `model.roots`,
which a type filter over cannot reach a nested match through — so it shows every
Deliverable *`model.results` currently contains*, focused or not, which is what
`boardColumns` can promise honestly.

**Population also needs to stop consulting `item.subtreeDone` for this board — a gap the
first draft's "regardless of what any other property holds" phrasing papered over.**
`host.isRowHidden`/`isRowHiddenUnfiltered` — what the requirements board passes as
`visible`/`population` — hide a fully-done subtree under "Show completed items", and
"done" there is `item.subtreeDone`, a rollup built once over the *requirements*
workflow's `stateValue`/`doneValues` (`assignAll` in `model.ts`). Reusing that predicate
verbatim would hide a Deliverable whenever its **unrelated** requirements-board state
happens to read as done — exactly the coupling this feature exists to avoid. Building a
second, Deliverable-scoped `subtreeDone` rollup is real, non-trivial work (another
descendant walk, another rollup field) for a control (`showCompleted`) this board has
not been asked for — the same shape of cost that ruled out WIP limits, policies and
stamps in Scope. So, added to Scope/Out below: **the Deliverables board does not honor
"Show completed items"** in this increment; every Deliverable result renders regardless
of either workflow's completion state, and only the quick filter narrows it. The
population predicate is the filter check alone, not the full `hidden()` — a new, small
variant (or a second parameter on it) rather than the two existing flags.

### 5. Writes — `src/domain/writePlan.ts`, `src/storage/frontmatter.ts`

`ItemWrite` gains `deliverableState?: string` and `removeDeliverableStateKey?: boolean` —
the same dedicated-pair shape `state`/`removeStateKey` already has, not `AxisWrite`'s
generalized shape. `AxisWrite` exists because `horizon`/`start`/`target` share a writer
for span/date semantics that don't apply here; a state-like field with no stamps is
simpler as its own pair, matching precedent rather than reusing a mechanism built for a
different problem.

```ts
export function computeDeliverableStateWrites(
  item: BacklogItem,
  state: string | null,
): ItemWrite[] {
  if (sameValue(item.deliverableStateValue, state)) return [];
  return [state === null
    ? { file: item.file, removeDeliverableStateKey: true }
    : { file: item.file, deliverableState: state }];
}
```

No `settings`/`today` params, deliberately — no stamp logic to consult, per Scope.
`frontmatter.ts` applies and captures the new fields through
`optionalKeyFor(settings, 'deliverableState')`, following the exact lines that already
apply/capture `state`/`removeStateKey` (`applyWrites`, `touchedKeys`,
`captureInverses`), so undo/redo work identically with no new capture logic.

### 6. View — `src/view/host.ts`, `src/view/render/projections.ts`, `src/storage/collapseStore.ts`, the render/interaction layer

**The content dispatcher needs its own explicit branch — missing entirely from the
first draft, and the most severe of the three gaps this round found.**
`renderProjectionContent` in `render/projections.ts` is the ONE place that decides what
actually draws into the pane, and today it is a closed three-way fork: `'board'` →
`renderBoardContent`, `'roadmap'` → `renderRoadmapContent`, **everything else** →
`renderTree`. Adding `'deliverables'` to the `Projection` union changes nothing here by
itself — every other file in this design could be built correctly and the toolbar's
fourth toggle would still draw the *tree*, with a `deliverablesBoard` snapshot computed
and never shown. `renderProjectionContent` needs a third branch,
`renderDeliverablesBoardContent`, mirroring `renderBoardContent`'s shape exactly: gate on
`settings.deliverableStateKey` (empty → `renderBoardNoWorkflowState`-style guidance, a
Deliverables-flavored variant of it, not a blank pane), otherwise render the board and
return it as the `board` snapshot with a `listbox` role. This is the one change in the
whole design a passing test suite could not catch without a `view/`-level test actually
asserting on the fourth toggle's rendered content, which is why that assertion is called
out explicitly in Testing below rather than folded into "toolbar coverage."

`host.projection` gains `'deliverables'`. **Persistence needs its own change, missing
from the first draft**: `storage/collapseStore.ts` stores the projection as a `mode`
string validated against an allowlist (`readEntry`'s `readEnum(record.mode, [BOARD_MODE,
ROADMAP_MODE])`) — a third value is silently dropped on read today, since nothing names
it. This needs a `DELIVERABLES_MODE` constant beside `BOARD_MODE`/`ROADMAP_MODE`, added
to that allowlist, and `view/collapseState.ts`'s `CollapseState.projection()` (plus its
write-back counterpart) mapping `'deliverables'` to and from it — the same round trip
`'board'`/`'roadmap'` already get. Without this, picking the Deliverables board would
silently revert to the tree on reopen, exactly the gap `[[Milestones as their own type]]`'s
own landmines list warns this codebase to check for on every new declared value
threaded through a stored enum.

`performDeliverablesBoardMove(item, state)` is
the one path for the drop/Alt-arrow/menu trio, following "one move, three inputs" — a
new method because the write target differs from `performBoardMove`'s, even though both
ultimately call a `computeXWrites` + `applySafely` pair.

**`render/board.ts`'s card shell is not quite "reused as-is" — corrected from the first
draft.** `createCard` hardcodes its `pbl-done` class from `item.done`
(`src/view/render/board.ts:230-236`), which is the requirements workflow's completion —
so a Draft Deliverable that happens to read Done on the *requirements* board would render
dimmed as finished here, and a Deliverable finished only in its own workflow would not
render as finished at all. `BacklogItem` gains `deliverableDone: boolean`, computed in
`assignAll` beside `item.done` the same way `deliverableStateValue` is computed beside
`stateValue` (§3), and `createCard` takes the completion flag as a parameter instead of
reading `item.done` itself — defaulted to `item.done` so the two existing call sites
(requirements board, roadmap) need no change, with the Deliverables board's call site
passing `item.deliverableDone` explicitly. `renderCardBody`/`wireCardActivation` are
unaffected; only the one class computation moves.

**`interactions/menu.ts`'s card menu needs three changes, not one — corrected from the
first draft**, which said only that the Set-state *choices* should source from whichever
board is active. Traced against the file: the section's own visibility gate
(`if (host.settings.stateKey) addSetStateMenu(...)`, `menu.ts:70`) checks only the
requirements key, so on a card viewed from the Deliverables board it would stay hidden
whenever `stateKey` is unconfigured, even with a Deliverable workflow fully set up;
`chooseState` (`menu.ts:305-311`) branches to `performBoardMove` only on
`host.projection === 'board'`, falling through to `computeStateWrites` — a write to the
**requirements** key — for `'deliverables'`, meaning an unfixed menu would write to the
wrong property, not merely display wrong; and `addStateItems`'s checked-entry logic
(`menu.ts:323-327`) calls that same `computeStateWrites` unconditionally to decide which
entry is checked, so it would check against `item.stateValue` rather than
`item.deliverableStateValue`. All three need a `'deliverables'` branch mirroring the
existing `'board'` one: the gate reads whichever key is active for
`host.projection`, `stateChoices` sources `host.deliverablesBoard?.board` the way it
already sources `host.board?.board`, `chooseState` routes to
`performDeliverablesBoardMove`, and the checked-entry test calls
`computeDeliverableStateWrites` instead of `computeStateWrites` on that branch.

The toolbar gets a fourth toggle position. `CardDragController` gets a third set of
column drop targets (mirroring the board's, writing through
`performDeliverablesBoardMove`); `interactions/keyboard.ts` extends the Alt-arrow ladder
to the new projection.

The empty-state rule matches the requirements board's: `[[Columns from the workflow]]`
already establishes that a board needs a configured state property before it draws
columns; the Deliverables board gates on `deliverableStateKey` the same way.

## Testing

- `domain/`: `itemTypes.test.ts` (rootable top-level offering, extra-type rank/children
  unchanged), `settings.test.ts` (the new `OptionalField`, list defaults),
  `board.test.ts` (the parametrized `Workflow` and candidate set, both call sites, no
  cross-contamination between the two workflows' columns; a Deliverable nested inside a
  focused Feature/PBI subtree still renders as a card; a Deliverable whose *requirements*
  state is done still renders), `writePlan.test.ts` (`computeDeliverableStateWrites`, no
  stamps emitted).
- `storage/`: `frontmatter.test.ts` — apply/capture/undo for the new fields, including
  the compare-and-swap restore path `applyRestores` already exercises for `state`; and
  `collapseStore.test.ts` — the Deliverables mode round-trips through `readEntry`'s
  allowlist exactly as `board`/`roadmap` already do, and a legacy stored value untouched
  by this change still reads back unchanged.
- `view/`: **an assertion that the fourth toggle actually renders the Deliverables
  board**, not just that `host.deliverablesBoard` was computed — `renderProjectionContent`
  is where a correct model can still draw the wrong thing, so this is the one case
  worth a dedicated test rather than folding into toolbar coverage. `menu.test.ts` —
  the Set-state section appears on a Deliverables-board card when only
  `deliverableStateKey` is configured (not `stateKey`), its checked entry reflects
  `deliverableStateValue`, and picking one writes `deliverableState` alone — a
  regression test standing in for the "wrong property" failure mode this round of
  review caught before any code existed to catch it in. `rendering.test.ts` — a card's
  `pbl-done` class follows the active board's own completion, not the other workflow's.
  Plus a `contextCardWrites.test.ts`-style block for the Deliverables board (context row
  never a card, never a write target — the same three questions asked of the general
  board's drag/keyboard/menu paths), and keyboard coverage for the fourth projection.

## Open questions carried into the plan, not blocking it

- Exact badge icon/colour for `Deliverable` (proposing `package`, an unused colour slot)
  — a one-line decision at implementation time, not a design fork.
- Whether `docs/Product Backlog.base` should grow a second, Deliverables-filtered view as
  a shipped example once this lands — left for a follow-up, per Scope.
