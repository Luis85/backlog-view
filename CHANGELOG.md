# Changelog

All notable changes to this plugin are documented here, for someone deciding whether to
upgrade — not the commit log. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/), read against
[ADR 0016](docs/adrs/0016-break-compatibility-freely-before-1-0.md): before 1.0, a
breaking change gets a line here rather than a deprecation window.

See [RELEASING.md](RELEASING.md) for how this file is kept in step with a release.

## [Unreleased]

### Changed

- **The view-options menu reads in your Obsidian's language.** Every group name, every
  option's name and every placeholder that is a hint rather than a value now comes from the
  plugin's string catalog. Nothing that is written down changes: the settings a base stores,
  the frontmatter keys a property picker suggests, and the placeholders that mirror an
  option's own default are the same in every language, so a vault set up in one language
  opens correctly in another. English is still the only catalog that ships.

- **The configuration warning reads as one sentence.** The toolbar's warning chip, the
  refusal that gates a write and the readme command all state a bad configuration the same
  way — `Fix the view options first: the parent and order properties share the key "rank".`
  — instead of running whole sentences together when more than one property collides.

### Added

- **The roadmap's shelf switches between cards and a compact list.** A third picker in the
  shelf's own header, beside the sort and the type filter, and a `Shelf layout` submenu in
  any shelf card's menu for a reader with no pointer. List mode draws one row per item —
  the type badge, the title, and everything the card already carried on one line — plus the
  item's workflow state, which a card does not show because a board column or a horizon
  bucket already says it and a shelved card sits in neither. The pick narrows nothing: the
  same cards are drawn either way, so the shelf's count is the same true total in both. It
  is remembered for the saved view on this device, like the sort beside it, and cards stay
  the default.

- **The open shelf's height is yours to set.** A grip along the band's foot, dragged with a
  pointer or stepped with ArrowUp/ArrowDown once it has focus; a double click or Home hands
  the height back to the share of the pane the shelf has always taken. A band you have sized
  is exactly that tall — it scrolls when the cards need more and shows space when they need
  less — and a height picked in a tall split comes back in full rather than being written
  down to a narrow one. Until you drag it, nothing is stored and the shelf takes the share of
  the pane it always has. It applies to the iteration board's backlog band as well — one
  band, one height — and it is remembered per saved view per device without anything
  reaching the `.base`.

### Fixed

- **The shelf's own title no longer moves when the band is opened or closed.** Opening the
  shelf adds its search box, and that box was 11px taller than everything else in the
  header — Obsidian styles `input[type='search']` itself and outranked the height this
  plugin asked for — while the band's padding halved when it shut. Together those moved the
  shelf's name 9.5px down the pane at the moment a reader pressed the disclosure beside it.
  The header now reserves one row height in both states and the band keeps one padding, so
  the title stays exactly where it is. A shut shelf is five pixels taller than it was.

### Changed

- **Everything the tree, the boards and the roadmap draw takes its words from the message
  catalog now** — every row marker and property chip, the tag pills, the rollup, each
  board column's announced name with its limit and overage, the card's parent line and
  children, the shelf and its context strip, the roadmap's buckets, the timeline's legend,
  today line, dependency arrows and span sentences, and every notice the write gate shows.
  With `main.ts`'s two palette commands and a handful of prompts and grip tooltips that a
  previous round reported as done and had missed, that leaves the plugin's user interface
  translated apart from the built-in manual. Nothing reads differently in English except
  where a list is involved: a row's prerequisites and a resource's absences are joined as
  the language's own grammar joins a list rather than with a fixed separator, so English
  now reads "A, B, and C" where it read "A, B, C". Nothing OF your vault is translated —
  titles, type names, workflow states, horizon values, resources, tags and dates appear
  exactly as your notes spell them.

- **The whole toolbar takes its words from the message catalog now** — the New button and
  its type picker, the projection switcher, the focus picker, the board scope picker, the
  roadmap's axis and zoom pickers, every icon control's tooltip, the `⋯` menu, the item
  count and its breakdown, the ignored-note and grouping advisories, the configuration
  warning and the busy indicator. Nothing reads differently in English, and nothing the row
  shows OF your vault is translated: type names, iteration titles and the type each button
  offers to create appear exactly as your notes spell them.

- **Every menu takes its words from the message catalog now** — the row and card menu, the
  board column's fold, the shelf's sort, type filter and search, and the Set state, Set
  risk, Set priority, Set assignee, Set iteration, Set horizon, Set type and Edit tags
  submenus, along with the prompts they open. Nothing reads differently in English, and
  nothing a menu LISTS is translated: your type names, workflow states, risk and priority
  rungs, assignees, iterations, horizon buckets and tags are what your notes hold, so they
  appear exactly as you wrote them in every language. Two entries are still English —
  `Clear horizon` and `Depends on…` — and follow with the rest of their own files.

- **Everything the view says when it has nothing to show comes from the message catalog
  now** — the empty backlog and its focused form, the empty test catalog, the guidance both
  boards show without a workflow, the roadmap without an axis, the empty Deliverables board
  and iteration, and the "all done and hidden" notice. Nothing reads differently in
  English. Type names are not translated and never will be: they are what `type:` holds in
  your notes, so a sentence that quotes one takes it as it is written.

- **Every dialog and both commands take their words from the message catalog now** — the
  new-item, folder, schedule, absence and iteration prompts, the state-colour dialog, the
  manual's title, and the notices from `Create backlog` and `Write backlog readme`. Nothing
  reads differently in English except one line of punctuation: the readme command's
  configuration refusal used to run its problems together as `"…".; "…"..` and now joins
  them as a list. With more than one problem that list still reads a little oddly, since
  what it joins are whole sentences; the rest of it waits on those sentences being
  translated. The plugin's own name is still its name in every language.

- **The words the plugin uses for "no placement" come from the message catalog now** —
  `Unplaced`, `Unscheduled`, `No state` and the `Unset` a real state collides with, plus
  the shelf's search labels and the marker row's header. Nothing reads differently in
  English. What changes is that they can be translated at all: they were constants in the
  code, and a constant is fixed before the plugin has read which language Obsidian is in.

- **The manual's item-types paragraph is built from the type vocabulary, not written around
  it.** It reads the same, with two small improvements the change came with: the lists in it
  now join the way English joins lists (`Issue, Bug, Idea, and Deliverable`), and the rungs
  the `+` offers under are named from the ladder itself rather than spelled out, so adding a
  rung to the ladder or a type beside it describes the new one instead of leaving the
  sentence quietly wrong. One thing it still does not adapt to: the paragraph says markers
  "are" neither, so a vocabulary reduced to a single marker type would read oddly until the
  sentence is rewritten.

- **A new iteration is named for its goal.** `New iteration…` names the note
  `1 - Iteration - Ship the board` rather than `1 - Iteration`, so a folder of sprints says
  what each one was for without opening one. The goal is appended to the name you confirm,
  sanitized into a legal file name and capped at 60 characters; with no goal, or with no
  goal property configured, the name is unchanged.

## [0.9.1] - 2026-08-17

### Removed

- **The toolbar's quick filter is gone — use the Base's own search.** Obsidian Bases carries
  a search of its own now, so the plugin's box was a second search over the same rows. A
  Base search narrows the results this view is given, and the ancestors those results need
  are still loaded around them, so a search reads as a tree rather than a flat list of hits.
  The roadmap's unplaced shelf keeps its own search, which is scoped to the untriaged work
  beside it. Going with the box: the `/` shortcut, the highlighted match in a title, the
  "3 of 12" column headers, the match links on a card and the `Open match` menu entries, and
  the no-match empty state. Nothing was ever written for a filter, so there is nothing to
  migrate and no stored setting left behind.

### Added

- **The iteration board has a shelf, so a sprint is filled by dragging.** Above its three
  columns it now draws the work in no iteration at all — unfinished, grouped by type and
  counted, foldable from its own disclosure. Dragging a card from the shelf onto a column
  puts it in the sprint and in that column at once, as one undoable step; dragging a card
  back onto the shelf takes it out of the sprint and changes nothing else. Work committed
  to another iteration is deliberately not on the shelf, so a pull can never quietly empty
  somebody else's fortnight — moving work between sprints stays `Set iteration`, which
  names both ends. The shelf is a pointer gesture for now: the keyboard's path to the same
  writes is still `Set iteration` on the item.

- **Set iteration is one undoable step, wherever it happens.** Picking a sprint from
  `Set iteration` writes the link and both of its dates as a single batch behind a single
  undo, and a card created straight onto an iteration board carries that same link and
  both dates in its first write — never a create followed by a second write of its own.

- **Keep iterations off the roadmap timeline.** A new "Show iterations on the roadmap
  timeline" view option, on by default, decides whether the grid axes draw iterations at
  all. Turned off, a sprint draws nowhere — no bar, no line, and nothing on the unplaced
  shelf either — for a plan that is read by milestone alone. Turned off, it also takes
  "Draw iterations as bars" out of the menu, since there is no reading left to choose;
  your pick is kept and comes back with the timeline. It writes nothing to any note:
  turning it back on redraws the same sprints.

- **Draw a sprint as a bar, not only a line.** A new "Draw iterations as bars" view
  option turns an `Iteration` from a point at its target date into a start→target bar on
  the roadmap's grid axes, with a grip on each configured end. Either way, the marker
  row's caption, the legend swatch and the announced sentence now name what is actually
  drawn — Milestone, Iteration, or both — instead of calling every marker a milestone.

- **A clear button on the shelf's search.** An x appears beside the box while there is
  something to clear and empties the search when pressed, leaving the caret where it was.
  The box is `type="search"` and was built expecting the platform's own clear button;
  where that never appeared there was no way out of a search but Escape or selecting the
  text by hand. The native button is now suppressed outright, so the field never shows two.

### Changed

- **Fold controls read as whole sentences.** Expanding or collapsing a board column, the
  roadmap's unplaced shelf, or a resource's band on the roadmap now takes its wording from
  the message catalog rather than swapping a verb inside one. Nothing about the wording
  changes in English; what changes is that a translation can reorder or inflect the whole
  sentence instead of being handed two halves. A resource band's chevron also stopped
  carrying an unreachable second label for the milestones row, which draws no chevron at
  all.

- **The board toggle is now called Boards.** Since the scope picker moved every board —
  Product, Deliverables, and each iteration — behind one toggle position, the switcher
  says so: the button reads **Boards** and its accessible name is
  **Show as kanban boards**. Nothing else about the position changed.

- **Column resize follows the pointer now.** A property column's grip moved from its
  trailing edge to its leading one — the edge that actually moves when a column anchored
  to the row's end resizes — so the boundary under the pointer tracks the drag instead of
  standing still while the column grows away from it. The arrow keys still move the
  boundary the way they point, a double click still resets, and stored widths are
  untouched. Hovering a column header now also lights the whole column band in the theme's
  hover colour — the full height of the header strip, square — so the header reads as
  something to interact with before the mark is found.

- **The unplaced shelf now leads the horizon board.** It renders above the buckets — and
  first in the keyboard's reading order — so the untriaged rest sits where a drag into a
  column starts, instead of below the tallest column. One exception: an EMPTY shelf, which
  is hidden until a drag makes it a target, still appears at the foot of the board — with
  nothing on it there is nothing to drag from, and putting it back at the top would shove
  the whole board down under the pointer the moment a drag began. Alt+arrow moves are
  unchanged: the shelf was already their first stop.
- **The horizon board's right-click menus no longer carry a children section.** No
  `Show/Hide children` toggle and no `Open child` entries there — the card's own
  disclosure still lists children on its face. The kanban board and the dated axis keep
  their menus as they were.

### Fixed

- **The horizon board no longer sizes itself from its cards.** Buckets share the pane's
  width equally again, down to their 280px floor — in the grid layout and one-card-per-row
  alike — instead of growing to the widest card and resizing as cards render, which is
  what made the pane jump near its right edge and the end unreachable. The buckets band
  now takes the pane's height the way the kanban board's columns do: each bucket scrolls
  its own cards, and the unplaced shelf stays on screen — at the top, where it now leads —
  instead of being pushed off the foot of a frame as tall as its tallest bucket.

- **Dragging to the bottom of the unplaced shelf scrolls it.** The shelf scrolls inside
  its own band, and a card held at its edge now scrolls it the way a board column, a
  horizon bucket and the timeline already did. It had no auto-scroll at all, so on a shelf
  holding more cards than its band could show, everything past the first few was out of
  reach for the whole drag.

- **The roadmap's empty state is no longer cut off.** The message that explains an empty
  roadmap — with its ✨ configure action and its link to the manual — was capped at a
  third of the pane and scrolled inside a box most readers would not know scrolls, so on a
  short pane half of it was below the fold. It draws only when there is nothing else on
  screen, so it now takes the room.

## [0.9.0] - 2026-08-16

### Changed

- **Milestones now share one row at the top of the dated roadmap.** Instead of a row each
  among the bars, every milestone draws as a diamond in a single `Milestones` row ahead of
  the first bar — the same row the resources axis already had — so the dates the plan is
  measured against read across the work beneath them and the work starts at the top of the
  grid. Each diamond names itself (title, exact date and workflow state) and opens its note
  on a click; the full-height line and its label are unchanged, and so is everything about
  where a milestone lands, what a drag writes and what the shelf does with it. Two
  consequences worth knowing: no fold can take a milestone off the grid any more, not even
  folding its parent — that is the point of the row — and a milestone is no longer a stop
  for the roadmap's arrow keys, so reach one from the tree or the board when there is no
  pointer.

### Added

- **A MoSCoW priority on every row.** Name a priority property under the new
  **Prioritization** view options and each row draws a priority chip: press it, or use
  **Set priority** in the row menu, to pick a rung. The ladder ships holding
  `1 - Must, 2 - Should, 3 - Could, 4 - Won't` and is yours to rewrite; clearing it takes
  the chip and the menu away and leaves an ordinary property. The ✨ button binds and
  backfills it like every other optional property, clearing removes the key rather than
  blanking it, and every write is one undoable batch.

- **The Deliverables board moved into the scope picker.** Its toolbar toggle position is
  gone: every board is the `Board` button now, and the picker beside it says which —
  `Product` and `Deliverables` lead the menu, each under its own icon, with the
  iterations below. The pick is remembered like an iteration scope, so leaving `Board`
  and returning reopens the board you were on.

- **The scope picker is the board's own control.** It draws after the New button, on the
  board and nowhere else, and it draws even in a vault with no iterations yet — because it
  carries the only way to make the first one. Iterations no longer appear in the tree or in
  any New menu: an iteration is the container a board is scoped to, not work the backlog
  holds. A new one is named `1 - Iteration` by default, numbered so a folder of them sorts
  in the order they run.

- **Make and edit an iteration from the board.** The scope picker carries
  `New iteration…` and, on a chosen sprint, `Edit iteration…`. A new one is dated for you
  — the day after the last sprint ends, running for the length you configure — and every
  field is a prefill you can change before it is written. The note is not opened: making a
  sprint is a planning act, and the board you are planning on stays in front of you.
  Editing writes to the iteration note alone: it never re-stamps the work already in it.

- **A board scoped to one iteration.** Pick a sprint from the scope picker beside the
  projection switcher and the Board position draws that iteration alone, in three columns
  over your own workflow: Open, In progress and Resolved. Which of your states fall in the
  two outer columns is configured; everything else is in between. The iteration's goal
  draws above the columns, a card moves between buckets by drag, Alt+arrow or its menu, and
  the choice of scope is remembered per view, per device — through a rename of the note or
  of a folder above it.

- **An iteration to put work in.** A note typed `Iteration` is a time box: name its
  property in the view options (a goal property too, for later), then, from any row's
  or card's menu, put an item in it with `Set iteration` (or take it back out with
  `None`). Joining one takes its start and target dates in the same action, so
  scheduling a sprint is one pick rather than three.

- **Fold a type group in the shelf.** Each type group in the expanded shelf now has a
  disclosure beside its name.

- **Search the shelf, and pick its types without the menu shutting.** The expanded shelf's
  header carries a search box: type and it narrows to the unplaced cards whose title
  matches, leaving the placed half of the roadmap alone, and its count keeps reporting the
  true total. Escape clears it, and the card menu offers **Search unplaced...** for a
  keyboard. The type filter now stays open across a pick and leads with **Show all types**
  and **Hide all types**, so "only the type I want" is two picks in one menu.

- **A toggle for the bucket grid on the horizon roadmap.** A wide bucket reflows its cards
  into several columns, which is right for a backlog slice and wrong for a short list you
  are reading down. The toolbar now carries a toggle for it while the horizon axis is
  showing: press it and every bucket lists its cards one per row.

- **Every milestone in one row above the roster.** On the resources axis a milestone is no
  longer filed under whoever is named on it — where folding that person's band took the
  date off screen — and one naming nobody no longer waits on the shelf.

- **One row per resource, whatever they have.** An absence used to draw a blocked line of
  its own beneath its resource's header; it draws inside the header itself now, and two that
  share a day pack into their own sub-lanes rather than either one hiding the other.

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
  descendants carries the count the tree's rollup column shows.

- **The roadmap says what your search found underneath** — filter the roadmap and any
  bucket card, bar, shelf card or context row that is only on screen because something
  beneath it matched now names those matches, each one opening its note.

- **Resize the tree's property columns** — drag the grip at a column header's trailing
  edge, double click it to put it back, or focus it and use the arrow keys. Each column keeps
  its own width, per saved view and per device, beside the folded rows — so a title
  column and a risk chip no longer have to be the same size, and nothing about your
  working position is written to the `.base` file.

### Changed

- **The board and the shelf only draw the cards you can see** — a column, a horizon bucket
  and the shelf now let the browser skip the layout and paint of cards scrolled out of
  view, which the tree's rows have done since 0.7. Measured over ~800 notes in the
  development harness, switching to the board went from 330ms to 126ms and to the roadmap
  from 557ms to 203ms.

- **Recording an absence now asks for the dates alone.**

- **State colours no longer offer a done state.**

### Fixed

- **Two rough edges on the shelf's own controls.** The type filter's menu opened under the
  mouse the first time and then reopened at the button's edge after every pick, so the
  menu moved the moment it was used; it now opens in the same place both times. And the
  search box drew a border and a background inside the theme's own, giving the field a
  double outline; it is now a plain search field wearing whatever the theme gives one.

- **The pause after a write on a large backlog is gone.** Every change used to redraw the
  whole tree, so on a vault of around eight hundred notes with the tree open, each move,
  each state change and each undo was followed by roughly half a second of nothing. The
  view now redraws only the rows that would look different — measured at about a third of
  the old cost per row, on the same expanded tree at every size tried. Three things switch
  it off, and on a vault that shows one of them nothing changes: a column that is not a
  note property (a file's modified time, a formula), a row whose cell draws a link or an
  embed rather than plain text, and a row whose file Obsidian has not finished indexing —
  each redraws as it always did, so nothing can go stale on screen.

- **One view saving can no longer forget every other view's working position.** Saving
  tidies away entries for `.base` files the vault no longer has — and if the vault could
  not answer at that moment, every entry looked gone and every one was dropped. It now
  checks that the vault can see the base of the view doing the saving before it believes
  any of the answers.

- **Progress bars line up again in a big backlog.** The bar and its count share a lane
  anchored at the right, and the count had a fixed reservation that only held two digits
  over two — so a row counting hundreds pushed its own bar left, and rows counting units,
  tens and hundreds each drew their bar in a different place.

- **Folding every resource row no longer reports the plan as empty.** The roadmap counted
  the rows it had drawn, and a folded band draws none — so shutting the last open band
  answered with "all your items are done and hidden" beside the headers, counts and rails
  still on screen.

- **A bar drag or resize no longer loses its release.** If the vault changed while a bar was
  in the air — which happens most often in the first minutes after a view is opened, while
  the query is still settling — the release could write nothing at all: the ghost showed the
  dates it meant, the bar snapped back, and nothing was said about it. The view now waits for
  the gesture to finish before it rebuilds.

- **Drawing a dependency no longer loses its release either.** The wait above covered a
  bar's own moves and resizes but not the dependency connector: a vault change mid-draw
  took the preview line with it and the release wrote no dependency, silently. A link
  gesture now holds the rebuild back the same way.

- **A one-day absence crossing reads "1 day lost", not "1 days lost".** The cost sentence
  in the crossing's tooltip and its screen-reader text now pluralizes like every other
  count on the roadmap.

- **The Property column width option is gone.** The width is a per-column pick you drag
  now, kept on the device rather than in the shared `.base`

### Removed

- **The card's right-click menu no longer offers Expand/Collapse unplaced**.

- **The card's right-click menu no longer lists the children one by one** — the
  **Show/Hide children** toggle stays, and so does the list on the card itself. A card with
  many children no longer pushes the rest of its menu off the screen.

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
