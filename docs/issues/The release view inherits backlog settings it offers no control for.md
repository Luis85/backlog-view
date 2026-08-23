---
type: Issue
order: 520
parent: "[[The scope of a release as a tree]]"
status: Open
priority: P2
area: design
created: 2026-08-23
source: Codex review of the release-management increment PR, verified at source 2026-08-23
files:
  - src/view/release/releaseView.ts
  - src/domain/settingsResolve.ts
  - src/domain/model.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The release view inherits backlog settings it offers no control for

`ReleaseView.draw` builds its model as `{ ...resolveSettings(this.config), typeKey, parentKey,
orderKey }` — the three mappings are this view's own, and **everything else `resolveSettings`
returns comes from whatever keys the `.base` happens to carry.** This view declares seven
options and none of them is one of those.

Two of the inherited settings change the model this view draws, and both were traced:

- `inferFolderHierarchy` becomes `settings.folderHierarchy`, which `linkAll`
  (`src/domain/model.ts`) reads to attach a note with no explicit parent to its nearest
  ancestor folder note. With it on, one release's scope nests by FOLDER rather than by the
  parent mapping this view declares — and offers no option to turn it off.
- `hierarchyOnly` gates `pruneOutsideHierarchy` (`src/domain/model.ts`), which decides which
  notes survive into `byPath` — and `byPath` minus the context rows is exactly the population
  `releaseIndex` scans for membership. It changes which items can be found to be members.

## How a release view comes to carry them

A view's options live in its own block in the `.base` YAML, keyed by option name. A view
SWITCHED to `product-release` from the backlog view keeps the block it had, and a hand-edited
`.base` can carry any key at all. Nothing prunes keys a view type does not declare, and
`resolveSettings` reads by name rather than against a declared set.

**Not verified in Obsidian.** Whether switching a view's type in the UI actually retains the
old option block is a live-vault question — see [[Smoke test the release view]]. The
hand-edited case needs no such confirmation.

## Why it is recorded rather than fixed

The fix is not mechanical. `resolveSettings` returns around thirty resolved fields and the
model build genuinely needs many of them; replacing the spread with `defaultSettings()` plus
the three mappings would ALSO discard whatever the view should legitimately inherit, and
deciding that field by field is a design pass rather than an edit. It arrived on a branch of
108 files whose remaining risk is a live-vault check nobody has run, and adding a new model
boundary there would move the thing that most needs to stop moving.

The comment at the call site already states the narrower rule it does keep — that the three
MAPPINGS are this view's own and not the backlog resolver's — so what is missing is a rule
about everything else, not a correction to what is written.

## What would close it

A stated answer to which of `BacklogSettings` a view that declares its own options inherits,
and which it must not — then the same answer applied to the estimation view, which resolves
its own settings the same way and has the same exposure. That makes it a question for
[[A view per capability]] as much as for this PBI, and it should be settled once for both
rather than patched here.
