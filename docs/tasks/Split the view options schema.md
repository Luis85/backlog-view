---
type: Task
order: 20
parent: "[[One file per concern]]"
status: Done
priority: P3
area: refactor
closed: 2026-08-01
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

---

## Outcome

Done. `src/domain/viewOptions.ts` holds `getViewOptions`, the four group builders and
`notePropsOnly`; `settings.ts` keeps the type, the defaults, `resolveSettings`,
`stateMenuValues` and `configProblems`, and went 392 lines to 229. `main.ts` takes
`getViewOptions` from the new module.

The dependency runs schema → settings, not the reverse: `DEFAULT_DONE_VALUES`,
`DEFAULT_PROP_COLUMN_WIDTH` and the two width bounds are now exported from `settings.ts`
and imported by the schema. The bounds matter twice — the slider offers that range and
`resolveSettings` clamps to it — so they stay single-valued rather than being restated
beside the slider.

The sharp edge was handled as the issue asked, mechanically rather than by eye: the 17
option keys were extracted from the file before the move and compared to the 17 extracted
after. Byte-identical, same order.

`test/domain/settings.test.ts` split along the same seam into `viewOptions.test.ts`. The
two one-line "declares the new progress/display option keys" cases became a single test
asserting all four keys, so the file is 22 tests rather than 23 with no assertion lost —
the only deliberate change to the tests.

**Since (2026-08-09):** one of the 17 keys this task moved no longer exists.
`showProperties` was deleted when the Bases properties menu became the only switch for
what a row shows ([ADR 0023](../adrs/0023-columns-are-the-bases-property-order.md)). The
count and the key list above are left as the record of what moved on 2026-08-01, which is
what this note is for; the current set is whatever `getViewOptions` returns.
