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
- Shelf items grouped under always-on type sub-headers (Epic → Feature → PBI → Task,
  the fixed vocabulary `domain/settings.ts` already declares as `LEVELS`), fixed order,
  empty groups omitted.
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

Group order is the fixed level ladder (`LEVELS` from `settings.ts`), never the input
order. A group is omitted entirely when it is empty or its type is in `hiddenTypes` —
same rule, one branch. Within a surviving group, `'tree'` keeps the input order (the
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

### 3. View state — `src/view/collapseState.ts`

Three accessor pairs alongside the existing `mode`/`axis` ones, backed by the same
debounced `scheduleSave`. No new save path, no new identity handling — this is the exact
extension point `docs/requirements/Lanes on the roadmap.md` and
`docs/requirements/Swimlanes by parent.md` already named for lane collapse, applied here
to the shelf instead.

### 4. Rendering — new `src/view/render/shelf.ts`

`view/render/roadmap.ts` currently owns `renderShelf` (154-196) and `renderContextStrip`
(204-218). The shelf header always carries the name, the count, and the collapse toggle
(a real `<button>`, not a styled `div`, so keyboard and screen-reader access come for
free). Only when expanded does it also carry the sort `<select>` and the type-filter
checkboxes, followed by a `.pbl-shelf-group` block per surviving group from
`organizeShelf` — nothing to sort or filter is visible while collapsed, so those
controls stay out of the header until there is. That is enough new markup and behavior
to justify pulling shelf rendering into its own file rather than growing `roadmap.ts`
past its own budget — `renderContextStrip` moves too, since it shares the card-layout
CSS and the same file already owns both. `roadmap.ts` keeps calling into `shelf.ts`
exactly where it calls `renderShelf` today.

**Invariant that must survive this change, and gets its own test:** the shelf remains a
valid drop target for un-placing a card while collapsed. Collapsing is a view
convenience; it must never gate the write path `performHorizonMove(item, null)` already
uses. This is exactly the kind of claim `CLAUDE.md` asks to be a test, not a comment —
modeled on `test/view/contextRowWrites.test.ts`'s own pattern of driving the rule rather
than the implementation.

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
- `styles/roadmap.css`: `.pbl-bucket` changes from `flex: 0 0 260px` to
  `flex: 1 1 280px`, so buckets share the row's full width equally down to 280px before
  the row falls back to its existing horizontal scroll. `.pbl-bucket-cards` changes from
  a flex column to `display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` —
  the same grid rule as the shelf, so a wide bucket shows multiple card columns and a
  narrow one (many buckets, or a narrow pane) stays single-column with no code branch
  needed for either case.

## Testing

- **Domain** (`test/domain/`, new file beside `shelf.ts`): fixed group order regardless
  of input order; empty groups omitted; each sort variant (`tree`, `title`, `modified`);
  a hidden type's group entirely absent from the output; the count of `organizeShelf`'s
  output cards across all groups always equals the input length (nothing silently
  dropped by grouping, only by the explicit hide).
- **Storage** (`test/storage/collapseStore.test.ts`): round-trip for the three new
  fields, and defensive rejection of a malformed stored value for each — mirroring the
  existing `mode`/`axis` coverage exactly.
- **View** (`test/helpers/roadmap.ts` gains group-aware accessors; tests land in
  `test/view/roadmapFrame.test.ts` or a new `test/view/shelfUx.test.ts` if the existing
  file's budget doesn't allow): default-collapsed on first render, the sort control
  changing display order within a group without touching group order, the filter
  hiding a group while the count badge stays unchanged, and the collapsed-but-still-a-
  drop-target invariant above — driven the way `contextRowWrites.test.ts` drives its own
  invariant, so a future change to the collapse toggle fails it without anyone having to
  predict the surface.
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
