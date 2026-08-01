---
type: PBI
parent: "[[codebase-health]]"
order: 20
status: Open
priority: P1
area: verification
created: 2026-07-31
source: PR #14, collapse-state persistence
files:
  - src/storage/collapseStore.ts
---

# Verify base identity resolves in a live vault

## The assumption

Collapse-state persistence keys on the `.base` file the view belongs to. The Bases API
hands a view **no reference to its own file**, so `collapseStoreIdentity` finds it by
walking `app.workspace.iterateAllLeaves()` for the `FileView` whose `containerEl`
contains the view's element, and requiring `view.file.extension === 'base'`.

Every part of that uses public API and is tested against a mock. But **whether a `.base`
file's leaf actually presents as a `FileView` with `.file` set is not verifiable in this
repo** — Obsidian cannot run in the jsdom harness.

## Why it matters

The failure mode is safe but silent. If the assumption does not hold,
`collapseStoreIdentity` returns `null`, the view falls back to session-only collapse
state — exactly the behaviour before persistence existed, nothing breaks — and **the
feature simply never works**, with no error and no log line.

That is the worst shape for a bug to have: shipped, believed working, quietly inert.

## How to check

`npm run test-build` gets you a vault with the plugin installed: it builds into
`.obsidian/plugins/product-backlog-view/` here, so this repository root can be opened as
one. Point a Base at `docs/issues/` (see [codebase-health](codebase-health.md)) and:

1. Open a backlog Base in a real vault.
2. Expand several rows.
3. Close the tab and reopen the Base (or restart Obsidian).
4. The rows should come back **open**. If everything is collapsed, the assumption failed.

To confirm directly, inspect the vault's local storage for the key
`product-backlog:collapse` — it should hold one entry per base view, keyed
`<percent-encoded base path>#<percent-encoded view name>`.

## If it fails

The seam is `collapseStoreIdentity` in `src/storage/collapseStore.ts`; nothing else
needs to change. Options in order of preference:

1. Find the correct public handle on the leaf's view and use it.
2. Feature-detect a documented Bases API for the view's own file, if one exists by then.
3. Log once when identity cannot be resolved, so the silence at least becomes visible.

Do **not** fall back to a shared storage key — see
[embedded-bases-do-not-persist-collapse-state](embedded-bases-do-not-persist-collapse-state.md)
for why two bases sharing one key is worse than not persisting.

## Acceptance criteria

- Confirmed in a real vault that rows reopen as left, or the failure diagnosed and fixed.
- Whatever is learned about the leaf's real shape is written into `CLAUDE.md`, since it
  is the fact the whole feature rests on.
