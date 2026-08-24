---
type: Test suite
order: 36
status: Open
created: 2026-08-23
source: the release-management increment, whose every visual claim is jsdom-only
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the release view

`product-release`, the plugin's third registered Bases view and the first that writes
nothing: the index of every release, one release's scope as a tree, and the four empty
states between them — plus, from [[Setting an item's release]], the one thing that puts
work into a scope at all, which is a menu on the BACKLOG view rather than anything on this
one.

**This suite exists because the increment shipped with nothing having looked at it.** Every
visual and assistive-technology claim on it rests on jsdom, which computes no layout and no
styles, plus two ad-hoc headless-Chromium runs against markup reproduced by hand. That gap
is not theoretical: it is exactly how `display: contents` on a release row — which makes the
row unfocusable, so Tab skips it and `.focus()` does nothing — survived eight tests, two
reviews and a fix round before a browser was finally asked. `npm run test-build` bundles into
`.obsidian/plugins/<id>/` in the repository root, and `docs/Product Backlog.base` is a real
base in this plugin's own schema, so the plugin can display its own register.

## What to look at

Registration and chrome, none of which any test here can reach:

- The view appears in the Bases view picker, under its own name, with the `lucide-package`
  icon resolving rather than falling back.
- Its seven options appear in the view-options menu, each with the suggested property name.
- `resolveViewIdentity` finds the leaf for a `.base` file: pick a release, switch away,
  switch back, and the same release is open. The persistence rests on it and fails silently.

The index:

- The five columns line up between the heading row and every row beneath it — the widths are
  published as custom properties per column, and only a browser lays them out.
- A long version or status ellipsises rather than overflowing. Fixed-width columns replaced
  content-sized tracks on 2026-08-23, and that trade has never been seen.
- Tab reaches every row, in order; Enter and Space open a release; Space does not scroll the
  list. The focus ring is visible and lands on the row rather than a cell.
- A row's spoken name pairs each figure with its column heading. **Nothing here has heard a
  screen reader** — the name is composed correctly by assertion only.

One release's scope:

- Context ancestors read as scaffolding: dimmed, with the corner marker, and its tooltip
  saying the row is in the base but not in this release.
- The tree is announced as a tree — levels and sibling positions — rather than a flat list.
- The back control is reachable and returns to the index.
- Title text can be selected and copied; the read-only rows must not show a pointer cursor
  or a hover highlight.

Putting work in a release, from the backlog view — the second increment, and the only way
a scope on this view is ever non-empty:

- **The picker's length.** `Set release` lists every release the base holds, with no cap and
  no search. Against a vault with many releases it may be a submenu nobody can use, which is
  a question about a real vault's release count and not about the code.
- **Whether the path-qualified entries read well.** Two releases sharing a basename are named
  apart by their whole path minus the extension — `Releases/2.4`, `Archive/2.4` — which is
  legible in a fixture with two-segment paths and unknown in a vault with deep ones.
- **The row menu's total length.** `Set release` joins Set type, Set state, Set risk, Set
  priority, Set assignee, Set iteration, Set horizon, the schedule entry, Edit tags and the
  dependency entries — one editable section, each entry present only where its property is
  configured, so a fully configured vault is where this is worst. Whether that menu still
  reads as a menu, or wants grouping, is a screen-height question no test here can ask.
- **That a link to a same-basename release resolves to the note that was picked.** The write
  hands Obsidian a qualified linkpath (`wikilinkTo`), and the check under that claim runs
  against `FakeVault`'s own `fileToLinktext` and `getFirstLinkpathDest` — a stand-in written
  here, not Obsidian's resolver. Put `Releases/2.4.md` and `Archive/2.4.md` in one vault, pick
  each in turn, and open the link the note ends up carrying.
- **That the property bound in this view and the one bound in the backlog view agree.** They
  are two separate options with one suggested default, no code may compare them, and a
  mismatch looks exactly like a vault nobody has assigned yet: every scope empty, nothing
  unresolved, no warning. Bind them apart on purpose once and see what the two screens say,
  because that is the whole of the signal a user gets.

Under a theme that is not the default:

- The row `<button>` reset holds against a theme that styles `button` harder than the
  stand-in baseline used in the harness.
- The status chip draws grey rather than adopting a state colour.

## Outcome

Not yet run. The pull request's test-plan box for this is deliberately unticked, and stays
unticked until a maintainer has opened a vault and worked through the list above.
