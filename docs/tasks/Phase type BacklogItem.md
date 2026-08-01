---
type: Task
order: 30
parent: "[[Build phases in the type system]]"
status: Done
priority: P2
area: design
closed: 2026-08-01
created: 2026-07-31
source: PR #14 maintainability review
files:
  - src/domain/model.ts
---

# Make `BacklogItem`'s build phases visible in its type

## Evidence

`BacklogItem` has **24 fields, 10 of which are assigned after construction**:
`parent`, `depth`, `levelIndex`, `effectiveLevelIndex`, `impliedType`, `orphan`,
`focusRoot`, `descendantCount`, `doneDescendants`, `subtreeDone`.

They are initialised to placeholders in `addItem` and filled in later by `linkParents`,
`breakCycles`, `assignAll` and `collectFocusRoots`. `domain/model.ts` has **fan-in 16** —
more than any other module.

## Why it matters

The type claims those fields are always present and meaningful. The code says they are
only meaningful *after the relevant build phase has run*. A reader holding a
`BacklogItem` cannot tell from the type which of its fields are real yet, and the
compiler cannot help them.

This is not theoretical. Several of the subtlest rules in `CLAUDE.md` live exactly in
that gap:

- `depth` is visual only and is re-rooted by focus mode, so level maths must use
  `effectiveLevelIndex` — see [stop-deriving-levels-from-depth](Stop%20deriving%20levels%20from%20depth.md)
  for the one place that still gets this wrong.
- `descendantCount` / `doneDescendants` deliberately skip `outsideFilter` rows while
  traversing *through* them.
- `focusRoot` items keep their real `parent` pointer, so a rendered root is not
  necessarily a real root.

Each of those is currently defended by prose and tests rather than by types.

## Approach

Stage the build in the type system so invalid states cannot be named:

```
RawItem      // what addItem produces: file, entry, frontmatter-derived fields
LinkedItem   // + parent, children, orphan — after linkParents/breakCycles
BacklogItem  // + depth, levels, rollups, focusRoot — after assignAll
```

Each phase function takes the previous type and returns the next. Consumers keep taking
`BacklogItem` and are unaffected.

## Acceptance criteria

- No behaviour change; the full suite passes untouched.
- No placeholder initialisers left in `addItem` for fields a later phase owns.
- `CLAUDE.md`'s notes about which fields are valid when can be **deleted**, because the
  types now say it.

## Risks

Highest-risk item in this folder. Fan-in 16 means the ripple is wide, and TypeScript's
structural typing will happily accept a `LinkedItem` where a `BacklogItem` is wanted
unless the phases differ by more than optionality. Wants its own PR, not a ride-along.

---

## Outcome

Done, in the shape the plan proposed: `RawItem` → `LinkedItem` → `BacklogItem`, each
extending the one before, with `RawStore` / `LinkedTree` / `BacklogTree` for the
collections. All 383 tests passed **untouched**, which is the acceptance criterion that
mattered.

**The feared risk did not materialise, and the reason is worth recording.** The worry was
that structural typing would accept a `LinkedItem` where a `BacklogItem` was wanted. It
does not: each phase *adds required fields*, so the later type is a strict subtype and
the unsafe direction — passing an unpromoted item to something expecting a promoted one —
is a missing-property error. The compiler proved this the moment the types went in, by
rejecting exactly two lines. Both were real (`cycleEntry`'s `Set<BacklogItem>` holding
items mid-link), and both were the new types catching precisely what they were added to
catch. Optionality would have been the weak formulation; required fields are what make it
work.

**What the fan-in cost: nothing.** `BacklogItem` still carries all 24 fields, so all 16
dependents compile unchanged. The only cross-module edit was `inferFolderParent`, which is
called from *inside* `linkAll` and so cannot demand a finished item; it is now generic
over `{ file: TFile }` — all it ever needed — which also drops `folderNotes.ts`'s import of
`model.ts` and makes it a true leaf.

**The honest cost.** The item graph is cyclic — a parent points back at its children — so
a phase cannot rebuild its items without rebuilding every reference to them. Promotion is
therefore in place, behind one assertion each in `linkAll` and `assignAll`, and each is
followed immediately by the loop that assigns every field the new type claims. Two lines
of unsafety replace ten placeholder fields visible to every reader, which is the trade
this issue was asking for; it is not zero, and the comments say so at both sites.

Two things improved beyond the plan while the code was open:

- `assignAll` now accumulates rollups from the **return value** of the recursive call
  rather than reading `child.descendantCount` back off the child. Same numbers, but a
  rollup can no longer read a field the recursion has not filled in yet.
- `pruneOutsideHierarchy` prunes `all` in place and returns the dropped count, instead of
  returning a filtered copy alongside a still-complete `all`. What survives is now exactly
  what the next phase promotes, so no unpromoted item is left behind claiming the later
  type.

The third acceptance criterion — deleting `CLAUDE.md`'s notes about which fields are valid
when — turned out to have nothing to delete: that prose lived in `model.ts`'s own field
comments, which the phase split reorganised. `src/domain/CLAUDE.md` gained a note instead,
because the phases raise a question a contributor must now answer: **adding a field means
choosing its phase.**
