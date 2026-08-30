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

Report back its actor, its trigger, its preconditions, its guarantee, its main flow, its
extensions, its acceptance criteria and its `## Where it lives`, name every output found,
and ask whether this is still what is being built. A child whose work already landed is
named as such rather than resolved again.

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

## The close

**The no-work path leaves at step 1.** When the filter left no task — every output already
landed, or every remaining one the human's — steps 2, 3, 4 and 7 do not happen: no plan, no
save question, no prompt. Asking whether to save "this prompt" when there is no prompt would
write a handoff `Task` whose `Approach` points at a plan nobody created. The children's edits
from phase 1 and 2 are still written and committed, and the close says what remains and
whose it is.

Otherwise, in this order, so the work lands in one commit and the prompt is the last thing on
screen to copy:

1. Write the children's edits.
2. Write the pointer plan.
3. Ask the save question.
4. Write the `Task` note if the answer is yes.
5. Run `npm run check` and fix what it reports.
6. Commit the notes and the plan alone. No push, no pull request.
7. Print the prompt.

Step 5 is the full gate, not `npm run docs` alone: the diff is markdown, so the register step
is realistically the only one of the five with anything to say about it, but root
`CLAUDE.md` states the rule unconditionally, and a skill that carves its own exception is
where exceptions start.

### The pointer plan

`subagent-driven-development` cannot consume child notes. Its three scripts each take a
`PLAN_FILE` and exit 2 without one, and `task-brief` extracts a task by matching
`^#+[ \t]+Task[ \t]+N` **inside that file**. A plan beside an already-ranked set of children
is a second copy of that order that can disagree with the register — a real cost — but it is
paid because there is no other artifact those scripts will run against.

The plan is written as thin as the tooling allows:

- The header `writing-plans` requires — goal, architecture, and a **Global Constraints**
  section.
- **One `## Task N` per output that is the subagent's *and* still owed**, child or not, in
  rank order, each naming the note's path and saying to read it. `N` is the dispatch index,
  not the note's `order` — ranks carry gaps, and `task-brief` matches on the integer it is
  given, so the indices are consecutive from 1 over the tasks that survive the filter.
- **An output that carries no rank runs first.** An ADR has no `order`, and a new
  `Test suite` is ranked among the roots rather than among the PBI's children, so neither
  has a position in the children's sequence. Both are context the ranked work rests on, so
  they take the low task numbers, in the order phase 2 named them, and the ranked children
  follow.
- Everything filtered out is **named in the header** with its reason — the human's outputs
  as what this run will not deliver, the landed ones as already done.
- Nothing else. No steps, no code blocks, no acceptance criteria.

**A plan with no tasks is not written at all.** Both filters can empty it, and `task-brief`
exits when the `## Task N` heading it asks for is absent, so a run with no work left reads
that back at phase 3 and closes without a plan or a prompt.

**A rerun writes a plan under a new identity.** `subagent-driven-development` keys its
workspace and its ledger by the plan's basename and trusts every `Task N: complete` entry in
it, so a second run landing on the same dated path would renumber the survivors and let a
stale entry mark a different task done. A rerun that finds a plan already at its path writes
a distinct basename instead.

This is not `writing-plans` — that skill decides granularity, file layout and TDD steps; here
all three already live in the register. And it costs a source of truth: SDD wants exact
values only in the task brief, and a pointer brief holds none — it names the note that does.
The single source of requirements moves to the note the brief names, and the brief says so in
those words.

**What every implementer must be handed.** Naming a rule in the printed prompt reaches the
**controller** and stops there: `task-brief` extracts from a `## Task N` heading onward, and
`subagent-driven-development` dispatches each fresh implementer with that brief plus context
the controller constructs — never the prompt. A rule that lives only in the prompt reaches
nobody who writes code. So the plan's **Global Constraints** carries what every task shares:
root `CLAUDE.md`, `test/CLAUDE.md`, `superpowers:test-driven-development`, the
red-green-`npm run check`-commit cycle, the `[Unreleased]` changelog rule, and closing the
note.

**The cycle is for the tasks that write code.** A decision-or-limitation `Issue`, an ADR and
a `Test suite` are prose, with no behaviour to make fail first, so they run write,
`npm run check`, commit — same gate, same commit discipline, no red step. Global Constraints
states which cycle each kind of output takes: a brief demanding red-green from prose is
unsatisfiable, and an implementer handed an impossible instruction invents a test to satisfy
it.

**Closing the note is part of a task's definition of done**, in the same commit as the work:
`## Outcome` written, `status: Done`, `closed:` dated. That shape is the backlog's, and it
does not fit every output. An ADR takes `status: Accepted` with no `closed:` and no
`## Outcome` — `docs/adrs/README.md` gives it neither. An `Issue` and a `Deliverable` close by
their own documented shapes: an Issue's two shapes carry no `## Outcome`, a Deliverable's
shape is whatever `decompose-pbi` agreed with the user, and the register gives a Deliverable
no `closed:` key at all. A `Test suite` is **written but never closed** — every suite in
`docs/tests/suites/` is `Open`, because it is a container for cases re-walked at each
release, and closing one reports a verification nobody ran.

**Each pointer task** names the layer guide for the layer it touches — `src/domain/CLAUDE.md`,
`src/storage/CLAUDE.md`, `src/view/CLAUDE.md` — beside the note path, **and names the plan's
own `## Global Constraints` by path as required reading**. In Global Constraints all three
guides would reach every implementer; in the task it is the one that binds. The
back-reference is belt and braces against an ambiguity in `subagent-driven-development`
itself, whose numbered dispatch contract omits Global Constraints while the paragraph below
it requires them — the pointer in the task closes the gap either way, since `task-brief`
extracts the task and nothing above it.

Closure has to be said here at all because `subagent-driven-development`'s own completion
record is its ledger, under a gitignored `.superpowers/` that never reaches the register.
Without the two paragraphs above, every child stays `Open` with its `## Outcome` unwritten.

### The prompt

Fenced, and nothing else in the block:

- read root `CLAUDE.md`, the layer guides for the layers touched, and `test/CLAUDE.md` — the
  plan repeats this where it travels, since a fresh implementer never sees this prompt
- read `docs/requirements/<Title>.md`, then its children **by path, in rank order** — a
  saved handoff `Task` is **not** among them
- read every non-child output **by path**, each marked subagent's or human's
- execute with `superpowers:subagent-driven-development` against
  `docs/superpowers/plans/<file>.md`, whose every task points at one of those notes
- for a task that writes code: red, green, `npm run check`, then commit — all five steps pass
  before the commit, never after. For a prose task — a decision-or-limitation `Issue`, an
  ADR, a `Test suite` — write, `npm run check`, commit: same gate, no red step, because there
  is no behaviour to make fail first
- close each child as its task lands: `## Outcome`, `status: Done`, `closed:` — an ADR
  instead reaches `status: Accepted`, since it carries neither of the other two
- *(only when a handoff was saved)* when every task is through, close the saved handoff
  `Task` the same way, then `npm run check` and commit — nothing else will, since it is not
  dispatched
- do not re-open the PBI — a child that contradicts it goes back to `adding-backlog-items`

The non-child outputs are named for the same reason `decompose-pbi`'s own handoff names
them: a `Test case`, its `Test suite` and an ADR are unreachable from the PBI's children, so
a prompt naming only those hands the executor a picture missing exactly the verification and
the decision the sweep established were needed.

### The save offer

A question with no default, asked once: save this prompt as a `Task` under the PBI for a
later run?

The saved note is a `Task` child of the PBI, which makes it a sibling of the work it
executes, and **it is never itself dispatched.** Two guards keep that shut, needed because
they fail differently: the plan and the prompt enumerate the children they run **by path**,
so a note written afterwards is outside the set by construction; and the saved note says so
in its own first line — *this note is the handoff, not a task to implement* — which is what a
later rerun catches when it re-derives children from `parent`.

On yes, one note at the next free rank among the PBI's children, in the `Task` shape
`docs/README.md` already documents — no invented shape:

| Section | What it holds |
| --- | --- |
| Evidence | This refinement pass and the decomposition behind it, naming the PBI as a `[[wikilink]]` |
| Why it matters | It is the execution handoff; without it a later session re-derives the order |
| Approach | The fenced prompt, verbatim |
| Acceptance criteria | Every sibling the run **executes** closed, and `npm run check` green — naming the human's siblings as what it deliberately does not cover |
| Risks | **The prompt is a pointer, not a snapshot** — a later run re-reads the notes it names rather than trusting anything it summarises |
| Outcome | Written after the run, like any Task |
