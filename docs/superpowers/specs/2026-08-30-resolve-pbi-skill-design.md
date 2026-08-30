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
  section, which carries the reading and the cycle for every task (below).
- **One `## Task N` per output that is the subagent's *and* still owed**, child or not, in
  rank order — each naming the note's path and saying to read it. That is the whole
  generation rule: an output the human owns and an output phase 0 found already landed each
  get no task. **`N` is the dispatch index, not the note's `order`** — ranks carry gaps and
  `task-brief` matches on the integer it is given, so the indices are consecutive from 1
  over the tasks that survive the filter.
- **An output that carries no rank runs first.** An ADR has no `order` by design, and a new
  `Test suite` is ranked in the roots' namespace rather than among the PBI's children, so
  neither has a position in the sequence the children are in. Both are context the ranked
  work rests on — an ADR states the decision the code is written against, a suite has to
  exist before a case can hang from it — so they take the low task numbers, in the order
  phase 2 named them, and the ranked children follow. Interleaving them by a rank they do
  not share is the failure this rule prevents.
- Everything filtered out is **named in the header** with the reason — the human's outputs
  as what this run will not deliver, the landed ones as already done. Named, because a plan
  that silently omits them reads as a decomposition someone forgot half of; not tasked,
  because a `Test case` is a live vault, an open-question `Issue` is a question the work
  cannot answer, and re-dispatching landed work is how a partially implemented PBI gets
  built twice.
- Nothing else. No steps, no code blocks, no acceptance criteria.

**A plan with no tasks is not written.** Both filters can empty it — every child already
landed, or every remaining output the human's — and a plan with no `## Task N` heading is
one `subagent-driven-development` cannot run: `task-brief` exits when the heading it asks
for is absent. So when the filter leaves nothing, phase 3 reads back a run with no work in
it and the close writes no plan and prints no prompt. It says which outputs remain and whose
they are, which is the honest answer for a PBI that is finished, or one whose remainder is a
question only a person can settle. That is a real state, not an error, and a decomposition
that reaches it deserves to be told so rather than handed an empty plan.

**This is not `writing-plans`.** That skill decides granularity, file layout and TDD steps;
here all three already live in the register, and the plan is generated mechanically from the
ranks in the same pass that fixed them.

### What every implementer must be handed

Naming the guides in the copy+paste prompt reaches the **controller** and stops there.
`task-brief` extracts from a `## Task N` heading onward, and `subagent-driven-development`
dispatches each fresh implementer with that brief plus context the controller constructs —
never the prompt. A rule that lives only in the prompt reaches nobody who writes code.

So the reading is placed where it actually travels, in two halves:

- **Global Constraints** carries what every task shares: root `CLAUDE.md`, `test/CLAUDE.md`,
  `superpowers:test-driven-development`, the red-green-`npm run check`-commit cycle, and the
  `[Unreleased]` changelog rule. `subagent-driven-development` passes that section into
  every dispatch, which is exactly why the header cannot be skipped.
- **Each pointer task** names the layer guide for the layer *it* touches —
  `src/domain/CLAUDE.md`, `src/storage/CLAUDE.md`, `src/view/CLAUDE.md` — beside the note
  path. A layer guide in Global Constraints would hand every implementer all three; in the
  task it is the one that binds.

### Closing what the run finishes

A run that implements a child and leaves its note open has not finished it. The register's
own vocabulary is what "closed" means: `status: Done`, a `closed:` date, and the `## Outcome`
paragraph `docs/README.md` reserves for after the work — *what actually happened, including
what the task did not anticipate*, which is the most valuable paragraph in the folder and
the one nobody writes from memory a week later.

Nothing in `subagent-driven-development` does this. Its completion record is the SDD ledger,
which lives under a gitignored `.superpowers/` and never reaches the register. So the plan
says it in the two places that travel:

- **Global Constraints**: closing the note is part of a task's definition of done, in the
  same commit as the work — `## Outcome` written, `status: Done`, `closed:` dated.
  **That shape is the backlog's, and an ADR is not a backlog item.** `docs/adrs/README.md`
  gives it `adr`, `title`, `status`, `date` and `area`, where `status` is `Accepted`,
  `Proposed` or `Superseded` and there is no `closed:` and no `## Outcome` — so an ADR task
  is done when the record is written and its status is `Accepted`, and writing `Done` there
  is a value the register does not have. The constraint says both shapes and which output
  takes which, because a task told to do the impossible does the nearest thing instead.
- **The prompt's last step**, controller-owned rather than a task: once every task is
  through, close the saved handoff `Task` the same way, **then run `npm run check` and
  commit it**. It is excluded from dispatch, so no task's own cycle covers this write, and
  a close left in the working tree is a close that never happened. Its `Acceptance criteria`
  is then a thing a reader can check rather than a sentence that can never come true —
  provided it is written about the siblings the run **executes**. "Every sibling closed"
  cannot be satisfied while an open-question `Issue` sits beside them by design, so the
  criterion names the executed set and names the human's siblings as what it does not cover.
  A criterion nobody can ever tick reads as unfinished work forever.

  **This step exists only when a handoff was saved.** The save offer is a question with a
  real "no", and the prompt is generated after it is answered, so a run that declined one
  gets a prompt without this bullet — not a bullet naming a note that was never written.

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

### Not every child is executable

The same pass assigns **every output — child or not — to the subagent or to the human**, and
that assignment decides which get a `## Task N` in the plan. Assigning only the non-child
outputs would send an intentionally unanswerable note through the TDD loop, because
`decompose-pbi` deliberately produces children that are not implementable:

| Output | Whose | Why |
| --- | --- | --- |
| A `Task` | The subagent's | It is engineering work with a test |
| An `Issue` holding an **open question** | The human's | The work cannot settle it; that is why it is an Issue |
| An `Issue` recording a **decision or a limitation** | The subagent's | It is prose stating something already settled |
| A `Deliverable` | Ask | A non-code artifact may be either, and the register documents no shape for it |
| An ADR *(not a child)* | The subagent's | Prose it can write, once phase 2 has the five things `docs/adrs/README.md` wants |
| A `Test suite` *(not a child)* | The subagent's | Prose saying what the group walks; it checks nothing itself, and it must exist before a case can hang from it |
| A `Test case` *(not a child)* | The human's | A live vault, which no subagent reaches — Obsidian cannot run here |

The human's outputs are **named in the plan's header, never given a task**. They are still
part of the picture — the prompt reads them as context, and the readback shows the split —
but the run does not pretend to deliver them.

An open question that *must* be answered before the work can start is not deferred by this
table: it is a phase 2 question to the user, and it either gets an answer that turns the
Issue into work or it blocks the run. Say which, out loud, rather than letting it ride.

**Exit when** every child is either "executable as written" or has an answer to write into
it, and **every output, child or not, is assigned** to the subagent or to the human.

### Phase 3 — the readback gate

Read the ordered set back: each output with its rank, **whose it is**, and one sentence of
what gets delivered — the subagent's as the task it becomes, the human's as the thing the
run will not do — plus what you are still assuming.

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
5. Run **`npm run check`** and fix what it reports.
6. Commit the notes and the plan alone. No push, no pull request.
7. Print the prompt.

`npm run check`, not `npm run docs`. The diff is markdown under `docs/`, so the register
gate is the only one of the five with anything to say about it — but root `CLAUDE.md` states
the rule unconditionally, and a skill that carves its own exception is where exceptions
start. `decompose-pbi`'s close had the same gap and was corrected to match, so the two
skills in this chain now commit under one rule.

### The prompt

Fenced, and nothing else in the block:

- read root `CLAUDE.md`, the layer guides for the layers touched, and `test/CLAUDE.md` —
  and know that the plan repeats this where it travels, since a fresh implementer never
  sees this prompt
- read `docs/requirements/<Title>.md`, then its children **by path, in rank order** — a
  saved handoff `Task` is **not** among them (below)
- read every non-child output **by path**, each marked subagent's or human's
- execute with `superpowers:subagent-driven-development` against
  `docs/superpowers/plans/<file>.md`, whose every task points at one of those notes
- red, green, `npm run check`, then commit — all five steps pass before the commit, never after
- close each child as its task lands: `## Outcome`, `status: Done`, `closed:` — an ADR
  instead reaches `status: Accepted`, since it carries neither of the other two
- *(only when a handoff was saved)* when every task is through, close the saved handoff
  `Task` the same way, then `npm run check` and commit — nothing else will, since it is
  not dispatched
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
| Acceptance criteria | Every sibling the run **executes** closed, and `npm run check` green — naming the human's siblings as what it deliberately does not cover |
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
- An `Issue` holding an open question was given a `## Task N`.
- An output was left unassigned because it is a child and children are "obviously" the
  subagent's.
- The close committed on `npm run docs` alone.
- A rule that every implementer needs was written into the prompt alone, where only the
  controller reads it.
- The plan gave a task to an output the human owns, or to one phase 0 found already landed.
- A run finished with its children's `## Outcome` unwritten and their `status` still `Open`.
- An ADR task was told to write `status: Done`, or to add a `closed:` or an `## Outcome`.
- An output with no rank was given a task number among the ranked children.
- The prompt told a run to close a handoff the user declined to save.
- The controller's own close was left in the working tree, with no gate and no commit.
- An empty plan was written, and a prompt printed, for a PBI with no work left in it.
- A saved handoff promised to close siblings the run was never going to touch.
- A child was re-scoped to fit the order, instead of the order being corrected.
- The saved handoff `Task` appears in the set of children the prompt executes.
- The prompt puts the commit before `npm run check`.
- You wrote a note before phase 3 to keep track.
- You started writing source code.
