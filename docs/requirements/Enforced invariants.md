---
type: Feature
parent: "[[Codebase health]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: Ben
---

# Enforced invariants

The rules that bite are lint rules where they can be, and prose beside the code they govern
where they cannot.

**Outcome** — The rules that bite are checks, so they are found by a command rather than
by a bug.

## Acceptance criteria

- Layer direction, the write boundary, ranking over real roots, menu anchoring and level
  maths are all checks, not conventions.
- Each rule is verified by planting the violation and watching lint reject it.
