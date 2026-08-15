---
type: PBI
parent: "[[The resource timeline]]"
order: 50
status: Done
created: 2026-08-14
closed: 2026-08-14
source: User request — "resource rows should be collapsible", with the toolbar's click-action toggle asked for alongside
files:
  - src/storage/collapseStore.ts
  - src/view/backlogView.ts
  - src/view/collapseState.ts
  - src/view/host.ts
  - src/view/render/lanes.ts
  - src/view/render/rows.ts
  - src/view/render/timeline.ts
  - src/view/render/toolbarControls.ts
  - src/view/uiState.ts
---

# Folding a resource's band

**As** someone reading a plan across a whole team, **I want** to shut a resource's row and
to fold a bar's subtree inside it, **so that** a roster longer than the pane stops being a
scroll and the rows I am actually comparing sit next to each other.

[[Showing a resources axis on the roadmap]] drew the rows FLAT and said why: membership is
the note's own assignee, so a parent and its child routinely sit in different bands, and a
chevron that folded an ancestry would let one person's chevron hide another person's bar.
That reasoning was right about the hazard and wrong that it made folding impossible — it
rules out an ancestry fold computed over the whole grid, and says nothing about one
computed per band.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Pressing a band's disclosure, or a bar row's, on the resources axis |
| **Preconditions** | Roadmap mode is on with the resources axis |
| **Guarantee** | Two folds, and neither reaches past what it is drawn on: a band's shuts its bars and the notes it places, leaving the header — its own stretches included, since they draw in the header's track rather than a row (4n in [[Resource absences]]) — on screen; a bar's shuts the rows beneath it **in its own band and nowhere else**. Both survive a reopen; neither writes anything to any note. |

**Main flow**

1. The user presses the disclosure on a resource's header.
2. The band shuts: its bars and the notes it places go, and the header stays — with its
   count, its controls and its own stretches, which were never rows for the fold to take.
3. The pick is remembered for this saved view on this device, and the band is shut again
   the next time the view opens.

**Extensions**

- **1a — the user presses a BAR row's disclosure instead.** Its descendants drawn in the
  same band go, exactly as they do on the plain dated axis. The bit is the dated axis's
  own (`TIMELINE_SCOPE`), so a subtree shut on one grid is shut on the other: it is one
  fact about one plan, and two bits would let the two grids disagree about it.
- **1b — the bar's children are in another band.** It draws no disclosure at all. Not a
  refusal but the honest answer — it is holding nothing back from where it sits, and the
  rows in question are somebody else's.
- **1c — a click on the row itself, with the toolbar's fold-on-click toggle on.** The bar
  row folds, the same gesture the dated axis has. That toggle is now offered on both grid
  axes; it was withheld here while nothing folded, which was correct then and would be the
  "one input goes quiet" failure now.
- **1d — a band with nothing in it.** It draws a disclosure anyway. A declared resource
  with no work is exactly the row a roster exists to put on screen, and a control that
  appeared only once work arrived would move under the reader — folding an empty band is
  still how a long roster is got out of the way.
- **2a — a band that is shut while a quick filter runs.** The filter overrides it, as it
  overrides every other fold: everything on a path to a match renders open, and the
  disclosure is disabled rather than merely inert.
- **3a — a parent nobody has ruled on.** It opens SHUT, which follows from sharing the
  dated axis's bit rather than from a decision taken here — `collapseNewParents` settles a
  new parent closed in that scope. The toolbar's expand-all is the way out, and the band
  fold is the coarser control beside it.
- **3b — the resource is renamed, or leaves the roster.** Nothing migrates the entry and
  nothing needs to. A resource is a name somebody typed, not a file, so there is no rename
  event to follow; a name no row draws simply has no band to shut, and the entry costs one
  string until the reader folds something else.

- **3c — every band that holds work is folded.** The roadmap says nothing about being
  empty, because it is not: the headers, their counts and their load rails are on screen
  and one press reopens any of them. The advisory counted the rows the axis DREW, and a
  folded band draws none, so shutting the last open band reported that every item was done
  and hidden. Found in review (2026-08-15) on the milestones' row, which reaches the same
  defect from the other side. Fixed where the count is rather than beside the fold —
  [[Roadmap empty states]] 3b.

## Acceptance criteria

- A band's disclosure shuts its bars and the notes it places, and leaves its header, count,
  controls and its own stretches on screen.
- Folding every band leaves the roadmap reporting nothing about emptiness.
- A bar row's disclosure shuts its descendants **in that band only**; a bar whose children
  are all in other bands draws no disclosure.
- Both folds survive closing and reopening the view, and neither is written to the `.base`.
- The fold-on-click toggle is offered on the resources axis and governs a bar row's fold
  there; it stays absent on the horizon axis, where the cards have no rows to fold.
- A running quick filter overrides both folds and disables both disclosures.
- An empty declared band still draws a disclosure.

## Where it lives

The subtree fold cost no new mechanism at all: `laneEntries` in
`src/view/render/lanes.ts` calls `timelineRows` — the dated axis's own row builder — once
PER LANE, with that lane's bars. That function's `drawn` set is what does the scoping:
handed one band's bars, `barAncestors` can only find an ancestor drawn in that band, so a
chevron reaches the rows beneath it in its own row and nothing else, and a parent whose
children are elsewhere reports `hasChildren: false` and draws the leaf placeholder. The
hazard [[Showing a resources axis on the roadmap]] recorded is answered by the argument
list rather than by a guard.

`collapseKey` in `src/view/backlogView.ts` therefore asks `drawsGrid` rather than
`=== 'dates'`, and `clickActionApplies` in `src/view/render/toolbarControls.ts` does the
same — the two places that decided "the dated axis and only the dated axis", both now
meaning "a grid with bar rows on it".

**The band fold is a third collapse question, and it needed a third home.** It is asked of
a NAME: a resource is not a note, so it has no path to key a bit under, and every piece of
machinery the collapse key space carries is about paths — the flush prunes any entry the
vault has no file for, the rename migration moves entries when a note moves, and
`collapseNewParents` settles new parents. A band key would have been dropped on the first
save. So it is stored beside the shelf's own hidden-type set (`collapsedLanes` in
`src/storage/collapseStore.ts`), which is the same shape for the same reason — a per-view
set of names — and reached through `isLaneCollapsed`/`setLaneCollapsed` on
`BacklogViewHost`.

The header's disclosure is `renderLaneChevron` calling `renderChevron` from
`src/view/render/rows.ts` — the same control every other fold in this plugin draws,
refactored for exactly this caller rather than copied beside it: its three per-caller
answers (which bit to flip, what to redraw, what the row's role already announces) are
parameters of `DisclosureState` now, so a band passes a toggle over a NAME and inherits
the four guards a second control would have had to remember — the filter override, the
real `disabled` flag, the middle click that never fires `click`, and the focus report. A
BUTTON, because the header claims no role for `aria-expanded` to sit on otherwise.

**A folded band still says where its work LIES, since 2026-08-14** — `renderLaneRail` in
`src/view/render/lanes.ts`, one thin strip per continuous run of days (`mergeSpans` over the
lane's own bars), drawn only while the band is shut and otherwise decoration alone:
`aria-hidden`, no pointer events, no tooltip, because everything it stands for is one click
away. It needed the window widened for a folded band's bars the same way an absence already
needed it — `drawnSpans` in `src/view/render/lanes.ts` reads a lane's bars from the entry
list itself, gated on that lane entry's own `collapsed`, so only a band that is actually shut
(and therefore actually drawing this rail) widens the window for them; an OPEN band's
row-collapsed subtree must not, since nothing of it draws at all — not a row, not a rail.
That gate gained a second arm on 2026-08-15 and the rule behind it is unchanged: the
milestones' row ([[Milestones out of the resource rows]]) draws every marker in its own
header track and produces no bar rows at all, open or shut, so it widens the window from
`lanes` for exactly the reason a folded band does — a mark drawn where the entry list draws
nothing.
Narrowing the fix to that distinction is its own record, in
[[The load rail drew nothing for a folded band's own far-off work]].

**A model-driven fold default was asked for on 2026-08-14 and refused as INERT.** The
request was "a band with no work folds itself", which needs a second stored set beside
`collapsedLanes` — an explicit set of folded names cannot express "folded unless opened".
It buys nothing: once the stretches moved into the header's own track (4n), a lane with no
bars has nothing beneath its header, so `laneEntries` emits the identical list either way.
The default would have shown a chevron pointing right and cost a first load after upgrade
where every empty lane folded itself once, which reads as data loss. The check that keeps
this honest is in `test/view/resourceLanes.test.ts`: a lane with no work renders the same
rows folded and open.

What a live vault still owes: whether a folded band reads as a row to reopen rather than a
row that went, and how a band's disclosure sits beside a bar row's one line below it.
