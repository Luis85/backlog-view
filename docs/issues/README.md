# Open issues

Distinct notes, one per issue, with frontmatter that doubles as this plugin's own
work-item schema — so the backlog can be read in the plugin it describes (see
[codebase-health](codebase-health.md) for the Base config).

| Issue | Priority | Area | Status | Summary |
| --- | --- | --- | --- | --- |
| [duplicate-orders-in-a-partially-filtered-group](duplicate-orders-in-a-partially-filtered-group.md) | P3 | limitation | Open | Known: a filtered base can compute a colliding order |
| [embedded-bases-do-not-persist-collapse-state](embedded-bases-do-not-persist-collapse-state.md) | P3 | limitation | Open | Accepted cost of refusing to share a storage key |
| [write-batches-are-refused-not-queued](write-batches-are-refused-not-queued.md) | P3 | design | Open | A deliberate decision, recorded so it is re-decided knowingly |
| [split-the-view-test-suite](split-the-view-test-suite.md) | P1 | testing | Done | One 2,800-line file was 59% of all test code, and `test/` had no size budget |
| [verify-base-identity-in-a-live-vault](verify-base-identity-in-a-live-vault.md) | P1 | verification | Done | Confirmed live: a `.base` leaf is a `FileView` with `.file` set, so rows persist |
| [smoke-test-the-visual-changes](smoke-test-the-visual-changes.md) | P2 | verification | Done | Checked live in both themes; `styles.css` needed no adjustment |
| [undo-the-last-backlog-change](undo-the-last-backlog-change.md) | P2 | feature | Done | Batch writes were irreversible; now inverse-captured and replayable, with redo |
| [phase-typed-backlog-item](phase-typed-backlog-item.md) | P2 | design | Done | The build's three phases are three types; adding a field now means choosing one |
| [stop-deriving-levels-from-depth](stop-deriving-levels-from-depth.md) | P2 | correctness | Done | The cascade chains down parent levels; `.depth` is now a lint rule |
| [enforce-and-colocate-invariants](enforce-and-colocate-invariants.md) | P2 | tooling | Done | Two invariants became lint rules; the rest moved beside the layer they govern |
| [lift-empty-states-out-of-rows](lift-empty-states-out-of-rows.md) | P3 | refactor | Done | Pure motion into `render/emptyStates.ts`; `rows.ts` 325 → 263 lines |
| [split-the-view-options-schema](split-the-view-options-schema.md) | P3 | refactor | Done | Pure motion into `domain/viewOptions.ts`; the 17 persisted keys diffed |
| [cover-the-drag-and-drop-branches](cover-the-drag-and-drop-branches.md) | P3 | testing | Done | 21 uncovered branches, the largest gap, in the hardest code to drive |

**Every actionable issue from the PR #14 review is now closed.** What is still open is
three notes with no acceptance criteria: two documented limitations and one recorded
decision, each waiting on a user report or an Obsidian API that does not exist yet. They
are here to be re-decided knowingly, not worked on.

Some closed notes stay useful and should be **re-run rather than read**:
[smoke-test-the-visual-changes](smoke-test-the-visual-changes.md) is the checklist for any
future change to `styles.css`, since nothing here can test appearance, and
[verify-base-identity-in-a-live-vault](verify-base-identity-in-a-live-vault.md) records a
fact about Obsidian's internals that a future release could quietly take away — with a
silent failure mode, so nothing would report it. `npm run test-build` is what makes both
cheap: it turns this repository into a vault with the plugin installed.

## Conventions

- **Priority** — `P1` blocks confidence in shipped work, `P2` is real debt with a
  known payoff, `P3` is worth doing but nothing waits on it.
- **Status** — `Open`, `In progress`, `Done`. Matches the plugin's default done values.
- Every note states the evidence it rests on, with the numbers and paths, so it can be
  re-checked rather than taken on faith.
