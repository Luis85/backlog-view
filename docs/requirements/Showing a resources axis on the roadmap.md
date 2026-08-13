---
type: PBI
parent: "[[The resource timeline]]"
order: 10
status: Open
created: 2026-08-13
source: user request
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

1. The user names a roster of resources in the view options — optional, the same shape
   as the horizon values — beside the assignee and date properties already configured.
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
- **4a — the user creates from a row.** The row's own resource name rides the single
  creation write, the same as a bucket's — no note ever exists in a row its frontmatter
  does not claim. Unlike a bucket, that write alone does not draw the card IN the row:
  [[New item flow]] supplies no date, and a picked template's start and target are
  stripped the same way a bucket-created note's horizon never is
  ([[Creating an item from a template]]), so the new note is exactly 3c's case the
  moment it is read back — an assignee and no date — and shelves on the same refresh
  that creates it. Announced the way [[Assigning items to a resource]] extension 3c
  already announces the identical outcome reached by a drag instead of a click: naming
  the resource now on the note and that a date is what is still missing to place it,
  rather than letting a click on a specific row silently produce a card that renders
  somewhere else entirely. Where a template is also picked, the row's name wins over
  anything the template declares for the assignee property
  ([[Creating an item from a template]] extension 5d) — the same reason a picked
  template cannot override a bucket's horizon either.

## Acceptance criteria

- The resources axis is a third choice through [[Horizons or dates]]'s own toolbar
  picker and persisted pick, never reachable alone (it requires the same date property
  the dated axis does) and never the default a first render selects — it takes the
  position after both existing axes in `configuredAxes`' priority order, and losing its
  configuration falls back the same generic way losing either existing axis already
  does.
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
- Creating from a row writes that resource's name into the assignee property as part of
  the single creation write, and wins over anything a picked template declares for that
  same property — but, having no date of its own (neither creation nor a template
  supplies one), it shelves on the same refresh rather than drawing in the row, announced
  the same way [[Assigning items to a resource]] extension 3c already announces the
  identical outcome reached by a drag.
- A card's own assignee chip does not also draw while the card renders inside its
  resource's row — the row already says who it is assigned to, the same rule
  [ADR 0027](../adrs/0027-label-chips-with-no-positional-meaning-also-draw-on-cards.md)
  holds for every other chip whose column already says what it would.

## Where it lives

Unbuilt. The read half would extend `src/domain/roadmap.ts`'s existing bucket
derivation (`deriveBuckets`, the declared-order, minted-stray shape
[[Buckets from a horizon property]] already specifies) with a sibling keyed off
`assigneeValue` instead of the horizon value, and would reuse `src/domain/bars.ts`'s
`placeItem`/`inferSpan` unchanged — a bar's position within its row is the same
computation the dated axis already makes, only grouped differently. `hasResourceAxis`
would join `hasHorizonAxis` and `hasDateAxis` in the same file, and reaching the axis
would widen the selection machinery [[Horizons or dates]] built rather than add a
second one: `RoadmapAxis` gains `'resources'` alongside `'horizons'` and `'dates'`,
`configuredAxes` pushes it last (after the `hasDateAxis` push, so it never leads),
`AXIS_LABEL` in `src/view/render/toolbarControls.ts` gains a third entry, and
`renderAxisPicker`'s two `choice(...)` calls gain a third — `activeAxis` and the
persisted pick in `src/storage/collapseStore.ts` need no change at all, since both
already resolve generically over however many axes `configuredAxes` returns. The optional
roster is one more row through the settings shape ADR 0026 already splits between
`src/domain/settings.ts` and its view-options picker; the value itself is
`assigneeValue`, already on the model ([[Setting the assignee on an item]]). Rendering
would sit in `src/view/render/roadmap.ts`, beside the bucket and shelf rendering it
already holds, with the chip suppression reading the same row-membership question
`src/view/render/columns.ts` already asks for the horizon chip. Creation from a row
would run the existing `promptCreateItem` (`src/view/interactions/create.ts`) with
`CreatePlacement` carrying the resource's name the way it already carries a horizon's.

What is genuinely new is the row-grouping walk itself, and where an absence's bar merges
into it — [[Resource absences]] owns the second source, and this PBI's rendering is what
has to leave the seam for it.
