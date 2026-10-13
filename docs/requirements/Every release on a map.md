---
type: PBI
parent: "[[Every release at once]]"
order: 20
status: Open
created: 2026-10-12
source: user request — release map design, 2026-10-12
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

# Every release on a map

**As** someone reviewing a release plan with stakeholders, **I want** the releases drawn on
one timeline with what each one holds, **so that** a review can start from the cadence and
go into any release from there.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reviewing the release plan |
| **Trigger** | Pressing **Map** on the release view's index |
| **Preconditions** | The property that holds a note's type is mapped, and the base holds a release |
| **Guarantee** | The map writes nothing to any note or to the `.base`. The only date it draws that no note holds — a row's start — is always faded and labelled as derived. Every figure on a card is the list's own. |

**Main flow**

1. The reader presses **Map** in the index's `List | Map` control. The choice is remembered
   per device and per saved view, never in the `.base`.
2. The view orders the releases by their end — the released date once shipped, the target
   otherwise — and draws one row each under a month ruler, with today marked. The map opens
   with today centred and, in view, the earliest release painted overdue — else the first
   release not yet past, else the last.
3. Each row draws a faded band from the previous row's end to its own, labelled as a derived
   start; a marker at its end; and a card: the name, version and status; the date with its
   days figure, overdue count or slip, and the progress bar; then the first three top-level
   items of its scope and a count of the rest.
4. Beneath the rows, a **Not scheduled** shelf holds the releases still in flight with no
   readable target, then the count of unresolved memberships the list also reports.
5. The reader picks a row or a shelf card, and that release's screen opens. **Back** returns
   to the map.

**Extensions**

- **1a — the type property is not mapped, or the base holds no release.** The empty state is
  the list's own, identical on both tabs, and no tab control is drawn.
- **1b — the remembered tab is a value this version did not write.** The list is drawn,
  without an error.
- **1c — the base is embedded in a note.** The tab is kept for the session only, as the
  picked release is.
- **2a — two releases end on the same day.** The second draws its marker and no band; their
  order is the list's own (rank, then path).
- **2b — the first row.** No start can be derived, so it draws its marker alone.
- **2c — a release ends past what the ruler can draw.** The ruler is bounded around today;
  the marker is pinned to its edge and drawn hollow with a dashed border, so it does not
  claim the date it sits at, and the card still states the date.
- **3a — a release shipped late or early.** A tick marks its target and a short stub joins
  the tick to the released date — the error colour when late, the success colour when
  early — so a slip never reads as a lead-in.
- **3b — a release is overdue.** It ends at its target and is painted overdue exactly where
  the list paints it: never while the released-date property is unbound or unreadable.
- **3c — a release has no members.** Its card says so and lists no scope.
- **4a — a release's target is unreadable.** It goes on the shelf, and its card says the
  target is unreadable.
- **4b — no release lacks a date.** No shelf is drawn.
- **4c — the target property is unbound.** Every release still in flight is on the shelf, and
  the note beneath the map names Target as a figure no property is bound for — the list's own
  note. An unbound released date is named there the same way.

## Acceptance criteria

- Pressing Map draws the map and stores only `map`; pressing List removes the stored value.
- Rows are in end-date order, ties in the list's own order. Each row after the first, unless
  it ends the same day, carries a band from the previous end, named as derived in its tooltip
  and in its accessible name.
- A shipped release with a non-zero slip draws a tick at its target and a stub in the error
  (late) or success (early) colour.
- A card lists at most three top-level scope items, then `+N more`.
- In-flight releases without a readable target are on the shelf; a shipped release never is.
- A row or a shelf card opens that release, and Back returns to the map.
- Arriving on the map centres today and scrolls into view the earliest release painted
  overdue, else the first release not yet past, else the last row; a redraw of the map
  keeps the reader's place.
- Nothing on the map writes to a note or to the `.base`.

## Where it lives

`src/domain/releaseMap.ts` derives the map from the `ReleaseIndex` that
`src/domain/releases.ts` builds for the list: the order by end, the derived start, the slip
tick, the headline over `releaseScope`, and the shelf, with the window from `timelineWindow`
in `src/domain/timeline.ts`. It computes no figure the list does not, so a card and a band
cannot disagree. The tab is the `releaseTab` pref in `src/storage/viewStateStore.ts`. Tested
in `test/domain/releaseMap.test.ts`.

`src/view/release/renderMap.ts` draws it: the ruler from `superCells` and `timelineCells`,
the grid lines `src/view/render/timeline.ts` draws for the roadmap, the today line as the
roadmap's own `.pbl-today` element (styled in `styles/timeline.css`), the band,
marker and slip stub placed by `barGeometry`, and a card built from
`src/view/release/renderIndex.ts`'s own band parts. `src/view/release/releaseView.ts` holds
the tab, restores it with the pick, and draws the map in place of the list when it is set.
Tested in `test/view/release/releaseMap.test.ts`.
