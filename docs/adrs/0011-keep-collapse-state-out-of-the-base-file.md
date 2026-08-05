---
adr: 11
title: Keep collapse state out of the .base file
status: Accepted
date: 2026-07-31
area: storage
---

# ADR 0011 — Keep collapse state out of the `.base` file

## Context

Which rows are open needs to survive closing the view. The obvious home is the `.base`
file, where every other setting for this view already lives — it is the file Bases hands
us and the one place we can write configuration.

Two things argue against it. Collapse state is **one path per collapsed row**, growing with
the backlog; and a `.base` file is **shared** — committed, synced, sent to a colleague —
while which rows someone has open is their working position for the afternoon.

## Decision

Persist collapse state to **vault-scoped `localStorage`**, keyed per base **and** per view.
Never to the `.base` file.

Identity comes from walking the workspace's leaves for the `FileView` whose element
contains this view's — the Bases API hands a view no reference to its own file, but the
leaf drawing it has one.

## Consequences

- The `.base` file stays small and stays shareable. Two people can work the same backlog
  without fighting over each other's expanded rows.
- **When identity cannot be resolved, the state is session-only.** A shared fallback key
  would be worse than not persisting: two bases would inherit each other's rows and
  overwrite each other's state. An embedded base — drawn inside its host note's leaf, so
  the file on offer is the note — takes this path, recorded as
  [[Embedded bases do not persist collapse state]].
- The whole feature rests on an **observation about Obsidian's internals**, not a
  documented API: that a `.base` leaf presents as a `FileView` with `.file` set. Verified
  once in a live vault (Obsidian 1.10.x, 2026-08-01) — rows came back open across a tab
  close, which they can only do if the walk found the leaf. The failure is silent by
  design, so nothing else would report it if a future Obsidian changed this; it is the
  first thing to re-check if persistence goes quiet.
- Both halves of the key are things a user can rename at any moment, so **each needs its
  own migration**: a note rename, a view rename and a base rename all move the stored
  entry. And a rename is never only the thing renamed — moving a *folder* reports the
  folder, so migrations carry everything beneath the old path. Without these, ordinary
  tidying orphans an entry and the next save prunes it for naming a file that is gone.
- The key only has to be **unique, never parsed**: each entry carries its own base path,
  because a view name may contain anything a user can type. Splitting a key on a separator
  misread the path once and deleted a live entry.
- Growth is bounded by pruning paths the **vault** no longer has — never paths the *model*
  lacks, since a query that has not warmed up would read as "these notes are gone".
- Local storage is user-writable data another version of this plugin may have written, so
  it is read defensively at every level.
- The cost: it does not sync. Open a vault on another machine and the tree starts
  collapsed. That is the right trade for state this personal, but it is a real one.
- The entry has since taken every other piece of working position — the projection, the
  roadmap axis and zoom, the shelf's own controls, and the **focus level**, which moved
  out of the `.base` under exactly this decision. Focus is the one that also feeds the
  MODEL rather than only the render, so the view restores before it builds; a `.base`
  written before the move keeps a `focusLevel` key that nothing reads.

## Alternatives

- **The `.base` file.** Shareable and syncing — and it grows a line per collapsed row in a
  file meant to hold a query, and publishes one person's working position to everyone.
- **The plugin's own `data.json`.** Syncs, and is global to the plugin rather than scoped
  to a vault, so it needs the same identity machinery plus a merge story on sync conflict —
  for state whose worst-case loss is re-expanding some rows.
- **Don't persist at all.** What it did before, and a large backlog starts unreadable every
  time.

## Revisit when

Bases exposes a per-view scratch space, or hands a view its own file — either would remove
the identity walk this rests on.
