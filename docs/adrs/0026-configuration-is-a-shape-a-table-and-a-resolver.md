---
adr: 26
title: Configuration is a shape, a table and a resolver
status: Accepted
date: 2026-08-10
area: architecture
---

# ADR 0026 — Configuration is a shape, a table and a resolver

## Context

`src/domain/settings.ts` held four different things: what a resolved configuration IS,
the fixed type vocabulary, the table of optional write targets, and the code that reads a
`.base` file into all of it. That was fine while the plugin had three write targets. It is
not fine now, and the way it stopped being fine is worth stating precisely, because it is
the thing this record exists to prevent from recurring.

Adding one optional property — the assignee — touched five places in that file: a field on
the interface, a line in `defaultSettings`, a member of `OptionalField`, a member of
`OptionalSettingsKey`, and a row of `PROPERTY_TABLE`. That is the right cost for the
feature. What was wrong is that the file was **at its 400-line lint budget**, so the sixth
line had to be bought back somewhere else — first by replacing eight hand-written
`propKey` lines with a spread of the table they restated (a genuine improvement, but one
found under duress), and then, after main merged a state-colour feature into the same
function, by hoisting a local to save exactly one line. The budget was doing its job: the
file had four reasons to change and was being edited for all of them at once.

The layer rule (ADR 0003) says nothing about this, because it is not a layer violation.
Everything here is `domain/`. The question is what a module inside a layer is FOR.

## Decision

Configuration is split into four modules, each with one reason to change, arranged so the
dependencies run one way:

- **`src/domain/typeVocabulary.ts`** — the fixed type names (`LEVELS`, `EXTRA_TYPES`,
  `MARKER_TYPES`, `ALL_TYPES`, `DELIVERABLE_TYPE`), the `byName` guard every table keyed by
  user data must be read through, and where a type's notes are filed
  (`DEFAULT_HOME_FOLDER`, `defaultTypeFolder`, `typeFolderKey`). A leaf that imports
  nothing. `byName` used to carry a comment saying it read more naturally in
  `itemTypes.ts` and could not go there because that module imports the settings — a
  dependency that could not run both ways. Splitting the NAMES out from the settings that
  carry them dissolves that: `itemTypes.ts` and `settings.ts` both sit above this file and
  neither has to sit above the other.
- **`src/domain/settings.ts`** — what a resolved configuration IS: the `BacklogSettings`
  shape, `defaultSettings`, and the questions answered from the fields alone (is this state
  done, what does a menu offer). It imports the vocabulary below it and **neither of the two
  modules above it**, which is what keeps it a shape a test can write as a literal.
- **`src/domain/optionalProperties.ts`** — the one vocabulary of write targets beyond
  `parent`/`order`/`type`: `OptionalField`, `PROPERTY_TABLE` and everything that reads it as
  a table (`optionalKeyFor`, `adoptableProperties`, `ownedProperties`,
  `resolvedDeliverableStateKey`, `AxisField`). This is the half that GROWS — a row per
  feature that learns to write somewhere new.
- **`src/domain/settingsResolve.ts`** — the only module that touches `BasesViewConfig`:
  never-set versus cleared, a list falling back to a shipped default, a folder path spelled
  the way the vault spells it, one workflow's key borrowed by another.

`configProblems` moved to the existing `src/domain/settingsConsistency.ts` rather than to a
module of its own: that file already asks which combinations of settings can exist, of the
producer that skips the resolver (a test fixture), and a collision report is the same
question asked of the producer that is a hand-edited `.base`.

**The rule to keep**: the shape imports neither the table nor the resolver. A cycle is the
signal that something has been put in the wrong one of the four — `npm run analyze` fails on
one, so this is checked rather than remembered.

## Consequences

`settings.ts` went from 400 effective lines (its cap) to 124, and no module in the group is
above 155. A new optional property is now a row in `optionalProperties.ts` plus a field on
the shape, and neither file is near a budget.

The cost is import churn: 47 files named `settings.ts` for a symbol that moved, and each now
names the module that holds it. That is a one-time mechanical edit and it makes the imports
say something — a file importing `settingsResolve.ts` is a file that reads the `.base`, and
there are three of them.

What this does NOT do is give the group a barrel. Re-exporting the moved symbols from
`settings.ts` would have made the churn zero and the split cosmetic: everything would still
import from one module, and the next contributor would still add their code to whichever
file the import line pointed at.

`test/domain/settings.test.ts` still covers all four modules and was not split with them.
The tests are organised by the behaviour they drive, and "the settings" is still one
behaviour to a reader; splitting them would be a rename with no reader served.

## Alternatives

**Leave it and raise the lint budget.** The budget is the only thing that noticed, and it
noticed correctly. Raising it would have removed the signal and kept the problem.

**Extract only the resolver.** The cheapest split that would have fitted this pull request:
~110 lines out, one new module, one register edit. Refused because it leaves the property
table — the half that actually grows — in the same file as the shape, so the next property
lands in a file at 290 lines instead of 400 and the same edit happens again in a year.

**Split by feature instead** (a `risk.ts`, an `assignee.ts`, each holding its own field,
default and table row). Refused outright: the table's whole value is that it is ONE
statement the pickers, the collision report, the adoption and the backfill all read. Nine
files each declaring a row is exactly the drift the table exists to prevent.

## Revisit when

A fifth concern appears in `settings.ts` — the menu-value readers (`stateMenuValues`,
`horizonMenuValues`, `hasRiskLevels`) are the candidate, and they were deliberately left
where they are: they are three small functions over the fields beside them, and a module
holding only them would be a boundary drawn for symmetry rather than for a reason to change.
Move them when something else wants to live with them, not because the shape's file grows —
if THAT grows it is because the shape grew, which is the one thing a settings shape is
supposed to do.
