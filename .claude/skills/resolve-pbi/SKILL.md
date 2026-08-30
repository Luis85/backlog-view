---
name: resolve-pbi
description: Use when a decomposed PBI in docs/requirements/ is ready to be built — the user asks to resolve, refine, prepare or execute a PBI, or wants the prompt that runs its children, after decompose-pbi has written them and before any code
---

# Resolving a PBI

Make an already-decomposed PBI executable, then hand out the prompt that executes it.
Write no source code, and never execute.

**Announce at start:** "Using resolve-pbi to make every child executable before anything
runs."

## Precedence, and what this is not

- `decompose-pbi` wrote the children. This skill is its follow-up and never re-opens the
  PBI: a child that contradicts the use case goes back to `adding-backlog-items`.
- A PBI with **no children** has not been decomposed. Stop and send the user to
  `decompose-pbi` — there is nothing here to make executable.
- A note that is **not a `PBI`** is refused as `decompose-pbi` refuses one: an `Epic` or a
  `Feature` holds requirements, not Tasks. Say which note is wanted instead.
- `subagent-driven-development` is what the printed prompt invokes, in a **different
  session**. This skill never executes, and never writes source code.

## What this produces

Three outputs:

- Edits to the children, so each one carries what an implementer subagent needs.
- A pointer plan at `docs/superpowers/plans/YYYY-MM-DD-<pbi-slug>.md`, the file
  `subagent-driven-development` cannot run without.
- An inline copy+paste prompt naming that plan and the notes, optionally saved as a `Task`
  child of the PBI for a later run.

## Two rules that hold across every phase

**Nothing reaches disk before phase 3 passes.** No note, no plan, no scratch list.

**One question per message.**

Execution detail goes into the notes. The plan and the prompt only point at them. A plan or
prompt carrying the detail inline is a snapshot that rots the moment a note changes; one
that points stays correct for as long as the notes are.

## Phase 0 — the subject

Read the PBI, its parent Feature and that Feature's Epic. A Feature may carry
`## Landmines, before implementation`, the only place the order the work must be done in is
stated — deliberately not in the PBI, so phase 1 depends on this read.

Then find every output the decomposition already produced: every note naming the PBI as
`parent`, and every note that links to it **without** being its child, found by a
`[[wikilink]]` search over `docs/`. That second search exists because a `Test case`, a
`Test suite` and an ADR carry no `parent` — the first search cannot see them, and a rerun
that skips the second treats them as never written.

Report back what was read, name every output found, and ask whether this is still what is
being built. A child whose work already landed is named as such rather than resolved again.

**Exit when** the user confirms the decomposition as read, and every output found is named
as still owed or as already done.

## Phase 1 — the order

`order` is a rank, not a dependency graph. Walk the children in rank against the Feature's
`## Landmines` from phase 0 — the only place the order the work must be done in is stated.

Two outcomes, and they are different repairs:

- A child that **cannot start until a sibling lands** says so as **step 1 of its
  `Approach`, naming the sibling as a `[[wikilink]]`.** `docs/README.md` documents this
  shape: [[Split the view test suite]] cannot split anything until the shared harness
  moves, and says so as step 1.
- A child whose **rank itself is wrong** is re-ranked. A note explaining that the ranks are
  out of order is not a repair.

**Exit when** every child's position is defended or corrected.

## Phase 2 — executability, per child, out loud

One line per child, out loud, saying what an implementer subagent will not find in it. Only
a thin child costs a question; **silence on a child is the failure this phase exists to
stop.**

| Row | The question |
| --- | --- |
| Evidence | What produced this child — the PBI slice, or the perspective row? |
| Approach | Is it ordered where order matters? |
| Acceptance criteria | Does each map to a test assertion or a one-minute vault check? |
| Files | Which layer, and which paths? |
| The failing test | Which file, node or jsdom, and **what does it assert**? |
| Coverage | Does the threshold in `vitest.config.mts` move, and to what? |
| What would refuse it | The 400-line cap, the layer's `no-restricted-imports`, the write-boundary ban |
| Risks | Is there one worth naming? |

The failing-test row is the specific assertion, never "add tests". Where the child's whole
deliverable is an invariant, root `CLAUDE.md`'s rule applies and belongs in the `Approach`:
the test is **watched failing** — revert the fix, run it, see red, restore.

The "what would refuse it" row is the clean-code gate asked before the work rather than at
lint time. A child that cannot land without splitting a file over the cap says so as a step
in its `Approach`, not as a surprise for the implementer.

### Not every child is executable

The same pass assigns **every output — child or not — to the subagent or to the human**.
Assigning only the non-child outputs would send an intentionally unanswerable note through
the TDD loop, because `decompose-pbi` deliberately produces children that are not
implementable:

| Output | Whose | Why |
| --- | --- | --- |
| A `Task` | The subagent's | It is engineering work with a test |
| An `Issue` holding an **open question** | The human's | The work cannot settle it; that is why it is an Issue |
| An `Issue` recording a **decision or a limitation** | The subagent's | It is prose stating something already settled |
| A `Deliverable` | Ask | A non-code artifact may be either, and the register documents no shape for it |
| An ADR *(not a child)* | The subagent's | Prose it can write, once phase 2 has the five things `docs/adrs/README.md` wants |
| A `Test suite` *(not a child)* | The subagent's | Prose saying what the group walks; it checks nothing itself, and it must exist before a case can hang from it. Written, never closed — it stays `Open` while its cases are re-walked |
| A `Test case` *(not a child)* | The human's | A live vault, which no subagent reaches — Obsidian cannot run here |

The human's outputs are **named in the plan's header, never given a task**. They are still
part of the picture — the prompt reads them as context, and the readback shows the split —
but the run does not pretend to deliver them.

An open question that *must* be answered before the work can start is not deferred by this
table: it is a phase 2 question to the user, and it either gets an answer that turns the
Issue into work or it blocks the run. Say which, out loud, rather than letting it ride.

**Exit when** every child is either "executable as written" or has an answer to write into
it, and **every output, child or not, is assigned** to the subagent or to the human.

## Phase 3 — the readback gate

Read the ordered set back: each output with its rank, **whose it is**, and one sentence of
what gets delivered — the subagent's as the task it becomes, the human's as the thing the
run will not do — plus what you are still assuming.

**Exit when** the user has answered. The readback is a question, not an announcement — a
mistaken order or a misread deliverable is caught here or not at all.
