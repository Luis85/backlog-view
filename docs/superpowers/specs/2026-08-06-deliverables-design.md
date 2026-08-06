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
shape works (`[[Types beside the ladder]]`). `Deliverable` reuses that shape wholesale —
**including root creation, which is not new here either**: the toolbar's top-level
creator has always offered every declared type with no parent, unconditionally (see
Scope and Architecture §1 below), so `Issue`/`Bug` could already be created rootless
before this increment touches anything. What `Deliverable` actually adds is its own
review workflow, per the paragraph above — nothing about where it may sit in the tree.

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
- A full second "declared vs. observed states" section in the generated README,
  mirroring `stateSection`/`readmeStates`/`unlistedDone` for the Deliverable workflow
  (added during review — see Architecture §2). The property-table **row** for
  `deliverableStateKey` is required (its absence makes the generated document's own
  claims false); a whole descriptive section about that workflow's vocabulary is
  additive documentation depth nobody has asked for, the same distinction WIP
  limits/policies/stamps already draw for the board itself.

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

**A fifth reader is not on that list and does not get it for free — missed until this
round of review.** `domain/backlogReadme.ts`'s generated-README property table
(`fieldRows`, `:126-152`) is hand-enumerated — one `if (settings.stateKey) rows.push(...)`
per property — rather than driven by `PROPERTY_TABLE`/`OPTIONAL_PROPERTIES` the way the
four readers above are, so it is not "the vocabulary" in the sense that paragraph in
`domain/CLAUDE.md` means and a field joining `OptionalField` does not put a row in this
table by itself. Left unfixed, a vault with `deliverableStateKey` configured would get a
generated README whose own words say "only the properties above are written" while a key
the board genuinely writes carries no row — the exact contradiction the `EXTRA_TYPES`
prose fix above exists to prevent, in a different function. `fieldRows` gains one more
`if (settings.deliverableStateKey) rows.push(...)` line, matching its existing pattern
(the horizon/start/target rows immediately above it in the same function) rather than
restructuring the function to read `OPTIONAL_PROPERTIES` generically — that
generalization would be a real improvement but is a wider change than this feature earns,
since `fieldRows` already carries the same manual shape for every property before this
one. **Out of scope, added here rather than assumed free**: a full second "declared vs.
observed Deliverable states" section mirroring `readmeStates`/`stateSection`/
`unlistedDone` for the requirements workflow. Its absence does not make any existing
sentence in the generated document false — unlike the property-table row, which is why
that one is required and this one is not — it only means the Deliverables workflow's own
vocabulary is less richly documented there than the requirements one's. The same
deferral this Scope section already makes for WIP limits, policies and stamps.

Two plain list fields join `BacklogSettings` beside it, mirroring `states`/`doneValues`:
`deliverableStates: string[]` (default `[]`, falls back to observed values exactly as
`stateMenuValues` does) and `deliverableDoneValues: string[]` (default
`DEFAULT_DONE_VALUES`, same shipped default as the requirements board's). A new
"Deliverables" group in `getViewOptions` exposes the three: the state property picker
(`optionalPropertyOption('deliverableState', 'Deliverable state property')`), the
workflow states text box, and the done values text box — no WIP limit or policy boxes,
per Scope.

### 3. Model — `src/domain/model.ts`

`BacklogItem` gains `deliverableStateValue: string | null` and `deliverableDone: boolean`,
and `BacklogModel` gains `observedDeliverableStates: string[]`.

**Wrong phase in an earlier draft, caught by review: `stateValue` and `done` are
computed in `addItem` — the `RawItem`/raw-frontmatter-read phase, `model.ts:267-289` —
not in `assignAll`, which runs two phases later.** `buildModel` calls
`collectObservedStates(linked.all, settings)` right after `linkAll`
(`model.ts:180`) and well before `assignAll` (`model.ts:183`) ever runs; the
collector can only see a field that phase already populated. `deliverableStateValue`
and `deliverableDone` are computed the same place `stateValue`/`done` are — in
`addItem`, alongside them — so `collectObservedDeliverableStates(linked.all, settings)`
sits beside `collectObservedStates` in `buildModel`, reading fields that already exist
by then. Built the same way `stateValue` and `observedStates` already are — a second,
parallel field rather than a generalized loop, matching how `plannedStart`/
`plannedTarget`/`horizon` are already three separate fields rather than one map. This is
a deliberate non-abstraction: the model already has
precedent for "one field per optional property," and a generic loop over "state-like
fields" would touch a tested, working phase for one caller.

**"The same way" is not quite true, and the difference matters — missed until this
round.** `collectObservedStates` (`domain/vocabulary.ts`) walks every loaded item and
skips only `outsideFilter` rows; a naive `collectObservedDeliverableStates` built the
same way would read `deliverableStateValue` off a PBI or a Bug too, if either happened
to carry that key. Since this board's candidate set is always narrowed to
`Deliverable`-typed results (§4), a stray value contributed by a non-Deliverable item
would mint a column no card could ever land in, and offer it as a Set-state target on a
card that could never check it. The new collector filters to `typeName?.toLowerCase()
=== 'deliverable'` **before** the first-seen walk `firstSeen` already does — one line
more than `collectObservedStates`, not a rewrite of it — and sorts open-before-done
against `deliverableDoneValues`, not `doneValues`.

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
fourth toggle would still draw the *tree*, with the board it should have shown never
computed at all. `renderProjectionContent` needs a third branch,
`renderDeliverablesBoardContent`, mirroring `renderBoardContent`'s shape exactly: gate on
`settings.deliverableStateKey` (empty → `renderBoardNoWorkflowState`-style guidance, a
Deliverables-flavored variant of it, not a blank pane), otherwise render the board and
return it as the **same `board` snapshot field** `renderBoardContent` already returns
(`ProjectionContent.board`), with a `listbox` role — there is no second field for it (see
the `host.board` reuse note under §6's write path below). This is the one change in the
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

**`performDeliverablesBoardMove` lives on `CardMoveController` (`src/view/cardMoves.ts`),
not as a standalone `computeXWrites` + `applySafely` pair on `host.ts` — corrected from
the first draft, which described the write without the controller that actually owns it.**
`host.performBoardMove` is a thin delegation to `CardMoveController.performBoardMove`,
which is itself three things, not one: it plans the write (`computeStateWrites`), it
reads the columns and the state being left *before* the write so the announcement can
name a column the refresh might delete (`this.host.board?.board`, `item.stateValue`), and
it calls a private `applyCardMove` that applies the pending CSS class, checks whether the
live write actually changed anything, and fires the announcement — the one place all
three of that method's responsibilities are implemented, per its own class doc comment.
Defining `performDeliverablesBoardMove` anywhere else means either reimplementing
`applyCardMove` a second time or silently dropping the pending-class/no-op/announcement
behavior the other two board-move-shaped methods (`performBoardMove`,
`performHorizonMove`) both get from it. It joins them as a fourth sibling method:

```ts
async performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
  const from = item.deliverableStateValue;
  const columns = this.host.board?.board;
  return this.applyCardMove(item, computeDeliverableStateWrites(item, state), () =>
    announceBoardMove(columns, item.title, from, state),
  );
}
```

**There is one `host.board` field, not two — corrected from an earlier draft that read
`this.host.deliverablesBoard` here.** `host.board` already holds whatever
`ProjectionContent.board` the last render produced (`backlogView.ts:494`,
`this.board = content.board`), and `renderProjectionContent` produces a non-null `board`
snapshot on exactly `'board'` and `'deliverables'` — null on `'tree'` and `'roadmap'`, and
also null on either board-shaped projection while its workflow is unconfigured. A second
`host.deliverablesBoard` field would have to be kept in step with that same rule by hand,
duplicating a distinction `host.board` already makes correctly by construction: whichever
board-shaped projection is active is the one whose snapshot is sitting in `host.board` at
read time, because nothing else writes that field. `performDeliverablesBoardMove` reads
`this.host.board?.board` for exactly that reason, not a second snapshot.

Reusing `announceBoardMove` as-is — it is already generic over columns/title/from/to, not
board-specific in any way the Deliverables board's columns would violate, so no new
announce function is needed. `interactions/cardDrag.ts`, `keyboard.ts` and `menu.ts` all
call `host.performDeliverablesBoardMove` (which `host.ts` continues to delegate to the
controller, mirroring `performBoardMove`'s own one-line delegation), so "one move, three
inputs" is one call to one controller method, exactly as it already is for the other two
board-shaped moves.

**`render/board.ts`'s card shell is not quite "reused as-is" — corrected from the first
draft.** `createCard` hardcodes its `pbl-done` class from `item.done`
(`src/view/render/board.ts:230-236`), which is the requirements workflow's completion —
so a Draft Deliverable that happens to read Done on the *requirements* board would render
dimmed as finished here, and a Deliverable finished only in its own workflow would not
render as finished at all. `BacklogItem` gains `deliverableDone: boolean`, computed in
`addItem` beside `item.done` — the raw-item phase, not `assignAll` — the same way
`deliverableStateValue` is computed beside `stateValue` (§3), and `createCard` takes the
completion flag as a parameter instead of
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
`host.projection`, `stateChoices` sources `host.board?.board` — already the right
snapshot for whichever board-shaped projection is active, per the `host.board` reuse note
above — `chooseState` routes to `performDeliverablesBoardMove`, and the checked-entry test
calls `computeDeliverableStateWrites` instead of `computeStateWrites` on that branch.

**A fourth spot in the same file has the same `=== 'board'` shape — found only after
three others already had. `addMatchSection`** (`menu.ts:248-253`), the card menu's
keyboard path to a quick-filter match hidden under a visible card
(`const board = host.projection === 'board' ? host.board?.board : null;`), returns early
whenever `board` is null — which it always is on `'deliverables'`, so a filtered match
under a Deliverable card would render as a `tabindex="-1"` link (per `render/board.ts`'s
`hiddenMatches` face) with no keyboard path to it at all, exactly the "found, counted,
impossible to get to" failure `view/CLAUDE.md`'s own board notes name as the reason that
link exists in the first place. Given four independent call sites in one file now
resolving "which board is active" the same way, this design introduces one small helper
rather than a fifth inline ternary — and because `host.board` is already the one field
holding whichever board-shaped projection's snapshot is current (never a second field to
branch on), the helper needs no projection check either: `activeBoard(host): BoardModel |
null` is simply `host.board?.board ?? null`. `stateChoices`, `addMatchSection`, and the
Set-state gate all call it in place of their old `host.projection === 'board' ? … : null`
ternary; `chooseState` still branches on `host.projection` itself, because that decision
is "which write to plan," not "which board to read." One function answering "which board"
is what stops a fifth spot from repeating this exact miss, which four independent
findings in one file is reason enough to no longer treat as coincidence.

**Four more gaps this round, all in code the first three drafts left untouched or
under-specified.** The pattern across all four is the same one the menu round found:
`render/board.ts` and its neighbors were built for exactly one board, and reach for that
board's specifics directly rather than through a parameter — so "reuse the card shell"
was true, and "reuse the rest of the render path unmodified" was not.

- **`renderBoard`/`renderColumn` hardcode `host.settings`, `host.performBoardMove` and
  `boardColumns`' requirements-scoped call internally** (`render/board.ts:19-42`, the
  drop wiring at `:123` calling `performBoardMove` directly) — not parameters today, so
  giving `CardDragController` "a third set of column drop targets" is not by itself
  enough: the renderer that builds those targets is the one hardcoding which move they
  perform. `renderBoard` takes the resolved `BoardModel` and a `move` callback as
  parameters instead of deriving both from `host` internally — `boardColumns`' result and
  `host.performBoardMove` for the requirements board, the same `host.board` snapshot
  (populated by `renderDeliverablesBoardContent` instead) and
  `host.performDeliverablesBoardMove` for this one — and `renderColumn` receives `move`
  from its caller rather than closing over `ctx.host.performBoardMove` directly. Left as
  first drafted, a **drag** on the Deliverables board would have written the
  requirements state key, the same failure mode the menu fix (above) closes for the
  other two inputs — drag is the third of the "one move, three inputs" trio and needs
  the identical fix, not a different one.
- **The board-mode CSS class is set by projection value, exactly, not by "is this a
  board-shaped pane"** (`backlogView.ts:468`,
  `this.viewEl.toggleClass('pbl-board-mode', projection === 'board')`). Missing a
  `'deliverables'` branch, the shared pane keeps the tree's `overflow-x: hidden`
  (`styles/tree.css`) and the tree's root drop zone, so the fourth toggle's columns would
  render clipped and partly unreachable even with every other piece correct. The
  condition becomes `projection === 'board' || projection === 'deliverables'` — one
  class, both board-shaped projections, since nothing about this board's *layout* differs
  from the requirements one.
- **The board's "nothing to show" advisory assumes the population and the base are the
  same size** (`renderBoardAdvisory`, `render/board.ts:84-91`): with every column empty,
  it reads `model.results.length` to choose between "no backlog items" and "all done and
  hidden" — a question that conflates "the base is empty" with "nothing matches this
  board's type filter." A base with fifty PBIs and zero Deliverables would report "50
  items are done and hidden," which is false on both counts (nothing is hidden by
  completion here — see the showCompleted exclusion above — and the fifty PBIs are not
  done, they are simply not Deliverables). The Deliverables board needs its own advisory,
  asking whether **`model.results` contains any Deliverable** rather than whether it is
  empty: no Deliverables anywhere → a new "No deliverables yet" guidance state (the
  `renderEmptyState` shape, scoped wording); filtering hides them all → the existing
  filter-empty state, reused as-is; nothing else lands on `renderAllDoneState`, since this
  board has no completion-hiding concept for it to describe.
- **"Show completed items" stays visible and clickable on a board it does nothing to**
  (`renderCompletedToggle`, `toolbar.ts:210`, gated only on `host.settings.stateKey`).
  Scoping the control's *effect* out of this board (Scope, above) does not scope the
  *button* out on its own — with the requirements `stateKey` configured, it would still
  render while viewing the Deliverables board, promising a hide/show it does not perform
  here. The gate becomes `host.settings.stateKey && host.projection !== 'deliverables'`.
- **The toolbar's own item count hardcodes the same requirements-only predicate this
  section just decoupled the board from — found by review, not by the earlier drafts.**
  `syncCountLabel` (`render/toolbar.ts:179-186`) runs on every render regardless of
  projection and computes `shown` as `model.results.filter((item) =>
  !host.isRowHidden(item)).length` — `isRowHidden` is `hidden(item, true)`
  (`backlogView.ts:307-343`), whose `hidingCompleted()` branch hides a fully-done
  *requirements* subtree. A Deliverable done only in the requirements workflow renders
  as a card on the Deliverables board (this section's whole point) while the toolbar
  simultaneously reports it hidden — "0 of 1" beside a visible card. The population
  predicate this section already had to invent for `boardColumns`' `visible`/
  `population` arguments (filter-only, never `hidingCompleted`) is exactly the rule
  `syncCountLabel` needs too, so it is exposed once rather than re-derived at the call
  site: `BacklogViewHost` gains `isRowHiddenByFilterOnly(item): boolean` — the quick
  filter alone, `this.filter.active && !this.filter.keeps(item.file.path)`, never
  `hidingCompleted()` — and `boardColumns`' Deliverables-board `visible` argument
  becomes `(item) => host.isRowHiddenByFilterOnly(item) === false && isDeliverable(item)`
  instead of a second inline predicate. `syncCountLabel` picks between the two by
  `host.projection === 'deliverables'`, the same test the completed-toggle's gate above
  uses.
- **The Alt-arrow ladder is the third input hardcoding the wrong move, not the second —
  missed in the previous round's own fix for the other two.** `handleBoardMoveKey`
  (`interactions/keyboard.ts:293`) calls `host.performBoardMove` directly, exactly the
  shape the menu and drag fixes above both had before this design named the pattern
  explicitly. "One move, three inputs" means what it says: a fix that changes two of the
  three and stops is exactly the failure the rule exists to prevent, so `handleBoardMoveKey`
  takes the same `move` callback `renderColumn` now takes (§6, drag), or branches on
  `host.projection` the way `stateChoices`/`chooseState` do (§6, menu) — either shape is
  fine as long as all three inputs share it, which the plan should verify explicitly
  rather than trust a description of "one move, three inputs" to have been applied
  uniformly by construction.
- **`handleBoardMoveKey` is unreachable from the Deliverables board in the first
  place — a second, upstream gap the fix above does not touch.**
  `handleProjectionKeydown` (`interactions/keyboard.ts:24-28`) is a closed three-way
  fork of its own, structurally identical to `renderProjectionContent`'s (§6, the
  content dispatcher): `'board'` → `handleBoardKeydown`, `'roadmap'` →
  `handleRoadmapKeydown`, **everything else** → `handleTreeKeydown`. Left as the rest of
  this section describes it, `'deliverables'` falls to the TREE handler — not merely a
  missing feature but an active hazard, since the tree handler's own Alt+arrows
  (`handleStructureKey`) reorder, indent and outdent, writing `parent`/`order` on
  whatever the tree considers selected. `handleProjectionKeydown` needs its own explicit
  `'deliverables'` branch to `handleBoardKeydown`, alongside and independent of the
  `handleBoardMoveKey` fix — the same two-dispatcher shape `renderProjectionContent` and
  `renderDeliverablesBoardContent` already have for rendering, now needed for keyboard
  too.

The toolbar gets a fourth toggle position.

The empty-state rule matches the requirements board's: `[[Columns from the workflow]]`
already establishes that a board needs a configured state property before it draws
columns; the Deliverables board gates on `deliverableStateKey` the same way.

### 7. The shipped user manual — root `README.md`

**Missed entirely until this round: every documentation fix so far was to a
*generated*, per-vault README (`backlogReadme.ts`) — the plugin's own shipped manual,
the root `README.md` a user reads on the plugin listing or in the repo, is a third,
separate, hand-written document this design had not touched.** It already carries
dedicated sections this feature makes incomplete the moment it ships: the type list
(`README.md:30-32`) names the vocabulary as "the extra types `Issue` and `Bug`… or
`Milestone`," with no `Deliverable`; "Issues and bugs sit beside the ladder"
(`README.md:306-354`) is a worked explanation of the extra-type shape with no mention of
a rootable member of it; the board's own section (from `README.md:499`) describes one
state property and one workflow; and the view-options table (`README.md:626-653`) lists
every configurable option by name and has no "Deliverables" group in it. Shipping the
type, the board and the settings group without touching this file leaves the plugin's
actual manual silent about a feature a user has no other way to discover — unlike the
generated per-vault README's deferred "declared vs. observed states" section (§2), this
is not additive depth on top of something already documented; it is the *only* place
the feature is documented for someone who has not read this design. In scope: a
`Deliverable` mention alongside `Issue`/`Bug` in the type list and the extra-types
section (matching that section's existing depth, not exhaustively re-deriving it), a
short addition to the board section naming the fourth projection and its independent
workflow, and the new "Deliverables" group's rows in the view-options table, in the same
row shape the existing options use.

## Testing

- `domain/`: `itemTypes.test.ts` (rootable top-level offering, extra-type rank/children
  unchanged), `settings.test.ts` (the new `OptionalField`, list defaults),
  `board.test.ts` (the parametrized `Workflow` and candidate set, both call sites, no
  cross-contamination between the two workflows' columns; a Deliverable nested inside a
  focused Feature/PBI subtree still renders as a card; a Deliverable whose *requirements*
  state is done still renders), `writePlan.test.ts` (`computeDeliverableStateWrites`, no
  stamps emitted), `backlogReadme.test.ts` (a configured `deliverableStateKey` gets a
  property-table row; the `EXTRA_TYPES` prose names `Deliverable`'s root capability
  rather than asserting it hangs from a rung).
- `storage/`: `frontmatter.test.ts` — apply/capture/undo for the new fields, including
  the compare-and-swap restore path `applyRestores` already exercises for `state`; and
  `collapseStore.test.ts` — the Deliverables mode round-trips through `readEntry`'s
  allowlist exactly as `board`/`roadmap` already do, and a legacy stored value untouched
  by this change still reads back unchanged.
- `view/`: **an assertion that the fourth toggle actually renders the Deliverables
  board**, not just that a `BoardModel` was computed — `renderProjectionContent`
  is where a correct model can still draw the wrong thing, so this is the one case
  worth a dedicated test rather than folding into toolbar coverage. `menu.test.ts` —
  the Set-state section appears on a Deliverables-board card when only
  `deliverableStateKey` is configured (not `stateKey`), its checked entry reflects
  `deliverableStateValue`, and picking one writes `deliverableState` alone — a
  regression test standing in for the "wrong property" failure mode this round of
  review caught before any code existed to catch it in; and a filtered match hidden
  under a Deliverable card still has a keyboard path through the card menu
  (`addMatchSection` on `activeBoard`, not just `'board'`). `rendering.test.ts` — a card's
  `pbl-done` class follows the active board's own completion, not the other workflow's;
  `pbl-board-mode` is present on the pane in Deliverables mode, matching `'board'`.
  `cardDrag.test.ts` / a board-drag test — a drop on a Deliverables-board column writes
  `deliverableState` alone, the drag counterpart of the menu regression test above, since
  the same wrong-property failure mode reaches through `renderColumn`'s wiring
  independently of the menu's. `keyboard.test.ts` — Alt+Left/Right on a Deliverables-board
  card writes `deliverableState` alone too: the third input in "one move, three inputs,"
  covered separately from the drag and menu cases rather than assumed to follow from
  either, since each of the three was independently found hardcoded to the wrong move in
  this design's own review history. `emptyStates.test.ts` — a Deliverables board with a
  configured workflow, a non-empty base and zero Deliverable results shows "No
  deliverables yet," never "All N items are done and hidden." `toolbar.test.ts` — the
  completed-items toggle is absent while `host.projection === 'deliverables'`, even with
  `stateKey` configured. Plus a `contextCardWrites.test.ts`-style block for the
  Deliverables board (context row never a card, never a write target — the same three
  questions asked of the general board's drag/keyboard/menu paths), and keyboard coverage
  for the fourth projection.

## Open questions carried into the plan, not blocking it

- Exact badge icon/colour for `Deliverable` (proposing `package`, an unused colour slot)
  — a one-line decision at implementation time, not a design fork.
- Whether `docs/Product Backlog.base` should grow a second, Deliverables-filtered view as
  a shipped example once this lands — left for a follow-up, per Scope.
