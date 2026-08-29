---
type: Issue
parent: "[[Binding the estimation properties]]"
order: 10
status: Done
area: view
priority: P1
created: 2026-08-21
closed: 2026-08-21
source: code review of claude/plugin-refactor-brainstorm-av0s6j, finding B2 — read against the PBI's stated guarantee
files:
  - src/view/estimation/init.ts
  - src/view/estimation/estimationView.ts
  - test/view/estimation/init.test.ts
  - test/view/estimation/toolbar.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The guided setup bound properties it could not stub

## The guarantee that was not kept

[[Binding the estimation properties]] states it as one sentence: "Either every suggested
key is bound *and* stubbed onto the results, or nothing is changed at all. A run that would
leave the model broken changes neither the configuration nor a note."

`runEstimationInit` (`src/view/estimation/init.ts`) wrote every pending binding to the
`.base` with `view.config.set` and *then* called `applySafely`. The write gate has three
refusals, and one of them — the serialization refusal, taken when another batch is in
flight anywhere in the vault — rejects the whole backfill. So the reachable outcome was
the exact half the guarantee forbids: **a dozen-odd properties bound in the saved view and
not one key stubbed onto a note**, leaving a configured model over notes that carry nothing
it names, which is the state the guided empty state exists to get a vault out of.

The module's own ordering comment already stated the rule the code broke, which is
[[A comment that states a rule is not a check]] again.

## Why it was reachable, and by a click

The undo slot and the write lock are **vault-wide** by decision
([ADR 0030](../adrs/0030-domain-is-the-kernel.md)), so "another batch is in flight" does not
mean this view is busy — a sibling Bases view writing at that moment is enough. The
toolbar's own ✨ is disabled while the gate is writing, because `syncEstimationToolbar`
finds it by its `pbl-est-init` class. **The guided empty state's button carried no such
class**, so nothing ever disabled it: the one control a vault with nothing configured is
actually pointed at was the one control the guard could not see.

## The fix, and the check under it

Two parts, because either alone leaves the hole open from the other side.

1. **A `view.gate.writing` check before the `config.set` loop**, refusing with the same
   `Notice` shape the existing `modelProblems` refusal uses — `estimation.init.busy`, said
   rather than silent, because the guided empty state stays on screen and a button that
   returned quietly would simply look dead.
2. **The empty-state button gains `pbl-est-init`**, so the existing sync disables it on the
   same fact as the toolbar's own.

**A synchronous check is sufficient here, and that is a claim about this call site rather
than about lock checks generally.** There is no `await` between the check and
`applySafely`, and the lock is taken synchronously on entry to `runExclusively`, so
run-to-completion means no other view can take the lock in between. That makes it airtight
rather than a narrowed race — and it stops being airtight the moment anything awaits
between the two, which is the thing to re-read before adding a step there.

**Checked by** `test/view/estimation/init.test.ts` — "changes no configuration when the lock is already held"

**Checked by** `test/view/estimation/toolbar.test.ts` — "disables the guided empty state’s own setup button while a sibling batch runs"

## What was deliberately not added

The plan for this fix carried a **third** source edit: a `syncEstimationToolbar(this)` call
at the end of `renderUnconfigured`, so the freshly drawn empty-state button would arrive
already disabled. It was dropped as dead code, and the reasoning is recorded because the
call reads as obviously needed: `WriteGate.followLock` already publishes the lock state to
any drawn `.pbl-est-init`, and every trigger that runs `renderUnconfigured` runs with the
lock released — the one mid-batch render trigger this view has is a sort pick, which is
configured-state only and never reaches the unconfigured branch. So the button cannot be
drawn during a batch in the first place.

**Checked by** `test/view/estimation/toolbar.test.ts` — "draws nothing while a sibling batch runs, and its setup button arrives enabled"

That test holds the reachability claim rather than the disabling claim: if a future trigger
ever renders the unconfigured state mid-batch, it fails, and the dropped call is the fix.

## What this environment could not answer

Two live Bases views sharing one `WriteLock` is the real scenario, and it is not
reproducible in jsdom — the tests hold the lock directly instead. **A two-view live-vault
check is owed and has not been made.**

## Acceptance criteria

- ~~A run refused by the lock leaves the saved view's options exactly as they were.~~ Met.
- ~~The control a vault with nothing configured actually uses is disabled on the same fact
  as the toolbar's.~~ Met.
- ~~The refusal says why, rather than returning quietly under a button still on screen.~~
  Met.
- Open, and outside this tree: the two-view scenario has never been driven in a live
  vault. It is a look, not a code change, so it carries no criterion here beyond being
  said out loud.
