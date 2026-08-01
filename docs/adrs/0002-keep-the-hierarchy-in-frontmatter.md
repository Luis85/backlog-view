---
adr: 2
title: Keep the hierarchy in frontmatter
status: Accepted
date: 2026-07-30
area: domain
---

# ADR 0002 — Keep the hierarchy in frontmatter

## Context

The tree has to live somewhere. Three places were available: the folder structure, a
plugin-owned index, or the notes themselves.

Whatever holds it becomes the thing that must not be lost, must survive a sync conflict,
and must stay meaningful when the plugin is not installed.

## Decision

Three ordinary frontmatter properties carry the whole model: **`parent`** (a wikilink),
**`order`** (a number), **`type`** (the level name). Nothing about the tree is stored
anywhere else.

The property *keys* are configurable, so this can be laid over a vault that already uses
different names.

## Consequences

- The backlog is made of notes, and stays searchable, linkable, editable and gradeable by
  every other tool in Obsidian. Uninstall the plugin and nothing is lost — a `parent`
  wikilink is still a link, still shows in the graph, still resolves.
- A parent link is a **real link**, so Obsidian's own rename handling keeps it correct for
  free, and aliases and bare names resolve the way they do everywhere else.
- **Files are never moved on disk.** Re-parenting writes a link. A view that rearranged a
  vault's folders as a side effect of a drag would be a different and much scarier tool.
- Every structural change is therefore a *write to notes*, which is what makes the write
  boundary ([ADR 0004](0004-one-write-boundary-planning-separate-from-applying.md)) and
  undo ([ADR 0015](0015-undo-by-captured-inverses.md)) load-bearing rather than nice.
- Merge conflicts are per note and legible: two people reordering the same group produce a
  conflict in a number, not a corrupted index.
- The cost is write volume. One move can touch a whole sibling group, which is why ranks
  are fractional ([ADR 0008](0008-rank-siblings-with-fractional-orders.md)).

## Alternatives

- **Folders as the hierarchy.** Zero new data, and it is how many vaults already work —
  but re-parenting means moving files, an item can only be in one place, and levels cannot
  be expressed at all. Supported as an *input* instead: folder-note inference reads such a
  vault, and still writes links rather than moving anything.
- **A plugin-owned index** (`data.json`, a SQLite file). Cheap writes and easy
  transactions — and the tree becomes invisible to the vault, breaks on every rename the
  plugin did not observe, conflicts unmergeably on sync, and vanishes with the plugin.
- **Inline dataview-style fields.** Same properties, worse tooling: no property editor, no
  Bases integration, and parsing that no other tool agrees on.

## Revisit when

Obsidian gains a first-class relational property type that other plugins read — the
argument for frontmatter is portability, and a better-supported portable format would
win it.
