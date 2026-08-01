---
type: PBI
parent: "[[Module structure]]"
order: 10
status: Done
---

# One file per concern

Four layers, a line cap, and one responsibility per file — so the question "where does
this go" has an answer before the code is written.

## Acceptance criteria

- A file that outgrows its cap is split along a real seam, not at a line number.
- A type lives with the code that produces it, not the code that consumes it.
- The layering fails the build when crossed, so it cannot erode quietly.
