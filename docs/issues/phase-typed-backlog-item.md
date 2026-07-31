---
type: PBI
parent: "[[codebase-health]]"
order: 30
status: Open
priority: P2
area: design
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
  `effectiveLevelIndex` — see [stop-deriving-levels-from-depth](stop-deriving-levels-from-depth.md)
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
