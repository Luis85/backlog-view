---
type: Feature
parent: "[[Codebase health]]"
order: 0
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: Alex
---

# Module structure

One file per concern, a line cap, and a layering that a violation cannot cross without
failing the build.

**Outcome** — "Where does this go" has an answer before the code is written, and a wrong
answer fails the build.

The four layers are current and enforced. They are also **under question**: the software
design document of 2026-08-16 proposes a different set of directories with the same intent,
and [[The SDD's layers are not the four this repository enforces]] is where that is settled.
Until it is, this note describes what the build enforces, which is the only thing a layer
rule can honestly describe.

## Acceptance criteria

- Four layers, each reaching only downwards.
- A type lives with the code that produces it, not the code that consumes it.
- Build phases are expressed as types, so a field cannot be read before it is real.
