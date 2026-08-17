---
type: Task
order: 20
parent: "[[Quick filter]]"
status: Done
priority: P2
area: usability
created: 2026-08-17
closed: 2026-08-17
source: Asked for directly — "Obsidian Bases bring their own search now", keep the shelf's
files:
  - src/view/rowVisibility.ts
  - src/view/projection.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/viewStateSurface.ts
  - src/view/viewStateController.ts
  - src/view/childrenList.ts
  - src/view/rowSignature.ts
  - src/view/renderPass.ts
  - src/domain/board.ts
  - src/view/render/board.ts
  - src/view/render/rows.ts
  - src/view/render/roadmap.ts
  - src/view/render/toolbar.ts
  - src/view/render/emptyStates.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/menu.ts
  - src/i18n/en.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Remove the quick filter, now that Bases has its own search

## Evidence

Asked for directly: Obsidian Bases carries a search of its own, so the plugin's toolbar box
was a second search over the same rows. The shelf's own search stays — it is scoped to the
untriaged work rather than to the view, which is the one thing the toolbar's box could not
do. [[Quick filter]] and [[The quick filter on the board]] are the two PBIs this drops, both
now `Dropped` with their use cases kept as the record.

Why it costs nothing to lose: a Bases search narrows the RESULTS, and a narrowed result set
is a case this view already serves properly — [[Filtered bases keep their tree]] loads the
ancestors those results need, so the tree keeps its shape instead of degrading to a flat
list of hits.

## Deleted whole

`src/view/filterState.ts` — the needle, the match-path walk, and the two `MatchIndex` sets.
`src/view/render/toolbarFilter.ts` — the box, `renderFilterBox`, `syncFilterUi`,
`revealFilter`. `test/view/filter.test.ts`, `test/view/boardFilter.test.ts` and
`test/view/roadmapMatches.test.ts` went with them; `src/domain/board.ts` lost
`hiddenMatches`, and `src/view/childrenList.ts` lost `undisclosedMatches` and `matchesFor`.

## What every other file lost

**The host contract** (`src/view/host.ts`): `filterText`, `setFilter`, `focusFilter`,
`isFiltering`, `isFilterMatch` and `isRowHiddenUnfiltered` — six members, leaving
`isRowHidden` as the one visibility question. `PlacedMount` lost `face` and `listsChildren`
and is now the item and its mount, which is all `cardedPaths` ever read from it.

**The second population** (`src/view/rowVisibility.ts`): `VisibilityRule` loses `filter`,
`applyFilter` and `scope`, so `visibilityRule()` takes three arguments rather than five and
`rowHidden` asks two questions rather than three. `src/view/projection.ts` loses
`FilterScope` and `filterScopeFor` with it — the distinction only ever existed because the
Deliverables board indexed matches over the unfocused tree.

**The paired count** (`src/domain/board.ts`): `BoardColumn.fullCount` is gone. `overBy` and
`emptyNoState` read `count`, and `boardColumns` / `iterationBuckets` take one visibility
predicate beside `owned` instead of two — the `population` parameter was the filter-lifted
reading and had no other caller. `src/view/render/board.ts` drops `renderCardMatches`,
`renderMatchCount` and the `filtering` flag on `ColumnFrame`.

**Three controls stop pausing.** The tree's chevron (`src/view/render/rows.ts`), a card's
disclosure (`src/view/render/cardChildren.ts`) and the bulk collapse pair
(`src/view/render/toolbarControls.ts`, `collapseCtlsDisabled`) each carried a real
`disabled` flag for the filter alone; the flag and the guard that read it are gone with the
condition. The card disclosure's `if (toggle.disabled) return;` was the last statement
keeping the coverage floor honest — see below.

**Also**: the `/` chord and the Escape-clears-the-filter arm
(`src/view/interactions/keyboard.ts`, where `handleFilterKey` became `handleEscape`),
`addMatchSection` (`src/view/interactions/menu.ts`), the no-match empty state
(`src/view/render/emptyStates.ts`), `nameMatches` (`src/view/render/roadmap.ts`), the filter
term in `renderInputs` (`src/view/rowSignature.ts`), the `pbl-filtering` class
(`src/view/renderPass.ts`), `renderTitleText` and its `.pbl-match` highlight — inlined to
`setText` at five call sites — every `.pbl-filter*` rule in `styles/toolbar.css`,
`styles/toolbarFit.css` and `styles/motion.css`, the match affordances in `styles/cards.css`,
and `count.cardsMatching` / `row.searchMatches` in `src/i18n/en.ts`. The harness lost its
`?filter=` knob.

## The coverage floor, and what it caught

`npm run check` failed on all four thresholds after the removal, which is the arithmetic of
deleting well-covered code — but not only that. The counts said so: total statements fell by
191 while COVERED statements fell by 201, so ten statements that had been covered were not
any more. `vitest.config.mts` says to look for the dead branch before writing the test, and
that is what it was: nine of the ten were `hiddenMatches`, still exported with no caller,
and the tenth was the card disclosure's `disabled` guard, unreachable once nothing set the
flag. Deleting both put all four figures back over their floors — 98.52 / 94.86 / 99.84 /
99.66 against 98.52 / 94.83 / 99.81 / 99.6 — **with no threshold lowered**, which is the
rule this repository holds ("coverage thresholds only ever go up") surviving a deletion
rather than being bent by one.

## What is not recoverable, and what is not lost

Nothing about the data: the filter never wrote anything — not to a note, not to the `.base`,
not to the view-state store. It was session state in the strictest sense, so there is no
migration and no stored value left behind.

What a reader loses is the two affordances that had no equivalent: a match's ancestors
rendered expanded on demand, and the naming of a match too deep to have a card of its own.
A Bases search narrows the results and the tree re-forms around them, which covers the
first; the second has no replacement, and if it is wanted back it is wanted against the
Base's own search rather than a box of ours.
