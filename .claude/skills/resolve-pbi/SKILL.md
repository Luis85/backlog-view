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
- A PBI with **no outputs at all** has not been decomposed. Stop and send the user to
  `decompose-pbi` — there is nothing here to make executable. **Children are not the test,
  and phase 0 is where it is applied**: a decomposition can produce a `Test case`, its
  `Test suite` and an ADR and no child at all, and each of those is an output this skill
  has work to do on. So the refusal waits for both of phase 0's searches. Refusing on an
  empty `parent` search alone sends back a PBI that was decomposed, into the skill that
  would decompose it a second time.
- A note that is **not a `PBI`** is refused as `decompose-pbi` refuses one: an `Epic` or a
  `Feature` holds requirements, not Tasks. Say which note is wanted instead.
- `subagent-driven-development` is what the printed prompt invokes, in a **different
  session**. This skill never executes, and never writes source code.

## What this produces

Three outputs:

- Edits to the outputs — the children, so each carries what an implementer subagent needs,
  and the non-child prose this run's close repairs.
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

**The second search returns candidates, not outputs.** A link is not evidence of
parentage, and most of the register's links are not: a limitation note names the PBI whose
property it cannot migrate, a sibling use case names the rule it rests on, a plan cites the
one it argued from. `decompose-pbi`'s close is what separates them — every output it writes
names the PBI as a `[[wikilink]]` **in the sentence saying what produced it**, the
`Evidence` section of a `Task` and the first paragraph of everything else. A candidate whose
only mention of the PBI sits anywhere else is an unrelated note, and it is left alone. The
failure this prevents is not a wasted read: an unrelated note taken for an output is
assigned an owner, given a task and closed by a run that had no business touching it.

Report back its actor, its trigger, its preconditions, its guarantee, its main flow, its
extensions, its acceptance criteria and its `## Where it lives`, name every output found,
and ask whether this is still what is being built. A child whose work already landed is
named as such rather than resolved again.

**Exit when** the user confirms the decomposition as read, and every output found is named
as still owed or as already done. A PBI both searches return nothing for is the refusal
above, and it is refused here rather than before the searches ran.

## Phase 1 — the order

`order` is a rank, not a dependency graph. Walk the children in rank against the Feature's
`## Landmines` from phase 0.

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

**Whose an output is comes first, and the rows follow from it.** The table below asks for a
failing test, a coverage move, the files and what would refuse the work — questions about
work somebody is going to do. An `Idea` and an open-question `Issue` are the human's, and a
run that asked them for a failing test would either stall or invent one. So settle ownership
by the table under *Not every child is executable*, then ask these rows of the outputs the
subagent will execute. The human's are named, and the phase exits on them being named rather
than on them being executable — and the two the decomposition already wrote are named the
same way, since neither is work anybody is about to do.

**And the rows are engineering questions, so they reach the code-bearing outputs only.** The
same split the cycle already uses holds here: a decision-or-limitation `Issue`, a
subagent-owned `Deliverable`, an ADR and a `Test suite` are prose, with no behaviour to make
fail, no coverage to move and no lint rule to refuse them. A `Deliverable` is on that list by
definition rather than by inspection — `decompose-pbi` types a **non-code artifact** as one,
so a code-bearing Deliverable is not a case that arises. Asking those four rows of any of
them stalls the phase or invents engineering detail for a record that has none. What a prose
output is asked is what it can answer — what produced it, what it must say, and what would
make it wrong — and `docs/adrs/README.md`'s five things are that question for an ADR.

The red-green-`npm run check`-commit cycle belongs once, in the plan's Global Constraints —
never copied into a child's `Approach`. What a child's row states is the specific: which
test file, which assertion, which threshold.

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

**Every answer lands in the note, and four of the rows do not say where.** `Evidence`,
`Approach`, `Acceptance criteria` and `Risks` name a section of the `Task` shape. The paths
have a home of their own: `files` is a frontmatter key the register gives to a `Task`, an
`Issue` and a `Bug` — the same three shapes the subagent owns — so the answer to the files
row goes there rather than into prose, and a reader lands in the code from the note's head.
The other three name nothing: the failing test, the coverage move and what would refuse the
work all belong with the steps that carry them out — the `Approach` in a `Task`.

**The rows are named for a `Task`, and the subagent owns two other shapes.** A `Bug` is
*What happened · Fix · Lesson*; a decision-or-limitation `Issue` has its own headings again.
Neither has an `Approach`, so the answers go to whichever of its sections says how the work
will be done, and `docs/README.md` is where that shape is written. Ask each row of the
children it applies to — the engineering four of the code-bearing ones, as the rule above
says — and write every answer into a section that child's own type already has. Inventing a
heading to hold it is a shape the register does not document — `decompose-pbi`'s own red
flag, one skill upstream.

**Some types have no documented shape, and that is a question rather than a licence.** The
register's shape table covers a `Task`, an `Issue`, a `Bug` and a `Test case`; an
`Improvement` and a `Deliverable` are legal children with no row in it and no note in
`docs/` to read as precedent. So there is no section to write into and none to invent:
phase 2 asks what shape the note takes, which is the ask `decompose-pbi` already makes for
the same two types. An unanswered shape blocks that output, and the readback says so.

**The question is only worth asking of an output this run will write.** A `Deliverable` the
table assigns to the human is named and left alone like every other human-owned output — a
run that stalled over the shape of an artifact it was never going to produce would block on
work nobody asked it to do. Every rule in this phase reads the same way: it applies to what
the subagent will write, and the human's outputs need a name and an owner and nothing
else.

The failing-test row is the specific assertion, never "add tests". Where the child's whole
deliverable is an invariant, root `CLAUDE.md`'s rule applies and belongs in the `Approach`:
the test is **watched failing** — revert the fix, run it, see red, restore.

The "what would refuse it" row is the clean-code gate asked before the work rather than at
lint time. A child that cannot land without splitting a file over the cap says so as a step
in its `Approach`, not as a surprise for the implementer.

### Not every child is executable

The same pass assigns **every output — child or not — to the subagent, to the human, or to
this run's own close**. Assigning only the non-child outputs would send an intentionally
unanswerable note through the TDD loop, because `decompose-pbi` deliberately produces
children that are not implementable:

| Output | Whose | Why |
| --- | --- | --- |
| A `Task` | The subagent's | It is engineering work with a test |
| A `Task` whose **first line declares it a handoff** | Nobody's | It is an earlier run's prompt, not work. This run's own handoff supersedes it, so it is named as superseded and given no task |
| An `Issue` holding an **open question** | The human's | The work cannot settle it; that is why it is an Issue |
| An `Issue` recording a **decision or a limitation** | The subagent's | It is prose stating something already settled |
| A `Bug` | The subagent's | A defect with a fix and a test, and `docs/README.md` gives it a shape — the same work a `Task` is |
| An `Improvement` | The subagent's | Engineering work like a `Task`, but the register gives it no `closed:` key — the closing rule says how |
| An `Idea` | The human's | A proposal nobody has committed to. Implementing an Idea decides it, which is not this run's call |
| A `Deliverable` | Ask | A non-code artifact may be either, and the register documents no shape for it |
| An ADR *(not a child)* | This run's close | `decompose-pbi` already wrote it. Phase 2 reads the five things `docs/adrs/README.md` wants; whatever is missing is supplied here and written at step 1, never dispatched |
| A `Test suite` *(not a child)* | This run's close | `decompose-pbi` already wrote it too — prose saying what the group walks, checking nothing itself. Repaired here if phase 2 finds it thin. Written, never closed — it stays `Open` while its cases are re-walked |
| A `Test case` *(not a child)* | The human's | A live vault, which no subagent reaches — Obsidian cannot run here |

**Every type the register lets a PBI hold has a row.** `docs/README.md`'s hierarchy table,
the `PBI` row, is that list — read it there rather than here. Phase 2 cannot exit until
each output is assigned, so a type with no row is a phase that cannot close over a legal
decomposition.

**The third bucket is narrow, and those two rows are the whole of it.** An ADR and a
`Test suite` are the two outputs `decompose-pbi` writes *complete* at decomposition — the
ADR under `docs/adrs/README.md`'s conventions with its index entry, the suite as the
shortest of the ones already in `docs/tests/suites/`. Neither is work owed to anybody, so
neither is the subagent's: phase 2 reads them, and whatever they still need is written by
this skill at close step 1, beside the children's edits. Both are named in the plan's header
as already written and **neither gets a `## Task N`**. A pointer task at a note whose prose
is already on disk hands an implementer nothing to do, and an implementer with nothing to do
writes something.

The human's outputs are **named in the plan's header, never given a task**. They are still
part of the picture — the prompt reads them as context, and the readback shows the split —
but the run does not pretend to deliver them.

An open question that *must* be answered before the work can start is not deferred by this
table: it is a phase 2 question to the user, and it either gets an answer that turns the
Issue into work or it blocks the run. Say which, out loud, rather than letting it ride.

**An ADR is checked, not assumed.** `decompose-pbi` asks for the context, the option taken,
what each rejected option cost, what got harder and what would revisit it before it writes
the record — but an older decomposition may not have, and `npm run docs` cannot tell:
`docs/README.md` says the gate sees whether a heading is present and never whether the
paragraph under it says anything. So phase 2 opens the record and reads the five. Empty
headings under a passing gate are the failure, and what follows is the shape question's own
sequence: ask the user for what is missing, write the answers into the record at close step 1,
and — where the answers do not come — block the output and say so in the readback. Writing the
five from what the code seems to imply is the failure this replaces; the ADR records a
decision somebody took, and nobody here took it.

**Exit when** every child is either "executable as written" or has an answer to write into
it, **every output, child or not, is assigned** to the subagent, to the human or to this
run's close, and **nothing is left blocked**. Blocked is a real state this phase can reach —
a shape the register does not document and nobody has settled, an ADR whose five headings are
empty, an open question the work cannot start without — and it belongs to non-child outputs
as much as to children, which the first clause alone does not reach. A blocked output gets
neither a task nor a repair: the plan omits it, its header names it as blocked, and the
readback says which and why. The gate does not pass on the strength of an owner alone.

## Phase 3 — the readback gate

Read the ordered set back: each output with its rank, **whose it is**, and one sentence of
what gets delivered — the subagent's as the task it becomes, the human's as the thing the
run will not do, this run's close's as what it repairs before committing — plus what you are
still assuming.

**Exit when** the user has answered. The readback is a question, not an announcement — a
mistaken order or a misread deliverable is caught here or not at all.

## The close

**The no-work path leaves at step 1.** When the filter left no task — every output already
landed, or every remaining one the human's — steps 2, 3, 4 and 7 do not happen: no plan, no
save question, no prompt. Asking whether to save "this prompt" when there is no prompt would
write a handoff `Task` whose `Approach` points at a plan nobody created. Every output's edits
from phase 1 and 2 are still written, and steps 5 and 6 run **only if there were any**: a run
that found the remainder executable as written leaves the tree clean, and an empty commit is
not how that is reported. The close says what remains and whose it is either way. Everything
below assumes there is work.

Otherwise, in this order, so the work lands in one commit and the prompt is the last thing on
screen to copy:

1. Write every refined output's edits — the children, and the non-child outputs phase 2
   repaired: an ADR whose five things were supplied, a `Test suite` phase 2 found thin. The
   plan and the prompt only point at those notes; nothing carries the phase's conversation,
   so an edit left unwritten is an edit the implementer never sees. **This step is the only
   place those two are written**, since neither is dispatched — an ADR closes at
   `status: Accepted` with no `closed:` and no `## Outcome`, and a `Test suite` stays `Open`
   because it is a container for cases re-walked at each release.
2. Write the pointer plan.
3. Ask the save question.
4. Write the `Task` note if the answer is yes.
5. Run `npm run check` and fix what it reports.
6. Commit the notes and the plan alone. No push, no pull request.
7. Print the prompt.

Step 5 is the full gate, not one step of it: the diff is markdown, so **two** of the six read
it — the register step, and `lint:md`, which is what refuses a table whose cells outnumber its
header (ADR 0032). Root
`CLAUDE.md` states the rule unconditionally in any case, and a skill that carves its own
exception is where exceptions start.

**Nothing here closes the PBI, and neither does the run the prompt starts.** Every output
reaching `Done` is a different claim from the use case's guarantee holding: acceptance
criteria are read against the flow a person walks, and a PBI whose verification is a
`Test case` cannot be judged by anything that never opened Obsidian. So the PBI keeps
`status: Open` through both sessions and the human closes it after the walk — deliberately,
not by omission. Flipping it on the strength of its children being closed reports a
verification nobody performed, which is the same defect as closing a `Test suite`.

### The pointer plan

`subagent-driven-development` cannot consume child notes. Its three scripts each take a
`PLAN_FILE` and exit 2 without one, and `task-brief` finds a task by its `## Task N`
heading **inside that file** — the heading format is load-bearing, and the script owns how it
matches. A plan beside an already-ranked set of children
is a second copy of that order that can disagree with the register — a real cost — but it is
paid because there is no other artifact those scripts will run against.

The plan is written as thin as the tooling allows:

- The header `writing-plans` requires — goal, architecture, and a **Global Constraints**
  section.
- **One `## Task N` per child that is the subagent's *and* still owed**, in rank order, each
  naming the note's path and saying to read it. `N` is the dispatch index, not the note's
  `order` — ranks carry gaps, and `task-brief` matches on the integer it is given, so the
  indices are consecutive from 1 over the tasks that survive the filter.
- **Every task is a child, so every task carries a rank.** The only outputs with no `order`
  are the ADR and the `Test suite`, and phase 2 assigns both to this run's close rather than
  to the subagent — so there is no rankless work to interleave and the sequence is the
  children's own. Both are named in the header instead, as already written.
- Everything filtered out is **named in the header** with its reason — the human's outputs
  as what this run will not deliver, the landed ones as already done, the ADR and the suite
  as prose the decomposition wrote and this close repaired.
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
note. That is the section `subagent-driven-development` hands to every implementer, which
is why the header cannot be skipped — and why each pointer task names it again, for a reason
the close gives below.

**The cycle is for the tasks that write code.** A decision-or-limitation `Issue` and a
subagent-owned `Deliverable` are prose, with no behaviour to make fail first, so they run
write, `npm run check`, commit — same gate, same commit discipline, no red step. Those two
are the whole prose list here, because they are the only prose outputs that reach a task: an
ADR and a `Test suite` are prose too, and phase 2 assigns both to this run's close instead.
Global Constraints states which cycle each kind of output takes: a brief demanding red-green
from prose is unsatisfiable, and an implementer handed an impossible instruction invents a
test to satisfy it. A `Deliverable` is the one that has been left out of such a list before —
its shape is settled per run rather than by the register, which reads as a reason to say
nothing about it and is not one.

**Closing the note is part of a task's definition of done**, in the same commit as the work:
`## Outcome` written, `status: Done`, `closed:` dated. That shape is the backlog's, and it
does not fit every output. An `Issue` and a `Deliverable` close by
their own documented shapes: an Issue's two shapes carry no `## Outcome`, a Deliverable's
shape is whatever `decompose-pbi` agreed with the user, and the register gives a Deliverable
no `closed:` key at all. A `Bug` closes with `status: Done` and `closed:` dated like a Task,
but its shape is `What happened` · `Fix` · `Lesson` — no `## Outcome`. An `Improvement`
closes with `status: Done` and by the shape phase 2 agreed for it — an `## Outcome` only if
that shape has one, since the register documents none and inventing the heading here would
undo the asking. It takes no `closed:` key either way: the register limits `created`/`closed`
to Tasks, Issues and Bugs. **The ADR's shape and the `Test suite`'s are not stated here** —
no task touches either, so a constraint describing how to close them would be a rule reaching
implementers who cannot act on it, and this skill's own close is where they are written and
where the two rules live. The PBI is not stated here either, and for the stronger reason: it
is not closed at all.

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
Without the two paragraphs above, every note a task dispatched stays `Open` with its
`## Outcome` unwritten. Only those: the outputs no task reaches are this run's own close's
or the human's, and neither is the executor's to finish.

### The prompt

Fenced, and nothing else in the block. The bullet that closes the saved handoff belongs in
the block only when a handoff was saved — omit it otherwise:

- read root `CLAUDE.md`, the layer guides for the layers touched, and `test/CLAUDE.md` — the
  plan repeats this where it travels, since a fresh implementer never sees this prompt
- read `docs/requirements/<Title>.md`, then its children **by path, in rank order** — a
  saved handoff `Task` is **not** among them
- read every non-child output **by path**, each marked as the human's or as prose already
  written — the ADR and the `Test suite` are context to write against, not work
- execute with `superpowers:subagent-driven-development` against
  `docs/superpowers/plans/<file>.md`, whose every task points at one of those notes
- for a task that writes code: red, green, `npm run check`, then commit — every step passes
  before the commit, never after. For a prose task — a decision-or-limitation `Issue`, a
  `Deliverable` — write, `npm run check`, commit: same gate, no red step, because there is no
  behaviour to make fail first
- close each note **a plan task dispatched you to**, in the shape its type owes, as Global
  Constraints states — and nothing else. The notes two bullets up are context: an ADR and a
  `Test suite` are already written, a suite stays `Open` because its cases are re-walked at
  each release, and a `Test case` is a walk in a live vault nobody in this run can perform.
  Closing one of those reports a verification that did not happen
- when every task is through, close the saved handoff `Task` the same way, then
  `npm run check` and commit — nothing else will, since it is not dispatched
- do not re-open the PBI — a child that contradicts it goes back to `adding-backlog-items` —
  and do not close it either: whether its guarantee holds is a walk only the human makes

The non-child outputs are named for the same reason `decompose-pbi`'s own handoff names
them: a `Test case`, its `Test suite` and an ADR are unreachable from the PBI's children, so
a prompt naming only those hands the executor a picture missing exactly the verification and
the decision the sweep established were needed.

### The save offer

A question with no default, asked once: save this prompt as a `Task` under the PBI for a
later run?

The saved note is a `Task` child of the PBI, which makes it a sibling of the work it
executes, and **it is never itself dispatched.** Two guards keep that shut, needed because
they fail differently: the plan and the prompt enumerate the outputs they run **by path**,
so a note written afterwards is outside the set by construction; and the saved note says so
in its own first line — *this note is the handoff, not a task to implement* — which is the
line a later rerun reads when it re-derives children from `parent`.

**That first line is a marker, and the ownership table is what acts on it.** A rerun finds
the note as an ordinary `Task` child, and the row above sends every `Task` to the subagent —
so without the row that reads the marker, the first guard fails exactly where it was meant to
hold: the path list is a fresh one, built from this rerun's own children, and it names the
saved note because the note is one of them. The rerun's last dispatch would then be an
implementer told to run the prompt it is already running. The marker's effect is that row,
not the sentence itself.

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

## Red flags — stop and go back

- A phase's exit gate asks for less than that phase's walk covered.
- A note that merely mentions the PBI was taken for an output of its decomposition, because
  the `[[wikilink]]` search found it.
- A PBI was sent back to `decompose-pbi` for having no children, when its decomposition
  produced only outputs that carry no `parent`.
- A child went unmentioned in phase 2 because it "obviously fits".
- The prompt paraphrases a rule that lives in a guide.
- Execution detail went into the prompt instead of the note.
- The plan carries execution detail instead of pointing at the note that holds it.
- A `## Task N` was numbered from a note's `order` rather than from its dispatch position.
- A live-vault `Test case` was written into the plan as a task.
- An `Issue` holding an open question was given a `## Task N`.
- An output was left unassigned because it is a child and children are "obviously" the
  subagent's.
- A legal child type reached phase 2 with no row in the ownership table.
- The close committed on `npm run docs` alone.
- A rule that every implementer needs was written into the prompt alone, where only the
  controller reads it.
- The plan gave a task to an output the human owns, or to one phase 0 found already landed.
- A run finished with an output left `Open` that its type says should close, or with an
  `## Outcome` unwritten on an output whose shape has one. A `Test suite` staying `Open` is
  the rule, not this flag — the flag below is the one that watches it.
- An edit phase 2 agreed was never written, so the implementer read the note unchanged.
- An ADR this close repaired was left without `status: Accepted`, or given a `closed:` key
  or an `## Outcome` the record does not have.
- A prose-only task was given a red-green cycle it cannot satisfy.
- A `Test suite` was closed because its prose was written.
- The prompt told the executor to "close each output", so a note no task dispatched — a
  human's `Test case`, an already-written ADR or suite — was in scope for closing.
- An ADR or a `Test suite` was given a `## Task N`, though `decompose-pbi` wrote it at
  decomposition and the task would hand an implementer nothing to do.
- The prompt told a run to close a handoff the user declined to save.
- The controller's own close was left in the working tree, with no gate and no commit.
- An empty plan was written, and a prompt printed, for a PBI with no work left in it.
- The save question was asked on a run that produced no prompt to save.
- An `Issue` or a `Deliverable` was closed with an `## Outcome` its shape does not have.
- A `Deliverable` gained a `closed:` key the register does not give it.
- The prompt told every task to run red-green, including the prose ones.
- A subagent-owned `Deliverable` went unnamed in the prose list, so a non-code artifact was
  left to a cycle that asks it for a failing test.
- A rerun overwrote the earlier plan at the same path, inheriting its ledger.
- A saved handoff promised to close siblings the run was never going to touch.
- A child was re-scoped to fit the order, instead of the order being corrected.
- The saved handoff `Task` appears in the set of outputs the prompt executes.
- An earlier run's saved handoff was given a `## Task N` on a rerun, because the ownership
  table sends every `Task` to the subagent.
- The prompt puts the commit before `npm run check`.
- The PBI was closed because its children were, or because the run reached the end.
- The no-work path took an empty commit to have something to show for itself.
- You wrote a note before phase 3 to keep track.
- You started writing source code.

All of these mean: the sweep is not finished. Go back to the phase you left.
