---
type: PBI
parent: "[[A third projection]]"
order: 50
status: Done
priority: P2
created: 2026-08-04
files:
  - src/domain/shelf.ts
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/render/shelf.ts
  - src/view/render/shelfControls.ts
  - src/view/render/toolbar.ts
  - src/view/render/roadmap.ts
  - styles/shelf.css
  - styles/roadmap.css
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-09
risk: ""
assignee: ""
---

# The shelf, organized

**As** someone whose shelf fills up before the first triage pass, **I want** it
collapsible, grouped by type, sortable and filterable, **so that** a shelf holding
dozens of untriaged items is something I can actually work through instead of a wall of
cards I have to scroll past to see the plan.

[[The unplaced shelf]] specified the shelf's existence and its counting guarantee; it
said nothing about comfort once the shelf holds more than a handful of items — a live
vault surfaced uneven card widths, a shelf flush against the pane's edges, and a
horizontal scrollbar the shelf itself was forcing. This PBI is that comfort pass,
alongside the same visual fixes.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The roadmap renders with items on the shelf |
| **Preconditions** | Roadmap mode is on and the horizon or dated axis is configured |
| **Guarantee** | Grouping, sort and the type filter are display-only — nothing is ever written to a note because of them. Grouping alone never drops a card: every card the shelf holds resolves to exactly one group before the type filter narrows what is shown. The type filter is then a deliberate, separate narrowing on top of that grouping — hiding a type hides its whole group on purpose, the same way [[The unplaced shelf]]'s own "Show completed items" and quick filter deliberately narrow the shelf elsewhere. |

**Main flow**

1. The shelf opens collapsed by default, remembered per view like the projection and
   the roadmap axis — a working position, never a `.base` setting.
2. Expanded, its cards group under always-on type sub-headers, in the same order as
   the type ladder plus the extra types and markers, with a trailing group for anything
   else — fixed order, empty groups omitted.
3. Within a group, a sort picker orders cards by sibling order (the default), title, or
   last modified — display only, never written.
4. A type filter hides whole groups; the shelf's own count keeps reporting the true
   total regardless of what is currently hidden.
5. The shelf and the context strip render with uniform card widths, proper spacing from
   the pane's edges, and no shelf-caused horizontal scrollbar.

**Extensions**

- **1a — collapsed, still a target.** Collapsing removes the shelf's cards from
  keyboard navigation (they were never Tab-reachable to begin with; they leave the
  Arrow/End walk too) but never from being a drop target: dropping a card onto a
  collapsed shelf still un-places it.
- **1b — everything is shelved and collapsed.** The roadmap's advisory (empty backlog,
  filtered-empty, all done) does not fire for this: an all-shelved, collapsed backlog
  is not empty, it is untriaged, and the advisory is gated on the roadmap's actual
  population rather than on how many cards are currently keyboard-reachable.
- **4a — a hidden group's last item is un-shelved.** The stored hidden-type preference
  is simply unused until a card of that type reappears; nothing is lost or reset.

## Acceptance criteria

- The shelf's collapse state, sort pick and type-filter selections persist per saved
  view, per device — the same store `mode` and the roadmap axis pick already use.
- Collapsed by default on a view nobody has touched; toggling it is a real `<button>`
  in the shelf's own header, where a reader working through unplaced work is already
  looking — never a form control, which the roadmap's one-tab-stop listbox has no room
  for.
- Type groups render in a fixed order (the declared type vocabulary, plus a trailing
  group for anything outside it); a group with nothing in it renders nothing.
- Every shelf control is reachable without a pointer: the disclosure returns to the tab
  order wherever the pane rendered no card, and the card menu carries collapse, sort and
  the type filter wherever it did.
- Using one never strands the keyboard. The press rebuilds the pane and destroys the
  button, so focus goes to the pane where cards remain — the composite owns the arrows,
  and its handler answers only to events targeting the pane itself — and to the control's
  own replacement where no card does.
- Sort and the type filter never write to a note; the shelf's count is the true total,
  unaffected by which groups are currently hidden.
- Shelf and context-strip cards render at a uniform width; the shelf sits with a
  visible gutter from the pane's edges and forces no scrollbar of its own.

## Where it lives

The grouping, sort and filter logic is `organizeShelf` in `src/domain/shelf.ts` — pure,
keyed by `displayType(item)` (never raw `typeName`, which would misgroup an untyped
child carrying an inferred level and any differently-cased declared type), driven in
`test/domain/shelf.test.ts`.

Persistence is three fields on the view-state store's existing per-view entry
(`src/storage/viewStateStore.ts`), read as defensively as `mode`/`axis` already are, with
matching accessors on `src/view/viewState.ts`.

The interactive controls — the disclosure that names, counts and opens the shelf, plus
the sort and type-filter pickers it carries while open — are the SHELF's own header
chrome (`src/view/render/shelfControls.ts`, called from `renderShelf`). They shipped
first as view-toolbar chrome and moved here: a control for the shelf, three regions away
from it, is one nobody finds. Nothing about the constraint that put them there changed —
`treeEl` still wears `role="listbox"` while any card renders — so what moved had to stop
being form controls: both pickers are `tabindex="-1"` buttons opening an Obsidian `Menu`,
the answer the tree's own per-row controls (`.pbl-add`, the state chip) already give.

The DISCLOSURE was lifted out of that rule on 2026-08-15 and is a permanent tab stop:
the card menu stopped carrying the collapse toggle
([[Drop the shelf's toggle from the card menu]]), and a collapsed shelf draws no card to
open a menu from, so the sentence below would have described a shelf a keyboard could
shut and never reopen. What follows is now about the two pickers.

That rule is the COMPOSITE's, so it is applied only where a composite exists:
`syncShelfTabStops` puts every picker back in the tab order whenever the pane
rendered no card and dropped to `role="region"`, resolved from the same final count the
role itself is. Two states reach it: an all-shelved roadmap with the shelf shut, where
the disclosure is the only way to the cards it holds, and an all-shelved roadmap whose
last visible type the filter just hid, where the pane empties by itself and the filter
is the only way back. Both are where a `-1` stops being a convention and becomes a
trap, which is why the lift is all-or-nothing rather than per control. Where the pane IS a composite, the keyboard path is the card menu's own shelf section
(`addShelfSection`, `src/view/interactions/menu.ts`): the same
two pickers as submenus. That is not a nicety deferred to later work — this codebase's
rule for a `tabindex="-1"` control is that its menu path ships WITH it, stated at the
board's hidden-match links, whose absence would leave them "pointer-only and the feature
would fail at its own purpose". The entries come from the same two item builders the
header buttons call, so the two surfaces cannot drift about what is offered or what is
checked, the reason the horizon chip and its menu already share one builder. Three host
methods (`setShelfCollapsed`/`setShelfSort`/`setShelfHiddenTypes`) each write through
`ViewState` and re-render the content pane alone — never the whole toolbar — so a
keyboard user's focus survives the control they just used, the same reason `setFilter`
does not call a full `render()` either.

The shelf's card content — grouped, sorted, filtered — renders in
`src/view/render/shelf.ts`, which also carries the context strip (unchanged: never
grouped, sorted or filtered, per the context-row rule). Collapsing removes the shelf's
cards from the keyboard-navigable array `RoadmapSnapshot.cards` builds, exactly as an
empty shelf already does, so `render/projections.ts`'s existing
`role: roadmap.cards.length > 0 ? 'listbox' : 'region'` recomputes correctly with no new
logic — and `renderRoadmapAdvisory` (`src/view/render/roadmap.ts`) is gated on the
roadmap's actual population instead (the axis's own rendered count, captured before the
shelf renders, plus the shelf's real count plus the context strip's count), so a
collapsed, all-shelved backlog is never reported as empty or done, and neither is a
focused view whose only visible row is a context card already placed inside a bucket.
Driven in `test/view/shelfUx.test.ts` (accessors added to `test/helpers/roadmap.ts`),
including the invariant that the shelf stays a drop target while collapsed.

Card sizing — the uniform-width grid, the collapsed footprint — lives in the new
`styles/shelf.css`, moved out of `styles/timeline.css` (which carried it only because
the shelf and the timeline shipped together, not because it belongs there). The
flush-edge gutter and overflow fix is NOT in `shelf.css`: it is the pinned-strip rule
(`.pbl-roadmap .pbl-shelf, .pbl-roadmap .pbl-roadmap-context, .pbl-roadmap
.pbl-board-advisory`) in `styles/roadmap.css`, changed by the same task that gives the
buckets their own full-width layout — the rule governs the shelf's POSITION within the
roadmap's scrollport, which is a roadmap-layout concern `roadmap.css` already owns,
not shelf-internal appearance. The layout half of that is now checkable without a vault: measured through
`npm run harness` ([[A browser harness without Obsidian]]), the shelf takes the pane's
width less a 12px gutter on each side (1376px of 1400px) on BOTH axes, its collapsed
footprint is 33px rather than an empty box, and the disclosure sizes to its label
(212x23px) rather than to `clickable-icon`'s lone-glyph square. The dated axis's own
number is what the fix is worth: with the sticky rule's `align-self: flex-start` left
standing, the same shelf measured 407px. Appearance rather than layout — a real theme's
fonts, colours and icons — the harness cannot answer, and the release sweep's check
stands for it (ADR 0020).
