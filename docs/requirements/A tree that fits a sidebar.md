---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 30
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

# A tree that fits a sidebar

**As** a contributor looking at my own work in this view, **I want** to set a row's state
from its own context menu, through the same gate and the same context-row refusals every
other projection's Set state goes through, **so that** the sidebar is a place to work
rather than only a place to look — without becoming a second editing surface for
everything else a note carries.

## Use case

| | |
| --- | --- |
| **Actor** | A contributor with a person picked in the my-work view |
| **Trigger** | A right-click (or the keyboard's Menu key) on a row in that person's tree |
| **Preconditions** | A person is picked; the view has a model |
| **Guarantee** | Every row offers Open and Open in a new tab. A MEMBER row (never a context row) whose own workflow's state key is bound also offers Set state, dispatched by that row's own type — the requirements, Deliverable or test workflow, exactly as the backlog view's identical menu dispatches — with a submenu naming that workflow's declared-or-observed vocabulary. Each entry is checked exactly when picking it would write nothing, asked of the same planner the pick itself runs. Picking an entry plans through that planner and applies through the view's own `WriteGate`: refused whole if any write in the batch targets a note the base excluded, refused entirely while `configProblems` reports anything, and otherwise applied with the same started/finished stamps a backlog-view write would carry. |

**Main flow**

1. The reader opens a row's context menu.
2. The view builds it fresh: Open, Open in a new tab, and — on a member row whose own
   workflow's key is bound — Set state.
3. Set state opens a submenu of that workflow's states, the current one checked.
4. The reader picks a state.
5. The pick is planned by that workflow's own function (`computeStateWrites` for the
   requirements workflow, with the started/finished stamps; `computeDeliverableStateWrites`
   or `computeTestStateWrites` for the other two, with none) and applied through
   `view.gate.applySafely`.
6. The batch lands, the model rebuilds, and the row's chip reflects the new state.

**Extensions**

- **1a — the trigger is the keyboard (ContextMenu, or Shift+F10) rather than a
  right-click.** The tree is one tab stop and a row is reached through
  `aria-activedescendant` (`src/view/CLAUDE.md`), so DOM focus never leaves the tree
  itself — a keyboard-fired `contextmenu` event would target the tree, not the row, and
  a listener that read the event's target would always miss. The menu is instead
  resolved from `view.activeRowFile` (written by the shared roving keyboard on every
  move, `view/scopeKeys.ts`) and anchored at that row's own element with
  `showMenuAtElement` — the same split `view/release/scopeCreate.ts`'s own two listeners
  keep, over the identical reason.
- **2a — the row is a context ancestor.** Set state is never offered: a context row
  renders, it parents, and that is all. Opening it still offers Open and Open in a new
  tab — reading a note is not a write.
- **2b — the row's own workflow has no state key bound.** Set state is withheld,
  asked of that ROW's own effective key (`stateKeyFor`), never of the view's single
  `stateKey` — a Deliverable with its own configured state property still gets a menu
  when the requirements property is the one left unbound.
- **5a — the batch names an excluded note.** `applySafely` refuses the whole batch,
  loudly, rather than applying the rest and dropping the one write that could not land —
  the same refusal every other projection's writes go through. This surface's own menu
  can never construct such a batch (extension 2a withholds the control), so the case is
  reachable only by a caller that builds a batch directly, the way a drag or a keyboard
  move could reach it on another projection.
- **5b — `configProblems` reports something.** The gate refuses before anything is
  touched, with a notice naming the first problem, exactly as every other write path in
  this plugin does.
- **5c — the pick is the state the row already holds.** The plan is empty, nothing is
  applied, and the entry was already drawn checked — there is nothing for the batch to
  do and no undo slot is spent.

**No Clear state entry, and no undo control, on this view — both deliberate, and named
here rather than left implied.** There is no way to remove a state once set (only to set
a different one), and nothing in `view/mywork/` wires `undoLast`: each view owns its own
`WriteGate`, so a batch this menu applies could not be taken back from the backlog
view's own undo button even if one were drawn here. A note that carried an unconfigured
value (one absent from the declared vocabulary) before this menu touched it — the
`Blocked` example the vocabulary widening above exists for — cannot be put back to that
value from this surface either: `addStateEntries` (`rowMenu.ts`) appends only the item's
own CURRENT value to the offered list, not every value the vault might have held before.
**The recovery path for all three is the same one every other unconfigured control on
this view already relies on: open the note and edit its frontmatter directly** — Open
and Open in a new tab are offered on every row for exactly this reason, context rows
included. Both omissions are the scope this task and its plan are explicit about
(anything wider is its own PBI), not a gap nobody noticed.

## The narrow pane

**Task 10 (added 2026-08-31): the panel was made to survive the width it is actually
opened at.** A `.base` tab drags into Obsidian's left sidebar already — nothing about
this view's registration refuses that dock — so the promise this Feature owes is that
nothing in the panel needs width it will not get. Review confirmed the gap on the
committed stylesheet: `.pbl-mw-statecol` reserved a fixed `inline-size: 92px` and
`styles/mywork.css` declared no `container-type` and no container query at all, so the
state column kept its full width at every pane size and squeezed the title and the Next
marker in a sidebar.

`.pbl-mw-view` is now a query container over its own inline size
(`container-type: inline-size`), and `@container (max-width: 260px)` is what a **pane's**
narrowness means here — never `@media`, which would answer with the window's width and
be wrong for exactly the case this view is built to be docked in (a narrow pane inside a
wide window). Below that width the state column is HIDDEN OUTRIGHT
(`.pbl-mw-view .pbl-mw-statecol { display: none }`), not merely the chip inside it:
hiding the chip alone would leave the column's own 92px still reserved and fix nothing,
which is the exact shape the confirmed finding named. The toolbar wraps
(`.pbl-mw-view .pbl-mw-toolbar { flex-wrap: wrap }`) rather than clipping its own
controls at the same width, `toolbarFit.css`'s narrow answer for the header bar carried
to this pane's own bar. The row's title, its depth indent and the Next marker are never
touched by this rule — they are what the panel exists to answer, and the state chip is
the one thing here that is decoration once the row has no room for it.

**What a jsdom test can and cannot say about a container query.** jsdom computes no
layout, so nothing in `test/view/mywork/narrow.test.ts` can show the column actually
disappearing at a measured width — that is answered by the browser harness alone, this
task's own second half. What a test CAN say, and what `narrow.test.ts` asserts: the panel
carries the class the rule keys on (`.pbl-mw-view`), draws no fixed-width property column
(`.pbl-col` — this view has none, so this is a floor rather than a fixed regression
guard), keeps the person picker in every state that has a roster, and — read from the
stylesheet SOURCE rather than from computed layout — that `.pbl-mw-view` declares
`container-type: inline-size`, that the `@container (max-width: 260px)` block hides the
COLUMN (`.pbl-mw-statecol`) rather than only the chip, and that it wraps the toolbar.

**The browser harness entry this task adds is what actually answers the visual
question**, and it is the reason this task matters most to a human reviewer: every
earlier task in this Feature reported the same live-vault debt honestly, because
Obsidian cannot run here. `test/harness/mywork.ts` (bundle entry) and
`test/harness/mountMyWork.ts` (the mount) put the REAL `MyWorkView` and the real
stylesheet in front of a browser with no Obsidian and no dependency — `npm run harness --
test/harness/mywork.ts`. `?person=People/Ada.md` picks a person through the real `pick`,
so it persists exactly as a click's would; `?width=280` narrows the mounted LEAF to that
many pixels, because a sidebar's width is a fact about the DOCK, not about the browser
window, and this harness has no sidebar chrome to drag narrow by hand.

**Looked at, at four widths (240px, 280px, 320px and 600px, plus the unconstrained
window), against a purpose-built fixture with a done PBI, an open one carrying the Next
marker, and an `outsideFilter` ancestor re-rooting its member one level up:**

- **600px and unconstrained** — the chip, the Next marker and every title draw in full;
  nothing clips.
- **320px and 280px** (both ABOVE the 260px threshold, so the rule has not fired) —
  the fixed 92px chip column is still reserved, and at this fixture's depth (an Epic and
  a Feature above the PBI rows, each level costing `--pbl-indent` of indent) the row's
  total content is wide enough that the Next marker either clips hard against the pane's
  edge (280px) or is pushed entirely out of the visible area (320px, where `.pbl-tree`'s
  own `overflow-x: hidden` — a tree-wide, pre-existing trade-off stated in `tree.css`'s
  own header, "rows clip at the pane edge rather than making the whole tree scroll
  sideways" — makes it invisible rather than partially cut). **This is the confirmed
  finding, still reproducible above the threshold this task's brief specified**, and it
  is reported rather than quietly widened: the brief gave 260px as the concrete value,
  and nothing in this codebase contradicts it, so it was kept rather than tuned on this
  task's own judgement. A deeper tree, or a longer title, would clip sooner; a shallower
  one, later — the number is a property of THIS fixture's depth and title lengths, not a
  general guarantee that 260px is the right cutoff for every vault.
- **240px** (below the threshold) — the state column is gone, the row's available width
  grows back by the 92px it was reserving, and the toolbar's "Hide done" button wraps to
  its own line rather than clipping. The Next marker is now the row's own rightmost
  content rather than sharing the row with a fixed column.

  **This paragraph said "can still sit close to the pane's edge" until it was measured.**
  It was 17px OUTSIDE it: `tree.css` gives `.pbl-title` a `min-width: 60px` floor that
  every projection shares, so the title stopped shrinking while the marker kept its
  intrinsic width, and `.pbl-tree`'s `overflow-x: hidden` made the marker invisible rather
  than cut. Below the threshold — where this rule HAS fired and the column IS gone — the
  view was losing its headline answer, which is not the general per-row trade-off
  `tree.css` accepts but a gap this rule was positioned to close and did not. The narrow
  block now also drops that floor to `0` for `.pbl-mw-view` alone, so the title yields to
  the marker instead: measured with the harness at 260px, 240px, 220px and 200px, the
  marker sits inside the pane at every one (12px of clearance at the first three, 3px at
  200px, where the deepest row's title is reduced to nothing and every other row still
  reads). No other projection's floor moves.

  Above the threshold, 280px is unchanged and still clips — that band is the entry above,
  and tuning the 260px cutoff to cover it was refused on this task's own terms rather than
  reversed here.

### The polish pass of 2026-09-01

**And a second round, from review: the indent needed a CAP, not a smaller step.** Halving
the indent below the cutoff bought a fixed amount per level, which the next level spends
again — so the row that runs out of pane was always just one deeper, and the failure was
postponed rather than closed. Measured in the harness at a 200px pane before the cap: a
depth-3 row carrying the Next marker sat **11px past the tree's edge**, and an unmarked
depth-5 row was within 5px of it. `.pbl-tree` hides its own horizontal overflow, so both
would have lost the trailing state icon rather than showing it cut — the partial-chip
failure this pass exists to end.

**The row that fails first is the deepest one CARRYING THE MARKER, not the deepest one**,
and that is why this went unseen. The marker is ~36px that never shrinks, so a deep row
without it has room to spare: the harness fixture was three levels deep with the marker
higher up and drew clean at every width. The review reported the depth and inferred the
clipping; the measurement confirmed the conclusion and corrected the mechanism. The
harness fixture now finishes that row's parent so `nextAssigned` lands on the deepest row,
which is the arrangement the width question is actually about.

The cap is `2 * var(--pbl-indent)`, stated in LEVELS rather than pixels so it cannot drift
from the step declared above it and so it carries no second number tuned to one fixture's
depth — the mistake the 260px cutoff already records. Re-measured at 200px, 240px and
260px across depths 0 to 5: nothing is clipped at any of them, with 5px of clearance on
the worst row and 12px on the rest.

**The band this section reported rather than fixed is closed, and closing it moved the
marker rather than tuning the cutoff.** Task 10 measured the Next marker clipped at 280px
and pushed off screen at 320px and declined to widen 260px on one fixture's evidence,
which was the right refusal to a wrong question: the marker was drawn LAST in the row, so
whatever the cutoff, some width existed where the reserved cell after it took the pane's
last pixels and `.pbl-tree`'s `overflow-x: hidden` swallowed it. `renderTree.ts` now draws
it before the row's spacer, beside the title it is about, and no cutoff decides that at
all.

**The reserved column was doing harm in the other direction too.** `.pbl-mw-statecol` was
a fixed `inline-size: 92px`, narrower than `.pbl-state-chip`'s own shared 140px cap: `In
progress` read `In progr…` in a 1000px pane, where nothing was competing for the room.
Both of the reservation's jobs had lapsed — the row is anchored at its end, so a row with
no chip slides nothing, and the marker it aligned is no longer drawn after it — so the
cell is content-sized now, with a 22px floor (the chip's own icon) and no floor where the
row drew no chip.

**Which makes the narrow rule a different rule, and a smaller one.** Dropping the column
below 260px was the only honest answer while it reserved 92px it could not fill; against a
content-sized cell it cost the reader the one fact the chip carries — with no chip at all a
finished row and an unfinished row are the same row, and hide-done is the only way left to
tell them apart. Below 260px the chip's TEXT is hidden instead, the `.pbl-sr-only` way
rather than `display: none`: a row is a `treeitem` with no `aria-label`, so its accessible
name is derived from its content, and `display: none` would have let the pane's width
decide whether a screen reader is told the state at all. The icon (`circle-check` against
`circle`) still says whether the row is finished, and the chip's own tooltip still says the
value in words.

**Two more terms yield before the pane does.** `.pbl-title` loses the `min-width: 60px`
floor `tree.css` gives every projection — for this pane only, at every width, because the
title is what costs least (the row still opens the note, the badge still says what it is,
and the title is tooltipped in full) — and below 260px the tree's indent step halves to
12px, which is the only term on the row that grows with DEPTH: two ancestors cost 48px
before a glyph is drawn.

**Measured with a throwaway probe rather than by eye**, an uncommitted harness entry that
mounted the same fixture and printed each row's child rectangles at five widths; the
screenshots that preceded it had reported a chip "clipped" that was in fact an 8px column
with the chip overflowing it, which is a different defect with a different fix. Reading the
`Send the magic link` row (depth 2, the marker on it) as `title | marker | chip`, and the
pane's own right edge beside it: **500px** — 129px, 36px, 91px (`In progress` in full),
everything inside; **320px** — 63px, 36px, 45px (the value ellipsised); **280px** — 40px,
36px, 28px; **240px** (below the cutoff) — 30px, 36px, 22px, the chip an icon, the row
ending 4px inside the pane; **200px** — the title reduced to nothing, the marker and the
icon both still drawn, the row's last pixel 2px inside the pane. Nothing is clipped by the
pane at any of the five, which is what the 260–330px band could not say before.

**What is unchanged and still owed**: a themed vault's colours, its accent, and
anything Bases hands the view — `test/harness/theme.css`'s own stated limits, unchanged
by this task. The live-vault check — does this actually feel right dragged into a real
sidebar, at a size Obsidian itself lets a reader resize to — is still owed.

## Acceptance criteria

- `showMyWorkRowMenu(view, row, evt)` (pointer) and `showMyWorkRowMenuAt(view, row, el)`
  (keyboard) build and show the IDENTICAL menu — the same `buildRowMenu`, shown at the
  click for one and anchored at the row's own element for the other — so the two inputs
  can never drift into offering different actions.
- The keyboard (ContextMenu, or Shift+F10) opens the same menu as a right-click, resolved
  from `view.activeRowFile` rather than the event's target — the tree is one tab stop, so
  a keyboard-fired `contextmenu` targets the tree itself, never a row.
- Set state is offered exactly when `!row.context && stateKeyFor(view.planSettings,
  row.item) !== ''` — never on `view.settings.stateKey` alone, and never on a context row
  regardless of that key.
- Set state's vocabulary and its planner both dispatch on the row's own workflow — a
  Deliverable reads and writes `deliverableStateKey`/`computeDeliverableStateWrites`, a
  test-catalog member reads and writes `testStateKey`/`computeTestStateWrites`, and
  everything else reads and writes the requirements workflow, stamps included.
- Every entry's checkmark is asked of that workflow's own planner — an entry is checked
  exactly when picking it would write nothing — never of a value comparison written
  beside it.
- A batch this menu builds, replayed directly against `view.gate.applySafely` with an
  `outsideFilter` note named in it, is refused whole: neither note in the batch is
  written.
- A batch is refused whole while `configProblems(view.planSettings)` is non-empty.
- The my-work options bag (`domain/myWorkOptions.ts`) offers a declared state vocabulary
  for all three workflows — `stateValues`, `deliverableStateValues`, `testStateValues` —
  each resolved through the identical reader the backlog view's own options use, so the
  Set state menu can offer a value no row currently carries.
- A my-work configuration that declares only the requirements vocabulary, with neither
  secondary workflow configured, never trips `secondaryWorkflowProblem` — the
  copy-fallback rule `resolveSecondaryWorkflow` already gives every secondary workflow
  (an unbound one copies the requirements list rather than staying empty) keeps that
  guard unreachable for any configuration this view's own options screen can produce.
- `.pbl-mw-view` declares `container-type: inline-size`, so the narrow rule keys on the
  PANE's own width rather than the window's.
- Below a 260px container width the chip's own TEXT is hidden the `.pbl-sr-only` way
  (`clip-path`, never `display: none`, so the row's content-derived accessible name still
  carries the state), `.pbl-mw-toolbar` wraps its controls rather than clipping them, and
  the tree's indent step halves to 12px.
- `.pbl-mw-statecol` is content-sized — `flex: 0 1 auto` with a 22px floor, and no floor at
  all where the row drew no chip (`:empty`) — never a fixed reservation, so a state value
  is shown in full wherever there is room for it and is reduced to its icon where there is
  not.
- `.pbl-mw-next` is drawn BEFORE the row's spacer, so the marker is never the row's last
  child and no reserved cell after it can push it out of the pane.
- `.pbl-mw-view .pbl-title` drops `tree.css`'s shared `min-width: 60px` floor at every
  width — the title is the term that yields, and it is tooltipped in full.
- `.pbl-mw-view .pbl-row` sets `user-select: auto`: this tree drags nothing, so a reader
  can select a title to copy it, and `renderTree.ts`'s own drag-select guard on the row
  click can be true.
- The state chip carries its own value as a tooltip, which is what a chip reduced to its
  icon — or clipped by the chip's shared 140px cap — cannot show.
- `npm run harness -- test/harness/mywork.ts` mounts the real `MyWorkView` with a
  purpose-built fixture (a done PBI, an open one carrying the Next marker, and an
  `outsideFilter` ancestor re-rooting its member); `?person=<path>` picks a person
  through the real `pick`, and `?width=<px>` constrains the mounted pane to that many
  pixels, independent of the browser window's own size.

## Where it lives

`src/view/mywork/rowMenu.ts` — `buildRowMenu` (private), the whole of this surface's one
write: the context-row guard, the per-row workflow dispatch (vocabulary and planner
alike), and the checkmark asked of the plan. `showMyWorkRowMenu(view, row, evt)` shows it
at a pointer click (`showMenuForClick`); `showMyWorkRowMenuAt(view, row, el)` shows the
IDENTICAL menu anchored at a row element (`showMenuAtElement`) for the keyboard path —
one builder, two entry points, so neither input can offer an action the other does not.
Reads `stateKeyFor`/`ownWorkflowReading`/`deliverablesWorkflow` from
`src/domain/board.ts`, `computeStateWrites`/`computeDeliverableStateWrites`/
`computeTestStateWrites` from `src/domain/writePlan.ts`, `stateMenuValues`/`menuValues`
from `src/domain/settings.ts`, `rowVocabulary` from `src/view/projection.ts`, and
`showMenuForClick`/`showMenuAtElement` from `src/view/interactions/menu.ts`.

`src/view/mywork/renderTree.ts` — wires TWO delegated listeners on the tree, the release
scope's own `wireScopeCreate` shape (`src/view/release/scopeCreate.ts:51-91`): a
`contextmenu` listener resolving the row from the event's target against the draw's own
`rowEls` index, and a `keydown` listener (ContextMenu / Shift+F10) resolving the row from
`view.activeRowFile` — the field the shared roving keyboard (`view/scopeKeys.ts`) writes
on every move — because a keyboard-fired `contextmenu` targets the TREE, never a row,
once focus is managed through `aria-activedescendant` rather than real DOM focus. The
first calls `showMyWorkRowMenu`, the second `showMyWorkRowMenuAt`.

`src/view/mywork/toolbar.ts`, `src/view/scopeFolds.ts` and `src/view/scopeKeys.ts` carry
no change for this task beyond `scopeKeys.ts`'s own pre-existing `activeRowFile` write;
they are named here because they are this view's other `view/mywork/` neighbours and
this note is where the narrow-pane behaviour and the one write both live, per the epic's
own file table. Beyond the menu's own default chrome (a context menu is Obsidian's own
widget, carrying nothing of this view's own), `styles/mywork.css` is Task 10's own
addition below.

`src/domain/myWorkOptions.ts` — the three added vocabulary options (`stateValues`,
`deliverableStateValues`, `testStateValues`) — Bases can only store a box the options
schema draws, so all three are required regardless of what reads them back — and one new
`MyWorkSettings` field, `states`, resolved the same way `resolveSettings` resolves it
(`dedupe(list('stateValues'))`). `deliverableStates` and `testStates` are NOT fields on
this interface: nothing in `src/` ever read them back off `MyWorkSettings` (the menu
reads `view.planSettings.deliverableStates`/`.testStates` — `BacklogSettings`, resolved
independently by `resolveSettings(this.config)` off the identical option keys) — only
`states` earns a place, and only because `resolveMyWorkSettings`'s own local copy feeds
`resolveSecondaryWorkflow`'s copy-fallback for the other two.

**Task 10 (added 2026-08-31):** `styles/mywork.css` — `.pbl-mw-view { container-type:
inline-size }` and the `@container (max-width: 260px)` block hiding `.pbl-mw-statecol`
and wrapping `.pbl-mw-toolbar` — see "The narrow pane" above for what the confirmed
finding was and what this rule does and does not close. `test/view/mywork/narrow.test.ts`
— the markup guarantees a container query keys on (jsdom cannot lay one out, so it checks
the class and, read from the stylesheet source, that the rule and its selectors exist).
`test/harness/mountMyWork.ts` and `test/harness/mywork.ts` — the browser-harness mount
and bundle entry that finally let a person LOOK at this view
(`npm run harness -- test/harness/mywork.ts`), with `?person=` and `?width=` as described
above; `test/harness/myWorkHarness.test.ts` pins that the entry still mounts and still
draws the cases (a done row, an open one with the Next marker, the `outsideFilter`
re-root, the `?width=` constraint) it exists to be looked at.

**The polish pass (added 2026-09-01):** `src/view/mywork/renderTree.ts` — `drawRow` draws
`drawNextMarker` BEFORE the row's spacer (the marker is no longer the row's last child),
and `drawStateChip` sets the chip's own value as its tooltip. `styles/mywork.css` — the
content-sized `.pbl-mw-statecol` and its `:empty` exemption, `.pbl-mw-view .pbl-row`'s
`user-select: auto`, `.pbl-mw-view .pbl-title`'s floorless width, and a narrow block that
now hides the chip's TEXT the `.pbl-sr-only` way and halves the tree's indent step instead
of dropping the column; its header states that this file's position in `styles/index.css`
is decided by SPECIFICITY now rather than by a disjoint vocabulary, since two of those
rules re-target a selector `tree.css` and `columns.css` own. `test/view/mywork/tree.test.ts`
— the marker's place in the row's own child order, and the chip's tooltip.
`test/view/mywork/narrow.test.ts` — the rules that hold at every width (the content-sized
cell and its floor, the dropped title floor, `user-select`), and the narrow block read for
what it takes and what it keeps; both describe blocks strip comments from the stylesheet
before matching, because a paragraph quoting the declaration it replaced is otherwise read
as the declaration.
