---
type: PBI
parent: "[[Enforced invariants]]"
order: 10
status: Done
---

# Invariants as checks, not conventions

A rule that lives only in prose is a rule that is followed until someone is in a hurry.
The ones that can be mechanical are lint rules; the rest live beside the code they govern.

## Acceptance criteria

- Layer direction, the write boundary, ranking over real roots, menu anchoring and level
  maths all fail the build rather than review.
- Each rule is verified by planting the violation and watching lint reject it.
- Rules that cannot be mechanised sit in the layer's own `CLAUDE.md`, not in one wall of
  text far from the code.
