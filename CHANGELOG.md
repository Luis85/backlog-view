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

### Changed

- The **Move to top level** strip no longer appears over the bottom of the tree while you
  drag. The drop it offered is still there — drop on the empty space below the last row —
  and Alt+Left, plus the row menu's **Outdent**, reach the top level without a drag at all.
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

### Added

- An **assignee** property: name it in the view options (or press ✨ and let the view bind
  and backfill `assignee`), then set it from the row's menu or its chip. The names on
  offer are the ones the base's own results already carry — plus anything typed into
  **New assignee...** — so there is no list to declare and nothing to keep in step.

## [0.6.0] - 2026-08-10

Changelog tracking starts here. For what shipped in 0.1.0–0.5.2, see the
[GitHub releases](https://github.com/Luis85/backlog-view/releases), generated from the
pull requests merged for each.
