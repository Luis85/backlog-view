---
type: Test case
order: 90
parent: "[[Smoke test the tree]]"
status: Open
priority: P1
area: verification
cadence: release
created: 2026-08-15
source: built in [[The render is the whole cost of a data update]]; the harness's fake entry has no renderTo, so the one thing this check is about cannot happen here
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Kept rows against a real Bases render

A verification to run.

## Why this exists

A data update now keeps the rows it decides would draw the same
([ADR 0029](../../adrs/0029-reconcile-rows-by-signature.md)), and the decision is made from
a note's frontmatter and a per-column probe in `src/view/rowSignature.ts`. **The one thing
that can go wrong is a cell that draws from something other than the row's own
frontmatter**, and this repository cannot see it: the browser harness's fake `entry` has no
`renderTo`, so every property cell falls to a plain `setText` and no cell in any test has
ever drawn a link, an embed or a formatted date. The suite drives the refusals through
doubles; only a vault runs Obsidian's own value renderer behind them.

Three rules are on trial, and each fails silently rather than loudly — a stale cell on
screen, not an error:

- a row whose cell drew ANOTHER note's content is never kept (a rename leaves this note's
  frontmatter untouched and its cell wrong);
- a column that is not `note.`-backed switches reuse off for the whole pass (a body edit
  moves `file.mtime` with the frontmatter untouched);
- a property's TYPE belongs to Obsidian, not to the note, so changing it redraws the
  column with every note byte-identical.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, the
repository is open as a vault with `docs/Product Backlog.base` showing the tree, and the
tree is EXPANDED (`Expand all`). A collapsed tree keeps almost nothing and would pass this
list without exercising it.

## How to check

- **First, the win itself.** With the tree expanded, drag a row to a new position and watch
  the pause after the write. It should feel immediate. Then confirm nothing is stale: every
  visible row still shows the right title, badge, chips and rollup after the move.
- **A link cell must not go stale.** Add a property to a note that holds a wikilink to
  another note, and put that property in the base's visible columns so it renders as a
  link. Then rename the LINKED note (Obsidian rewrites the link for you). The cell must
  redraw with the new title. Watch it in a base where nothing else changed — this is the
  case where the row's own frontmatter is untouched and only another note moved.
- **An embed cell must not go stale.** Same again with an embed (`![[Note]]`) in a rendered
  column: edit the embedded note's body and confirm the cell follows.
- **A date cell must not go stale.** Put a real date property in a column, confirm it draws
  as Obsidian formats dates, then change the note's date and confirm the cell follows on the
  next update rather than on a reopen.
- **A `file.mtime` column switches reuse off.** Add `file.mtime` to the base's properties.
  Edit the BODY of a note in the tree — nothing in its frontmatter — and confirm its
  modified time updates on screen. With that column showing, no row anywhere may be kept,
  so this is also a check that the whole feature can be turned off by a column.
- **A property's TYPE change redraws its column.** With an ordinary property showing (say a
  text one holding something date-shaped), change its type in Obsidian's property registry
  (Settings → Properties, or the property's own type menu). Every cell in that column must
  redraw in the new rendering without touching a single note.
- **A slow vault, right after opening.** On a large vault, open the view and interact
  immediately, while Obsidian is still indexing. Rows whose files the metadata cache has not
  answered for are refused reuse by design; what to look for is that they still render
  correctly and settle, rather than drawing empty and staying that way.

## Acceptance criteria

- A rename behind a rendered link column, an edit behind an embed, and a changed date each
  confirmed to redraw the cell on a tree that was NOT rebuilt for any other reason.
- A `file.mtime` column confirmed to follow a body-only edit.
- A property type changed in the registry confirmed to redraw its whole column with no note
  edited.
- The pause after a write confirmed gone on an expanded tree of several hundred notes, with
  nothing stale left behind — the symptom
  [[The render is the whole cost of a data update]] was filed for.
- Any one of these failing is reported as a stale CELL and names which column it was in:
  that is the difference between a missing term in the per-row signature and a missing
  refusal, and the two are fixed in different places.

## Outcome

Not run yet. Written with the change, before any release, so the first sweep after it has
the list rather than reconstructing it.
