# Open issues

Distinct notes, one per issue, with frontmatter that doubles as this plugin's own
work-item schema — so the backlog can be read in the plugin it describes (see
[codebase-health](codebase-health.md) for the Base config).

| Issue | Priority | Area | Status | Summary |
| --- | --- | --- | --- | --- |
| [verify-base-identity-in-a-live-vault](verify-base-identity-in-a-live-vault.md) | P1 | verification | Open | Collapse persistence rests on one assumption this harness cannot check |
| [phase-typed-backlog-item](phase-typed-backlog-item.md) | P2 | design | Open | 10 of `BacklogItem`'s 24 fields are placeholders until a later build phase |
| [stop-deriving-levels-from-depth](stop-deriving-levels-from-depth.md) | P2 | correctness | Open | `computeTypeChanges` breaks the codebase's own stated invariant |
| [enforce-and-colocate-invariants](enforce-and-colocate-invariants.md) | P2 | tooling | Open | 46 prose invariants are 43% of CLAUDE.md; some can become lint rules |
| [smoke-test-the-visual-changes](smoke-test-the-visual-changes.md) | P2 | verification | Open | jsdom covers structure and behaviour, never appearance |
| [lift-empty-states-out-of-rows](lift-empty-states-out-of-rows.md) | P3 | refactor | Open | `rows.ts` is 392 lines against a 400-line cap |
| [split-the-view-options-schema](split-the-view-options-schema.md) | P3 | refactor | Open | Half of `settings.ts` is a declarative schema |
| [duplicate-orders-in-a-partially-filtered-group](duplicate-orders-in-a-partially-filtered-group.md) | P3 | limitation | Open | Known: a filtered base can compute a colliding order |
| [embedded-bases-do-not-persist-collapse-state](embedded-bases-do-not-persist-collapse-state.md) | P3 | limitation | Open | Accepted cost of refusing to share a storage key |
| [write-batches-are-refused-not-queued](write-batches-are-refused-not-queued.md) | P3 | design | Open | A deliberate decision, recorded so it is re-decided knowingly |
| [split-the-view-test-suite](split-the-view-test-suite.md) | P1 | testing | Done | One 2,800-line file was 59% of all test code, and `test/` had no size budget |
| [cover-the-drag-and-drop-branches](cover-the-drag-and-drop-branches.md) | P3 | testing | Done | 21 uncovered branches, the largest gap, in the hardest code to drive |

## Conventions

- **Priority** — `P1` blocks confidence in shipped work, `P2` is real debt with a
  known payoff, `P3` is worth doing but nothing waits on it.
- **Status** — `Open`, `In progress`, `Done`. Matches the plugin's default done values.
- Every note states the evidence it rests on, with the numbers and paths, so it can be
  re-checked rather than taken on faith.
