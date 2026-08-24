# Releases own their creation — design

**Date:** 2026-08-24
**Status:** Approved

## The problem

A `Release` is created from the backlog tree, which is where releases do not belong. The
register already says so, in `byProjectionType` (`src/view/projection.ts`):

> It narrows THIS projection and no other. A `Release` stays offered in the tree and on both
> boards, which is the decision `Releases as their own type` task 1 step 7 took deliberately:
> **a release has no dedicated door the way an iteration has the scope picker, so withholding
> it everywhere would leave the type creatable only by hand.**

The recorded reason a `Release` appears in the tree *is* the absence of a door in the release
view. This increment builds the door, which retires the reason, which lets the tree drop the
type — one change with two halves rather than two changes.

The precedent is a few lines below in the same function, for iterations: *"No creation surface
offers `Iteration`. One control makes them — the board's scope picker."* Releases follow.

## What ships

1. A **New release** gesture in the release view, with a dialog collecting the release's own
   fields.
2. A **releases folder** option on the release view, and the backlog view's `Release`
   type-folder row removed.
3. The release view's own **✨**, binding its options and backfilling their keys.
4. `Release` **leaves the backlog tree** — not drawn as a row, not offered as a type.
5. The read-only invariant **narrowed**, not deleted.

## 1. The gesture

**One function, two entry points** — the "one move, N inputs" rule. A `New release` control in
the release view's toolbar, and the same action from the index's empty state.

It opens a dialog (the `src/ui/` dialogs are the precedent) collecting **title, version, target
date and status**. On confirm it creates one note carrying the type key plus whichever of the
three the view has an option bound for. **An unconfigured key is never written to** — with an
option unbound, that field does not appear in the dialog at all rather than appearing and being
discarded.

### The creator

A `Release` is a marker: no rung, no children, hangs from nothing. `createBacklogItem`'s
`NewItemSpec` requires a parent, a rank and a type from the ladder, and a release has none of
the three — which is `createResourceNote`'s own stated reason for standing apart
(`src/storage/createNote.ts`). This increment likely needs its own creator beside it, in the
same module, under the same write-boundary rule. The implementation decides; a wrapper that
passes a fake parent and a fake rank to reuse `createBacklogItem` is the outcome to avoid.

### The rule it does not breach

`createBacklogItem` carries a standing rule that **"a `Release` is seeded NOTHING a surface
adds"** — not the sprint it was created on, not that sprint's dates, not the bucket header's
horizon. That rule is about a surface seeding a release with the surface's own context, and it
stays. This dialog seeds a release's *own* fields, which is a different claim. The distinction
gets a sentence at the creator, because the two read alike and the next reader will ask.

## 2. The folder

The release view gains an option of `type: 'folder'` — the mechanism `newItemsGroup`
(`src/domain/viewOptions.ts`) already uses for the home folder, the per-type folders and the
resource folder — defaulting to a literal matching the shipped layout.

**The backlog view drops its `Release` row** from `newItemsGroup`. `ALL_TYPES` is
`[...LEVELS, ...EXTRA_TYPES, ...MARKER_TYPES, ...]` and `MARKER_TYPES` includes `Release`, so
that row exists today. After this increment nothing in the backlog view creates a release, so
the row has no consumer: it would be a setting that looks live and is not.

Leaving both would give a vault two folder settings for one kind of note, in two views that
**cannot read each other's configuration** — the same wall behind
[[The release view inherits backlog settings it offers no control for]] and
[[Two release options aimed at one property go unreported]]. One setting in the view that owns
the gesture means the collision never exists rather than being reported.

**Cost, stated rather than hidden:** a vault that set the backlog's `Release` folder silently
stops using it. The changelog says so.

## 3. Configuration, and the ✨

**One function does bind-and-backfill**, modelled on `runEstimationInit`
(`src/view/estimation/init.ts`) — each view owns its registration and its own init. It binds
every unbound option to its suggested key, then backfills those keys onto existing release
notes, because Obsidian's property picker cannot offer a property no note in the vault carries.
The two halves are one action because neither works alone, which is `runInit`'s own rule.

**Two entry points, one function:** the ✨ control, and the dialog when it finds options
unbound. Sharing the function is what stops the two drifting into a subset and a superset.

The dialog **states** that it is binding the view's options, rather than modifying the `.base`
silently as a side effect of a gesture whose name only promises a note.

### What it must not backfill

**The membership key is never stubbed onto work items.** `membershipTarget`
(`src/domain/releases.ts`) reads a present-but-blank value as an **unresolved** membership
rather than as "names none", so a stub would report every work item in the vault as broken on
the release index. `neverStubbed` (`src/domain/writePlan.ts`) refuses it and continues to.
This view's ✨ backfills a **release note's own** fields — version, target date, status.

## 4. The tree

`Release` leaves the backlog tree two ways, because being offered and being drawn are different
questions:

- **Not drawn.** The tree drops `Release` from its rows, the way `roadmapRows` already drops one
  before `buildRoadmap` branches. A release in the base's results is no longer a tree row.
- **Not offered.** `byProjectionType` drops `Release` for the tree as it already does for the
  roadmap, so `New <child>`, `Set type` and the focus picker stop offering it.

The release view becomes the only door onto a release.

`byProjectionType`'s comment today explains that a `Release` *stays* offered because it has no
dedicated door. That paragraph gets rewritten to say the door now exists — the retired
justification is the part worth recording, and it belongs in the register rather than only in a
diff.

## 5. The write boundary

`test/view/releaseWritesNothing.test.ts` asserts a category claim in three layers: five spies on
every writer in `storage/`, the vault boundary beneath them for a write that reached a note
without going through any of them, and `config.setCalls` for the `.base` itself. A
`WRITE_BOUNDARY` lint rule in `eslint.config.mjs` bans `processFrontMatter`, `vault.create` and
`load/saveLocalStorage` across `src/view/` with no exemption for this directory.

The claim **narrows** rather than being deleted:

> **This view creates notes and its own config. It never edits a note that already exists.**

- `applyWrites`, `applyRestores` and `applyPropertyWrites` stay banned — those are the edit
  paths, and refusing them is the property that actually matters for a view whose job is to show
  a scope the reader did not type.
- The note creators and `config.set` become permitted.
- The lint rule gains a scoped exemption for `src/view/release/`.
- The test file is renamed to match what it now asserts. A file called `releaseWritesNothing`
  asserting something else is the shape this repo's own rules warn about.

`registerReleaseView` currently takes no `WriteLock`, and says why: *"this view plans no batch,
so there is nothing for a lock to serialize... Threading one in 'for symmetry' would state a
relationship that does not exist."* That stays true — creation is not a batch and plans no
undo — so **no lock is threaded in**. That comment gets a sentence about creation, so the next
reader does not read "writes nothing" into it.

**Accepted cost: creation is not undoable.** `createBacklogItem` does not go through
`applyWrites` and captures no inverse, so no `New` in this plugin is undoable. Consistent rather
than new; a mis-made release is deleted by hand.

## Out of scope

- **Editing a release in place** from the release view. The narrowed invariant forbids it, and
  the version/date/status fields are editable in Obsidian's own property editor.
- **The index's visual design.** Recorded separately; the release rows reading as buttons is a
  real finding and wants its own pass against `npm run harness`.
- **The live-decision family** — [[A pick compared against the model reads as a no-op]],
  [[A stale release or iteration target can still be committed]] and
  [[A carrier reparented into the catalog keeps its release]]. One shape, one increment, not
  this one.
- **Deleting or archiving a release.** No gesture is added for either.

## Testing

- The gesture: the dialog's fields track which options are bound; confirming creates exactly one
  note with the expected keys and no others.
- **The unbound case:** an unbound option's field is absent, and no write names its key.
- **The ✨ path:** one function, reached from both entry points, producing the same result — the
  check on the call, not on the two paths somebody thought of.
- **The membership key is not stubbed** on work items, asserted as a category over what the
  backfill plans.
- The tree: a `Release` in the results draws no row, and no creation surface offers the type.
- The narrowed boundary: the three edit functions are still never called from
  `src/view/release/`, driven by the same spy shape as today.

`npm run check` is the gate. jsdom computes no layout and no styles, so the dialog's appearance
and the index's look are live-vault questions and stay owed —
`docs/tests/suites/Smoke test the release view.md` gains them.

## Register

`docs/requirements/` gains a PBI under [[Putting work in a release]] for the creation gesture.
[[Two releases with the same basename read alike]] is unaffected. The retired justification in
`byProjectionType` is recorded where the tree's behaviour is specified.
