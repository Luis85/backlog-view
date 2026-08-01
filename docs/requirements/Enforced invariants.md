---
type: Feature
parent: "[[Codebase health]]"
order: 20
status: Done
---

# Enforced invariants

The rules that bite are lint rules where they can be, and prose beside the code they govern
where they cannot.

## Acceptance criteria

- Layer direction, the write boundary, ranking over real roots, menu anchoring and level
  maths are all checks, not conventions.
- Each rule is verified by planting the violation and watching lint reject it.
