---
adr: 1
title: Build on the Bases custom view API
status: Accepted
date: 2026-07-30
area: platform
---

# ADR 0001 — Build on the Bases custom view API

## Context

Obsidian has no backlog. Bases gave it queryable tables over note properties, but a
backlog is a **tree with a rank**, and neither survives a flat table: nesting is not a
column, and "third from the top of this parent" is not a sort.

Obsidian 1.10.2 opened `registerBasesView`, letting a plugin supply its own renderer for
a Base's results while Bases keeps ownership of the query, the filters, the sort, the
visible properties and the view's persisted options.

## Decision

Register a **custom Bases view** (`product-backlog`) rather than a view of our own.

The Base owns which notes are in scope and what their properties are. The plugin owns the
tree, the ranking, and the writes. The `.base` file is where the user's configuration
lives, including this view's own options.

## Consequences

- Everything a user already knows about Bases — filters, sorts, properties — works
  unchanged, and every backlog is a `.base` file they can edit, copy and share.
- `minAppVersion` is **1.10.2**. That is a floor, not a range (see
  [ADR 0016](0016-break-compatibility-freely-before-1-0.md)); nothing here carries a shim
  for an older Obsidian.
- A filtered Base returns matches **without their parents**, which would flatten the tree.
  That problem is created by this decision and answered by
  [ADR 0010](0010-load-excluded-ancestors-as-context-rows.md).
- The view is handed its `app` *after* construction, so nothing in the constructor may
  read it. This has bitten twice.
- Bases owns grouping, and grouping means nothing in a tree — the toolbar says so rather
  than pretending the setting works.
- Obsidian's own typings trail the app (`setSubmenu` is absent entirely), so a few call
  sites cast. That is a typings gap, not a version guard.

## Alternatives

- **A standalone `ItemView`.** Full control, and we would then have had to build query,
  filter, sort and property configuration ourselves — reimplementing Bases badly, and
  leaving every backlog locked inside one plugin's storage.
- **A markdown code-block processor.** Renders anywhere a note does, but the tree would be
  configured in a fenced block nothing else understands, with no property UI and no
  reuse of the user's existing queries.
- **Canvas.** Spatial, not ranked. A backlog's whole point is a total order.

## Revisit when

Bases gains first-class hierarchy or ranking of its own — at which point much of this
plugin becomes a wrapper around it, and the question is what is left.
