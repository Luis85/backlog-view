---
type: PBI
parent: "[[Safe writes]]"
order: 20
status: Done
---

# The write gate

**As** someone letting a view edit my notes, **I want** every change to pass one checkpoint,
**so that** "is this safe" is a question with one answer in one place — rather than a
property of whichever code path happened to run.

## Use case

| | |
| --- | --- |
| **Actor** | The view, on behalf of any interaction |
| **Trigger** | Any planned batch of frontmatter changes |
| **Preconditions** | A batch has been planned by `domain/writePlan.ts`, which applies nothing |
| **Guarantee** | Nothing reaches a note except through this gate. That is enforced by lint, not by review. |

**Main flow**

1. An interaction plans a batch. Planning is pure: it reads the model and returns what
   *would* be written.
2. The batch enters the gate. It is **serialized** — a second batch cannot start while one
   is running.
3. The gate checks the configuration. If the property keys are valid, the batch proceeds.
4. Each write lands through the one module allowed to touch frontmatter, capturing its own
   inverse as it goes ([[Undo and redo]]).
5. Progress ticks in the toolbar per file.
6. The batch finishes and the view refreshes **once**.

**Extensions**

- **2a — a write targets a note the Base excluded.** The whole forward batch is refused
  ([[Filtered bases keep their tree]]).
- **3a — the configuration has problems** (two keys pointing at the same property, say).
  The batch is refused and the toolbar says why. Guessing which key was meant would corrupt
  notes, and this is the one thing worth blocking every write over.
- **4a — a write fails partway.** The batch is **not** transactional and does not pretend
  to be: the prefix that landed stays applied, stays undoable, and the view still refreshes
  — those notes are on disk and the tree has to show them.
- **5a — data updates arrive mid-batch.** Every file `applyWrites` touches comes back as
  its own change event; rebuilding the tree on each would render a half-applied backlog
  hundreds of times. They are recorded and flushed once at the end instead.
- **6a — the batch is undo.** Same gate, minus the context-row check — see
  [[Undo and redo]] for why that one is capture-time.

## Acceptance criteria

- All frontmatter writes live in one module; a new write path elsewhere fails lint.
- Property-key collisions are reported and block writes, rather than being guessed at.
- A batch is one refresh, not one per file, and a failure mid-batch still refreshes.
- Planning and applying are separate: `domain/writePlan.ts` touches nothing.
- Interaction never pauses — each write awaits, so scrolling, filtering and selection keep
  working against a briefly stale model.

## Where it lives

`src/view/writeGate.ts` (`WriteGate` — `runExclusively`, `applySafely`, `undoLast`, the
undo slot and the deferred mid-batch refresh). It moved out of `src/view/backlogView.ts`
when the view hit its 400-line cap, the same extraction `filterState.ts` and
`collapseState.ts` already are: five of that class's fields served this one concern and
only `busy` was read from outside it. The view now owns a gate, delegates the three host
methods to it, and publishes its progress — `syncBusyUi`, because the gate reaches none
of the view's elements ·
`src/storage/frontmatter.ts` (`applyWrites` — the only module that writes) ·
`src/domain/writePlan.ts` (planning) · `src/domain/settings.ts` (`configProblems`) ·
`eslint.config.mjs` (`no-restricted-syntax` banning `processFrontMatter` and
`vault.create` outside `storage/`).
Tests: `test/storage/frontmatter.test.ts`, `test/view/contextRowWrites.test.ts`,
`test/view/toolbar.test.ts`.
