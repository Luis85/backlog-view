# resolve-pbi — design

A skill that turns a decomposed PBI into an executable one, then hands out the prompt that
executes it. It is the third link in the chain: `adding-backlog-items` writes the PBI,
`decompose-pbi` writes its children, `resolve-pbi` makes those children executable and
prints the prompt a fresh session pastes to run them.

## What it produces

Three outputs:

1. **Edits to the children**, so each one carries what an implementer subagent needs.
2. **A pointer plan** at `docs/superpowers/plans/YYYY-MM-DD-<pbi-slug>.md` — the file
   `subagent-driven-development` cannot run without, holding no detail of its own.
3. **An inline copy+paste prompt** naming that plan and the notes, optionally saved as a
   `Task` child of the PBI for a later run.

## The pointer plan, and why there is one

The first draft of this design produced no plan file at all: the PBI's children are already
a ranked task list, and a plan beside them is a second copy of that order which can disagree
with the register. That is a real cost, and it is paid rather than avoided, because
`subagent-driven-development` cannot consume child notes. Its three scripts each take a
`PLAN_FILE` and exit 2 without one, and `task-brief` extracts a task by matching
`^#+[ \t]+Task[ \t]+N` **inside that file**. A handoff naming only notes reaches that skill
without the one artifact it needs.

So the plan is written, and made as thin as the tooling allows:

- The header `writing-plans` requires — goal, architecture, and a **Global Constraints**
  section, since `subagent-driven-development` passes that section into every dispatch and
  a constraint absent from it reaches no implementer.
- One `## Task N` per child, in rank order, each naming the child's path and saying to read
  it. **`N` is the dispatch index, not the note's `order`** — ranks carry gaps and
  `task-brief` matches on the integer it is given.
- One `## Task N` for each **non-child output that is the subagent's** — an ADR is prose it
  can write. The outputs that are the **human's** are named in the header instead, never as
  a task: a `Test case` is a live vault, and no subagent reaches one.
- Nothing else. No steps, no code blocks, no acceptance criteria.

**This is not `writing-plans`.** That skill decides granularity, file layout and TDD steps;
here all three already live in the register, and the plan is generated mechanically from the
ranks in the same pass that fixed them.

One cost is real and stated rather than hidden: `subagent-driven-development` says exact
values appear **only** in the task brief, and a pointer brief holds none — it names the note
that does. The single source of requirements moves from the brief to the note the brief
names, and the brief says so in those words, so an implementer knows it is not looking at a
brief that forgot its values.

## Scope, and what it refuses

- The subject is **one PBI that has already been decomposed**. No children means the
  decomposition has not happened: stop and send the user to `decompose-pbi`.
- A note that is not a `PBI` is refused the same way `decompose-pbi` refuses one — an
  `Epic` or a `Feature` holds requirements, not Tasks.
- It never re-opens the PBI. A child that contradicts the use case goes back to
  `adding-backlog-items`; it is not fixed here.
- It writes **no source code** and it never executes. Executing is always a separate
  session the user starts by pasting the prompt.
- The plan it writes is a **pointer**, never a second copy of the work. Detail in the plan
  is detail that can contradict the note it came from.

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
file and the assertion, the risk worth naming — and commits it. The plan and the prompt that
follow are both short: read these notes, in this order, and execute.

This is what makes both durable. A plan or a prompt carrying the detail inline is a snapshot
that rots the moment a note changes; one that points is correct for as long as the notes
are. That property is what the saved note's `Risks` section states out loud, and it is the
reason the plan is allowed to exist at all — a **thin** second copy of the order can be
regenerated from the ranks; a thick one becomes an authority that disagrees with the
register.

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

**The cycle is stated once, in the prompt, never per child** — red, green, **`npm run
check`, then commit**. That order is not a preference: root `CLAUDE.md` requires all five
steps to pass *before* committing, so a commit taken first is an unverified commit that
costs a cleanup commit or a rewrite when lint, coverage, fallow or the docs register
refuses it. Copied into every note the cycle drifts. What *is* per child is the specific: which test file, which assertion, which
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
2. Write the pointer plan.
3. Ask the save question.
4. Write the `Task` note if the answer is yes.
5. Run `npm run docs` and fix what it reports.
6. Commit the notes and the plan alone. No push, no pull request.
7. Print the prompt.

### The prompt

Fenced, and nothing else in the block:

- read root `CLAUDE.md`, the layer guides for the layers touched, and `test/CLAUDE.md`
- read `docs/requirements/<Title>.md`, then its children **by path, in rank order** — a
  saved handoff `Task` is **not** among them (below)
- read every non-child output **by path**, each marked subagent's or human's
- execute with `superpowers:subagent-driven-development` against
  `docs/superpowers/plans/<file>.md`, whose every task points at one of those notes
- red, green, `npm run check`, then commit — all five steps pass before the commit, never after
- do not re-open the PBI — a child that contradicts it goes back to `adding-backlog-items`

Naming the non-child outputs is not decoration, for the same reason `decompose-pbi`'s
handoff names them: a `Test case`, its `Test suite` and an ADR are unreachable from the
PBI's children, so a prompt naming only those hands the executor a picture missing exactly
the verification and the decision the sweep established were needed.

### The save offer

A question with no default, asked once: save this prompt as a `Task` under the PBI for a
later run?

The saved note is a `Task` child of the PBI, and that makes it a sibling of the work it
executes. **It is never itself dispatched.** A prompt that says "one task per child" and a
note that is both a child and the prompt is a self-reference: the executor's last dispatch
would be an implementer told to run the prompt it is already running. Two things keep that
shut, and both are needed because they fail differently:

- **The prompt enumerates the children it executes by path.** A path list cannot pick up a
  note written after it, so the saved note is outside the set by construction.
- **The saved note says so in its own first line** — *this note is the handoff, not a task
  to implement.* That is what a later run catches, since a rerun re-derives the children
  from `parent` and would otherwise find it there.

Its own `Outcome` is what closes it: the note is done when the run it handed off is done,
which is the same condition as its `Acceptance criteria` below.

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
- The plan carries execution detail instead of pointing at the note that holds it.
- A `## Task N` was numbered from a note's `order` rather than from its dispatch position.
- A live-vault `Test case` was written into the plan as a task.
- A child was re-scoped to fit the order, instead of the order being corrected.
- The saved handoff `Task` appears in the set of children the prompt executes.
- The prompt puts the commit before `npm run check`.
- You wrote a note before phase 3 to keep track.
- You started writing source code.
