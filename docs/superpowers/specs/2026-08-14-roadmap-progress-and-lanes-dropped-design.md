# Progress on the bar, matches in the row, lanes dropped — design

Spec for the increment that empties [[Hierarchy on the roadmap]], the last unbuilt feature
of the [[Product Roadmap]] epic. Date: 2026-08-14.

## Why this is the increment

The epic in flight is the roadmap, and the milestone [[Ship the roadmap epic]] is due
2026-09-30. Reading the register for what is actually unbuilt gives a shorter list than
the status column does:

- `Scheduling work` and `The resource timeline` carry `Active` PBIs, but each one's
  **Where it lives** says *Built* apart from a named extension. Nothing there is a
  feature-sized hole.
- `Dependencies` is `Done` in every PBI under it.
- `Hierarchy on the roadmap` holds the three notes that are genuinely design:
  [[Lanes on the roadmap]], [[Progress on the bar]] and [[Focus level picks the rows]].

Lanes are refused by decision (below). What remains of the other two is smaller than
either note reads, but the two halves are not the same size, and an early draft of this
spec got that wrong. Read the two seams separately:

**The rollup** is on every card already. `renderCardBody` in `src/view/render/board.ts`
draws it, and its own comment names the one surface that misses out:

> One call, three surfaces: board cards, roadmap bucket cards and shelf cards all come
> through here. Timeline rows never do — they use the card SHELL with a bar-grid row
> layout.

**The match links are on the board alone.** `renderCardMatches` is called from
`renderCard` in the board's column path, never from the shared body, and the comment at
that call site is explicit that this was deliberate:

> The board's own addition to the shared body: which items already have a card is a
> question only the board can answer, so the roadmap does not get this.

The question was the right one; only the answer's source was missing. The roadmap's gap is
a whole projection wide — none of its **five** surfaces names a match — and
`addMatchSection` in `src/view/interactions/menu.ts` misses all five the same way, because
`activeBoard` returns null off the board and the function exits before adding anything.
Section 3 is where that question gets an answer the roadmap can actually give.

So the increment is two sentences. **The timeline row gets the rollup fill every card
already has**, which closes [[Progress on the bar]]. **The roadmap gets match naming on
all five of its surfaces, on the face and in the menu**, which closes the second of the
items [[Focus level picks the rows]] still owes.

## What ships

1. **Lanes are dropped**, with a `Dropped` status added to the register's vocabulary.
2. **A progress fill inside a timeline bar**, from the rollups the tree already shows.
3. **Match naming on all five roadmap surfaces**, on the face and in the menu, from the
   walk the board already uses.

### The statuses this leaves behind

[[Lanes on the roadmap]] and [[Swimlanes by parent]] go `Dropped`. [[Progress on the bar]]
goes `Done`. [[Focus level picks the rows]] is the one to judge at the end rather than
promise now: this increment closes two of the three items its **Where it lives** still
owes, and the third — inferred spans counting below-focus results — may already be met by
[[Spans roll up the tree]], whose walk does not ask about focus. The plan verifies that
with a test before the note is retyped; if the walk turns out to have a focus-shaped hole,
the note stays `Open` and names it. Either way [[Hierarchy on the roadmap]] holds no
unbuilt design when this lands, which is what the milestone needs.

## 1. Lanes are dropped

Lanes were tried and refused — both projections, not just the roadmap's. The decision is
the user's, recorded here as the evidence the notes will cite.

**Both notes stay in the tree**, marked `status: Dropped`, each gaining a short
`## Why it was dropped` paragraph saying it was built, tried and refused, and on what
date. Keeping them is the point: every `[[wikilink]]` still resolves, `docs-check.mjs`
needs no exemption, and the register keeps the one thing CLAUDE.md says only a note can
hold — an alternative already refused and why. The notes are
[[Lanes on the roadmap]] and [[Swimlanes by parent]].

**`Dropped` joins the status vocabulary.** `NOTE_STATUSES` in `scripts/docs-check.mjs`
gains it, and the conventions table in `docs/README.md` gains it in the same change —
the table is where the checker's comment says the vocabulary comes from, so the two move
together. `test/docs/checkerAccepts.test.ts` plants a `Dropped` note and expects it to
pass; `test/docs/checkerRejects.test.ts` keeps refusing a status outside the set, so
widening the vocabulary does not quietly disable the check that guards it.

**No `.base` change is needed, and that is the argument for this status rather than a
deletion.** `docs/Product Backlog.base` already declares `doneValues: Done, Dropped`.
A dropped PBI therefore counts as done in every rollup and hides with "Show completed
items" — so a refused design can never drag the progress fill this same increment
builds. `stateValues` stays `Open, Active, Done`: a `Dropped` note mints a stray column
on this repository's own board, which is the honest report of a value the workflow does
not declare, and is the behaviour [[Every card has a column]] already specifies.

**Every lane clause is stripped** from the notes that assume lanes will arrive. A shipped
acceptance criterion promising "with lanes on …" is a guarantee nothing will ever meet,
which is the defect CLAUDE.md names as promising more than the suite delivers. The notes
carrying such a clause are [[Move and resize a bar]],
[[Drag from the shelf to schedule]], [[Moving between horizons]], [[Arrows between bars]],
[[Collapsing a bar's subtree]], [[Keyboard and menu on the roadmap]],
[[Keyboard, menu and touch]] and [[The horizon board]], plus the roadmap and Kanban
paragraphs in `docs/README.md`. The implementation plan re-derives that list by search
rather than trusting this one — the register is edited between spec and plan, and a
list of note names in a spec is exactly the enumeration that goes stale.

**No source file changes.** `src/view/render/lanes.ts` draws the **resource** lanes — the
rows of [[Showing a resources axis on the roadmap]] — and is unrelated to lanes-by-parent.
It keeps its name.

## 2. A progress fill inside the bar

**As** someone reading a roadmap bar, **I want** its fill to show how much beneath it is
done — the story [[Progress on the bar]] states, now on the one surface that lacks it.

### Where it draws

`.pbl-bar` in `styles/timeline.css` is a single positioned element carrying
`--pbl-bar-color`, with the two grips already living inside it as children. The fill is
one more child: a div whose width is a custom property the renderer sets, so the shape is
CSS and the arithmetic is one division.

**It is a thin band inset inside the bar, never a full-height wash over it** — and that is
the whole design, not a styling preference. A bar's own BACKGROUND is already carrying
meaning, three ways at once, all of them in `styles/timeline.css`:

- `.pbl-bar-inferred` is `background: none` with a dashed border, because an inference is
  a summary the view drew rather than a plan somebody made,
- `.pbl-bar-open-end` and `.pbl-bar-open-start` are gradients fading to transparent, which
  is how an unstated endpoint says it is unstated,
- and the compound of the two has its own rule, with a specificity comment explaining why.

A solid child spanning the bar's height would paint over every one of them. At 100% done
it would cover the bar edge to edge, so an open-ended span would read as stated and closed
and a dashed inference would read as a plan — the two claims those styles exist to keep
apart. Inset vertically, the band leaves the border, the dashes and both fades visible on
every shape, so **no shape needs a special case and none can be forgotten**: the reason to
prefer it over "skip the fill on inferred and open bars" is that the second is a list, and
a list is what the review found wrong three times already in this spec.

**The band is a track and a fill, in the tree's own two colours** — not the bar's colour.
`.pbl-bar` paints `background-color: var(--pbl-bar-color)`, so a band in that same colour
would be invisible against the bar at every percentage, and the increment's whole signal
would vanish on the commonest shape. The tree already solved this in
`styles/columns.css`: `.pbl-progress-bar` is a neutral track
(`var(--background-modifier-border)`) and `.pbl-progress-fill` is green
(`rgb(var(--color-green-rgb))`). The band copies that pair rather than inventing a colour
rule, so it reads against all eight state colours at once, needs nothing when a ninth is
added, and looks like the progress this reader already knows from the tree. Found by
review, against a draft that said "the bar's own colour" and would have drawn nothing
anyone could see.

The bar says *what state it is in* and *how certain its dates are*; the band says *how
much beneath it is done*. Three claims, three channels, none overwriting another.

### The number

`doneDescendants / descendantCount`, both already assigned by the tree walk in
`src/domain/model.ts` and both already rendered by `renderRollup` in
`src/view/render/columns.ts`. Derived at render, stored nowhere. This is the whole reason
the PBI is small: the roadmap adds a drawing, not a second answer to how far along
anything is.

### Where no fill draws

Each of these is an absence, not a zero — an empty measure must never read as "nothing
done":

- **A leaf.** No descendants, no fill, no counts — the tree's own rule for the rollup
  column, unchanged.
- **No state property configured.** There is no *done* to count. A band would report
  every subtree as unstarted, which is a claim nobody made. The descendant count is the
  whole report, exactly as in the tree in this configuration — **and the count has to
  actually render**, which is a second thing to build rather than a consequence of the
  first. A timeline row calls `renderRollup` nowhere, so a design that only adds a band
  would leave this configuration with no report at all while promising the tree's. The
  count therefore renders as text in the row's lead column wherever an item has
  descendants — with a workflow it sits beside the band, without one it is the whole
  report — and it says the same words `renderRollup` says. Found by review, on a draft
  that inherited the PBI's promise and specified only its other half.
- **A milestone diamond and an outside-window arrow.** Both are points rather than spans —
  `markWidth` in `src/view/render/barLabel.ts` is where that distinction already lives —
  and a milestone is a leaf by nature anyway.

**No context item draws a band, because no context item draws a bar.** `deriveBars` in
`src/domain/bars.ts` routes every `outsideFilter` item straight to `context` before a
placement is computed for it — its own comment says such a row is never placed by its own
dates and gets no inferred span either — so it is a strip card on the dated axis, a
`renderLaneContextRow` with an empty track on the resources axis, and an ordinary card on
the horizon axis. There is nowhere for a band to be inset.

What those surfaces report instead is already right, and is what the guarantee attaches
to: a strip card and a bucket card draw the rollup through `renderCardBody` like any card,
and a lane context row draws the **count** in its lead cell, as every other row with
descendants does. Each surface reports what it can draw and claims nothing it cannot.

The guarantee itself — a context item describes its visible results only — needs nothing
new either way: `assignAll` walks *through* an `outsideFilter` row and never counts it,
which the two invariant tests in `test/view/contextRowWrites.test.ts` already hold, and
every count above inherits it by reading the same fields. Found by review twice: against a
blanket "a context row draws a fill", and then against the narrowed "a context item that
draws a bar", which named a case the projection cannot produce.

An **inferred span** — a parent with no dates of its own, spanning its dated descendants —
fills like any other, and is in fact the common case: an item with descendants is exactly
the item a fill has something to say about.

### What it says out loud

The tooltip and the bar's accessible description use `renderRollup`'s own words —
*"3 of 8 items done"* — rather than a second phrasing invented here. One item cannot
report its progress differently per projection, which is the PBI's guarantee.

## 3. Match naming across the roadmap

On the roadmap, a search match beneath a rendered item is currently found, counted in the
fill this increment adds, and impossible to reach — on every surface the projection has,
from the face and from the menu both. That is the gap [[Focus level picks the rows]]
extension 3b names, and it is where a focused roadmap hurts most: the only rows are the
focus level's, so a match three levels down has nothing anywhere that opens it.

Fixing this on the timeline row alone would patch one caller of a gap with five.

### The question is asked of the render, not of the model

`cardPaths(board)` in `src/domain/board.ts` answers "which items already have something of
their own on screen" from the **model**, and on the board that is honest: a `BoardModel` is
already narrowed to what draws, and nothing on the board hides part of it afterwards. The
roadmap is not like that, and the obvious mirror — a pure `placedPaths(roadmap)` — is the
wrong shape. Two review rounds established it by counting:

- **Five surfaces**, not three: bucket cards, timeline rows, shelf cards, the context strip
  (`roadmap.context`, drawn by `renderContextStrip`) and **`ResourceLane.context`**, drawn
  by `renderLaneContextRow` on the resources axis, which is a hand-built row using neither
  `renderCardBody` nor `renderRowFacts`.
- **Host state decides whether a modelled item actually draws**, and — this is the part
  that makes prediction fragile — **the quick filter overrides some of it and not the
  rest**. `isLaneCollapsed` returns false outright while a filter runs, so a folded lane
  reopens and every row in it draws. `renderShelf` has no such term: `host.shelfCollapsed`
  keeps a shelf shut mid-search, and `host.shelfHiddenTypes` goes on dropping whole groups
  from an EXPANDED one. Two states that look alike, with opposite answers to the same
  question, and only the code says which is which.

Every one of those was a separate review finding, each fixed by adding a parameter to a
pure function — which is the signature of a design that will keep acquiring them. A
missed one is not cosmetic: `hiddenMatches` would stop at a path the reader cannot reach,
and the match under it would be named by nobody.

**So the set is collected by the render, where the answer is a fact rather than a
prediction.** Each surface, as it draws an item, registers the element its matches belong
on: a card registers the card, a timeline row and a lane context row register their lead
div. That gives one map in the roadmap render pass whose **keys are the placed paths**,
and whose value is the mount point plus one boolean: whether that surface lists the item's
children itself. Membership is the visibility answer, so a surface cannot be counted as a
route without having drawn.

**The boolean is not bookkeeping — the menu cannot work without it.** Once the
already-listed set became the caller's to supply, `addMatchSection` had no way to choose:
`buildItemMenu` is handed an item and no surface, so a menu that always subtracted would
lose a timeline row's direct-child match — the bug moved rather than fixed — and one that
never subtracted would offer a bucket card's disclosure entries a second time as matches.
Recording the policy where the surface is known, at the moment it draws, is what lets one
lookup answer for a caller that rendered nothing. Found by review, on the draft that made
the subtraction caller-specific and left the menu with nothing to read it from.

This is the same accumulation `RoadmapSnapshot.cards` already performs — "the NAVIGABLE
cards, in reading order", built by pushing what each surface returned, a collapsed shelf
contributing none — so the pattern is the projection's own, not a new one. The map is
published on the snapshot beside `cards` for the menu to read.

The cost is that matches render in a **second pass**, after the surfaces have drawn,
rather than inline as the board does them. That is the price of the guarantee, and it is
one short loop over the map. The board keeps `cardPaths` and renders inline: its model
carries no hidden visibility, so nothing there is bought by changing it.

A sixth surface added later gets match naming by registering its mount, and gets it wrong
only by not drawing at all.

### On the face — five surfaces

Each registers a mount as it draws, and the second pass calls `renderCardMatches` on it:

- **bucket cards** (`src/view/render/roadmap.ts`) — the card itself,
- **shelf cards** and the **context strip** (`src/view/render/shelf.ts`) — the card itself.
  The strip matters more than its size suggests: a focused `outsideFilter` root on the
  dated axis is routed to `roadmap.context` and drawn there rather than as a bar, which is
  exactly the focused-context case [[Focus level picks the rows]] extension 2b describes,
- **timeline rows** (`renderBarRow` in `src/view/render/timeline.ts`) — the sticky lead
  column, the one text region such a row has. A bar is not a sixth surface: it is a child
  of the row `renderBarRow` builds, so the row registers **once**, and the path-keyed
  register never has two values competing for one key,
- **lane context rows** (`renderLaneContextRow` in `src/view/render/lanes.ts`) — its lead
  div. This is the resources axis's own focused-context row, held in `ResourceLane.context`
  rather than `roadmap.context`, and it is hand-built from `createCard` upward, so it
  shares no body with the other four and has to register for itself.

The lead column is the reader's to size ([[A resizable lead column]]), so a narrow one
wraps the links rather than reserving room for them.

`renderCardMatches`'s own body is unchanged, including the `fromRowControl` arrangement
that keeps a link's click and the card's own handler from both firing, and the `auxclick`
handler without which a middle click still opened the card's note instead of the match's.

### The subtraction belongs to the caller

`undisclosedMatches` currently ends by removing `listedChildren` — right on a board card,
which lists those children in its own disclosure, and **wrong on a timeline row**, which
draws no disclosure at all (`renderCardChildren` is a card-path call, and the board's own
comment says timeline rows are why). Left as it is, a focused row whose IMMEDIATE child is
the match loses it: the child has no placed row, so nothing else names it, and the
subtraction removes it anyway. That is the below-focus result this increment exists to
make reachable, so the bug would land inside its own fix.

The rule is that a surface should not name twice what it already shows, and only the
surface knows what it shows. So the already-listed set becomes a **parameter**: card
callers pass `listedChildren(host, item)`, the timeline row passes nothing. One
signature, both callers explicit, and no function carrying a hidden assumption about who
called it. Found by review.

### In the menu

`addMatchSection` currently bails whenever `activeBoard(host)` is null, which is every
roadmap render. It stops asking for a board and asks for **the active projection's placed
paths** — the board's when a board drew, the roadmap's when the roadmap did — leaving
`host.isFiltering()` as the only other gate. This is what makes the `tabindex="-1"` links
legitimate rather than a pointer-only feature: the board's own comment calls the menu
"their keyboard path rather than an extra", and on the roadmap that path does not exist
today. Found by review on this spec's first draft, which claimed the menu already covered
it.

The Deliverables board reaches this through `host.board` like any other board and needs
nothing of its own.

## Line budgets

`src/view/render/timeline.ts` is at or near the 400-line cap that `eslint.config.mjs`
enforces, and both the fill and the row's match links land in it. The implementation plan
measures first and extracts if it must — the same move `barLabel.ts` and `lanes.ts`
already made out of this file, and for the same reason. The likely seam is the fill, which
is a function of the rollup fields and the bar geometry and of nothing else the grid
holds. `src/view/interactions/menu.ts` and `src/view/render/board.ts` gain a few lines
each and lose none, so they are measured too. `styles/timeline.css` is under the same
400-line rule via `styles-assemble.mjs`.

## Testing

The domain is unchanged — every number already exists and is already tested — so the new
checks are view-level, in `test/view/`:

- The band's ratio against a known subtree, and its absences: a leaf, a milestone, an
  outside arrow.
- **The count's VALUE with no state property configured** — not merely that the band is
  absent. The band's absence and the count's presence are two claims, and only the second
  is what the tree promises in that configuration.
- **An inferred bar and an open-ended bar keeping their own geometry**, at 100% done,
  where the failure is worst: the dashed border still dashed, the end fades still fading,
  the band inset within them. Milestones and arrows alone would have passed a design that
  paints an open span shut.
- A context item counting its visible results only, asked from the rule rather than from
  the implementation, beside the two invariant tests that already state it for writes and
  rollups. Driven on the two surfaces a context item actually reaches — a strip card's
  rollup, and a lane context row's count — since no context item draws a bar to band.
- A filtered roadmap naming a match three levels down on each of its five surfaces —
  bucket card, timeline bar, shelf card, context strip, lane context row — each link
  opening its note, and neither `click` nor `auxclick` reaching the card or row beneath.
- **The two ways an item is modelled but not drawn WHILE A FILTER RUNS**, each asserted as
  "the ancestor names the match rather than stopping at it": a collapsed shelf, and an
  expanded shelf whose type filter hides the matching group. Both were review findings
  against a design that predicted the screen instead of reading it.
  A folded lane is deliberately **not** a third case: `isLaneCollapsed` returns false
  while a filter is active, so the state cannot occur where match naming runs, and a test
  for it would need a host state production cannot reach. Its counterpart is worth
  asserting instead — **a folded lane reopening under a filter**, so its rows are drawn,
  registered, and name their own matches.
- **A DIRECT child as the match, on a timeline row**, which is the case the subtraction
  would silently eat and which a three-levels-down test passes straight over. Paired with
  the card case, where that same child must be named once by the disclosure and not
  twice.
- The same matches in the row menu on the roadmap, which is the check that would have
  caught the first draft's claim: it is asserted at `addMatchSection` on a roadmap
  render, not inferred from the board's passing test — **and both disclosure policies
  through it**: a direct-child match reaching a timeline row's menu, and a bucket card's
  menu not offering as a match a child its own disclosure already lists.
- `test/docs/checkerAccepts.test.ts` accepting `Dropped`, and
  `test/docs/checkerRejects.test.ts` still refusing a status outside the set.

Every new assertion is watched failing before its code lands — revert, run, see red,
restore — which is this repository's rule and the one that twice showed an assertion
covering less than it read as.

Coverage thresholds in `vitest.config.mts` only ever go up.

## Not in this increment

- **The Space-lift** — [[Keyboard and menu on the roadmap]]'s state machine, its Tab grips
  and its date-entry prompt. WCAG 2.2 SC 2.5.7 is already satisfied by the Alt+arrow and
  menu paths, so this is ergonomics, and it is the next increment's natural subject.
- **[[Children on the card]]** — a card-face concern, not a timeline-row one.
- **Estimates.** The fill counts items because items are what this schema records. No
  estimate field is invented, and no percentage is ever written to a note.
- **A computed health.** Health, where a team wants it, stays a hand-set property chip
  like any other — the surveyed trackers treat it as a judgement, and nothing here
  computes one.

## What still needs a live vault

Obsidian cannot run in this repository's test environment. Two claims here are jsdom's
blind spot and are owed a vault check before the increment is called done:

- **The band reading against all eight state colours**, in light and dark themes, and
  against a themed vault's own accent — and, at the compact density, whether an inset
  band still has the height to be seen. `npm run harness` answers the layout and
  Obsidian's *default* colours with the real stylesheet; it cannot answer a theme.
- **The link buttons in a narrow lead column** — whether wrapping reads as intended at
  the smallest width the resize grip allows.

`npm run test-build` installs the plugin into this repository so
`docs/Product Backlog.base` can be opened as the check's own fixture: the register is a
backlog with dropped items, deep subtrees and a milestone already in it.
