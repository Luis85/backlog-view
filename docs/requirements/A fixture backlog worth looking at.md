---
type: PBI
parent: "[[A browser harness without Obsidian]]"
order: 20
status: Done
priority: P2
created: 2026-08-05
closed: 2026-08-05
files:
  - test/helpers/fixtures.ts
  - test/harness/mount.ts
  - test/harness/harness.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A fixture backlog worth looking at

**As** whoever opens the harness, **I want** it already holding a backlog that exercises
every projection, **so that** looking at a change costs no setup and an empty screen means
a defect rather than an unconfigured view.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever opens the harness |
| **Trigger** | The page mounts |
| **Preconditions** | None — the fixture and the view options that configure all three projections ship together |
| **Guarantee** | Every projection has something to draw, and the parts of the render path that only appear under specific data — the context row, the shelf, the no-state column, the milestone — are on screen without anyone configuring them. |

**Main flow**

1. `demoVault()` builds a backlog several levels deep: two live epics with real subtrees,
   items spread across every configured state, some dated and some not, some triaged onto
   a horizon and some not, one milestone, and one item that is neither typed nor placed.
2. `demoOptions()` names the state property and its vocabulary, the horizon property and
   its buckets, and both date properties — so the board has columns, the roadmap has
   buckets, and the dated axis has bars, all at once.
3. `demoResults()` hands the view everything **except** one note. That note is the parent
   of an item that IS returned, so the tree draws a context row.

**Extensions**

- **1a — an existing suite is rewritten onto it.** Deliberately not. `fixture()`,
  `boardVault()` and `horizonVault()` are four notes each *on purpose*: a test asserting
  on three rows should not be reading past thirty. This is a fourth fixture with a
  different job, and the suites that own the other three are untouched.
- **1b — the fixture decays into one that draws nothing.** The mount test is the floor:
  it asserts the tree has rows, the board has cards in its columns, the roadmap has
  buckets, and the shelf is not empty. A fixture nobody asserts against is one that
  silently stops covering what it was built for.
- **3a — the context row is built from the vault alone.** It cannot be. A context row is
  the difference between what the vault holds and what the query returned, so the fixture
  has to say which note is outside — that is why the results are a function and not just
  `vault.entries()`.

## Acceptance criteria

- One module, importable by both the harness and the suite, holding the vault, the
  options and the result set as three functions rather than one blob.
- The tree renders at depth, with a context row that is marked as one.
- Every configured board column exists, including the no-state column, and cards land in
  more than one of them.
- Both roadmap axes have content, and the shelf holds what neither can place.
- Nothing in it is required by an existing suite, so it can grow to cover a new
  projection without a test needing to agree with it.

## Where it lives

`test/helpers/fixtures.ts` · `test/harness/mount.ts`
