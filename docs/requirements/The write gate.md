---
type: PBI
parent: "[[Safe writes]]"
order: 20
status: Done
---

# The write gate

Every write goes through one serialized gate that refuses to run while the view options are
misconfigured.

## Acceptance criteria

- All frontmatter writes live in one module; a new write path elsewhere fails lint.
- Property-key collisions are reported and block writes, rather than being guessed at.
- A batch is one refresh, not one per file, and a failure mid-batch still refreshes.
