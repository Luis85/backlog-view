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
  - src/domain/releases.ts
  - src/domain/board.ts
  - src/domain/releaseOptions.ts
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
returns comes from whatever keys the `.base` happens to carry.**

Of the options this view declares, **exactly four are one of those**: the state property and
its done values, declared on 2026-08-25 with the two-line band because the index's progress
figure reads them and reading a setting the screen cannot show was the sharpest instance
below — and the Deliverable workflow's own state property and done values, declared
2026-08-28 for the identical reason (`ownWorkflowReading`'s progress gate again, this time
for a release holding only Deliverables). That narrows this issue by four settings and closes
nothing — every other field `resolveSettings` returns is still inherited unseen, and this
note is about the rule for those rather than about the four. It opened saying the view
declared none of them, which was true until the first band landed.

Two of the inherited settings change the model this view draws, and both were traced:

- `inferFolderHierarchy` becomes `settings.folderHierarchy`, which `linkAll`
  (`src/domain/model.ts`) reads to attach a note with no explicit parent to its nearest
  ancestor folder note. With it on, one release's scope nests by FOLDER rather than by the
  parent mapping this view declares — and offers no option to turn it off.
- `hierarchyOnly` gates `pruneOutsideHierarchy` (`src/domain/model.ts`), which decides which
  notes survive into `byPath` — and `byPath` minus the context rows is exactly the population
  `releaseIndex` scans for membership. It changes which items can be found to be members.

## The sharpest instance: a member's progress read off the wrong workflow

The release index draws a progress bar, and the walk behind it asks `ownWorkflowReading`
(`src/domain/board.ts`) whether a member is done rather than reading `item.done`. That is the
right call and was a correction to the plan that built it: a `Deliverable` and a `Test case`
each answer "done" against their OWN workflow, and reaching for the requirements reading is
named in `src/domain/CLAUDE.md` as the recurring form of that mistake.

**But those two workflows were four more inherited settings — now two remain.**
`item.deliverableDone` and `item.testDone` are computed from `deliverableStateProperty` /
`deliverableDoneValues` and the two test equivalents. The Deliverable pair joined this view's
own options menu beside the shared state band (2026-08-28), the identical narrowing the
shared pair already got: a release holding only Deliverables can now have its progress
configured from this screen rather than only through a hand-edited `.base` or one that
started life as a backlog view. `testStateProperty` / `testDoneValues` did not, so in a vault
whose BACKLOG view runs a distinct Test workflow, a release's Test-catalog members' progress
is still counted against the shared state property instead of their own — `8 of 14 done`
decided by a rule the reader configured on another screen. That is the one workflow this
narrowing left unclosed.

**Bounded rather than harmless.** `resolveSettings` (`src/domain/settingsResolve.ts`) falls
back to the shared state property whenever a secondary key is unset, and that fallback is
deliberate, so a vault that never configured a separate workflow gets the right answer by
construction. Only the vault that did configure one is wrong, and it is wrong silently.

**Declaring the remaining options is not the fix**, which is why this is recorded here rather
than patched. Each increment that added a figure declared exactly the options that figure
reads and said in its own design that it narrows this issue and does not close it — first the
shared pair, then the Deliverable pair. Two more (the test workflow's) would move the line
again without settling the rule, and the rule is what this note is for — see **What would
close it** below.

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
