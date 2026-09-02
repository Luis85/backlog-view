# Changelog

All notable changes to this plugin are documented here, for someone deciding whether to
upgrade — not the commit log. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/), read against
[ADR 0016](docs/adrs/0016-break-compatibility-freely-before-1-0.md): before 1.0, a
breaking change gets a line here rather than a deprecation window.

**One entry is one sentence: what changed, for the reader.** The reasoning behind a change
does not belong here — it is already in `docs/`, in the note that argued it, and a changelog
that repeats it is a second copy to keep in step and a wall nobody reads. 0.10.0 was written
the other way first and came to 11,267 words across 113 entries, 37 of them full paragraphs
and one of them 430 words; rewritten to this rule it is a fifth of that and says the same
things. A breaking change is the one exception and keeps the room it needs, because what an
upgrader has to *do* is the whole reason they opened the file.

Add the entry in the pull request that earns it, under the section's existing `### Added` /
`### Changed` / `### Removed` / `### Fixed` heading rather than a second copy of one —
`test/release/changelogVersion.test.ts` fails on a repeated group heading, because the whole
section is what the release workflow publishes as the release body.

See [RELEASING.md](RELEASING.md) for how this file is kept in step with a release.

## [Unreleased]

### Added

- `npm run check` has a sixth step, `lint:md`, gating the Markdown in `docs/` and the
  root documents.
- **My work**, a fourth Bases view (`product-my-work`): one person's work as a backlog tree,
  with the person picked in the view rather than in the Base, so one saved view serves
  everybody. Dock the tab where you want it; the toolbar, the chips and the tree give way in
  a narrow pane. The pick, the folds and "hide done" are remembered per device and per saved
  view.
- `npm run check` typechecks `test/` as well as `src/` (`npm run typecheck:test`), so a
  test calling a function with the wrong arguments fails the gate instead of passing.
- Every shipped catalog is checked against English — the same keys, the same parameters,
  and the plural categories its own language has — so a half-finished translation fails
  the build instead of rendering half in English.
- A pseudo-locale for development builds (`en-x-pseudo`): English accented, a third longer
  and bracketed, so a layout can be looked at in something that is not English. It ships in
  no release; set `localStorage['product-backlog-locale']` and reload to see it.
- CI runs the whole test suite a second time in a non-English locale.

### Changed

- The sentences that tell you to set a view option now quote that option's own label, so a
  renamed option cannot leave the guidance pointing at a control you cannot find.

### Fixed

- Two timeline tests measured against the calendar rather than a fixed day, so they began
  failing a fortnight after they were written.
- My work: the Next marker stays inside the pane at every width, the state chip shows its
  value in full where there is room and its icon where there is not, a title can be
  selected and copied, and a narrow pane keeps the state instead of dropping it.
- A release's scope: a member's state chip shows its value in full rather than truncating
  it at a fixed column width, and carries the value as a tooltip where the row is too
  narrow to show it.

## [0.10.0] - 2026-08-30

### Added

- **Release**, a third Bases view (`product-release`): every release the base holds as one
  list, and one release's scope drawn as a tree.
- **Estimation**, a second Bases view (`product-estimation`): score each item against a
  configurable weighted model — eight value dimensions plus confidence, effort and
  complexity — and rank by the result.
- `Improvement`, a fifth type beside the ladder, for a further round of work on something
  already delivered: it takes its own release rather than moving the shipped item's.
- `Resource`, a declared type for the people work is assigned to. A `Resource` note is
  recognised and then left out of every projection — the plan points at a person, it does
  not contain one.
- `Release` joins the fixed type vocabulary as a marker, beside `Milestone` and `Iteration`.
- A `pbl-id` on every note the plugin creates: one integer from the highest the vault holds,
  written in the same write that makes the note. A handle for naming an item outside
  Obsidian. Existing notes are untouched — there is no backfill.
- `Mark as released` on a release's own screen: one undoable batch writing the configured
  released status and today's date to the release note and nothing else. It asks first,
  listing the members that are not finished.
- `Generate release notes` beside it: one Markdown file per release, grouped by type.
  Regenerating it is byte-identical, and it refuses a file it did not write.
- `Set release` on an item's own menu, with **No release** at the foot to take it back out.
- A context menu on a release scope's rows, offering `New <type>` for every type that row
  may hold — the note hangs from that row and joins the open release in one write. Reachable
  from the keyboard with the Menu key or Shift+F10.
- **New release** at the head of the release list, and again on the empty state.
- A release's status, its description and the day it shipped are set from its own screen.
- Releases draw on the roadmap: a `Release` with a target date draws a dashed purple line
  at that date, with a swatch in the legend.
- A control in the release header opens the release note.
- The release list shows how far along each release is, and how far it landed from target.
- A release's own screen opens with the same figure, counted over its own members.
- A release's scope folds, takes a keyboard walk (arrows, `Home`/`End`, `Enter`), and has
  its own toolbar: collapse all, expand all, hide done.
- Release view options for all of the above: the statuses that mean released, the single
  status `Mark as released` writes, a notes folder, the item state property and its done
  values, and the Deliverable workflow's own pair. Binding the released-date property to the
  target-date property is refused where it is entered — a record that overwrites the plan
  destroys the only evidence a release slipped.
- ✨ on the release view binds every property that view can use, without making a release.
- The estimation view has a toolbar: the backfill action, an undo, and how many results are
  scored.
- The estimation view ranks by a framework you pick — RICE, ICE, WSJF or value over effort —
  previewing what it would change before it configures the indicator.
- A business value stamp left without its total is reported, and offers the cleanup.
- A stale business value can be recalculated where it is reported.
- The item's name in the estimation panel opens the note, and so does `Enter` in the table.
- **New resource** on the roadmap's resources axis toolbar.
- The roadmap's resources axis draws one row per `Resource` note the base returns,
  alphabetically, including a resource nobody is assigned to yet.
- The roadmap's shelf switches between cards and a compact list.
- The open shelf's height is yours to set: drag the grip, or step it with the arrow keys.
- The iteration board's shelf carries the same four picks as the roadmap's — layout, sort,
  type filter and search.

### Changed

- **Breaking:** an item names its assignee by link to a `Resource` note rather than by name.
  Resolution decides, not spelling — `assignee: Sarah` keeps its assignment wherever the
  base already returns a `Sarah.md` typed `Resource`. What goes stale is narrower: an
  assignment naming somebody with **no** `Resource` note behind them draws no row on the
  resources axis. Nothing is rewritten on disk either way. Give that person a note, or set
  the assignee again.
- **`Show completed items` is the toolbar's eye alone now, kept per saved view on this
  device rather than in the `.base` file.** It was an option and a toggle at once, and the
  toggle wrote the option — so hiding finished work for an afternoon rewrote a file everyone
  the base is shared with reads. The default is unchanged. What it costs: a base sent to a
  colleague no longer arrives with finished work hidden, and the pick does not follow you to
  another device. A `.base` written before this keeps a `showCompleted` key nothing reads.
- **Releases no longer appear in the backlog** — no rows, no cards, and no New menu or Set
  type offers the type. The release view is where a release is made, listed and read.
- The plugin reads in your Obsidian's language. Every surface the view draws now takes its
  words from the message catalog: the tree, both boards and the roadmap; the whole toolbar;
  every menu; every empty state; every dialog and both commands; the view-options menu; the
  writer's mid-move notices; the words for "no placement"; and the estimation view's own
  options, refusals and sentences.
- The write path's serialization and single undo slot are plugin-wide: a write in one Bases
  view briefly holds back the other's write controls, and undo takes back the vault's last
  batch whichever view wrote it.
- Both undo buttons read `Undo last change`.
- The release list is a list of releases now, not a grid of columns: each release is a
  two-line band.
- A release's own screen draws its two closing actions inside the header, and the released
  date is the control wherever a release has one.
- The release header's released-date control is labelled `Set released date` — the action
  beside it is what `Mark as released` means now.
- An unset property chip is no longer drawn at rest. Seven of nine columns on a typical row
  showed a grey chip meaning "nothing here".
- The selected projection tab is readable: it was 2.56:1 in dark and 1.65:1 in light.
- The shelf's resize handle sits on the edge the shelf actually shares with the roadmap.
- The shelf's title bar stays on screen while you scroll the shelf.
- A compact shelf row draws aligned columns, reusing the tree's own stored property widths.
- A shelved parent's disclosure moves onto its own row, so a shut parent costs no more
  height than a leaf.
- A card lists work below a row the screen is not showing — a task committed to the sprint
  under a story that is not.
- The configuration warning reads as one sentence, the same one in all three places it
  appears.
- Assign missing properties no longer creates a date property on a note that cannot use one:
  a `Milestone` gets the target and not the start.
- A new iteration is named for its goal — `1 - Iteration - Ship the board`.
- The manual's item-types paragraph is built from the type vocabulary rather than written
  around it.
- The estimation view's table and panel are readable: proportional strips on value and
  coverage, a currency chip that spends colour only where something needs doing, and columns
  that line up across every row.
- A sorted column header says which direction, not just that it is active.
- A dimension problem names the dimension the way its own settings panel does —
  `Strategic alignment`, not `strategic-alignment`.
- Each dimension's box is labelled `Weight (% of 100)`, and a refusal says the delta.
- A refused estimation setup names every configuration problem, not just the first.

### Removed

- The `Show completed items` view option — see **Changed** above.
- The `Resources (in order)` view option. The roster is the notes the base returns.

### Fixed

- No screen offers `Iteration` or `Release` under `New` or `Set type` any more. The
  requirements board still did, and the note it made vanished from the board that made it.
- The release index says which binding is wrong when the membership property is aimed at a
  property something else owns — instead of reporting work you had never mis-assigned, or
  showing `No items yet` on every release with nothing to explain it.
- A release whose vault has no statuses yet can be given one.
- A release can no longer lose its type to an editor left open.
- A release band that cannot compute its own progress says so, instead of showing nothing.
- A release holding only Deliverables shows progress, where it used to say progress was not
  configured.
- A row's progress no longer reads `0/2` where progress is not configured at all.
- A finished item in a release's scope reads as finished — the done colour and the check.
- A release's rows line up: the state chip and progress figure anchor to the row's end.
- Picking a different release no longer starts the keyboard on a row left over from the last.
- Clicking a release scope's disclosure no longer drops keyboard focus out of the tree.
- Selecting a title with the mouse no longer opens the note.
- Clearing a release's released date no longer drops keyboard focus to the page.
- The reason a closing action is not offered takes a line of its own, instead of reading as
  the other action's.
- The release screen says `Description unreadable`, not the name of the setting.
- The release list, the release screen's description and released date, and a confirmation
  dialog's member rows no longer paint as raised Obsidian buttons.
- Renaming a release, or an item in one, no longer reopens every row you had folded.
- Folding a row no longer silently does nothing once you have folded roughly 12,000 rows —
  the stored list discarded your newest fold rather than your oldest.
- Deleting a note takes its folded rows with it, instead of leaving an entry against the cap.
- A focused roadmap no longer loses work beneath a parent the base filtered out.
- Alt+Up/Down on a milestone's card no longer writes an assignee nothing shows.
- An assignee chip naming no resource says so to a screen reader, not only in colour.
- Marking or editing an absence refuses when the resource it names stopped being one between
  the form opening and the submit.
- An unset property chip meets AA contrast when it is shown. It was 2.57:1 in dark against
  the 4.5:1 a 12px label needs — unreadable and clickable at once.
- The shelf's compact rows no longer reserve room for columns empty on every card in the band.
- The shelf's type headers no longer let the cards under them show through.
- The shelf's own title no longer moves when the band is opened or closed.
- The shelf's resize grip no longer strands itself mid-band when everything inside is
  collapsed.
- The estimation panel's clear control no longer draws over the last point of its row.
- The four numeric columns' values share one baseline.
- The estimation panel's title wears the same weight as every other Title-level text, and
  its total, item name and table render at the right sizes.
- A long currency word no longer pushes a row's numeric columns out of line with the header.
- A business value typed in by hand is no longer offered for deletion.
- The guided estimation setup is all-or-nothing: it can no longer bind every property and
  then have the writes refused.
- A sorted column header keeps keyboard focus.
- Stepping through the estimation table with the arrow keys no longer parks the selected row
  behind the column labels.
- The estimation table's sort buttons are no longer pruned from the accessibility tree.
- Two surfaces that were still English in every language: how a move on the dated axis names
  a one-ended span, and every sentence the estimation view refuses with.
- The docs register gate no longer fails on `docs/product/`.

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

- **The board and the shelf only draw the cards you can see** — a column, a horizon bucket
  and the shelf now let the browser skip the layout and paint of cards scrolled out of
  view, which the tree's rows have done since 0.7. Measured over ~800 notes in the
  development harness, switching to the board went from 330ms to 126ms and to the roadmap
  from 557ms to 203ms.

- **Recording an absence now asks for the dates alone.**

- **State colours no longer offer a done state.**

### Removed

- **The card's right-click menu no longer offers Expand/Collapse unplaced**.

- **The card's right-click menu no longer lists the children one by one** — the
  **Show/Hide children** toggle stays, and so does the list on the card itself. A card with
  many children no longer pushes the rest of its menu off the screen.

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
