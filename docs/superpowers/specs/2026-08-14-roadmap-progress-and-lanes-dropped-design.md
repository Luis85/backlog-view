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

That was true when it was written. It is not true now: `RoadmapModel` knows which items
become buckets, bars, shelf cards and context cards before anything renders, exactly as
`BoardModel` does. So the roadmap's gap is a whole projection wide — none of its four
surfaces names a match — and `addMatchSection` in `src/view/interactions/menu.ts` misses
all four the same way, because `activeBoard` returns null off the board and the function
exits before adding anything.

So the increment is two sentences. **The timeline row gets the rollup fill every card
already has**, which closes [[Progress on the bar]]. **The roadmap gets match naming on
all four of its surfaces, on the face and in the menu**, which closes the second of the
items [[Focus level picks the rows]] still owes.

## What ships

1. **Lanes are dropped**, with a `Dropped` status added to the register's vocabulary.
2. **A progress fill inside a timeline bar**, from the rollups the tree already shows.
3. **Match naming on all four roadmap surfaces**, on the face and in the menu, from the
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

The done share draws solid in the bar's own colour and the remainder at reduced opacity —
**one rule for all eight state colours**, no per-state tuning, so a colour added to the
palette needs nothing here. The bar's colour still says *what state it is in* and the
fill says *how much beneath it is done*; the two never compete for the same channel.

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
- **No state property configured.** There is no *done* to count. A fill would report
  every subtree as unstarted, which is a claim nobody made. The descendant count is the
  whole report, exactly as in the tree in this configuration.
- **A milestone diamond and an outside-window arrow.** Both are points rather than spans —
  `markWidth` in `src/view/render/barLabel.ts` is where that distinction already lives —
  and a milestone is a leaf by nature anyway.

A **context row** draws a fill, and it describes its visible results only. Nothing new is
needed for that: `assignAll` walks *through* an `outsideFilter` row and never counts it,
which the two invariant tests in `test/view/contextRowWrites.test.ts` already hold. The
fill inherits the guarantee by reading the same fields.

An **inferred span** — a parent with no dates of its own, spanning its dated descendants —
fills like any other, and is in fact the common case: an item with descendants is exactly
the item a fill has something to say about.

### What it says out loud

The tooltip and the bar's accessible description use `renderRollup`'s own words —
*"3 of 8 items done"* — rather than a second phrasing invented here. One item cannot
report its progress differently per projection, which is the PBI's guarantee.

## 3. Match naming across the roadmap

On the roadmap, a search match beneath a rendered item is currently found, counted in the
fill this increment adds, and impossible to reach — on a bucket card, on a shelf card and
on a timeline row alike, from the face and from the menu both. That is the gap
[[Focus level picks the rows]] extension 3b names, and it is where a focused roadmap hurts
most: the only rows are the focus level's, so a match three levels down has nothing
anywhere that opens it.

Fixing this on the timeline row alone would patch one caller of a gap with three. The fix
goes where all of them route through.

### One question, asked of the model

`cardPaths(board)` in `src/domain/board.ts` answers "which items already have something of
their own on screen" from the **model**, not from the DOM, which is why the board can
render a card's matches inline during the same pass. The roadmap gets the mirror of it:
`placedPaths(roadmap, shelfCollapsed)` in `src/domain/roadmap.ts`, over the buckets, the
bars, the shelf and the **context strip** — pure, node-testable beside the derivations
already there, and available before the first element is created. It is deliberately not
read off the rendered snapshot: none of `host.roadmap` exists while the pass that builds
it is running, a constraint `src/view/render/timeline.ts` already states about its own
published fields.

**A collapsed shelf contributes nothing, and that is why the function takes a second
argument.** `RoadmapModel.shelf` holds every shelved item whatever the screen shows;
whether those cards render is `host.shelfCollapsed`, which `renderShelf` reads and which —
unlike a row or a lane fold — an active filter does **not** override. So the model alone
cannot answer this, and a function that pretended to would report hidden cards as routes:
`hiddenMatches` would stop at a path the reader cannot reach, and the match under it would
be named by nobody. One boolean in, the function stays pure, and the claim stays true.
The same reasoning is why `hiddenMatches` takes a `drawn` predicate at all — an item
behind a collapsed disclosure is not a route to anything. Found by review, on a first
draft that asserted the exclusion and gave it nothing to read.

### On the face — four surfaces, not three

`renderCardMatches` moves out of the board's private path and is called by every roadmap
surface that puts an item on screen, with `placedPaths` supplying what `cardPaths` supplies
on the board:

- **bucket cards** and **timeline bars** (`src/view/render/roadmap.ts`),
- **shelf cards** and the **context strip** (`src/view/render/shelf.ts`) — the strip is
  the fourth surface, and the one that matters most here: a focused `outsideFilter` root
  on the dated axis is routed to `roadmap.context` and rendered by `renderContextStrip`
  rather than as a bar, which is exactly the focused-context case
  [[Focus level picks the rows]] extension 2b describes. It draws through `renderCardBody`
  like any card, so it takes the links the same way,
- **timeline rows**, whose links render in `renderRowFacts` in
  `src/view/render/timeline.ts`, under the title in the sticky lead column — the one text
  region such a row has. The lead column is the reader's to size
  ([[A resizable lead column]]), so a narrow column wraps them rather than reserving room.

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

- The fill's ratio against a known subtree, and its four absences: a leaf, no state
  property configured, a milestone, an outside arrow.
- A context row's fill counting its visible results only, asked from the rule rather than
  from the implementation, beside the two invariant tests that already state it for
  writes and rollups.
- `placedPaths` in `test/domain/roadmap.test.ts` — buckets, bars, shelf and context strip
  counted, and a collapsed shelf contributing nothing — beside the derivations already
  driven there.
- A filtered roadmap naming a match three levels down on each of its four surfaces —
  bucket card, shelf card, context strip, timeline row — each link opening its note, and
  neither `click` nor `auxclick` reaching the card or row beneath.
- **A DIRECT child as the match, on a timeline row**, which is the case the subtraction
  would silently eat and which a three-levels-down test passes straight over. Paired with
  the card case, where that same child must be named once by the disclosure and not
  twice.
- The same matches in the row menu on the roadmap, which is the check that would have
  caught the first draft's claim: it is asserted at `addMatchSection` on a roadmap
  render, not inferred from the board's passing test.
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

- **The fill reading against all eight state colours**, in light and dark themes, and
  against a themed vault's own accent. `npm run harness` answers the layout and
  Obsidian's *default* colours with the real stylesheet; it cannot answer a theme.
- **The link buttons in a narrow lead column** — whether wrapping reads as intended at
  the smallest width the resize grip allows.

`npm run test-build` installs the plugin into this repository so
`docs/Product Backlog.base` can be opened as the check's own fixture: the register is a
backlog with dropped items, deep subtrees and a milestone already in it.
