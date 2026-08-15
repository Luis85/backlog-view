# Changelog

All notable changes to this plugin are documented here, for someone deciding whether to
upgrade — not the commit log. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/), read against
[ADR 0016](docs/adrs/0016-break-compatibility-freely-before-1-0.md): before 1.0, a
breaking change gets a line here rather than a deprecation window.

See [RELEASING.md](RELEASING.md) for how this file is kept in step with a release.

## [Unreleased]

### Added

- **Fold a board column or a horizon bucket** — press the chevron in its header and the
  column narrows to a strip, keeping its name, its count and its ability to take a drop.
  The choice is remembered per saved view and per device, beside the rows you have
  collapsed, and never written to the `.base`. On a board the column's own context menu
  offers the same fold, which is the keyboard path to it.

- **A done column of finished work opens folded** — the first time a board draws a done
  column holding finished work and nothing else, it starts shut, the same once-only default
  the tree applies to a parent nobody has ruled on. One still carrying open work opens
  normally, an empty one is left alone, and once you open a folded column it stays open.
  Horizon buckets have no such default: an axis has no notion of finished, so a bucket is
  open until you shut it.

  A running quick filter opens every fold, so a search can still find what is inside one.

- **How far along a roadmap bar is** — a bar on the dated axis now carries a band
  showing the share of the work beneath it that is done, and every row with
  descendants carries the count the tree's rollup column shows. The band draws inside
  the bar without covering it, so a bar whose span is inferred still reads as
  inferred and an open end still reads as open. With no workflow property configured
  there is nothing to call done, so the count is the whole report — exactly as in the
  tree.

- **The roadmap says what your search found underneath** — filter the roadmap and any
  bucket card, bar, shelf card or context row that is only on screen because something
  beneath it matched now names those matches, each one opening its note. They are in
  the row menu too, so this needs no pointer. Previously a match three levels down was
  found, counted, and impossible to reach.

- **Resize the tree's property columns** — drag the grip at a column header's trailing
  edge, double click it to put it back, or focus it and use the arrow keys. Each column keeps
  its own width, per saved view and per device, beside the collapse state — so a title
  column and a risk chip no longer have to be the same size, and nothing about your
  working position is written to the `.base` file.

### Removed

- **The card's right-click menu no longer offers Expand/Collapse unplaced** — the shelf
  still collapses, from its own header, which is where the control has always been. Its
  sort and type filter stay on the menu whenever the shelf is open. The header's
  disclosure is now reachable with Tab, so the shelf can still be opened and shut without
  a pointer.

- **The card's right-click menu no longer lists the children one by one** — the
  **Show/Hide children** toggle stays, and so does the list on the card itself. A card with
  many children no longer pushes the rest of its menu off the screen. A child that matches
  the quick filter is still offered in the menu, as a match. **While a focus level is
  set**, where a child has no card of its own, the menu still offers **Open child** for it
  — otherwise the only way to it would be a mouse.

### Changed

- **The board and the shelf only draw the cards you can see** — a column, a horizon bucket
  and the shelf now let the browser skip the layout and paint of cards scrolled out of
  view, which the tree's rows have done since 0.7. Measured over ~800 notes in the
  development harness, switching to the board went from 330ms to 126ms and to the roadmap
  from 557ms to 203ms. Nothing about what is on screen changes, and the timeline's rows are
  deliberately left as they were — its dependency arrows have to measure them.

- **State colours no longer offer a done state.** A finished bar is drawn green whatever
  is stored against it, so the swatch for a done state could never change anything on the
  grid or in the legend. The dialog now lists the open states only, and says so; a colour
  a `.base` still holds for a done state is ignored. Done is read per workflow, so a value
  only one of your two workflows finishes on still gets a swatch for the other.

- **Lanes will not be built** on the roadmap or the board. They were tried and refused.

- **Double click either resize grip to reset it** — the tree's new property-column grips
  and the roadmap timeline's lead-column grip. A mouse never focuses a grip, so the Home
  key that resets one was reachable only by tabbing onto it first.

- **The Property column width option is gone.** The width is a per-column pick you drag
  now, kept on the device rather than in the shared `.base`
  ([ADR 0011](docs/adrs/0011-keep-collapse-state-out-of-the-base-file.md): a value is
  configuration or working position, never both). A base written with a
  `propertyColumnWidth` key keeps a setting nothing reads; every column starts at the
  same 132px it did and moves from there.

## [0.8.0] - 2026-08-14

### Added

- **A resources axis on the roadmap** — a third choice beside Horizons and Timeline, drawn
  from the assignee property you already use: one row per person, with their work
  positioned by exactly the dates the timeline already reads. Declare a roster under
  **Resources (in order)** to give someone a row before anything lands in it; anyone a note
  names gets a row of their own regardless, and work with no assignee, or with nobody's
  dates to sit at, waits on the shelf. Configured views keep showing Horizons or Timeline
  until you pick the new axis.

- **Move work between resources** — drag a bar into someone else's row, or onto the shelf
  to un-assign it; **Alt+Up** and **Alt+Down** step the selected card one row, and **Set
  assignee** on the row menu now offers every row on screen, empty ones included. All
  three write the same single value to the note's own assignee property, undoable as one
  batch. A row is who and a date is when, so moving work between rows never changes its
  dates — and an item with no dates stays on the shelf under its new owner, which the view
  says out loud rather than leaving it looking like a drop that missed.

- **Mark a resource unavailable** — **Add absence** on a row header writes a note saying
  who is away and for how long, and that stretch draws as a blocked band in their row and
  nowhere else. It is never a backlog item: it has no parent, no rank and no state, it
  never appears in the tree, on a board or on the other roadmap axes, and it is deleted
  through Obsidian's ordinary file delete rather than this plugin's undo. Needs both date
  properties configured — an absence has no children to infer a missing end from — and
  files itself under **Folder for Absence items**, or the home folder when that is unset.

- **An absence is readable against the work it crosses** — the stretch is drawn in a text
  colour instead of the one the gridlines and the weekend banding are made of, so it no longer
  reads fainter than the shading behind it, and at the same height as a bar. The same days are
  now shaded across that person's own rows and over the bars in them, edge to edge with a line
  down each end of the range, so a plan running through an absence is one line to read rather
  than two to compare; the named stretch stays where it was, with its title, its dates and its
  menu. A bar scheduled across one carries a marker in its row header naming which absence and
  which days, and the legend gains an **Unavailable** key wherever a stretch is actually on
  screen.

- **Schedule from a resource's row** — a bar in someone's row now behaves like a bar on
  the plain timeline: drag its body to move it in time, drag either end to change how long
  it takes, and drop an unscheduled card straight into a row to give it both an owner and a
  date in one go. A drag that moves sideways *and* into another row writes who and when as
  a single change, undoable in one step, and says both in one message. Dragging an END into
  someone else's row still only resizes — a resize is not a hand-off — and releasing on a
  row's title assigns it without guessing a date. Dropping on the shelf still un-assigns
  and leaves the dates alone. Keyboard scheduling on this axis is not in yet: **Alt+Up** and
  **Alt+Down** still move between rows only.

## [0.7.1] - 2026-08-12

### Added

- **The assignee chip now shows on cards** — the board, the roadmap's buckets and its
  shelf — not only on the tree's rows. Pressing it opens the same **Set assignee** list
  the row's chip does. State and horizon still don't: a card's own column or bucket
  already says those.

### Fixed

- **A card no longer leaves a blank gap for a property with nothing to show.** A plain
  value or a tag list with no content used to still reserve its cell, which read as
  broken spacing between the chips that did have something to say; that cell is now
  absent entirely. An unassigned item's dashed "Assignee" invitation is unaffected — it
  is a value ("nobody yet"), not an empty cell.

### Changed

- Large backlogs redraw a little faster: the refresh after every change re-parses no
  icons (each is built once and cloned) and rebuilds no listeners (the tree's activation
  and drag handlers now live on the pane, one set for the view). Roughly a tenth off a
  data update at ~800 expanded rows, measured in the browser harness; behaviour is
  unchanged.

## [0.7.0] - 2026-08-10

### Added

- **Clicking a row folds it** is now a toolbar toggle, beside the completed-items eye. It
  moves into the `⋯` menu on a narrow pane, and it is remembered per saved view on this
  device — beside the collapse state, like the projection and the focus level — rather
  than in the `.base` file. So it is yours rather than everyone's: a base shared with a
  colleague no longer carries your habit of clicking to fold. There is no
  **Handling items → Clicking an item** view option any more; a `clickAction` key in a
  base written before this is ignored, and the toggle starts from "opens the note".
- Folding on click now covers the **roadmap's timeline** as well as the tree: a click on a
  timeline row folds the rows below it, exactly as the row's own chevron does. Cards — on
  a board, in a horizon bucket, on the shelf — still open their note, since a card lists
  its children on its own face rather than folding rows. The toolbar toggle is drawn on
  the tree and the timeline for the same reason.
- **A test catalog.** Two new types, `Test suite` and `Test case`, form a ladder of their
  own — a suite holds cases, a case holds tasks — beside the plan's Epic → Feature → PBI →
  Task rather than inside it. A suite is the top of that ladder, so tests are a catalog with
  an order you chose rather than work filed under a requirement. The toolbar's new **Tests**
  projection draws it, and you can walk a suite from the top with the plan out of the way.
- **Your plan does not change when you start writing tests.** The tree, the boards and the
  roadmap draw exactly what they drew before: a test is not a row, not a card, not a bar, and
  not a number in anyone's progress. A test parented under a plan item by mistake still shows
  up — in the catalog, as a root of its own — rather than vanishing, and the same holds the
  other way for a plan item parented under a test.
- Both new types are told apart at a glance the way every other type is, with the outlined
  badge that marks a row as a test.
- An **assignee** property: name it in the view options (or press ✨ and let the view bind
  and backfill `assignee`), then set it from the row's menu or its chip. The names on
  offer are the ones the base's own results already carry — plus anything typed into
  **New assignee...** — so there is no list to declare and nothing to keep in step.
- A **Test management** group in the view options: name a test state property (or leave
  it unbound to share the plan's own state property), list the test workflow's states in order,
  and say which of those count as done. A test catalog row's state chip and its
  `Set state` now read and write that state independently of the plan's, whichever
  property the two end up sharing or not.

### Changed

- **Obsidian 1.12.0 or newer is now required** (was 1.10.2). The Bases custom-view API
  opened in 1.10.2, but a view's options callback was not handed the base's own
  configuration until 1.12.0 — so on older versions this view's options menu showed the
  shipped `docs/…` folders as the type-folder defaults inside any other base, and offered
  no WIP-limit or column-policy box at all. Nothing else was affected: the tree, the board
  and the roadmap all worked. Obsidian keeps serving 0.6.0 to vaults below the new floor.
- The toolbar now leads with the projection switcher and puts **New** beside it, and the
  dividers in the head of the row are gone — between those two, and in front of the
  roadmap's own controls. Each group is set off by spacing instead: a bordered button group
  already says where one control ends and the next begins.
  Both still sit at the head of the row, which is what keeps them on screen at the
  narrowest pane.
- **Dependencies work in a base that has never named the property.** The bar connector and
  the row menu's **Depends on…** used to be withheld until the dependency property was
  bound in the view options — which Obsidian's own picker cannot offer until some note
  already carries it, so the feature was hidden in exactly the vault that had never used
  it. Making the first link now binds `dependsOn` for you and says so. Clearing the option
  still turns the feature off, and an option you have already set is never changed.
  The handle costs what it draws: on the dated axis with 811 bars expanded, a render goes
  from ~274ms to ~318ms.
- Large backlogs render about two and a half times faster with every row expanded: the
  tree now lets the browser skip layout for rows scrolled out of the pane. Measured at 832
  expanded rows, a full render goes from ~718ms to ~283ms; at 1632 rows, from ~1089ms to
  ~446ms.
- `Test case` now wears its own colour, cyan, instead of sharing `Test suite`'s orange —
  the outlined border that marks both as tests is unchanged, only which hue each fills.

### Removed

- **Dragging an item onto the empty space below the tree no longer makes it top-level**,
  and neither does the **Move to top level** strip that used to appear there during a drag
  — the strip is gone as well. Making an item top-level is a deliberate action now:
  **Outdent**, from the row's context menu or Alt+Left, makes a row a sibling of its own
  parent, so a row one level down becomes top-level. It climbs one level at a time, so a
  deeply nested item takes a few presses. Nothing about your notes changes, and nothing
  needs migrating.
- **Assign item type when moving is gone, and a move now never rewrites a note's type.**
  The option re-typed a whole moved subtree to match its new position. It was off by
  default, it was the only thing in the plugin that changed a `type` you had written, and
  a review found one of its safety guards had nothing checking it — losing that guard let
  an unrelated drag turn a hand-nested `Test suite` into plan work and drop it out of the
  test catalog. Removing the feature removes that risk entirely. Dragging, indenting,
  outdenting and clearing a parent link all write the parent and the rank and nothing
  else; **Set type** is how you change a type. If an existing base still has the setting
  saved, it is simply ignored — nothing to migrate and nothing to clean up.
- The fallback that filled the view options menu when Obsidian handed the view no
  configuration. Requiring the floor above is what makes that menu describe the base it
  is open in, always.

### Fixed

- **The roadmap no longer stops responding to the pointer after a drag.** If the view
  refreshed while a card or bar was being dragged — which a session spent drawing
  dependencies does constantly, since every link is a write — the drag left its state
  behind on the pane for good: rows stopped highlighting on hover, the dependency
  connector never appeared again, and no further drag could be started. The drop itself
  had landed correctly, which is why nothing looked wrong until the pane went dead.
  Reopening the base was the only way out.
- Hovering rows in a large backlog is no longer laggy. Deciding whether a title or a type
  badge needed its full-text tooltip measured the element inside the hover event itself,
  which forced the whole tree to be laid out again on every hover — 65.7ms per hover at
  832 rows. Both now carry their full text always, so nothing measures and nothing is
  hidden: the only visible difference is a tooltip on a title that already fits.

## [0.6.0] - 2026-08-10

Changelog tracking starts here. For what shipped in 0.1.0–0.5.2, see the
[GitHub releases](https://github.com/Luis85/backlog-view/releases), generated from the
pull requests merged for each.
