---
type: PBI
parent: "[[A Deliverables board]]"
order: 10
status: Done
priority: P2
created: 2026-08-06
source: user request
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/model.ts
  - src/domain/board.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/render/board.ts
  - src/view/render/toolbar.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/render/projections.ts
  - src/domain/backlogReadme.ts
  - src/view/cardMoves.ts
  - README.md
  - eslint.config.mjs
started: ""
finished: ""
horizon: ""
start: 2026-08-06
due: 2026-08-09
risk: ""
assignee: ""
---

# A board scoped to Deliverables

**As** someone producing concepts, designs and other deliverables, **I want** a kanban
board that shows only Deliverables moving through a process of their own, **so that** a
document's review status doesn't have to share a column list with a PBI's implementation
status.

This is the board [[Columns from the workflow]] already describes, projected a second
time: the same rule — the workflow the view options define **is** the column
configuration — applied to a second, independent property and a card population
narrowed to one type.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing `Deliverables` from the board scope picker (a fourth toggle position until 2026-08-16 — the user moved it under the picker's `Product` entry; [[An Iterations board]], "Why a scope", records the reversal) |
| **Preconditions** | A Deliverable workflow resolves to some key — the Deliverable state property when it is configured, or (falling back) the requirements board's own `stateKey` when it is not (`resolvedDeliverableStateKey`, `deliverableKeyFallsBack` in `resolveSettings`). The two value lists follow that key only while they are EMPTY: a `deliverableStates`/`deliverableDoneValues` the user populated is used whatever the key does (2a) |
| **Guarantee** | One model, one write gate, one undo history, exactly as [[Product Kanban]]'s own guarantee states — and a move here writes the *resolved* Deliverable state key: the Deliverable's own configured property when one is set, or (falling back) the requirements board's `stateKey` itself — in which case the two boards share one property rather than each owning a different one. |

**Main flow**

1. The board scope picker names `Deliverables` directly under `Product`, each entry
   under the icon its surface already wears (`square-kanban`, `package`). Until
   2026-08-16 this step read "the toolbar toggle grows a fourth position" — the
   projection is unchanged; only its door moved, and the `Boards` position now draws as
   pressed while this board is showing.
2. Choosing it shows a board whose columns are the workflow the "Deliverables" settings
   group defines — its own state property when `deliverableStateProperty` is configured,
   or (falling back — `deliverableKeyFallsBack` in `resolveSettings`) the requirements
   workflow's own resolved key when it is not. The states and done values are NOT carried
   along with that key: a list the user populated is this workflow's list either way, and
   only an EMPTY one follows the key — to the requirements workflow's declared states and
   *effective* done values while the key is falling back, to this board's own observed
   values or the shipped default once the key is its own (2a). Either way the columns run:
   no-state first, then the configured states in order, then any observed value the
   configuration does not name.
3. Its cards are every `Deliverable`-typed item in `model.deliverableResults` — read off
   the whole, unfocused tree (`domain/model.ts`), so no focus level active elsewhere can
   narrow this board's population; see 3b — matched case-insensitively, the same way
   `isExtraType` already recognises the type, regardless of the *requirements*
   workflow's state, and regardless of "Show completed items" (which this board does
   not honor; see 3c).
4. A drag, an Alt+Left/Right, or the card menu's Set state all write the resolved
   Deliverable state key alone, through the same gate every other move goes through, and
   announce themselves the same way board moves already do.
5. Creating a new item from this board's own toolbar always creates a Deliverable: the
   primary New button is bound to it unconditionally, and the chevron "New item of
   another type" picker the other projections offer is absent here, since nothing else
   could ever appear as a card on this board.

**Extensions**

- **1a — neither the Deliverable state property nor the requirements one is
  configured.** Only then does the board show the unconfigured empty state the
  requirements board shows without a `stateKey` — a workflow is this mode's
  prerequisite here too, and the fallback means an unconfigured Deliverable property
  alone is no longer enough to trigger it.
- **2a — the Deliverable state property IS configured, on its own distinct key, but its
  own states or done values are not.** They fall through to THIS workflow's own
  observed values or the shipped default (`DEFAULT_DONE_VALUES`) — never to the
  requirements workflow's declared states or customized done values. What the KEY decides
  is which fallback an EMPTY list takes — its own observed values when the key is its own,
  the requirements workflow's declared list when the key is falling back too — never
  whether a list the user populated is used. **A list you set always wins**, shared key or
  not; the all-or-nothing rule is about BORROWING, not about overriding. Saying it the
  wider way ("only an unset key borrows every field together, never just one of the
  three") described a configuration the code does not have — a shared key with its own
  states — and it was written the same day the check asserting the opposite landed.
  **Checked by** `test/domain/deliverableSettings.test.ts` — "keeps its own declared states over the
  shared list once configured".
  **Checked by** `test/domain/deliverableSettings.test.ts` — "keeps its own done values over the
  shared list once configured".
- **1b — the Deliverable workflow is configured, but the base holds no `Deliverable`
  results at all.** Every column renders empty, and the board shows "No deliverables
  yet" — never "All N items are done and hidden," which is what the requirements
  board's own empty-column advisory would say if reused unmodified: it cannot tell "the
  base is empty" from "nothing here matches this board's type," and this board's
  population is a type filter, not a completion state.
- **1c — the requirements `stateKey` is also configured.** The toolbar's "Show completed
  items" toggle does not appear while viewing the Deliverables board, even though it
  would appear on the requirements board with the same settings — the control has no
  effect here (3c), so it is absent rather than present and inert.
- **3a — a Deliverable also carries the requirements board's own state property (or,
  under the fallback, the two workflows are the same property).** It is never an
  ordinary card on the requirements board — that board excludes every `Deliverable`
  from its cards, its `fullCount` and its stray columns, whatever either workflow's
  state says. It still counts on the tree and on both roadmap axes; only the
  requirements board's cards are scoped away from it. A Deliverable acting purely as an
  excluded ancestor is the one exception: it still renders there as a context row for a
  matching visible descendant, exactly as an `Issue` or a `Bug` already does — never a
  real, in-filter card, a ranking peer or a count, whatever its state. See
  [[A Deliverables board]].
- **3b — a hierarchy focus level is active** (set from the toolbar's focus picker on
  another projection and carried over — this board's own toolbar renders no picker to
  set one from here; see 5a). **No focus level narrows this board, at any level,
  ever.** Cards are drawn from `model.deliverableResults`, which `domain/model.ts`
  builds off the whole, unfocused tree — read before either focus branch re-roots
  anything — precisely so a focus left active on another projection can never make a
  Deliverable disappear from here. This reverses an earlier, reviewed decision: a prior
  round of this design gave `Feature` focus (and every level but `PBI`) a different
  rule from `PBI` focus and no focus at all — narrowing the board to the focused
  subtree in the first case, the same way it already narrows the tree and the
  requirements board, while `PBI` focus and no focus left every Deliverable visible,
  mirroring how `collectFocusRoots`' `extraFocused` rule
  (`EXTRA_TYPE_RANK === focusIdx`) already admits every extra type as a focus root by
  TYPE under PBI focus, the same way `Issue` and `Bug` work there today. The human
  overruled that decision afterward, in these words: "when a type level is set and the
  user goes to the deliverables board, the type level shall not affect this board… there
  are only the deliverables to display." Both halves of the old rule are gone — no level,
  `Feature` and `PBI` alike, narrows anything here now, checked over every level
  `ALL_TYPES` names plus no focus at all
  (`test/domain/deliverableModel.test.ts`'s "immune to the focus level" block).
- **3c — a Deliverable's requirements-board state reads as done.** Its card still
  renders here. This board does not implement "Show completed items" in this increment
  (Scope, in the design spec) — building it would need its own rollup over the
  Deliverable workflow, not the requirements one, and nothing has asked for it yet.
- **3d — a Deliverable's two workflow states disagree on completion** (e.g. `Done` on
  the requirements board, `Draft` here, or the reverse). Its card's finished styling
  (`pbl-done`) here reflects the **Deliverable** workflow's own done values, never the
  requirements board's — the shared card shell takes completion as an input rather than
  reading `item.done` itself, so the two boards can disagree about one card without
  either one lying about it.
- **4a — the card is a context row (`outsideFilter`).** Never a card to drag, never a
  write target, never counted — the context-row rule applies here exactly as it does on
  the requirements board.
- **4b — the quick filter is active and matches a non-Deliverable descendant of a
  visible Deliverable card.** The card menu's matches section still names it and still
  offers a way to open it, the same keyboard path the requirements board gives a hidden
  match — this board is a second `=== 'board'`-shaped gate in the same file the Set-state
  fix touches, not a different rule.
- **4c — a PBI, Task or Bug carries a value under the configured Deliverable state
  property** (a coincidence, or a leftover from re-typing a note). That value never
  mints a stray column and is never offered on that note's own Set-state menu — a
  column no Deliverable card could ever land in is not a target this board offers,
  whatever key happens to hold a value.
- **5a — a focus level was set from another projection and is still active when the
  Deliverables board is chosen.** The toolbar's focus picker never offers a menu to pick
  a *different* focus from here — nothing to narrow by, since every card is already a
  Deliverable — and, since 3b, it never renders a "Focused: <level>" label or a clear
  button either: whatever the inherited focus, it does not narrow this board, so there
  is nothing left for a label to name or a clear button to undo. The control renders the
  same fixed, disabled "Deliverables" button no matter which level is inherited —
  `renderFocusPicker`'s one, unconditional branch for this projection
  (`view/render/toolbar.ts`).

## Acceptance criteria

- The toolbar offers exactly Tree, Board, Roadmap, Deliverables, and the fourth shows
  cards only for items typed `Deliverable`.
- Its columns come from a workflow (state property, ordered states, done values) that
  is either its own, configured independently from the requirements board's
  `stateValues`/`doneValues`, or — when no Deliverable state property is configured —
  the requirements workflow's own resolved key, declared states and effective done
  values. Field by field, never as a unit: the key falls back when no Deliverable state
  property is set, each list only while it is itself empty.
- A move — drag, Alt+arrow, or menu — writes the *resolved* Deliverable state key alone
  (`resolvedDeliverableStateKey`): its own configured property when one is set, in
  which case the requirements board's state is untouched by it and vice versa; or,
  falling back, the requirements board's `stateKey` itself, in which case the two
  boards deliberately share the one write.
- Undo takes back a Deliverables-board move through the same one slot every other move
  in the view uses.
- No non-Deliverable item ever appears as a card here, whatever its own state.
- No result is lost: every Deliverable item in `model.deliverableResults` renders in
  exactly one column, and column counts sum to the Deliverable card count — the same
  guarantee [[Product Kanban]] states for the requirements board, including a stray
  column for an observed value the configured workflow does not name, and including
  every Deliverable regardless of any active focus level, never only the ones a
  focused subtree would still reach (3b).
- Neither the requirements workflow's completion state nor "Show completed items" hides
  a card here, **nor anything a card draws** — a card's child disclosure lists a
  requirements-done child like any other. Only the quick filter narrows this board.
  That is one rule inside `isRowHidden` rather than a second predicate call sites choose
  between: three surfaces chose the narrower one and the fourth did not, so a setting
  flipped on another projection emptied a Deliverable's child list here, on a board with
  no toggle to put it back.
  **Checked by** `test/view/deliverablesBoard.test.ts` — "lists a requirements-done child on a Deliverable card whatever the completed toggle says"
- A card's finished styling here follows the Deliverable workflow's own done values,
  never the requirements board's — the two can disagree about one card and each board
  shows its own answer.
- **Which workflow tracks an item is a property of its TYPE, not of the projection it
  is drawn in.** A Deliverable's state is the Deliverable workflow's on the tree and on
  the roadmap exactly as it is on this board: the tree's Set state offers *its* declared
  states, checks the entry `item.deliverableStateValue` holds, and writes the resolved
  Deliverable key — and the row's state chip shows and styles that same value, so the
  chip and the menu it opens can never name two workflows. Everything not typed
  `Deliverable` keeps the requirements workflow everywhere, unchanged.
- The tree serves BOTH workflows in its column strip, and asks two different questions to
  do it. The CELL is the Bases properties menu's question — a state property is a column
  when the menu shows it, which since
  [ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md) means the two workflows
  on distinct visible keys are **two** columns rather than one shared one. The CHIP inside
  a cell is gated on the key *this row's* workflow writes (`stateKeyFor`, the same
  function `Set state` gates on, so a chip and a menu can never disagree about which key a
  row writes): every row fills exactly one state column and leaves the other empty —
  empty rather than absent, or the columns after it shift on that row alone. A vault
  SHOWING only the Deliverable property gets one column, a chip on its Deliverables and
  an empty cell on every other row — configuring it is not what puts it there. Each column's header is its own property's
  display name, fallback included; the generic word `State` is gone with the single
  shared column that needed it, since a column now names exactly one property.
- **Completion is deliberately NOT type-scoped.** `item.done`, `subtreeDone`, the rollup,
  the row's finished styling and "Show completed items" all stay the requirements
  workflow's, on every projection but the Deliverables board (which has no completion
  concept of its own, above). So a Deliverable carrying a done requirements state and an
  open Deliverable state reads as done to the tree while its chip says otherwise. That is
  a known consequence of two distinct keys, accepted rather than overlooked: `subtreeDone`
  rolls up through a Deliverable's `Task` children, which the requirements workflow tracks,
  so "this Deliverable is done" and "its subtree is done" would become two claims the model
  answers as one. Sharing the key — the shipped default — makes the divergence
  unreachable.
- The requirements board offers no way to make a Deliverable from itself, at **any** of
  the four surfaces that name a type: `Set type`, a card's own `New <child>`, and both
  toolbar creators. A note written from there would be excluded from the very board it
  was created on. Withheld, not disabled — the "absent rather than inert" rule the state
  chip already follows — and only there: every other projection offers the whole
  vocabulary. One rule, one function (`offerableTypes`), because it was broken twice by
  being applied a surface at a time: the primary New button follows the focus target
  (`newItemType`), so a `Deliverable` focus left active elsewhere read "New Deliverable"
  while the chevron beside it filtered; and `childTypeChoices` answers about the LADDER
  — a PBI holds Deliverables — which is a different question from what this board can
  show, so every card kept offering `New Deliverable` while `Set type` filtered. The
  focus PICKER is the fifth surface under the same rule: focusing `Deliverable` from the
  requirements board narrows it to roots that board excludes, which is an empty board
  one click away. An INHERITED focus still reads in the button, with the clear beside it.
- **The rule cuts both ways, and this board keeps its own half**: it shows nothing but
  Deliverables, so it offers nothing else — a Deliverable card's `New Task` is withheld
  here exactly as `New Deliverable` is withheld next door, because a Task created from
  this board vanishes on the pass that writes it. `Set type` goes with it rather than
  becoming a one-entry submenu whose only option is the type the card already carries:
  absent rather than inert, the same rule the state chip follows. Everything not about
  type — Set state, the placement actions, navigation — is untouched.
- **The unconfigured empty state can be fixed by its own button.** Its setup CTA names
  BOTH the Deliverable state field and the requirements one, which is
  `resolvedDeliverableStateKey`'s rule expressed as a list: this board resolves through
  its own key when one is set and through `stateKey` when it is not. Naming only its own
  field hid the button on the case that matters most — a fresh view, where
  `adoptableProperties` gives the shared `status` suggestion to `state` first and drops
  `deliverableState` as a duplicate, so nothing was adoptable and the guidance named an
  option while withholding the press that would have set it. A CLEARED `state` still
  hides the button: that is a decision, and `adoptableProperties` asks the config.
- **The requirements board's own vocabulary is Deliverable-free in both passes that can
  mint a column** — the configured list's fallback and the stray pass that runs even once
  a workflow IS declared. Scoping one alone leaves the other drawing a column only a
  Deliverable could fill, on a board that excludes every card that could sit in it. One
  collection feeds both (`requirementsWorkflow`), taken from the FOCUSED results: with a
  declared workflow the columns are the declaration and this changes nothing, and without
  one the board draws the states its own visible work holds rather than columns for work
  it is not showing.
- **The quick filter keeps ONE index per population, not one index patched to serve
  two.** The tree, the requirements board and the roadmap render out of `model.roots`,
  which a focus narrows; this board renders `model.deliverableResults`, built from the
  whole tree and deliberately focus-immune. `FilterState` therefore holds a `focused`
  and a `whole` index — the same match-path rule (`indexMatches`) over each forest — and
  every caller names the scope it is asking about, resolved once from the projection
  (`ProductBacklogView.filterScope`). Unfocused the two forests are the same one, so the
  second index IS the first and the distinction costs nothing.
  That shape was arrived at the expensive way, and the history is the argument for it:
  one index that this board also consulted took four rounds of fixes, each correct and
  each one case short — the out-of-focus Deliverable that was never indexed, its matching
  ANCESTOR that was not either, a focused row BELOW one that the patch then wrote to and
  should not have, and finally the two the guard could not reach at all (an in-focus
  Deliverable whose ancestor sits ABOVE the focus root, and a Deliverable whose matching
  descendant sits BELOW it across that boundary). Two indexes make all six structural:
  neither is a special case of the other, and neither can write into the other.
- **Every toolbar readout answers for the projection's OWN population**, resolved once
  (`countedPopulation`) rather than per readout: the Deliverables board counts
  `model.deliverableResults`, the requirements board counts every result except a
  Deliverable, the tree and the roadmap count them all. The count label and the completed
  toggle's "(N hidden)" sit beside each other and disagreed — the label was scoped and the
  toggle was not, so a done Deliverable made the requirements board offer to reveal a
  hidden card that board never had. "Every readout" is true of `render/toolbar.ts`, which
  is where the readouts are. `countedPopulation` moved with them to
`src/view/render/toolbarStatus.ts` and is exported there (2026-08-10), so the duplication
risk below is closed rather than open: a readout added in
  another view file would have to duplicate it, and nothing stops that
  ([[Follow-ups from enforcing the Deliverables invariants]]).
- **The requirements board's empty advisory answers for its OWN population**, never
  `model.results` — which counts the Deliverables it excludes. A base of Deliverables
  alone read "All N items are done and hidden", beside a `Show completed items` button
  that would change nothing. A `Deliverable` focus inherited from another projection
  gets its own state rather than the ordinary empty one, because that one names the
  focused type and offers to create another: it says why the board is empty and its
  button clears the focus.
- **Excluding a Deliverable never excludes the requirement work below it, focus or not**
  (`requirementsFocusRoots`, `domain/board.ts`). `Deliverable` is in `EXTRA_TYPES`, so a
  focus on the extra-type rung promotes one to a focus root exactly as it promotes a Bug —
  and under a focus the ROOTS are this board's candidates, so excluding that root took its
  whole subtree off screen: a Task it owned was counted by the toolbar and drawn by
  nothing, while with no focus that same Task gets its own card. The candidate list now
  descends through an excluded Deliverable to its topmost non-Deliverable descendants,
  which is the same descent `collectFocusRoots` already makes for a root that does not
  match. The rule is stated as the two surfaces agreeing rather than as an expected card
  list: pressing the focus button must not decide whether a Task exists on this board.
  A CONTEXT Deliverable is kept rather than descended through — it is admitted as
  placement and renders whenever it has a visible child, so its descendants already have
  a card to sit under.
- **Under a SHARED state property the observed vocabulary is one pool, not two.** When
  `stateProperty` and the Deliverable one resolve to the same key, a Deliverable's value
  in that key is also a real value *of that property*, so the tree's Set state offers it
  on a PBI. Reviewed twice and decided by the maintainer: narrowing it would stop a PBI
  being put into a state that already exists in its own property — a capability loss for a
  tidiness gain — and the outcome is self-correcting, since a PBI carrying that value
  gives the requirements board a column its card can sit in. This is the one place the
  Deliverable-free scoping deliberately stops: the board's COLUMNS are still scoped
  (`requirementsWorkflow`), because a column no card can reach is a different defect from
  a value a card can legitimately take.
- On a Deliverable card viewed from this board: the card menu's Set state section
  appears whenever the *resolved* Deliverable state key is non-empty — its own key, or
  (falling back) the requirements one — even when the requirements `stateKey` alone
  would otherwise be unset; its checked entry reflects `item.deliverableStateValue`,
  never `item.stateValue`; and picking one writes `deliverableState`, which lands on
  the resolved key alone — its own key when configured, the requirements key itself
  when falling back, never a third, uninvolved property.
- Picking the Deliverables board survives closing and reopening the view, the same way
  Board and Roadmap already do — not merely reverting to the tree because the stored
  value went unrecognised. Since 2026-08-16 the pick is also RETAINED like an iteration
  scope: leaving the `Boards` position and returning reopens this board, remembered as a
  stored word beside the stored scope path, and the two clear each other so they cannot
  contradict.
- Selecting the picker's entry actually renders the Deliverables board's columns and
  cards into the pane — asserted directly, not inferred from the board model existing.
- A drop on a Deliverables-board column writes `deliverableState` alone — the drag input
  gets the same wrong-property regression coverage the menu input does, since the two
  reach the write through separate code paths that must not disagree.
- Alt+Left/Right on a Deliverables-board card writes `deliverableState` alone too —
  covered as its own case, not assumed from the drag or menu fix, since each of the
  three inputs in "one move, three inputs" was independently found hardcoded to the
  wrong write during this design's review.
- On the Deliverables board, ordinary arrow-key navigation moves the board selection
  between cards and columns (never falling through to the tree's keyboard handler),
  and Alt+Left/Right never runs the tree's own reorder/indent/outdent — asserted
  directly, since the two dispatchers involved (which projection routes to which
  keyboard handler, and which move a routed key performs) are independent and both
  were found wrong.
- A stray column never appears on the Deliverables board for a value only a
  non-Deliverable item carries under the configured Deliverable state property, and
  that value is never offered on that other item's own Set-state menu.
- The generated README lists the *resolved* Deliverable state key in the property table
  whenever it is non-empty — its own key, or (falling back) the requirements one — so
  "only the properties above are written" stays true of a vault using this board, the
  same contract every other property this view writes already gets.
  **One property gets one row, and a relationship is stated only where there are two.**
  Whether there are two is asked of the resolved key against `stateKey`, never of the
  raw option: the two workflows share a property both when the Deliverable key is unset
  AND when it is set to the requirements key on purpose — the one collision
  `configProblems` exempts — and asking the option documented that second arrangement as
  two separate properties, listing the one key twice in a table of what a note may
  carry. Shared, the requirements row says it carries both workflows. Distinct, the
  Deliverable row names itself separate from the requirements one. And with no
  requirements key configured at all there is no such row and no `## Workflow states`
  section, so no relationship is stated — "separate from the requirements workflow's"
  would name something the reader cannot find.
- The pane carries the same board-shaped styling (columns readable, no clipped overflow)
  in Deliverables mode as in Board mode.
- A configured-but-empty Deliverables board (no `Deliverable` results in the base) shows
  "No deliverables yet," never a message claiming items are done and hidden.
- "Show completed items" does not appear in the toolbar while viewing the Deliverables
  board, whatever the requirements `stateKey` holds.
- A quick-filter match hidden under a visible Deliverable card is reachable from the
  keyboard through the card menu, the same as on the requirements board.
- The plugin's own shipped `README.md` — not only the generated per-vault one — names
  `Deliverable` beside `Issue`/`Bug`, describes the fourth projection, its workflow (its
  own when configured, or the requirements one when not), and lists the new
  "Deliverables" view-options group: a user reading the plugin's manual can find this
  feature without reading this design.
- The requirements board never shows a Deliverable as a real card, whatever either
  workflow's state says, and its `fullCount` and the toolbar's item count agree with
  that — except a Deliverable rendered purely as a context row for a matching visible
  descendant, which the requirements board still shows exactly as it does for any other
  excluded ancestor.
- The toolbar's primary New button on the Deliverables board always creates a
  Deliverable, and the chevron "New item of another type" picker is absent there —
  asserted directly against the requirements board, where the picker still offers every
  type.
- The toolbar's focus picker renders a real, disabled `Deliverables` button on this
  board unconditionally, whatever the inherited focus level — never the "Focused:
  <level>" label, never a clear button — because no focus level narrows this board's
  population (`BacklogModel.deliverableResults`) for either of those to have anything
  to name or undo.

## Where it lives

`src/domain/optionalProperties.ts` — a `deliverableState` field joins `OptionalField` and
`PROPERTY_TABLE` (so it gets collision-checking, adoption and backfill for free, the way
every optional property already does), plus `deliverableStates` and
`deliverableDoneValues` beside `states`/`doneValues`. `resolveSettings` names the key's
own fallback condition once (`deliverableKeyFallsBack` — true exactly when no
Deliverable state property is configured) and consults it for all three returned
fields — but it is not the same question in all three. For `deliverableStateKey` it
decides the key. For `deliverableStates` and `deliverableDoneValues` it sits BEHIND each
list's own emptiness check and picks WHICH fallback an empty list takes: the requirements
workflow's declared states and effective done values while the key is falling back too,
this workflow's own observed values or the shipped default (`DEFAULT_DONE_VALUES`) once
the key is its own. **A list the user populated is never overridden by either**, so
falling back is field by field and never all three together — an independently-keyed
Deliverable workflow shares none of them, ever. `resolvedDeliverableStateKey(settings)` is the one function
every other reader and writer calls for the key — never `settings.deliverableStateKey`
directly — deliberately excluded from `optionalKeyFor`, since `configProblems`/
`adoptableProperties` need the RAW (possibly empty) key to tell a fallback share from an
explicit collision.
`src/domain/viewOptions.ts` — a new "Deliverables" group: `deliverableStateProperty` (the
state property picker), `deliverableStateValues` (the ordered workflow states) and
`deliverableDoneValues` (the done values).
`src/domain/model.ts` — `BacklogItem.deliverableStateValue` and `deliverableDone`, built
the same way `stateValue`/`done` already are, reading through `resolvedDeliverableStateKey(settings)`
rather than the raw `deliverableStateKey` — so a card that looks movable on the
Deliverables board, own key or shared fallback, resolves to the value that key
actually holds. `BacklogModel.deliverableResults` is a second, later addition (see
extension 3b): every Deliverable-typed result, read off `items` — the whole tree
`assignAll` builds — before either focus branch below it re-roots anything, so it is
immune to the focus level rather than inheriting the re-rooting `results` gets.
`renderDeliverablesBoard` (`view/render/board.ts`) reads this field instead of
`model.results`, and `test/domain/deliverableModel.test.ts`'s "immune to the focus
level" block drives it over every level `ALL_TYPES` names.
`src/domain/vocabulary.ts` — `collectObservedDeliverableStates`, filtering to
`typeName?.toLowerCase() === 'deliverable'` **before** the first-seen walk
`collectObservedStates` already does, and sorting against `deliverableDoneValues` rather
than `doneValues` — not a blind copy of `collectObservedStates`, which would mint a
stray column from a non-Deliverable item's coincidental value.
`src/domain/board.ts` — `boardColumns` takes the workflow (state reader, states, done
values) as a parameter instead of reading `settings.stateKey`/`states`/`doneValues`
directly, so the requirements board and this one share one implementation.
`src/domain/writePlan.ts` — `ItemWrite.deliverableState` / `removeDeliverableStateKey`
(the `state`/`removeStateKey` shape, not `AxisWrite`'s — no span semantics here) and
`computeDeliverableStateWrites`, deliberately with no stamp logic.
`src/storage/frontmatter.ts` — applying and capturing the new fields through
`resolvedDeliverableStateKey(settings)`, the fallback-aware key, never the raw
`optionalKeyFor(settings, 'deliverableState')` — so a move on the Deliverables board
lands bytes even when no Deliverable-specific property is configured, and undo
(`touchedKeys`) captures the very key `applyInto` wrote.
`src/view/host.ts` — `projection` gains `'deliverables'`, `performDeliverablesBoardMove`
is declared on `BacklogViewHost` as a one-line delegation to `CardMoveController`,
mirroring `performBoardMove`'s own delegation exactly. `isRowHidden` stays the ONE
visibility question every projection asks; this board's exception — no completion concept
of its own, so the toggle describing the requirements rollup cannot reach it — lives
inside that answer as `VisibilityRule.hideCompleted` (`src/view/rowVisibility.ts`),
including inside the context-row recursion. It was briefly a second method
(`isRowHiddenByFilterOnly`) that callers picked between, which is a category invariant
asked at the places someone thought of: the board, the count label and the completed
toggle asked it and `listedChildren` did not.
`src/view/cardMoves.ts` — `CardMoveController` gains `performDeliverablesBoardMove` as a
fourth sibling to `performBoardMove`/`performHorizonMove`/`performScheduleMove`,
delegating to the same private `applyCardMove` (pending class, no-op check, announcement)
those three already share — not a standalone write, which would either reimplement or
silently drop that behavior.
`src/view/render/projections.ts` — `renderProjectionContent` gains an explicit
`renderDeliverablesBoardContent` branch beside `renderBoardContent`/
`renderRoadmapContent`, gated on `resolvedDeliverableStateKey(ctx.host.settings)` rather
than the raw key — so the "no workflow" guidance shows only when NEITHER workflow
resolves — returning its board through the same `ProjectionContent.board` field
`renderBoardContent` already uses — there is no second snapshot field; without this
branch the projection falls through to `renderTree` and nothing computes a board at
all.
`src/view/backlogView.ts` — the projection's stored round trip; the `pbl-board-mode`
class condition widens to admit `'deliverables'` — the two are shaped alike and share the
class, rather than the Deliverables board inheriting the tree's overflow and root drop zone
by omission. It is written in `syncProjectionClasses` now, `src/view/render/projections.ts`,
beside the content fork it mirrors, and the iteration board has since joined it there. And
`isRowHidden` assembles the one `VisibilityRule` every reader shares through
`visibilityRule` in `src/view/rowVisibility.ts`, which is where the exception is stated
once. Two things about it have moved since this was written. The test is
`hidesCompleted(projection)` in `src/view/projection.ts` rather than a comparison here, and
it now names three projections rather than one — the catalog for this board's own reason
(completion is another workflow's question) and the iteration board for a reason of its
own, its Resolved column being exactly what the sprint finished. And `hideCompleted` MEANS
something narrower: not "this projection has a completion concept" but "the toggle is
actively hiding", so it is false wherever the reader has finished work switched on or no
state property is configured at all. Neither changes what this board does; both change what
a reader of that field may conclude from it.
`src/view/render/toolbar.ts` — the toggle position until 2026-08-16, and since then the
way in is `renderBoardScopePicker` in `src/view/render/toolbarControls.ts`, whose
`Deliverables` entry sits under `Product`; `renderCompletedToggle`'s gate adds
`&& host.projection !== 'deliverables'` · `src/view/render/toolbarStatus.ts` —
`syncCountLabel`, which runs every render
regardless of projection, asks the one `isRowHidden` — found by review: before the
predicate answered per projection, a Deliverable done only in the requirements workflow
rendered as a visible card here while the toolbar simultaneously reported the base as
"0 of 1". Extended by the later board-scoping change,
covered in `test/view/deliverablesToolbar.test.ts` rather than folded into
`test/view/toolbar.test.ts`: `renderToolbar`'s `onDeliverables` flag binds the primary
New button to `DELIVERABLE_TYPE` unconditionally — never the focus-dependent
`newItemType` the other projections use — and skips rendering the chevron "New item of
another type" picker entirely, since a board that only ever shows one type has nothing
for a second choice to add; `syncCountLabel` gains a parallel `onRequirementsBoard`
branch that filters `Deliverable` out of the population and the tooltip breakdown it
counts, agreeing with `renderRequirementsBoard`'s own exclusion (`view/render/board.ts`)
rather than a second, independently-computed count that could drift from it; and
`renderFocusPicker` drops the picker MENU entirely on the Deliverables projection —
nothing to choose a focus from here — and, since the reversal recorded in extension 3b
above, drops the "Focused: <level>" label and its clear button too: this projection's
one branch now always renders the same real, disabled `<button>` reading
"Deliverables," whatever `model.focused` says, because no inherited focus narrows
`model.deliverableResults` for a label or a clear button to answer to. `admitsEveryDeliverable`,
the function that used to answer "does this focus narrow the board," is deleted along
with the branching it existed for. Covered, alongside the New-button and count-label
changes above, in `test/view/deliverablesToolbar.test.ts`'s "the focus control on the
Deliverables board" block.
`src/view/render/board.ts` — four changes, not three: `createCard` takes its completion
flag as a parameter (defaulted to `item.done`, so the requirements board and the roadmap
need no change) instead of reading `item.done` itself, so the Deliverables board's call
site can pass `item.deliverableDone`; `renderBoard`/`renderColumn` take the resolved
`BoardModel` and a `move` callback as parameters instead of deriving `boardColumns(...)`
and `host.performBoardMove` internally, so `renderColumn`'s drop wiring calls whichever
`move` its caller gave it rather than hardcoding `performBoardMove` — the drag
counterpart of the menu fix above, since an unparametrized `renderColumn` would let a
drop write the wrong property exactly as an unparametrized menu would;
`renderDeliverablesBoard`'s own `drawEmpty` closure asks whether
`model.deliverableResults` is empty, never whether `model.results` contains a
Deliverable, so a base full of other work is never reported as "done and hidden" on
this board; and — added by the later board-scoping
change, covered in `test/view/board.test.ts` and `test/view/deliverablesBoardContext.test.ts`
rather than folded into this PBI's own suite — `renderRequirementsBoard` filters every
`Deliverable` out of the population it passes to `boardColumns` (its cards, its
`observedValues` via `collectObservedStates` in `domain/vocabulary.ts`, and both its
`isRowHidden`/`isRowHiddenUnfiltered` predicates), so a Deliverable never becomes a
stray column, a card or a counted result on the requirements board. The predicate is
`item.outsideFilter || !isDeliverable(item)`: a real, in-filter Deliverable is always
excluded, but one rendered purely as a context row for a visible descendant is exempted
from the exclusion — the same "renders, parents, and that is all" guarantee every other
excluded ancestor already gets, restored after an earlier version of this predicate
dropped it unconditionally (see extension 3a above).
`src/view/interactions/cardDrag.ts` — wiring the new board's drop targets through the
parameterized `renderColumn` above.
`src/view/interactions/keyboard.ts` — two changes, not one: `handleProjectionKeydown`
(`:24-28`), the top-level dispatcher, gains a `'deliverables'` branch to
`handleBoardKeydown` beside its existing `'board'` one — without it every keystroke on
the Deliverables board reaches `handleTreeKeydown` instead, whose own Alt+arrows
reorder/indent/outdent and write `parent`/`order`, not a hazard the move-routing fix
below touches at all; and `handleBoardMoveKey` (`:293`) dispatches to
`host.performDeliverablesBoardMove` on `host.projection === 'deliverables'` instead of
hardcoding `host.performBoardMove` — the third of the three move inputs, found
independently hardcoded to the wrong write and fixed as its own case rather than assumed
to follow from the other two.
`src/view/interactions/menu.ts` — four changes, not one: a new `activeBoard(host)`
helper — `host.board?.board ?? null`, no projection branch needed because `host.board` is
already the one field holding whichever board-shaped projection's snapshot is current —
replaces the repeated `host.projection === 'board' ? host.board?.board : null` ternary at
all three of its existing call sites plus the one this PBI adds; the Set-state section's
visibility gate checks whichever key is active for `host.projection` — on the
Deliverables projection, the *resolved* key (`resolvedDeliverableStateKey`), never the
raw `deliverableStateKey`, so the menu still offers Set state under the fallback — not
only the requirements `stateKey`; `chooseState` (the write) and `addStateItems` (the
checked entry) route to `performDeliverablesBoardMove` / `computeDeliverableStateWrites`
rather than falling through to the requirements-keyed `computeStateWrites`; and
`addMatchSection`, the keyboard path to a quick-filter match hidden under a card, now
resolves through `activeBoard` too instead of returning early on every projection but
`'board'`.
`src/storage/viewStateStore.ts` — a `DELIVERABLES_MODE` constant beside
`BOARD_MODE`/`ROADMAP_MODE`, added to `readEntry`'s stored-mode allowlist, or the
projection is silently dropped on read like any unrecognised value.
`src/view/viewState.ts` — `ViewState.projection()` and its write-back
counterpart map `'deliverables'` to and from `DELIVERABLES_MODE`, the same round trip
`board`/`roadmap` already get.
`src/domain/backlogReadme.ts` — `fieldRows` gates its Deliverable row on
`resolvedDeliverableStateKey(settings)` rather than the raw key, so the row still
documents the property the board actually reads and writes under the fallback. Whether
that key is a SECOND property or the same one is decided by comparing it against
`settings.stateKey` — again not the raw option, which is what made an explicitly shared
key read as two separate properties and appear twice in the table. Shared, the
requirements row carries the whole description and no second row is emitted; distinct,
the Deliverable row names the relationship; with no requirements key at all it names
none, there being nothing in the document to relate to. This matches its existing manual, per-property shape
(the horizon/start/target rows immediately above it) rather than a generic loop over
`OPTIONAL_PROPERTIES` — `fieldRows` already has that shape for every property before
this one, so this PBI matches precedent rather than refactoring it. The full "declared
vs. observed states" section for the Deliverable workflow is out of scope (design spec,
Scope/Out) — only the property-table row, which an existing sentence elsewhere in the
generated document depends on being complete.
`README.md` — the plugin's own shipped manual, distinct from the generated per-vault one
above: `Deliverable` joins the type list and the "Issues and bugs sit beside the ladder"
section, matching its existing depth rather than re-deriving it; "## The board" names
Deliverables' exclusion from that board; "## The Deliverables board" describes the
fourth projection's workflow (its own when configured, or, falling back, the one the
board above already uses), the toolbar's New button bound to it, and the focus picker's
reduced form — since extension 3b's reversal, the same disabled `Deliverables` button
unconditionally, whatever the inherited focus, never a "Focused: …" label and never a
clear button; and the view-options table gains the new "Deliverables" group's rows,
each stating its own fallback.
`eslint.config.mjs` — three rules this board's review found broken a surface at a time
are now checked at the call rather than relied on at the next review:
`ALL_TYPES_IMPORT` bans IMPORTING the whole type vocabulary into view/ outside
`offerableTypes` (`interactions/menu.ts`, above) and `CHILD_TYPE_CHOICES_NULL` bans the
one spelling that reached it without the import; the `countedPopulation`
one-population-per-readout rule (above) has a watched test rather than a lint rule,
since `no-restricted-syntax` cannot express "not inside this one function"; and
`DELIVERABLE_FIELD_READ` bans the dotted `deliverableStateValue`/`deliverableDone`
member access in view/ outside `cardMoves.ts` and `render/board.ts`, which
read one workflow's raw fields by BOARD rather than by item type — `ownWorkflowReading`
(`domain/board.ts`, beside `stateKeyFor`) is the one accessor the chip and the menu now
share instead of each hand-writing the same `isDeliverableType(item) ? … : …` ternary.
