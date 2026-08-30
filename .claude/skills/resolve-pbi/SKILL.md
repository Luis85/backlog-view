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
