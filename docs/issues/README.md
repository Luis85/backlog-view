# Open issues

Distinct notes, one per issue, with frontmatter that doubles as this plugin's own
work-item schema — so the backlog can be read in the plugin it describes (see
[codebase-health](codebase-health.md) for the Base config).

| Issue | Priority | Area | Summary |
| --- | --- | --- | --- |
| [split-the-view-test-suite](split-the-view-test-suite.md) | P1 | testing | One 2,800-line file is 59% of all test code, and `test/` has no size budget |
| [verify-base-identity-in-a-live-vault](verify-base-identity-in-a-live-vault.md) | P1 | verification | Collapse persistence rests on one assumption this harness cannot check |
| [phase-typed-backlog-item](phase-typed-backlog-item.md) | P2 | design | 10 of `BacklogItem`'s 24 fields are placeholders until a later build phase |
| [stop-deriving-levels-from-depth](stop-deriving-levels-from-depth.md) | P2 | correctness | `computeTypeChanges` breaks the codebase's own stated invariant |
| [enforce-and-colocate-invariants](enforce-and-colocate-invariants.md) | P2 | tooling | 46 prose invariants are 43% of CLAUDE.md; some can become lint rules |
| [smoke-test-the-visual-changes](smoke-test-the-visual-changes.md) | P2 | verification | jsdom covers structure and behaviour, never appearance |
| [cover-the-drag-and-drop-branches](cover-the-drag-and-drop-branches.md) | P3 | testing | 21 uncovered branches, the largest gap, in the hardest code to drive |
| [lift-empty-states-out-of-rows](lift-empty-states-out-of-rows.md) | P3 | refactor | `rows.ts` is 392 lines against a 400-line cap |
| [split-the-view-options-schema](split-the-view-options-schema.md) | P3 | refactor | Half of `settings.ts` is a declarative schema |
| [duplicate-orders-in-a-partially-filtered-group](duplicate-orders-in-a-partially-filtered-group.md) | P3 | limitation | Known: a filtered base can compute a colliding order |
| [embedded-bases-do-not-persist-collapse-state](embedded-bases-do-not-persist-collapse-state.md) | P3 | limitation | Accepted cost of refusing to share a storage key |
| [write-batches-are-refused-not-queued](write-batches-are-refused-not-queued.md) | P3 | design | A deliberate decision, recorded so it is re-decided knowingly |

## Conventions

- **Priority** — `P1` blocks confidence in shipped work, `P2` is real debt with a
  known payoff, `P3` is worth doing but nothing waits on it.
- **Status** — `Open`, `In progress`, `Done`. Matches the plugin's default done values.
- Every note states the evidence it rests on, with the numbers and paths, so it can be
  re-checked rather than taken on faith.
