---
type: PBI
parent: "[[Module structure]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Build phases in the type system

**As** someone reading or extending the model builder, **I want** the types to say which
fields are real yet, **so that** the compiler stops me from using a value the phase that
computes it has not produced — instead of my having to hold the build order in my head.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is changing the model builder |
| **Trigger** | Writing a function that takes a model item, or adding a field to one |
| **Preconditions** | None |
| **Guarantee** | A field that has not been computed yet cannot be read. Not by convention — the parameter type does not have it. |

**Main flow**

1. The model is built in phases: raw fields read off notes, then parent links, then cycle
   breaking and sorting, then levels, focus and rollups.
2. Each phase has **its own type** — `RawItem` → `LinkedItem` → `BacklogItem` — each
   extending the one before.
3. A function's parameter names the phase it runs in, so it can only see fields that phase
   has produced.
4. Promotion between phases is an in-place cast, because the object graph is cyclic and
   rebuilding it would break the parent links it just made.

**Extensions**

- **1a — a new field is added.** Its phase has to be chosen: which type does it go on? That
  was the question it was easy to skip when everything was one interface with placeholder
  values in it.
- **3a — a function needs a field from a later phase than its parameter.** It does not
  compile. That is the whole point, and it is what the placeholder values used to hide.

## Acceptance criteria

- Each phase has its own type, and a function's parameter says which fields are real.
- No placeholder values stand in for fields a later phase owns.
- Adding a field means choosing its phase — the question that was easy to skip before.

## Where it lives

`src/domain/model.ts` (the three phase types and the phases themselves), with phase 1
split into `src/domain/readItems.ts` when `model.ts` reached its line budget. The seam is
the phase boundary rather than a convenient cut: `RawItem` is the one phase whose output
holds no reference to the phases after it — no parent, no children, no level — so the
module can own `RawItem`, `RawStore` and the read that produces them without importing
`LinkedItem` or `BacklogItem` back. Cutting anywhere later would have made `model.ts`
import a module that imports `BacklogItem` from it, which is the import cycle this
repository's own dependency gate refuses. The types staying separate is what makes that
checkable rather than a matter of care.
Tests: `test/domain/model.test.ts`.
Done by: [[Phase type BacklogItem]].
