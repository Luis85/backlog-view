# Roadmap shelf UX — collapse, grouping, sort, filter, and full-width buckets

**Date** 2026-08-04
**Delivers** two new PBIs, neither designed before this increment (see Register work):
one under `[[A third projection]]`, sibling of `[[The unplaced shelf]]`; one under
`[[The horizon board]]`, sibling of `[[Buckets from a horizon property]]`.

## Why this increment, and why now

The shelf and the horizon buckets are both `Built` (per `[[The unplaced shelf]]` and
`[[Buckets from a horizon property]]`), but built as a flat list and a fixed-width
column respectively — neither note anticipated collapse, grouping, sort, filter, or a
width that responds to the screen. This is a live-vault complaint, not a code defect:
the shelf renders correctly, it is simply uncomfortable to use once it holds more than a
handful of items, and the horizon row wastes most of a wide pane on a 260px-wide strip
per bucket while cards stack one per row regardless of how much space is actually free.

Two things came in as one request because they touch the same two files
(`domain/roadmap.ts`, `view/render/roadmap.ts`) and the same stylesheet
(`styles/timeline.css`), but they are independent features with independent acceptance
criteria, which is why they get two backlog notes rather than one.

## Scope

**In:**
- Shelf collapse (default collapsed), remembered per view like `mode`/`axis`.
- Shelf items grouped under always-on type sub-headers, in `ALL_TYPES` order (Epic,
  Feature, PBI, Task, Issue, Bug, Milestone — `domain/settings.ts`'s complete declared
  vocabulary, not just the four-rung `LEVELS` ladder), with a trailing "Other" group for
  any further custom type the model admits when `hierarchyOnly` is off. Fixed order,
  empty groups omitted. Every card the shelf holds lands in exactly one group — the
  shelf's own "no result is ever silently omitted" guarantee must survive grouping.
- A display-only sort control, applied *within* each type group: tree order (default),
  title A→Z, last modified. Never written anywhere — `domain/CLAUDE.md`'s rule that
  order inside a column is derived, never stored, holds unchanged.
- A type filter that hides/shows whole groups. Display-only; the shelf's count badge
  keeps reporting the true total, unaffected by what is currently hidden.
- Visual fixes to the shelf and context strip: uniform card widths (today's wrapping
  flex row shrinks unevenly), the flush-edge spacing, and the horizontal-scrollbar
  overflow bug.
- Horizon buckets grow to fill the available width, sharing it equally down to a
  minimum width, falling back to horizontal scroll only past that point.
- Cards inside a bucket lay out as a responsive grid (multiple columns when the bucket
  is wide enough) instead of a single vertical list.

**Out:**
- The board (confirmed out — it has no shelf, only a no-state column, and no part of
  this request touches it).
- Drag-to-reorder within the shelf (sort is display-only; a written shelf order is a
  different feature with its own justification, not asked for here).
- Per-type-group collapse (only the whole shelf collapses).
- Any interactive control (collapse/group/sort/filter) on the context strip — it keeps
  its flat list, sharing only the visual/CSS fixes.
- Lane/swimlane collapse (`[[Lanes on the roadmap]]`, `[[Swimlanes by parent]]`) and
  board column collapse (`[[Done columns stay lean]]`) — both already anticipated,
  designed separately, unbuilt, and not part of this increment.

## Architecture

### 1. Domain — new `src/domain/shelf.ts`

`domain/roadmap.ts` is at 391 of its 400-line budget, so the grouping/sort/filter logic
is a new sibling file rather than an addition there — one file, one concern, same rule
the rest of the codebase already follows. It imports `ShelfCard` from `roadmap.ts` (the
type stays where it is produced) and exports one pure function:

```ts
function organizeShelf(
  cards: ShelfCard[],
  sort: ShelfSort,          // 'tree' | 'title' | 'modified'
  hiddenTypes: ReadonlySet<string>,
): ShelfGroup[];            // ShelfGroup = { type: string; cards: ShelfCard[] }
```

**The group key is `displayType(item)` (`domain/itemTypes.ts:139`), never raw
`item.typeName`.** `displayType` already exists precisely because the two disagree: an
untyped child infers a `levelIndex` from its parent and is badged Feature/PBI/Task on
every card it already renders on, while `typeName` alone would read `null` for it — and
a declared type's casing (`"task"` in frontmatter) is not the casing `ALL_TYPES` spells
it with. Grouping on `typeName` would put both under `Other` despite the card's own
badge visibly disagreeing. `organizeShelf` resolves each card's key by comparing
`displayType(item)` case-insensitively against `ALL_TYPES` (the same fold
`isExtraType`/`isMarkerType` already use) and keys the group by `ALL_TYPES`'s own
canonically-cased entry when one matches, so the group label is never a copy of
whatever casing one note happened to use.

Group order is fixed — `ALL_TYPES` from `settings.ts` (Epic, Feature, PBI, Task, Issue,
Bug, Milestone), then a trailing `Other` group for any type `ALL_TYPES` doesn't name —
never the input order. A group is omitted entirely when it is empty or its type is in
`hiddenTypes` — same rule, one branch. The `Other` group exists so that a custom type
(reachable when `hierarchyOnly` is off) still gets a home instead of vanishing from the
shelf, which is what a `LEVELS`-only ladder would have done to it, and to every Issue,
Bug and Milestone card besides. Within a surviving group, `'tree'` keeps the input order (the
shelf's existing sibling-order guarantee), `'title'` compares item titles, and
`'modified'` reads `item.file.stat.mtime` — already on every `BacklogItem` via its
`TFile`, so no new field or vault read is needed, only a comparator. Pure, so it is a
node test, no jsdom required — matching why this layer has none today.

### 2. Storage — `src/storage/collapseStore.ts`

Three new optional fields on the existing per-view `StoredEntry`, read exactly as
defensively as `mode`/`axis` already are (unrecognized values dropped, never trusted):

```ts
shelfCollapsed?: boolean;                 // absent means collapsed (the default)
shelfSort?: 'tree' | 'title' | 'modified'; // absent means 'tree'
shelfHiddenTypes?: string[];               // absent means none hidden
```

`shelfHiddenTypes` stores what is hidden, not what is shown, so the common case (nothing
hidden) costs nothing in storage — consistent with the sparse-by-default shape the rest
of the entry already uses.

### 3. View state — `src/view/collapseState.ts` and `src/view/backlogView.ts`

Three accessor pairs on `CollapseState` alongside the existing `mode`/`axis` ones,
backed by the same debounced `scheduleSave`. That much is the exact extension point
`docs/requirements/Lanes on the roadmap.md` and `docs/requirements/Swimlanes by parent.md`
already named for lane collapse, applied here to the shelf instead — but the accessors
alone are not the whole feature, and how the rest of it hooks into `backlogView.ts`
needs more care than `setProjection`/`setAxisPick` alone suggest, for two separate
reasons below.

**Reason one — the toolbar renders before the shelf's own data exists.**
`ProductBacklogView.render()` (`backlogView.ts:385-391`) calls `renderToolbar(this,
this.toolbarEl)` and only afterwards calls `this.renderTreeContent()`, which is the
call that assigns `this.roadmap` from the frame it just built
(`backlogView.ts:394-421`). A `renderShelfControls` gated on "the shelf has a card" —
the way `renderAxisPicker` gates on the configured axis count — would read `host.roadmap`
before that render pass has set it, seeing the *previous* pass's value (`null` on the
very first roadmap render). Filtering makes the same gap wider: `setFilter`
(`backlogView.ts:228-232`) recomputes the filter and calls only
`this.renderTreeContent()`, never the toolbar, because the toolbar holds the filter
*input* and a full rebuild would drop its focus — but that also means a filter that
empties the shelf never gets a chance to hide toolbar-rendered shelf controls, because
nothing tells the toolbar to look again.

The fix already exists in this file as a pattern, not as something to invent:
`syncCountLabel` and `syncFilterUi` are exactly this — toolbar elements built once,
whose *values* are synchronized separately, after content renders, from data the toolbar
pass itself couldn't see yet. So: `renderShelfControls` builds the collapse toggle, the
sort `<select>` and the type-filter checkboxes unconditionally whenever
`host.projection === 'roadmap'` — structure only, no gate on shelf population, the same
way the filter input always exists regardless of whether anything currently matches. A
new `syncShelfControls(host, toolbarEl)`, called at the end of `renderTreeContent()`
beside `syncCountLabel` (where `host.roadmap` is finally current), does the rest: shows
or hides the whole cluster based on the shelf's total card count — *not* narrowed by the
type filter, since hiding every group must never also hide the only control that can
un-hide one — updates the count text, and sets each control's checked/selected state
from the persisted `CollapseState` values. Calling it from `renderTreeContent()` means it
runs after `setFilter` too, with no separate wiring for that path.

**Reason two — a setter must not cost the control its own focus.** Calling a full
`this.render()` from a shelf setter would tear down and rebuild the whole toolbar,
including whichever `<select>` or checkbox the user just activated — a keyboard user
changing the sort or clearing several type filters in a row would lose focus back to the
document after each one. `setFilter`'s own doc comment states the rule this needs:
*"Re-render only the content pane — used by the filter so the toolbar input keeps
focus."* So `BacklogViewHost` (`host.ts`) gains three methods — `setShelfCollapsed`,
`setShelfSort`, `setShelfHiddenTypes` — each shaped exactly like `setFilter`, not like
`setProjection`: write the field on `this.collapse`, then call `this.renderTreeContent()`
alone. The content pane rebuilds (the newly (in)visible groups, the possibly-changed
pane role — see §4), `syncShelfControls` updates the existing controls' attributes in
place, and none of it recreates the element the user's focus is sitting on.

### 4. Rendering — toolbar chrome plus a shelf content module

**The interactive controls are toolbar chrome, not shelf-interior markup.** This is the
one place the original draft of this design was wrong: `view/render/roadmap.ts`'s
`renderShelf` builds inside `treeEl`, and `treeEl` carries `role="listbox"` whenever any
roadmap cards render (`render/projections.ts`) — the same composite-widget contract the
board and the tree already live under, spelled out in `view/CLAUDE.md`'s "Two tab-stop
zones" section: the tree/roadmap pane is ONE tab stop, its own per-row controls are
`tabindex="-1"` buttons reachable through a context menu, and nothing else is Tab-
reachable inside it. A `<select>` and a set of checkboxes do not fit that contract
either way — `tabindex="-1"` would make them unreachable by keyboard entirely, since
unlike a per-card action they have no row, no context menu, and no place in the roadmap's
linear card walk to attach to.

The existing precedent for exactly this shape of control is `renderAxisPicker` in
`toolbar.ts` (327-340): rendered in the toolbar bar (`barEl`), a sibling of `treeEl`
rather than a descendant, using ordinary `iconButton`s wired straight to a
`BacklogViewHost` setter. `renderShelfControls` and `syncShelfControls` (§3) follow the
same shape but do not fit in `toolbar.ts` itself — that file is at 387 of its 400-line
budget, tight enough that two more render functions plus a sync function would clear it
— so both go in a new `src/view/render/shelfControls.ts`, called from `renderToolbar`
and `renderTreeContent` respectively exactly the way `renderAxisPicker` and
`syncCountLabel` already are. The collapse toggle carries the shelf's name and count as
its own label ("Unplaced (12)"), the same way each mode-toggle button already carries an
icon and a label, so that information exists once rather than being repeated inside
`treeEl` as well. **Only** the shelf's card content — the grouped, sorted, filtered
`.pbl-card`s themselves — keeps rendering inside `treeEl`'s listbox, exactly as
`renderShelf` does today, since those already participate in the roadmap's card walk as
they always have.

`view/render/roadmap.ts` currently owns `renderShelf` (154-196) and `renderContextStrip`
(204-218); with the interactive header moved out to `shelfControls.ts`, what is left to
grow is the grouped-card rendering itself (`organizeShelf`'s output turned into DOM),
which is still enough new markup to justify a new `src/view/render/shelf.ts` rather than
pushing `roadmap.ts` further past its own budget — `renderContextStrip` moves there too,
since it shares the card-layout CSS and the same file already owns both today.

**Collapsing must remove shelf cards from keyboard navigation, not merely hide them.**
`renderRoadmap` (`roadmap.ts:27-63`) accumulates every card it draws — buckets or
timeline, then the shelf, then the context strip — into one flat `cards` array that
becomes `RoadmapSnapshot.cards`, and `handleRoadmapNavigationKey`
(`interactions/keyboard.ts:349-363`) walks exactly that array with no visibility check
of its own: whatever is IN the array is reachable by Arrow/End, full stop. A CSS-only
collapse (hide the groups, still return their cards from `shelf.ts`'s render function)
would leave collapsed cards fully keyboard-reachable — `aria-activedescendant` could
point at something invisible, and a pane that is entirely shelved-and-collapsed would
keep `role="listbox"` with no reachable option in it. The fix costs nothing new to build:
an empty shelf already contributes zero cards to this array (today's `renderShelf`
returns `[]` when there is nothing to place), so collapsing the shelf is specified to do
exactly the same thing regardless of how many cards it actually holds — `shelf.ts`'s
render function returns `[]` for `cards` whenever collapsed, full stop, independent of
population. `render/projections.ts:118`'s existing
`role: roadmap.cards.length > 0 ? 'listbox' : 'region'` then recomputes correctly with
no new logic: an all-shelved, collapsed roadmap already becomes `role="region"` the
moment its `cards` count is honestly zero. **The shelf remains a valid DROP target while
collapsed regardless** — that is a different fact from being a keyboard-navigable card,
proven already by the empty-shelf case, which is wired to `dnd` and reachable by drag
while contributing zero cards to the same array. This is the invariant this design
already called out for its own test: the shelf stays a drop target for
`performHorizonMove(item, null)` while collapsed, even though none of its cards are in
`RoadmapSnapshot.cards` at that moment. This is exactly the kind of claim `CLAUDE.md`
asks to be a test, not a comment — modeled on `test/view/contextRowWrites.test.ts`'s own
pattern of driving the rule rather than the implementation.

### 5. Styles — new `styles/shelf.css`, changes to `styles/roadmap.css`

The shelf's CSS lives in `styles/timeline.css` today, which its own doc comment already
flags as a surprise. Rather than growing that file further, shelf and context-strip
styling move to a new `styles/shelf.css` partial — one partial, one concern, matching
the rule the rest of `styles/` already follows — added to `styles/index.css` in the
position its load-order comment calls for.

- `.pbl-shelf-cards` / `.pbl-roadmap-context .pbl-shelf-cards` (today's wrapping flex
  row, the direct cause of uneven card widths) become
  `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` — matching the bucket
  card grid below, so every card in the roadmap is sized the same way.
- Spacing and the horizontal-overflow bug get a pass alongside the rewrite — both were
  living in code being rewritten anyway.
- `styles/roadmap.css`: `.pbl-bucket` changes from `flex: 0 0 260px` (with today's
  `min-width: 0`, which lets a flex-shrink basis be ignored entirely) to
  `flex: 1 1 280px; min-width: 280px` — the explicit `min-width` is what actually stops
  the shrink at 280px; `flex-basis` alone is not a floor once shrinking is enabled. Only
  past that floor does the row overflow into its existing `.pbl-tree` horizontal scroll.
  `.pbl-bucket-cards` changes from
  a flex column to `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); align-content: start` —
  the same grid rule as the shelf, so a wide bucket shows multiple card columns and a
  narrow one (many buckets, or a narrow pane) stays single-column with no code branch
  needed for either case. `align-content: start` is not optional: `.pbl-roadmap-buckets`
  is a flex row with `align-items: stretch`, so every bucket already stretches to the
  tallest one, and `.pbl-bucket-cards`'s retained `flex: 1 1 auto` fills that surplus
  height — as a flex column that surplus was blank space below the last card, but a
  grid's default `align-content: normal` would stretch the grid's own rows into it,
  rendering a sparse bucket's one or two cards abnormally tall instead of their natural
  size. The shelf does not need the same override: `.pbl-shelf` is not a row-flex child
  stretched by a sibling, so its groups have no surplus height to absorb.

## Testing

- **Domain** (`test/domain/`, new file beside `shelf.ts`): fixed group order regardless
  of input order (including `Other` for an off-ladder type); empty groups omitted; each
  sort variant (`tree`, `title`, `modified`); a hidden type's group entirely absent from
  the output. Two separate conservation assertions, not one: with no hidden types, the
  output's total card count equals the input length (grouping alone drops nothing); with
  `hiddenTypes` non-empty, it equals the input length minus the cards whose type is
  hidden (the filter is the only thing allowed to drop a card, and it must drop exactly
  those). Two more directly from the group-key correction: an untyped child with an
  inferred `levelIndex` groups under that inferred level, not `Other`; a declared type
  spelled in a different case than `ALL_TYPES` (`"task"` vs `"Task"`) groups under the
  canonical entry, not a second, casing-distinct group.
- **Storage** (`test/storage/collapseStore.test.ts`): round-trip for the three new
  fields, and defensive rejection of a malformed stored value for each — mirroring the
  existing `mode`/`axis` coverage exactly.
- **View** (`test/helpers/roadmap.ts` gains group-aware accessors; tests land in
  `test/view/roadmapFrame.test.ts` or a new `test/view/shelfUx.test.ts` if the existing
  file's budget doesn't allow):
  - Default-collapsed on first render; the sort control changing display order within a
    group without touching group order; the type filter hiding a group while the total
    count stays unchanged.
  - The shelf controls exist in the toolbar (not inside `treeEl`'s `role="listbox"` —
    querying within the listbox element finds nothing, querying the toolbar bar finds
    all three) on the very FIRST roadmap render, before any content has rendered once —
    the regression `renderShelfControls` gating on live shelf data would reintroduce.
  - Toggling the quick filter down to an empty shelf hides the shelf-controls cluster
    without a full toolbar rebuild, and back again when the filter clears — proving
    `syncShelfControls` runs on the `renderTreeContent`-only path `setFilter` already
    uses, not only on a full `render()`.
  - Activating a shelf control (sort, filter, collapse) leaves the OTHER toolbar
    elements' identity unchanged (e.g. the mode-toggle buttons are the same DOM nodes
    before and after) — the test that catches a shelf setter calling `this.render()`
    instead of `this.renderTreeContent()`, since a full rebuild would pass every
    behavioral assertion above while still discarding focus.
  - Collapsing the shelf removes its cards from `RoadmapSnapshot.cards`: Arrow/End from
    the last visible axis card does not land on a shelved item, and a roadmap whose
    every result is shelved-and-collapsed renders `role="region"`, not `role="listbox"`
    with nothing reachable in it.
  - The collapsed-but-still-a-drop-target invariant from §4 — driven the way
    `contextRowWrites.test.ts` drives its own invariant, so a future change to the
    collapse toggle fails it without anyone having to predict the surface.
- The full-width / grid **visual** behavior itself is not something jsdom can verify —
  it has no layout engine. `npm run test-build` is the honest answer here, named
  explicitly rather than claimed as covered by the DOM tests above.

## Register work

| Note | Change |
| --- | --- |
| New PBI under `[[A third projection]]`, sibling of `[[The unplaced shelf]]` | Collapse (default collapsed), type grouping, sort, filter, and the shelf/context-strip visual fixes. Title and exact order number decided when the note is authored. |
| New PBI under `[[The horizon board]]`, sibling of `[[Buckets from a horizon property]]` | Full-width buckets with a minimum-width scroll fallback, and the multi-column card grid inside each bucket. |
| `docs/README.md` | The Product Roadmap paragraph gains a third and fourth increment once both PBIs are `Done`. |

No existing note changes status or gets amended — both ideas are genuinely new ground,
per the research this brainstorm ran before writing this spec (no doc anywhere proposes
or rejects shelf collapse, shelf grouping, or a responsive bucket grid).

Two visual defects the user reported (uneven card widths, flush-edge spacing, and a
horizontal-scrollbar overflow) are folded into the first PBI's acceptance criteria
rather than filed as separate Bug notes — they are being fixed by the same CSS rewrite
in the same change, so a standalone Bug note would open and close in the same PR and add
bookkeeping without tracking anything real.

## Definition of done

`npm run check` passes — build, lint, coverage-thresholded tests, fallow, docs register
— with the two new PBI notes authored (full frontmatter, use case, acceptance criteria,
`Where it lives`) before `npm run check`'s docs gate is satisfied, since every module in
`src/` must be specified by one. The grid/full-width visual behavior is recorded as
verified only after a live-vault look via `npm run test-build`, never claimed from the
jsdom suite alone.
