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

**But those two workflows were four more inherited settings — and now this instance is
closed, for two different reasons.** `item.deliverableDone` and `item.testDone` are computed
from `deliverableStateProperty` / `deliverableDoneValues` and the two test equivalents. The
Deliverable pair joined this view's own options menu beside the shared state band
(2026-08-28), the identical narrowing the shared pair already got: a release holding only
Deliverables can now have its progress configured from this screen rather than only through a
hand-edited `.base` or one that started life as a backlog view.

`testStateProperty` / `testDoneValues` did NOT join the menu, and this note originally read
that as the one workflow this narrowing left unclosed — wrong, verified against the code
rather than assumed: **a release can never hold a Test-catalog member at all.**
`membershipTarget` (`src/domain/releases.ts`) resolves a note's own membership property
through `if (!inPlan(item) || isMarkerType(item.typeName)) return UNRESOLVED;`, and `inPlan`
(`src/domain/model.ts`) is `!inCatalog(item) && !isIterationType(...)` with `inCatalog`
(`src/domain/itemTypes.ts`) true exactly when `item.ladder === TEST_LEVELS` — the test
catalog. A `Test suite`, a `Test case`, or a `Task` chained onto the test ladder therefore
never resolves to a release at all; the writing end states the identical refusal
(`mayHoldField`'s `field === 'release'` branch, `itemTypes.ts`: "a test-catalog note is not
the plan's, so [it] may not hold a membership"). `workflowConfigured` / `missingWorkflows`
(`src/domain/releases.ts`) say so directly in their own comment: `'test' never appears in
kinds`, "so only two branches of `workflowConfigured` are reachable; a third would be
untestable dead code." The population a `testStateProperty` option would read from a release
is empty by construction, not merely unconfigured — declaring it would add a control nothing
on this screen would ever consult. For THIS instance, both workflows a release's members can
actually belong to are now on the release view's own options menu.

**Bounded rather than harmless, while the Deliverable gap lasted.** Before 2026-08-28,
`resolveSettings` (`src/domain/settingsResolve.ts`) fell back to the shared state property
whenever `deliverableStateProperty` was unset — deliberate — so a vault that never configured
a separate Deliverable workflow got the right answer by construction; only a vault that did
was silently wrong. `testStateProperty` never had an equivalent gap to be bounded, for the
reason above.

**This instance is closed; the wider issue is not.** Each increment that added a figure
declared exactly the options that figure reads and said in its own design that it narrows
this issue without closing it — first the shared pair, then the Deliverable pair. That held:
closing the workflow-progress gap for both real workflows still leaves
`inferFolderHierarchy`, `hierarchyOnly`, and every other field `resolveSettings` returns
beyond the four named above, unseen and unchangeable from this view — see **What would close
it** below for the shape of what remains. A fifth pair of options for the test workflow is not
part of it.

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
