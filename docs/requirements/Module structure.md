---
type: Feature
parent: "[[Codebase health]]"
order: 30
status: Done
---

# Module structure

One file per concern, a line cap, and a layering that a violation cannot cross without
failing the build.

## Acceptance criteria

- Four layers, each reaching only downwards.
- A type lives with the code that produces it, not the code that consumes it.
- Build phases are expressed as types, so a field cannot be read before it is real.
