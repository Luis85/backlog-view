# resolve-pbi — design

A skill that turns a decomposed PBI into an executable one, then hands out the prompt that
executes it. It is the third link in the chain: `adding-backlog-items` writes the PBI,
`decompose-pbi` writes its children, `resolve-pbi` makes those children executable and
prints the prompt a fresh session pastes to run them.

## What it produces

**No plan file.** `docs/superpowers/plans/` gains nothing. The PBI's children *are* the
task list — `decompose-pbi` already ranked them in the order the work must be done, and a
plan file beside them is a second copy of that order which can disagree with the register.

Two outputs instead:

1. **Edits to the children**, so each one carries what an implementer subagent needs.
2. **An inline copy+paste prompt** that points at those notes, optionally saved as a `Task`
   child of the PBI for a later run.

## Scope, and what it refuses

- The subject is **one PBI that has already been decomposed**. No children means the
  decomposition has not happened: stop and send the user to `decompose-pbi`.
- A note that is not a `PBI` is refused the same way `decompose-pbi` refuses one — an
  `Epic` or a `Feature` holds requirements, not Tasks.
- It never re-opens the PBI. A child that contradicts the use case goes back to
  `adding-backlog-items`; it is not fixed here.
- It writes **no source code** and it never executes. Executing is always a separate
  session the user starts by pasting the prompt.

It reads the same surroundings `decompose-pbi` phase 0 reads: the parent `Feature` — for
`## Landmines, before implementation`, which is the only place the order the work must be
done in is stated — and that Feature's `Epic`, every note naming the PBI as `parent`, and
every note that links to it **without** being its child. That last search is what finds the
`Test case`, the `Test suite` and the ADR a decomposition produced: none of them carries a
`parent`, so a `[[wikilink]]` search over `docs/` is the only thing that sees them.

## Where the execution detail lands

**Back into the notes. The prompt just points.**

A child note says what work is owed; it does not say how to execute it. `resolve-pbi` fills
that in — an ordered `Approach`, criteria that map to something a test asserts, the test
file and the assertion, the risk worth naming — and commits it. The prompt that follows is
short: read these notes, in this order, and execute.

This is what makes the prompt durable. A prompt carrying an inline plan is a snapshot that
rots the moment a note changes; a prompt that points is correct for as long as the notes
are. That property is what the saved note's `Risks` section states out loud.

## The phases

One question per message throughout. **Nothing reaches disk before phase 3 passes.**

### Phase 0 — the subject

Read the PBI, its ancestors, every child and every non-child output. Report back the PBI's
actor, guarantee, main flow, extensions and acceptance criteria, plus every output found
around it, and ask whether that is still what is being built. A child whose work has already
landed is named as such rather than re-planned.

**Exit when** the user confirms the decomposition as read, and every output found is named
as still owed or as already done.

### Phase 1 — the order

`order` is a rank, not a dependency graph. Walk the children in rank against the Feature's
`## Landmines`: the constraints there are invisible from the PBI alone, on purpose, because
no single use case can state the order two pieces of work must keep.

Two outcomes, and they are different repairs:

- A child that **cannot start until a sibling lands** says so as **step 1 of its
  `Approach`, naming the sibling as a `[[wikilink]]`**. `docs/README.md` already documents
  that shape — [[Split the view test suite]] cannot split anything until the shared harness
  moves, and says so as step 1.
- A child whose **rank itself is wrong** is re-ranked. A note explaining that the ranks are
  out of order is not a repair.

**Exit when** every child's position is defended or corrected.

### Phase 2 — executability, per child, out loud

One line per child, saying what an implementer subagent will not find in it. Only a thin
child costs a question; **silence on a child is the failure this phase exists to stop.**

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

The same pass names each **non-child output** as the subagent's or the human's. An ADR is
prose a subagent can write. A `Test case` is a live vault and no subagent reaches it — Obsidian
cannot run in this environment, so that output stays the human's and the prompt says so.

**Exit when** every child is either "executable as written" or has an answer to write into
it, and every non-child output is assigned.

### Phase 3 — the readback gate

Read the ordered set back: each child with its rank and one sentence of what the subagent
will do, each non-child output with whose it is, and what you are still assuming.

**Exit when the user has answered.** The readback is a question, not an announcement — a
mistaken order or a misread deliverable is caught here or not at all.

## Clean code and TDD — named, not restated

Every rule this skill needs already exists in this repository. `decompose-pbi`'s rule
applies unchanged: read them, do not restate them.

**The cycle is stated once, in the prompt, never per child** — red, green, commit, and
`npm run check` (all five steps) before a task is called done. Copied into every note it
drifts. What *is* per child is the specific: which test file, which assertion, which
threshold moves.

**The prompt names the reading rather than carrying it:** root `CLAUDE.md`, the layer guide
for each layer touched (`src/domain/CLAUDE.md`, `src/storage/CLAUDE.md`,
`src/view/CLAUDE.md`), `test/CLAUDE.md`, and `superpowers:test-driven-development`. An
implementer that reads those has the clean-code rules. A prompt that paraphrases them holds
a second copy that goes stale — and a paraphrase of a rule that lives in a guide is a red
flag below.

The `[Unreleased]` changelog row is part of done for a child that earns one.

## The close

In this order, so the work lands in one commit and the prompt is the last thing on screen:

1. Write the children's edits.
2. Ask the save question.
3. Write the `Task` note if the answer is yes.
4. Run `npm run docs` and fix what it reports.
5. Commit the notes alone. No push, no pull request.
6. Print the prompt.

### The prompt

Fenced, and nothing else in the block:

- read root `CLAUDE.md`, the layer guides for the layers touched, and `test/CLAUDE.md`
- read `docs/requirements/<Title>.md`, then its children **by path, in rank order**
- read every non-child output **by path**, each marked subagent's or human's
- execute with `superpowers:subagent-driven-development`, one task per child
- red, green, commit; `npm run check` before a task is done
- do not re-open the PBI — a child that contradicts it goes back to `adding-backlog-items`

Naming the non-child outputs is not decoration, for the same reason `decompose-pbi`'s
handoff names them: a `Test case`, its `Test suite` and an ADR are unreachable from the
PBI's children, so a prompt naming only those hands the executor a picture missing exactly
the verification and the decision the sweep established were needed.

### The save offer

A question with no default, asked once: save this prompt as a `Task` under the PBI for a
later run?

On yes, one note at the next free rank among the PBI's children, in the shape
`docs/README.md` documents for a `Task` — no invented shape:

| Section | What it holds |
| --- | --- |
| Evidence | This refinement pass and the decomposition behind it, naming the PBI as a `[[wikilink]]` |
| Why it matters | It is the execution handoff; without it a later session re-derives the order |
| Approach | The fenced prompt, verbatim |
| Acceptance criteria | Every sibling closed, and `npm run check` green |
| Risks | **The prompt is a pointer, not a snapshot** — a later run re-reads the notes it names rather than trusting anything it summarises |
| Outcome | Written after the run, like any Task |

## Red flags — stop and go back

- A phase's exit gate asks for less than that phase's walk covered.
- A child went unmentioned in phase 2 because it "obviously fits".
- The prompt paraphrases a rule that lives in a guide.
- Execution detail went into the prompt instead of the note.
- A plan file appeared in `docs/superpowers/plans/`.
- A child was re-scoped to fit the order, instead of the order being corrected.
- You wrote a note before phase 3 to keep track.
- You started writing source code.
