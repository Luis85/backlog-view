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
either note reads, because `renderCardBody` in `src/view/render/board.ts` already gives
board cards, roadmap bucket cards and shelf cards the rollup fill **and** the quick
filter's match links. Its own comment names the exception:

> One call, three surfaces: board cards, roadmap bucket cards and shelf cards all come
> through here. Timeline rows never do — they use the card SHELL with a bar-grid row
> layout.

So the increment is one sentence: **give the timeline row the two things every card
already has.** That closes [[Progress on the bar]] whole, and closes the two of
[[Focus level picks the rows]]'s three remaining items that this projection owes — the
fill counting below-focus results, and the quick filter's descendant naming.

## What ships

1. **Lanes are dropped**, with a `Dropped` status added to the register's vocabulary.
2. **A progress fill inside a timeline bar**, from the rollups the tree already shows.
3. **Match links in a timeline row's lead column**, from the walk the board already uses.

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

## 3. Match links in a timeline row's lead column

A timeline row has no card face, so a search match three levels beneath it is currently
found, counted in the fill this increment adds, and impossible to reach. That is the gap
[[Focus level picks the rows]] extension 3b names, and the board already solved it.

`undisclosedMatches` in `src/view/childrenList.ts` answers "what did the filter find
under this row that has no row of its own", already bounded by the projection's own
visibility predicate. The timeline row calls it unchanged and renders the same
`tabindex="-1"` link buttons the board card renders, in `renderRowFacts` in
`src/view/render/timeline.ts`, under the title in the sticky lead column — the one text
region a timeline row has.

Two rules carried over rather than re-decided:

- **The row stays one tab stop.** The links are `tabindex="-1"`, reached the way every
  per-row control here is reached, with the row menu's existing `addMatchSection` as the
  keyboard path.
- **Each link stops `click` *and* `auxclick`.** A middle click never fires `click`, so
  stopping the primary event alone still opened the row's own note in a new tab. The
  board learned this once; the roadmap does not get to learn it again.

The lead column is the reader's to size ([[A resizable lead column]]), so a narrow column
wraps the links rather than reserving room for them.

## Line budgets

`src/view/render/timeline.ts` is at or near the 400-line cap that `eslint.config.mjs`
enforces, and both halves of this increment land in it. The implementation plan measures
first and extracts if it must — the same move `barLabel.ts` and `lanes.ts` already made
out of this file, and for the same reason. The likely seam is the fill, which is a
function of the rollup fields and the bar geometry and of nothing else the grid holds.
`styles/timeline.css` is under the same 400-line rule via `styles-assemble.mjs`.

## Testing

The domain is unchanged — every number already exists and is already tested — so the new
checks are view-level, in `test/view/`:

- The fill's ratio against a known subtree, and its four absences: a leaf, no state
  property configured, a milestone, an outside arrow.
- A context row's fill counting its visible results only, asked from the rule rather than
  from the implementation, beside the two invariant tests that already state it for
  writes and rollups.
- A filtered timeline row naming a match three levels down, each link opening its note,
  and neither `click` nor `auxclick` reaching the row beneath.
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
