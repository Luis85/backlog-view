# Release map — design

Date: 2026-10-12. Status: approved in conversation, awaiting written-spec review.

## Intent

A second tab in the release view (`product-release`) that draws the release plan as a
stakeholder-friendly roadmap: which release comes when, and what is in it. A review starts on
the map; a click on a release opens that release's existing scope screen for the details.

**Said by the user:** a second tab; a dedicated page; visualizes the planned cadence; start a
review there, then go into details. Click → the release's scope screen (not a cross-view jump).
Segments with a derived start drawn faded and labelled. Facts plus headline scope per release.
Time runs horizontally, one row per release.

**Assumed (agreed in the design sections):** the tab is view state, never a `.base` setting;
the map writes nothing; it reuses `domain/timeline.ts`.

## Boundaries kept

- A release states one planned date (target) and one record date (released). The map invents
  no stored date. The only derived value is a segment's START, and it is drawn faded, dashed
  and labelled as derived wherever it appears (tooltip and spoken label).
- [[Release Management]] refuses scheduling and history charts. The map draws only dates the
  notes hold plus that one labelled derivation; it charts no past scope.
- Nothing is persisted except the tab choice (localStorage, ADR 0011).

## 1. Structure, state and navigation

- **Tab state.** New `ViewPrefs` key `releaseTab`, validated in `PREF_READERS`
  (`storage/viewStateStore.ts`). Only `'map'` is stored; absence means the list. It is not a
  member of `PROJECTION_MODES`.
- **Tab control.** A two-button group, `List | Map`, in the index screen's `.pbl-rel-actions`
  bar, styled like the backlog mode toggle (`.pbl-btn-group`). `aria-pressed` on the current
  one. The scope screen does not draw it.
- **Dispatch.** `ReleaseView.draw()`: the empty states (no type, no releases) stay first for
  both tabs; with no pick, `releaseTab === 'map'` draws `renderMap`, else `renderIndex`.
- **Navigation.** A row or shelf card calls the existing `pick(path)`. Back calls `pick(null)`,
  which draws the stored tab, so the reader returns to the map.
- **Modules.** `src/domain/releaseMap.ts` (pure), `src/view/release/renderMap.ts` (DOM), one
  stylesheet partial `styles/releaseMap.css` imported from `styles/index.css`.
- **Writes.** None.

## 2. What the map derives (`domain/releaseMap.ts`)

Input: the `ReleaseIndex` the view already builds, the `releaseScope` roots per release, and
today. Output: a `ReleaseMap { rows, shelf, window }`.

- **End.** `released` if shipped, else `target`. A row needs a readable end.
- **Order.** By end ascending; ties keep the index's own order (rank, then path).
- **Derived start.** The end of the previous row in that order. The first row has no start and
  draws only its end marker. Equal ends give a zero-length lead-in (marker only).
- **Shipped.** Kept, drawn muted at the released date. If `slip` is non-zero, a tick at the
  target date and the slip text from the list ("N days late" / "N days early").
- **Overdue.** In flight with a past target: ends at the target, flagged with `overdue`.
- **Window.** `timelineWindow` over every row's span (start..end, or end..end) plus today.
  Scale fixed to month (`scaleFor('month')`).
- **Headline scope.** The roots of `releaseScope` for that release, in its order; at most 5,
  then a count of the rest. An empty release reports zero members ("No items yet").
- **Shelf ("Not scheduled").** In-flight releases with no readable target, in index order.
  Shipped releases always have an end and never land here.

## 3. What the page draws (`view/release/renderMap.ts`)

- **Ruler.** Month cells with year super-cells (`timelineCells`, `superCells`), sticky at top.
- **Today line.** Full-height, as on the backlog roadmap.
- **Rows.** One per map row, in date order. Each row: a faded dashed lead-in from the derived
  start to the end; an end marker (diamond); for a slipped shipped release, the target tick;
  then the card to the right of the end marker. The track gets a right-hand gutter one card
  wide so the last card is not clipped.
- **Card.** Name, version, status chip, target date with "N days left" / overdue / shipped,
  progress bar with "x of y done", headline scope list with "+N more".
- **Interaction.** Each row is one `button` (as `.pbl-rel-band` is); its accessible name
  reuses the list's spoken facts plus "start derived from the previous release" when a lead-in
  is drawn. Tab order is date order. Click or Enter → `pick(path)`.
- **Below the rows.** The shelf, then the unresolved footer (`drawUnresolved`, reused).
- **Text.** Every sentence via `t()`; dates via `formatDate`; numbers in the user's locale.
  Names, versions and status values are data and are not translated.
- **Style.** Obsidian CSS variables only; no inline styles (`setCssProps` for geometry).

## 4. Tests and docs

- **Domain (node):** order; derived start; first row without lead-in; same-day ends; shipped
  with slip; overdue; shelf; headline cap and remainder count.
- **View (jsdom):** the tab switch draws the map and persists `releaseTab`; a row click opens
  the scope and Back returns to the map; empty states identical on both tabs; the map is
  covered by `test/i18n/projections.test.ts`.
- **Harness:** `?tab=map` on `test/harness/release.ts`, with a fixture shaped like an
  eight-release plan.
- **Register:** a new PBI under [[Release Management]] whose `## Where it lives` names
  `domain/releaseMap.ts` and `view/release/renderMap.ts` (docs-check rule 7); a
  `CHANGELOG.md` `[Unreleased]` entry.
- **Gate:** `npm run check`. A live-vault look stays owed (`npm run test-build`).

## Not in scope

Scale switching, zoom, drag to reschedule, printing/export, cross-view navigation to the
backlog view. Each is a later note if asked for.
