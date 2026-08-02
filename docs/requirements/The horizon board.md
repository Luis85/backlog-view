---
type: Feature
parent: "[[Product Roadmap]]"
order: 20
status: Active
created: 2026-08-01
---

# The horizon board

A Now-Next-Later roadmap: buckets from a horizon property and its ordered values,
exactly as the board's columns come from the workflow states. The format organizes by
confidence rather than calendar, and its inventors are blunt that buckets are explicit
placements — this feature keeps them so, which is why no date is ever read as one.

**Outcome** — A roadmap that never promises a date it does not have: every item sits in
the horizon its own note declares, moving one is a single gated, undoable write, and
the untriaged rest is a visible count rather than a secret.

Both halves are built — the buckets and the moves. The feature stays Active rather than
Done on one criterion neither of its use cases can exercise alone: a same-bucket move
that crosses a lane must plan the reparent without a redundant horizon write, and there
are no lanes yet to cross ([[Lanes on the roadmap]]).
