---
type: PBI
parent: "[[The resource timeline]]"
order: 10
status: Done
created: 2026-08-13
source: user request
files:
  - src/domain/roadmap.ts
  - src/domain/settings.ts
  - src/domain/settingsConsistency.ts
  - src/domain/settingsResolve.ts
  - src/domain/viewOptions.ts
  - src/storage/viewStateStore.ts
  - src/storage/frontmatter.ts
  - src/view/backlogView.ts
  - src/view/resize.ts
  - src/view/interactions/create.ts
  - src/view/manual/setupSection.ts
  - src/view/render/lanes.ts
  - src/view/render/legend.ts
  - src/view/render/projections.ts
  - src/view/render/roadmap.ts
  - src/view/render/shelf.ts
  - src/view/render/timeline.ts
  - src/view/render/toolbarControls.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-13
due: 2026-08-13
risk: ""
assignee: ""
---

# Showing a resources axis on the roadmap

**As** someone planning across a team rather than one backlog, **I want** a row per
resource on the roadmap, with each person's assigned work positioned by its own dates,
**so that** "who has what, and when" is one screen instead of a mental join between the
assignee column and the dated axis.

The row list is the board's own rule applied to a new property: declared names render
whether or not anything is in them yet, exactly as [[Buckets from a horizon property]]
already renders an empty horizon. Where this axis differs from that one on purpose is
that nothing has to be declared at all — [[Assignment]]'s whole premise is that nobody
declares who exists, and this axis keeps that premise rather than asking for a second
vocabulary the way the horizon values do.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders with the resources axis |
| **Preconditions** | Roadmap mode is on, and a resources axis is configured — an assignee property, plus a start or target date property, the same two properties assignment and scheduling already use. A roster of resource names is optional. |
| **Guarantee** | Every declared resource renders, empty or not; a result's row comes from its own assignee value alone, its position from its own dates alone, and no date is ever read as an assignee or the reverse; no result is lost for naming an undeclared resource or for having no date to sit at — it shelves instead. |

**Main flow**

1. The user names a roster of resources in the view options (`resourceNames`) — optional,
   the same shape as the horizon values but with nothing prefilled, since nobody declares
   who exists — beside the assignee and date properties already configured.
2. Each declared resource renders as a row, in declared order, empty or not.
3. Every result whose assignee value names a row renders as a bar in that row,
   positioned exactly where the dated axis would place it — its own dates first, a
   dateless parent's inferred from its descendants exactly as
   [[Spans roll up the tree]] already gives it, and the shelf only where neither exists.
4. A bar carries what a dated-axis bar carries.

**Extensions**

- **1a — reaching the axis at all.** [[Horizons or dates]] already specifies the toolbar
  control that picks among configured axes, persisted per saved view; this is a third
  choice through that same mechanism (`configuredAxes` / `activeAxis` in
  `src/domain/roadmap.ts`, `renderAxisPicker` in `src/view/render/toolbarControls.ts`),
  never a fourth idea of what picking an axis means. It cannot be configured alone —
  `hasResourceAxis` needs the same start-or-target property `hasDateAxis` does, so
  wherever this axis is configured the dated axis necessarily is too — and it is never
  the default a first render picks: `configuredAxes`' own order is priority
  (`horizons` ahead of `dates` today because "the axis that cannot over-promise" leads),
  and this axis is a further grouping ON TOP of dates, one step more specific still, so
  it takes the LAST position rather than displacing either. A vault that newly names an
  assignee property alongside its dates does not have its roadmap silently change under
  it — the resources axis has to be picked, the same way dates already has to be picked
  over a configured horizon axis. Losing this axis's configuration afterward needs no
  new case either: [[Horizons or dates]] extension 3a already states that the roadmap
  falls back to whichever configured axis remains, pick retained rather than rewritten,
  and that is generic over how many axes exist, not written for exactly two.
- **2a — a declared resource holds no bars.** It renders anyway — the horizon board's
  own empty-bucket rule, over a different property.
- **3a — a result's assignee is not in the declared roster.** It renders in a row named
  by that value, after the declared ones — the same minted-row rule
  [[Buckets from a horizon property]] already gives an undeclared horizon.
- **3b — a result has no assignee.** The shelf, whatever its dates say: a row is who,
  not when, and there is no row to place an unnamed result into.
- **3c — a result has an assignee but no date to place** — none of its own, and for a
  parent, none inferred from its descendants either ([[Spans roll up the tree]]'s own
  shelving case, unchanged by which axis is asking). The shelf. Naming a resource is not
  scheduling against them, and a row with no date to position a bar at has nothing to
  draw. A dateless parent WITH dated descendants is not this case: it draws the same
  inferred bar the plain dated axis would, only grouped into its resource's row instead
  of the plain one.
- **3d — the item is outside the Base's filter (a context row).** It groups into a
  resource row that already EXISTS — declared by the roster or created by a result —
  never mints one of its own, is never counted, and is never shelved, the same
  membership rule the horizon axis already keeps
  ([[Buckets from a horizon property]]). What it does NOT do, dated or not, is draw as a
  positioned bar there: `deriveBars` in `src/domain/bars.ts` routes every context row
  straight to a context collection before `placeItem` is ever asked about it,
  unconditionally — the dated axis this axis reuses never draws a context row's dates
  as a bar at all, own or inferred, so there is no separate "what if it has no date"
  case to answer here either. A context row with no resource-row match at all falls to
  the same undifferentiated context this axis's own dated ancestor already keeps.
- **4a — creating from a row. WITHDRAWN on 2026-08-14; a row offers no New button.** It
  was built, and the reason it went is the reason this extension had to keep explaining
  itself: creation supplies no date and nothing else on the path does either, so a note
  made here was assigned and then immediately shelved for want of one — a click on a
  specific row producing a card somewhere else entirely. The write was correct and one
  atomic call, the announcement said exactly what had happened, and the gesture was still
  a row promising a placement it cannot make. A resource's row is where work is SEEN; the
  toolbar's New creates it, and Set assignee or a drag puts it in a row once it has a date
  to sit at. `CreatePlacement.assignee` and the creation write behind it went with the
  button rather than being left for a caller that no longer exists.

## Acceptance criteria

- The resources axis is a third choice through [[Horizons or dates]]'s own toolbar
  picker and persisted pick, never reachable alone (it requires the same date property
  the dated axis does) and never the default a first render selects — it takes the
  position after both existing axes in `configuredAxes`' priority order, and losing its
  configuration falls back the same generic way losing either existing axis already
  does. A saved pick of this axis survives a reload — the storage layer's own
  string vocabulary for the stored pick includes it, not only the in-memory
  `RoadmapAxis` type, since the two are checked separately.
- Declared resources render as rows in declared order, empty or not; the roster is
  optional and, unlike the horizon values, ships with nothing prefilled.
- A row's membership is the note's own assignee value; a bar's position is computed
  exactly as the dated axis already computes one — a childless item's own dates, a
  dateless parent's inferred from descendants, the shelf only where neither exists —
  read the same tolerant way the dated axis already reads them.
- An undeclared-but-observed assignee gets a trailing row named by itself; nothing is
  lost.
- A result with no assignee shelves; a result with an assignee and no date to place —
  none of its own, none inferred from descendants — shelves too.
- A context row only ever groups into a resource row that already exists, declared or
  result-created; it never mints one, is never counted, and is never shelved. It is
  never drawn as a positioned bar either, dated or not — the dated axis it derives from
  never places a context row's dates as a bar, so this axis inherits that rather than
  adding a case for it.
- A row header offers **Add absence and nothing else** — no New button, since creation
  supplies no date and a note made from a row would shelve on the same refresh (4a).
- A card's own assignee chip does not also draw while the card renders inside its
  resource's row — the row already says who it is assigned to, the same rule
  [ADR 0027](../adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md)
  holds for every other chip whose column already says what it would.

## Where it lives

The read half extends `src/domain/roadmap.ts`'s existing bucket derivation with a sibling
keyed off `assigneeValue` instead of the horizon value — `deriveLanes`, in the
declared-order, minted-stray shape [[Buckets from a horizon property]] already specifies —
and reuses `src/domain/bars.ts`'s `placeItem`/`inferSpan` unchanged: a bar's position
within its row is the same computation the dated axis already makes, only grouped
differently. `ResourceLane` and `hasResourceAxis` join `hasHorizonAxis` and `hasDateAxis`
in that same file, and reaching the axis widened the selection machinery
[[Horizons or dates]] built rather than adding a second one: `RoadmapAxis` gains
`'resources'`, `configuredAxes` pushes it last (after the `hasDateAxis` push, so it never
leads), `AXIS_LABEL` in `src/view/render/toolbarControls.ts` gains a third entry, and
`activeAxis` needed no change at all, since it already resolves generically over however
many axes `configuredAxes` returns. `renderAxisPicker`'s literal `choice(...)` calls became
a loop over `configuredAxes` itself: with exactly two axes a spelled-out list was the same
thing, and with three it stopped being — two configured out of three would have offered the
unconfigured one, whose pick `activeAxis` then falls straight back out of.

The persisted PICK is not the same claim: `src/storage/viewStateStore.ts` reads stored state
defensively rather than trusting it as the `RoadmapAxis` type, so its own `AXIS_VALUES` — a
separate list of strings, not derived from the type — gains `'resources'` too, or a saved
pick of this axis is silently dropped on the next load and falls back to whichever axis
remains, exactly as an axis losing its configuration already does (extension 1a), which
would misreport a stored pick as one never made. The optional roster is one more row through
the settings shape ADR 0026 already splits between `src/domain/settings.ts` and its
view-options picker (`resourceNames`, in the Roadmap group, with nothing prefilled); the
value a row is matched on is `assigneeValue`, already on the model
([[Setting the assignee on an item]]).

**One predicate carries the axis through the view**: `drawsGrid` in
`src/domain/roadmap.ts`, because six places compared `activeAxis(...) === 'dates'` to mean
"the dated grid is on screen" — the zoom, density and jump-to-today controls, the
state-colour button, the legend, the resize policy's lead-column branch, the
`pbl-roadmap-dates` layout class and a shelf card's dependency note. That comparison was
exact while one axis drew a grid and stopped being the moment a second one did. Four sites
keep their comparison deliberately, because they mean the plain dated axis and nothing
else: `collapseKey`'s `TIMELINE_SCOPE` and `clickActionApplies`, since rows here are flat
and fold nothing, and the two `'horizons'` gates.

Rendering is `src/view/render/lanes.ts` — the row header, and the bar-less row an excluded
note gets inside one — drawn by `src/view/render/timeline.ts`, which now takes a
`TimelineEntry` list rather than a row list so a header can be interleaved: the window, the
day header, the gridlines, the today line, the milestone lines, the dependency layer and
the drop overlay are all derived from the bars in that list and are the same on both grid
axes, so rows cost no second grid. `laneEntries` sits beside the dated axis's own
`barEntries` in that file rather than in `lanes.ts`, so the grid and the row renderer do not
import each other. `src/view/render/roadmap.ts` dispatches the three axes and holds
`renderGridAxis`, the one place the two grid axes differ: which entry list, and whether a
bar may be taken hold of. `styles/lanes.css` carries the header's band, imported after
`timeline.css` because it overrides `.pbl-timeline-lead` at equal specificity.

**The header's count became a labelled readout on 2026-08-14, and changed shape again the
same day.** What started as one string, `2 items / 1 absence` (`laneReadout`), is now an
item count that drops at zero and a weeks-away pill beside it (`renderAwayPill`, over
`awayWeeks` in `src/domain/absences.ts`) that drops at zero too and is weighted up when the
resource also holds work — both read the same whether the band is open or shut. The item
half is unchanged in meaning, still result bars; the reasons for the rest belong to
[[Resource absences]] and are recorded there. What belongs here is that this axis's own
promise — one row per declared or observed resource, empty or not — now reaches the
header's own STRETCH track too (4n there): a band with nothing but an absence is still one
row, never a row plus a line of its own. `.pbl-lane-count` refuses to shrink
(`styles/lanes.css`), so the resource NAME ellipsizes into the label at a narrow lead
width rather than the label being measured and shortened — a third fit mechanism beside
`columnFit` and `syncToolbarFit` was refused. A band with nothing at all — no bars, no
absences, no context row — draws `.pbl-lane-quiet` instead of a zero of any kind, the same
refusal applied to the row itself rather than to a number in it.

**The axis was read-only in this increment, and that was a decision rather than an
omission.** No grip on a bar, no drop target on the grid, and a shelf that accepted nothing
(`shelfRemoval`'s own `'resources'` branch): every move here writes an assignee, which is
[[Assigning items to a resource]]'s, and a bar wired with grips over a grid with no
registered target is the "picked up and had nowhere to land" failure `src/view/CLAUDE.md`
records. A row's own New button and the write behind it were this PBI's, and were
withdrawn on 2026-08-14 — see extension 4a.

All four of those seams were reversed by [[Assigning items to a resource]] on 2026-08-13,
which is what "in this increment" was reserving them for, and the last of them — the GRIP,
withheld even then because a grip writes a DATE and no positional target existed to land
one on — by [[Scheduling inside a resource's row]] on 2026-08-14. The target that was
missing is not the overlay: it is each band ELEMENT, which reads the same pointer X for the
same date and knows its own row as well, so a release answers both questions at once. The
overlay stays undrawn for the reason it always was.

What is genuinely new is the row-grouping walk itself, and where an absence merges into
it. A row draws from a list per SOURCE and the renderer walks each — which is the seam
[[Resource absences]] needed, though not in the shape this paragraph first promised: it
said a second source would append to `ResourceLane.bars`, and it cannot, because
`TimelineBar.item` is a `BacklogItem` and an absence is deliberately never one. The seam
held; the sentence was wrong about which list. `ResourceLane.absences` is the second one,
added 2026-08-13.

**The rows were FLAT here, and stopped being so on 2026-08-14.** This note said a fold was
impossible — a chevron would let one person's chevron hide another person's bar, since
membership is by assignee and a parent and its child routinely sit in different bands.
That was right about the hazard and wrong about the conclusion: it rules out an ancestry
fold computed over the whole grid and says nothing about one computed per BAND, which is
what [[Folding a resource's band]] built. The header gained a disclosure of its own in the
same increment.

**The LEGEND is this PBI's file** (`src/view/render/legend.ts`, reached through `drawsGrid`
above), and on 2026-08-14 `DrawnColors` came to carry a fourth thing the render reports: a
MARK rather than a colour override, the absence hatch, so the `Unavailable` swatch can be
gated the way the other four are. Reported from the render rather than derived from the
model, but not for the fold reason the done and milestone swatches learned it from: a
stretch now draws in its header's own track whether the band is folded or not (4n in
[[Resource absences]]), so `roadmap.lanes` is never stale about one going missing under a
fold. What a hand-derived `entry.lane.absences.length > 0` would still risk is DRIFT — a
second statement of the exact condition `renderLaneAbsences`' own early return already
decides, kept in step by hand rather than read off what it actually drew — so `drawEntries`
asks the header's own DOM after `renderLaneHead` returns instead. The interface is therefore
wider than its name, and a BAR's own report is the narrower `BarColors` so no row literal has
to claim anything about a mark drawn nowhere near it. See
[[An absence read fainter than the decoration behind it]].

**Not built here, and owed:** the header's appearance in a themed vault, plus how a screen
reader reads a header div among `option` rows, are live-vault checks the jsdom harness
cannot make.
