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

- **The release list shows how far along each release is, and how far each one landed from
  its target.** Two new options on the release view turn them on. Bind **the property that
  holds a work item's state** — and, if your vault does not spell them the usual way, the
  values that mean done — and every release grows a progress bar and a `8 of 14 done` phrase
  counted over its own items. Bind **the property that holds a release's released date** and
  a release that carries one moves to a **Shipped** group, says how far it landed from its
  target (`7 days late`, `7 days early`, `Shipped on time`), and stops being counted as work
  in flight.
  **Until you bind them the figures are absent rather than wrong**, which is worth knowing
  because it is what you will see on the first open. With no state property bound the bar and
  the phrase are not drawn at all — deliberately not drawn as 0%, which would look exactly
  like a release where nothing is finished. With no released-date property bound **no release
  is ever marked overdue**, however long its target has been past: without that one value the
  view cannot tell a release that is late from one that shipped weeks ago, and it would
  rather say nothing than say the wrong one of those. Since the option is new, that is the
  state every saved release view is in until you set it. Both missing bindings are named in
  one line beneath the list, so a screen that is staying quiet says why.

- **Releases are made from the release view.** A **New release** button now sits at the head
  of the release list, and again on the screen you see when there are no releases yet. It
  asks for a name and — where your vault tracks them — a version, a target date and a status,
  and writes one note with those and nothing else. The first press also binds the release
  view's own properties for you if you have never set them, and says so; a property you
  deliberately cleared is left alone and is not asked for, and a property one of the view's
  other options already points at is never handed out a second time — two options aimed at
  one property is a state this view cannot report, so it will not create one.
  Two things worth knowing before you use it. **New releases land in `docs/releases` unless
  you say otherwise** — that is the shipped default and it is a new option on the release
  view. If you moved your backlog's home folder, your releases used to go to
  `<your folder>/releases`, and the release view cannot see that setting, so the next one
  goes to `docs/releases` until you point the new option somewhere else. Nothing warns about
  this; check where the note lands the first time. And **creating a note cannot be undone** —
  that is true of every New in this plugin, not just this one — so a release made by mistake
  is deleted the ordinary way.
  A box you leave blank is left off the note entirely rather than written empty. That has
  one consequence worth knowing: Obsidian's own property picker only offers a property some
  note already carries, so in the view options the version, target-date and status boxes may
  show a suggested name rather than a pickable one until a release you have made actually
  carries that field. Fill a box in once and that property is pickable like any other.

- **A release's scope can be folded, and a row opens the note it names.** Every row that
  holds children now carries a disclosure, so a large release can be collapsed down to its
  Epics and Features rather than always drawing every Task; a leaf holds the same width in
  reserve so titles at one level still line up. Folding never changes a figure — a folded
  parent keeps its own progress, since the count is over the subtree rather than over what
  happens to be drawn. Each row that holds a state also shows it, and a row with members
  below it shows a compact progress figure of its own, the same bar the release-wide summary
  above the tree already draws. Clicking anywhere on a row but the disclosure opens its note,
  in the pane the view's own new **Open the note in** option names — the same choice the
  estimation table already offers, defaulting to a split pane here too. A fold is remembered
  per release: folding an Epic while looking at one release leaves it open in another, and —
  where this view can tell which saved view it is — survives closing and reopening it;
  embedded in a note, it lasts only the session.

- **A release's scope is reachable from the keyboard.** The tree now takes one Tab stop
  rather than none: the arrow keys move a highlighted row up and down between the ones on
  screen, `Home`/`End` jump to the first and last, `Enter` (or `Space`) opens the highlighted
  row's note, and Left/Right fold a row, unfold it, step into its children or step back out
  to its parent — a leaf has nothing to step into, so Right does nothing on one. A middle
  click on a row, anywhere but the disclosure, now opens the note in a new tab too, the same
  gesture every other tree and card in this plugin already offers.

- **A release's scope has its own toolbar: collapse all, expand all, and hide done.** The
  third control folds away every finished subtree at once, leaving the rest exactly as
  ranked; press it again to bring them back. When hiding takes the whole tree with it — every
  member finished — the screen says so by name (`All 14 items are done.`) instead of going
  blank, with the toggle still there beside it as the way back. Hide done is withheld
  wherever the progress figure above it already reads "not configured": a control that could
  hide rows the summary refuses to count would answer the same question twice, and
  disagree.

### Fixed

- **A release holding only Deliverables now shows progress**, where it used to say progress
  was not configured. The figure now asks whether every kind of work a release's own members
  span can be read as done, rather than asking only about the plan's own state property — so
  a release scoped entirely to Deliverables reads its own workflow correctly, on the list and
  on the release's own screen alike.

- **A row's progress no longer reads `0/2` on a release where progress is not configured.**
  With no state property bound, a parent with members below it used to draw a rollup anyway,
  which looked exactly like a genuine "nothing here is finished yet" — the same absence the
  summary strip above the tree already knew to leave blank rather than count as zero. The row
  now leaves the same blank lane, agreeing with the header above it.

- **A release's rows line up.** The state chip and the progress figure at the end of each row
  used to pack against whichever title happened to be short, reading ragged down a scope with
  titles of different lengths; they now anchor to the row's end, the same rule every column in
  the backlog tree already follows.

- **Selecting a title with the mouse no longer opens the note.** Titles in a release's scope
  can be selected and copied, and finishing that drag by releasing the pointer over the row
  used to dispatch a click that opened the note out from under the selection just made. A
  plain click still opens it; a drag that ends one does not.

- **Picking a different release no longer starts the keyboard on a row left over from the
  last one.** If the same note happened to sit in both releases' scopes — most often a shared
  ancestor drawn as context in each — the tree could open already highlighted on it instead of
  its own first row. Picking a release now always starts fresh; reopening the SAME release
  (a background refresh, an edit elsewhere) still returns you to where you were.

- **The release list no longer draws every row as a raised Obsidian button.** Each row really
  is a button — that is what makes it reachable with Tab, and openable with Enter and Space —
  and it was carrying Obsidian's own button background and shadow, so the list read as a stack
  of controls rather than as a list of releases. The reset was there and simply lost to
  Obsidian's own rule; it is fixed at the rule rather than by changing the element, so the
  keyboard still reaches every release. A second defect of the same kind went with it:
  Obsidian gives a bare button a fixed height, which squashed the new two-line band down to
  one line and spilled its second line into the release below.

- **A focused roadmap no longer loses work beneath a parent the base filtered out.** A
  parent shown for context, with a release between it and the work below, counted as an
  empty scaffold and took that work off the screen with it — and the roadmap then said
  every item was done and hidden, offering to show completed items that would not have
  brought any of it back. A row shown for context now stays while any of the work it places
  is drawn BENEATH it, whatever rows lie in between. It still goes when nothing is left
  under it — including when the work it was placing is drawn in its own right instead of as
  its child, which is what happens when the row between the two is a release the base
  excludes, or a sprint, which the plan does not hold whether or not the base returns it.
  Filtering a row out is not on its own what promotes the work: an excluded feature between
  the two is still shown for context, and everything under it stays its child.
  The same reading reaches the iteration board, where it ADDS a card rather than restoring
  one: a parent shown for context appears there when a task committed to the sprint hangs
  below it through a story that is not in the sprint.

### Changed

- **The shelf's resize handle now sits on the edge the shelf actually shares with the
  roadmap.** On the timeline and resources axes the unplaced shelf is drawn below the grid,
  so the edge between the two is the shelf's TOP — that is where the handle is, and dragging
  it **up** makes the shelf taller (the arrow keys follow the same direction). On the horizon
  axis and on both boards the shelf leads and the handle stays at its foot, where a downward
  drag still grows it. On those axes the shelf also keeps a proper gap below its last row of
  cards, matching the space at its left and right, and the handle sits on the band's own top
  border with room between it and the title row rather than against it. **The handle is also
  no longer see-through**: scrolling the shelf used to draw its own cards inside the strip you
  grab, on every projection that has one.

- **The shelf's title bar stays on screen while you scroll the shelf.** Its sort, type filter
  and search box are the controls that decide what the band is showing, and they used to leave
  the screen exactly when a long shelf gave you a reason to reach for them. They are now pinned
  to the top of the band on every projection that draws one, so a shelf scrolled to its end
  still has them.

- **The release list is a list of releases now, not a grid of columns.** Each release is a
  two-line band: its name, its version, a date and its status chip on the first line; a
  progress bar, the count of its finished items and — where there is one — an overdue warning
  or a slip on the second. A release whose target has passed with nothing shipped is drawn in
  the error colour, with a rule down its leading edge and a note counting the days. The five
  columns are gone and so are their fixed widths, which changes how the screen behaves in a
  narrow pane: a band gives its width to whichever figure needs it, and **the release's own
  name is the last thing to shorten** — a long version ellipsises down to its first few
  characters before the name it belongs to gives up any, rather than keeping its full width
  beside a name cut down to nothing. Past that point the name ellipsises too; neither figure
  is ever cut off without the ellipsis that says so, and neither is shrunk away to nothing.
  **The order changed with it, and that changes what is at the top of your screen.**
  Releases are split into **In flight** and **Shipped**, each headed with its own count. In
  flight is ordered by target date as before; shipped releases are ordered by released date,
  newest first, in their own group at the bottom. Until now a release that had already
  shipped sorted on its old target date and floated to the top, burying the one shipping
  next.
  The Items column is not lost: its number is the denominator of `8 of 14 done`. A release
  with no items says `No items yet` and draws no bar, because an empty bar reads as failure
  where the answer is emptiness.

- **Releases no longer appear in the backlog.** They are not drawn as rows on the tree, they
  do not appear on either board, and no New menu or Set type offers the type any more. The
  release view is where a release is made, listed and read — it now has a control for making
  one, which is what the backlog's own entry was standing in for. Nothing is lost: the notes
  are untouched, work that names a release still names it, and the release view shows every
  one of them. If you had set a folder for Release items in the backlog view's settings, that
  box is gone and the release view's own releases folder is what applies.

- **A card lists work below a row this screen is not showing.** On the iteration board a
  card now lists a child that names the sprint even where the row between them does not —
  a task committed to the sprint under a story that is not, for example. That task already
  had a card of its own on the board; what it did not have was a place under the card it
  belongs to, so the face and the board disagreed. On the roadmap the gap was wider: a
  release hand-hung between a feature and its stories left those stories on no card at all
  under a focus, while their dates went on moving the feature's bar. Nothing joins a board
  or a roadmap it was not already on: each note is still asked for itself, and a row in
  between is passed through rather than promoted.

- **The three notices the writer shows when a note changes mid-move read in your Obsidian's
  language.** Retype a note while a drag is in flight, or edit one while an estimation score
  is being saved, and the message explaining that nothing was written now comes from the
  string catalog like every other notice. Nothing about what is written changes.

- **The estimation view's options menu, the iteration board's columns, the roadmap legend
  and the reasons a card is on the shelf read in your Obsidian's language.** These were the
  last words the view drew from its own code rather than from the string catalog. Nothing a
  note holds changes: the scoring model's dimension names, its rubric sentences, the type
  names, the workflow values and the horizon list are the same in every language, so a vault
  set up in one language still opens correctly in another. English is still the only catalog
  that ships.

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

- **Work can be put in a release, and taken out again, from the item's own menu.** Right-click
  a story — or press the menu key on it — and `Set release` lists every release the base
  holds, with **No release** at the foot to take the item back out. The pick writes one
  property and nothing else: not the parent, not the rank, not the state, and no dates, so
  joining a release commits the item to a version without scheduling it. It is one batch
  through the same gate as every other write, so one undo takes it back, and the release view
  then shows the item under that release's scope. The release the item is already in is
  ticked, and picking it again writes nothing rather than spending your undo. Two releases
  whose notes share a name are listed by their path, so you can tell which one you are
  picking, and the value written is a link to that note rather than its name. `Set release` is
  offered on work only — never on a milestone, an iteration or another release — and it is
  absent entirely, rather than present and inert, until the property that holds a membership
  is named. **There is no drag yet**: the release view is read-only, so there is nowhere to
  drop an item.

  One thing to know when you configure it: **the property that holds a release membership is a
  view option, so the backlog view and the release view each name their own.** Both suggest
  the same name, so a vault that accepts the suggestion in both is already consistent. Bind
  them to different properties and the release view will not see what the backlog view wrote —
  every scope empty, nothing reported as unresolved, and **no warning**, because neither view
  may read the other's configuration and the result is indistinguishable from a vault where
  nothing has been assigned yet. If your scopes are empty after assigning work, check that the
  two options name the same property.

  Also: **✨ does not create the release property on your notes**, unlike most of them, and
  like the prerequisite list. An empty value there would read as an item pointing at a release that cannot be
  found, so the whole backlog would be reported as unresolved on the release screen. The cost
  is that Obsidian's property picker cannot offer the property until at least one note carries
  it — so in the release view's own options, pick the property AFTER the first `Set release`,
  which is what puts it in the vault.

- **A third Bases view, Release** (`product-release`, its own icon in the view picker) —
  every release the base holds as one list, and one release's scope drawn as the tree it
  already is. A row states the release's version, target date, status and how many items
  name it; picking one opens that release and shows its members with the ancestors that
  hold them in place, marked as context and carrying no numbers. Membership is a note's
  own property and one value: it never cascades to a parent or a child, and an item whose
  value names no release in the base is counted and reported rather than dropped in
  silence. Which release is open is remembered per device and per saved view, and follows
  the note through a rename — a base embedded in a note remembers it for the session
  instead, as every base does, and there a rename returns you to the list. Both screens
  keep your place: a refresh of the same screen — an edit somewhere else in the vault, a
  query re-running — leaves you scrolled where you were, while opening a release or going
  back starts at the top of the screen you asked for. **The view is read-only** — it plans no write to any note and
  none to the `.base`. Which properties hold the version, the target date, the status and
  the membership are the view's own options; a column whose property nobody bound is
  absent, and named once beneath the list rather than left blank on every row.
  **The list works without a mouse**: every release in it is a button, so Tab reaches each
  one in turn and Enter or Space opens it, with the row outlined while it has focus. Its
  figures line up down the screen in fixed columns, so a value too long for its column is
  shortened with an ellipsis rather than pushing that row's figures out of line with the
  rows above it. On a release's own screen the rows are text and behave like it — nothing
  to click, nothing to fold, and the titles can be selected and copied.

- **`Release` joins the fixed type vocabulary as a marker**, beside `Milestone` and
  `Iteration`: a root by nature, holding nothing, offered by the backlog's `New` menu and
  by Set type. It is placed by no planning axis — no horizon, no dates — so the roadmap
  draws no card for one, the placement actions are withheld from it, and **Assign missing
  properties** adds it none of those keys.

- **A second Bases view, Estimation** (`product-estimation`, its own icon in the view
  picker) — score each item against a configurable weighted model: eight value
  dimensions plus confidence, effort and complexity, each scored against a rubric
  sentence per point. The consolidated business value writes back to the note with a
  model stamp and its coverage; everything else derives fresh on every read instead —
  the confidence-adjusted value, the value-to-effort indicator, and whether a stored
  total can still be trusted (Current, Needs re-estimation, Another model,
  Hand-written). A guided empty state binds and backfills the properties it needs in one
  gated batch, and the table ranks by whichever column you sort — reading only, never
  the backlog's own order. Rubric sentences ship with the default model and are edited
  in the `.base` file this round, with no options-menu box for one yet.

- The estimation view has a toolbar — the backfill action, an undo for the last batch, and
  how many of the results are scored. The backfill is offered wherever the view cannot
  score yet, the configuration warning included: a dimension added after setup binds no
  property, which is exactly what replaces the toolbar with a warning, and Obsidian's
  picker cannot offer a property no note carries.

- **A business value model stamp left without its total is reported.** Deleting the
  business value property outside the plugin used to leave the stamp behind with nothing
  on screen to say so and no action that would accept it. The row now reports it — *Inputs
  gone* where the scores are gone too, so the cleanup removes the stray stamp, and *Needs
  re-estimation* where the scores remain, so the recalculation writes the total back.

- **A stored business value can be recalculated where it is reported as out of date.** A
  total reading *Needs re-estimation* or *Another model* now offers one action that rewrites
  it and its model stamp from the scores already on the note. The only route out before was
  to change a score to a value you did not mean and change it back. A *Hand-written* total
  is never touched by it — that number is yours — and an orphaned total still gets the
  cleanup that removes it instead.
- **`Resource` is a declared type, and notes carrying it stay out of the backlog.** A
  person is something the plan points at rather than work it contains, so a `Resource`
  note is recognised and then left out of every view this plugin draws — the tree, both
  boards, both roadmap axes, the shelf, the item count and every menu that offers a type.
  It is the same treatment an `Absence` already gets, and it is one gate rather than a rule
  each view has to remember. Resources are for the resource timeline and for a dedicated
  resource view later. Nothing creates one from the backlog view yet, and nothing about
  `assignee` changes — it is still the text you type, and the roadmap's rows still come
  from it.

- **A resource note can be made without leaving the roadmap.** The resources axis's
  toolbar gets its own **New resource** button, beside the axis controls it already owns.
  It opens a name prompt — warned rather than refused when the name already matches
  someone on the roster, since two real people can share a first name — and writes the
  note into its own `resourceFolder` view option, a subfolder of the home folder by
  default. The note carries only its type and title: no `order`, no `parent`, and it
  never enters the backlog, exactly like every other `Resource` note. The roster itself is
  unchanged for now — the axis still draws its rows from declared names, assignees and
  absences, so a note made this way earns a row of its own once the axis starts reading
  resource notes directly.

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

- **The iteration board's shelf carries the same four picks as the roadmap's** — layout,
  sort, type filter and search. They were withheld before now only because their
  keyboard path, the card menu's shelf section, was built for the roadmap alone; it
  serves both surfaces now, so narrowing a sprint's uncommitted backlog no longer means
  switching projections. Five labels that called a backlog "unplaced" — `Search
  unplaced`, `Sort unplaced`, `Filter unplaced by type` among them — now say `shelf`
  instead, since the board's band is a backlog too, not only the roadmap's.

- **The estimation view ranks by a framework you pick.** A new toolbar action offers RICE,
  ICE, WSJF and value over effort; picking one previews what it would change and configures
  the indicator in one act, without touching the value model or any stored total. The
  indicator is a product of named operands over an optional divisor — no expression, and
  nothing parses one — so swapping an operand afterwards is an edit to a text box. It takes
  a column in the table that sorts, with an item whose operands are unanswered sorting with
  the unmeasured rather than at one end, and it draws beside the confidence-adjusted value
  in the panel. Clear the operands box and there is no indicator and no column.

- **Open the note you are scoring, from the panel.** The item's name in the panel header now
  carries an Open note control, and the table's `Enter` goes the same way — both through the
  same controller the backlog view uses, so the estimation view gains an `Open in` setting
  and, on its default, opens the note beside itself rather than over itself.

### Changed

- **Assign missing properties no longer creates a date property on a note that cannot use
  one.** A `Milestone` is a point, so ✨ gives it the target property and no longer the
  start one — which this view has never placed a milestone by. An `Iteration` still gets
  both, whichever way the roadmap is set to draw it: how a thing is drawn must not decide
  what properties its note carries. Every other type is unchanged, and no existing property
  is touched either way.

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

- **The write path's serialization and single undo slot are now plugin-wide** — a write
  in one Bases view briefly holds back the other's write controls, and undo always takes
  back the vault's last batch, whichever view wrote it
  ([ADR 0030](docs/adrs/0030-domain-is-the-kernel.md)).

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

- The estimation view's table and panel are readable: a proportional strip on value and
  coverage, a currency chip that spends colour only where something needs doing, columns
  that line up across every row, and a panel whose total is stated above its inputs and
  stays on screen while they scroll.

- **A sorted column header now says which direction, not just that it is active.** The
  active header draws a chevron pointing the way it sorts and states the direction in its
  own accessible name; `aria-sort` stays as the style hook it always was, but nothing
  depended on it being read aloud any more.

- **A dimension problem names the dimension the way its own settings panel does.** A
  refusal used to read `strategic-alignment: the weight must be a positive number`; it now
  reads `Strategic alignment`, and a dimension group in the options menu is headed by that
  same resolved label rather than by its id.

- **The weight rule is stated at the box that can break it.** Each dimension's `Weight` box
  is now labelled `Weight (% of 100)`, the refusal for a total that is off says the delta
  (`the weights total 87, not 100 (13 short)`), and the lead sentence on the view's own
  problem block names where to go and fix it.

- **Both undo buttons now read `Undo last change`.** There is one undo slot for the whole
  vault ([ADR 0030](docs/adrs/0030-domain-is-the-kernel.md)), so `Undo last backlog change`
  and `Undo last estimation change` each promised a scope the slot does not have — either
  button always took back the vault's last batch, whichever view wrote it. The behaviour is
  unchanged; the labels were the wrong half, and the two are now one label.

- **A refused estimation setup names every configuration problem, not just the first.** A
  model with two faults took one round trip per fault to fix; the refusal now lists all of
  them, joined the way the rest of the plugin joins a list.

- **A compact shelf row draws aligned columns**, reusing the tree's own stored property
  widths instead of sizing each cell to its own content: titles now land at one x
  position where there were four. The row itself grew a little to do it — 28px where it
  measured 22.4px before — because the fix is the tree's own row anatomy, badge and
  property cells included, not a narrower one.

- **A shelved parent's disclosure moves onto its own row**, into a leading fold slot
  beside the badge, instead of drawing as a line of its own beneath the title. A shut
  parent now costs no more height than a leaf — both 28px — and its expanded children
  are indented so a child's badge lines up under the parent's own title.

### Fixed

- **Alt+Up/Down on a milestone's card no longer writes an assignee nothing shows.** The
  resources axis draws every marker in its own Milestones row whatever the note says, so
  the keyboard ladder was changing the note, leaving the card exactly where it was, and
  spending the undo on it. Dragging one already knew this; the keyboard now agrees. Set
  assignee still writes one — a note may record who owns a date.

- **The shelf's own title no longer moves when the band is opened or closed.** Opening the
  shelf adds its search box, and that box was 11px taller than everything else in the
  header — Obsidian styles `input[type='search']` itself and outranked the height this
  plugin asked for — while the band's padding halved when it shut. Together those moved the
  shelf's name 9.5px down the pane at the moment a reader pressed the disclosure beside it.
  The header now reserves one row height in both states and the band keeps one padding, so
  the title stays exactly where it is. A shut shelf is five pixels taller than it was.

- A long currency word pushed every numeric column on its row out of line with the header
  above it.
- The estimation panel's total and item name rendered at the wrong size, and the table
  rendered at the reading size rather than a UI size.
- **The panel's title now wears the same weight as every other Title-level piece of text.**
  It rendered semibold against a Title entry that has always declared 500.
- **The four numeric columns' values now share one baseline.** The value and coverage
  strips used to make their own cells taller than a plain cell, so their numbers sat about
  3px above the numbers in Confidence and Effort — in a table whose whole job is comparing
  numbers across a row.

- **The estimation panel's clear control no longer draws over the last point of its row.**
  The gutter held open for it at the end of the row was narrower than the control itself,
  so it reached back over the last button and pointing at a row took that point out of
  reach.

- **A business value typed in by hand is no longer offered for deletion.** A total with no
  model stamp and no scores behind it reported *Inputs gone*, and the panel offered the
  cleanup that removes it. A total with no stamp now reads *Hand-written* whatever its
  scores say, and only a **stamped** total whose scores are gone can be cleaned up.

- **The guided estimation setup is all-or-nothing.** With another write in flight —
  including one from a different Bases view, since the write lock is vault-wide — it could
  bind every suggested property to the view and then have the backfill refused, leaving a
  configured model over notes carrying none of its keys. It now says a change is being
  saved and changes nothing at all, and the button on the empty state goes quiet while a
  write is running, like the toolbar's own.

- **A sorted column header keeps keyboard focus.** Activating a header rebuilds the table,
  which destroyed the button that was just pressed and dropped focus to the page, so a
  second `Enter` could not flip the direction back.

- **Stepping through the estimation table with the arrow keys no longer parks the selected
  row behind the column labels.** The header is sticky, and a step upwards scrolled the row
  flush to the top of the list — which is underneath it.

- **The estimation table's sort buttons are no longer pruned from the accessibility
  tree.** The list role sat on the box holding both the header and the rows, so the six
  sort buttons were non-option children of a list and dropped, `aria-sort` with them. The
  role now covers the rows alone, and with no results the element is a plain region
  instead, so the empty-table message is not dropped either.

- **The shelf's resize grip no longer strands itself mid-band when everything inside is
  collapsed.** `position: sticky` holds an element inside its scrollport, but it never
  pushes one down — so a band picked taller than its collapsed cards left the grip
  sitting under the last group instead of at the foot you sized: measured with every
  type group folded and a 400px pick, it sat 139px short. A scoped margin now pulls it
  the rest of the way.

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
