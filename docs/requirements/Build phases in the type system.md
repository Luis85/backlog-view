---
type: PBI
parent: "[[Module structure]]"
order: 20
status: Done
---

# Build phases in the type system

The model is built in phases, and a field is meaningless until its phase has run. Saying
so in the types means the compiler enforces it instead of the reader remembering it.

## Acceptance criteria

- Each phase has its own type, and a function's parameter says which fields are real.
- No placeholder values stand in for fields a later phase owns.
- Adding a field means choosing its phase — the question that was easy to skip before.
