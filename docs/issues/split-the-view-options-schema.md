---
type: PBI
parent: "[[codebase-health]]"
order: 90
status: Open
priority: P3
area: refactor
created: 2026-07-31
source: PR #14 maintainability review
files:
  - src/domain/settings.ts
---

# Separate the view-options schema from settings resolution

## Evidence

`src/domain/settings.ts` is 299 counted lines. Roughly half is the declarative Bases
options schema — `getViewOptions`, `hierarchyGroup` (61 lines on its own), `progressGroup`,
`newItemsGroup`, `displayGroup`.

## Why it matters

Three different jobs share the file:

1. **Declaring** what Bases shows in the view-options menu — pure data, changes when the
   UI gains an option.
2. **Resolving** persisted config into `BacklogSettings` — `resolveSettings`, the
   `note.` prefix stripping, the defaulting rules.
3. **Validating** — `configProblems`, the gate every write path passes through.

Only (2) and (3) share anything. The schema is a wall of literals in the middle of the
logic, and it is the part most often edited when adding a feature.

## Approach

Move the schema to `src/domain/viewOptions.ts`, keeping the `notePropsOnly` filter with
it. `settings.ts` keeps `BacklogSettings`, `defaultSettings`, `resolveSettings`,
`stateMenuValues` and `configProblems`, at roughly 160 lines.

`main.ts` imports `getViewOptions` from the new module.

## Acceptance criteria

- Pure motion; `test/domain/settings.test.ts` splits along the same seam.
- The option `key` strings stay byte-identical — they are the persisted `.base` file
  format, and a typo silently resets a user's configured view.

## Risks

Low, with one sharp edge: the keys in the schema (`inferFolderHierarchy`,
`autoAssignType`, `showProperties`, …) are read back by `resolveSettings` and are user
data. Diff them explicitly rather than trusting the move.
