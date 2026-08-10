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

- `Test case` now wears its own colour, cyan, instead of sharing `Test suite`'s orange —
  the outlined border that marks both as tests is unchanged, only which hue each fills.

## [0.6.0] - 2026-08-10

Changelog tracking starts here. For what shipped in 0.1.0–0.5.2, see the
[GitHub releases](https://github.com/Luis85/backlog-view/releases), generated from the
pull requests merged for each.
