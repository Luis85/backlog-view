---
type: Feature
parent: "[[Codebase health]]"
order: 30
status: Done
---

# Module structure

One file per concern, a line cap, and a layering that a violation cannot cross without
failing the build.

**Outcome** — "Where does this go" has an answer before the code is written, and a wrong
answer fails the build.

## Acceptance criteria

- Four layers, each reaching only downwards.
- A type lives with the code that produces it, not the code that consumes it.
- Build phases are expressed as types, so a field cannot be read before it is real.

## Use cases

- [[One file per concern]] — four layers, a line cap, one responsibility per file.
- [[Build phases in the type system]] — a field that is not real yet cannot be read.
