# resolve-pbi — design

A skill that turns a decomposed PBI into an executable one, then hands out the prompt that
executes it. It is the third link in the chain: `adding-backlog-items` writes the PBI,
`decompose-pbi` writes its children, `resolve-pbi` makes those children executable and
prints the prompt a fresh session pastes to run them.

## What it produces

Three outputs:

1. **Edits to the outputs** — the children, so each carries what an implementer subagent
   needs, and the non-child prose this run's close repairs.
2. **A pointer plan** at `docs/superpowers/plans/YYYY-MM-DD-<pbi-slug>.md` — the file
   `subagent-driven-development` cannot run without, holding no detail of its own.
3. **An inline copy+paste prompt** naming that plan and the notes, optionally saved as a
   `Task` child of the PBI for a later run.

## The pointer plan, and why there is one

The first draft of this design produced no plan file at all: the PBI's children are already
a ranked task list, and a plan beside them is a second copy of that order which can disagree
with the register. That is a real cost, and it is paid rather than avoided, because
`subagent-driven-development` cannot consume child notes. Its three scripts each take a
`PLAN_FILE` and exit 2 without one, and `task-brief` finds a task by its `## Task N`
heading **inside that file** — the heading format is load-bearing, and the script owns how
it matches. A handoff naming only notes reaches that skill
without the one artifact it needs.

So the plan is written, and made as thin as the tooling allows:

- The header `writing-plans` requires — goal, architecture, and a **Global Constraints**
  section, which carries the reading and the cycle for every task (below).
- **One `## Task N` per child that is the subagent's *and* still owed**, in rank order —
  each naming the note's path and saying to read it. That is the whole generation rule: an
  output the human owns and an output phase 0 found already landed each get no task.
  **`N` is the dispatch index, not the note's `order`** — ranks carry gaps and
  `task-brief` matches on the integer it is given, so the indices are consecutive from 1
  over the tasks that survive the filter.
- **Every task is a child, so every task carries a rank.** The only two outputs with no
  `order` are the ADR and the `Test suite` — and those are exactly the two `decompose-pbi`
  writes complete at decomposition, which phase 2 assigns to this run's own close rather
  than to the subagent. So there is no rankless work left to interleave, and the plan's
  sequence is the children's own. An earlier draft of this design gave those two the low
  task numbers instead, which handed an implementer a pointer to prose already on disk:
  nothing to do, and an implementer with nothing to do writes something.
- Everything filtered out is **named in the header** with the reason — the human's outputs
  as what this run will not deliver, the landed ones as already done, the ADR and the suite
  as prose the decomposition wrote and this close repaired, and an earlier run's handoff as
  superseded and dropped. Named, because a plan
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

**A rerun writes a plan under a new identity.** `subagent-driven-development` keys its
workspace and its ledger by the plan's **basename**, and treats each `Task N: complete`
entry there as authoritative. A second `resolve-pbi` run on the same PBI on the same day
would land on the same dated path, filter out what has since landed, and renumber the
survivors from 1 — so a stale ledger entry for the old task 3 would silently mark the new
task 3 done, skipping work nobody notices is missing. So a rerun that finds a plan already
at its path does not overwrite it: it writes a distinct basename (a `-2` suffix is enough),
which gives it a fresh workspace and a fresh ledger. The cost is a stale plan file left on
disk, which is a record of what the earlier run was going to do and reads as one.

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
  `[Unreleased]` changelog rule. That is the section `subagent-driven-development` hands to
  every implementer, which is why the header cannot be skipped — and why each pointer task
  names it again, for the reason the close gives below.

  **That cycle is for the tasks that write code.** A decision-or-limitation `Issue` and a
  subagent-owned `Deliverable` are prose by definition, and there is no behaviour to make
  fail first — a brief demanding red-green from one is unsatisfiable, and an implementer
  handed an impossible instruction invents a test to satisfy it. Those tasks run write,
  `npm run check`, commit: same gate, same commit discipline, no red step. Global
  Constraints says which cycle each kind of output takes rather than stating one and
  hoping. **A `Deliverable` is on that list by definition rather than by inspection** —
  `decompose-pbi` types a non-code artifact as one, so a code-bearing Deliverable is not a
  case that arises — and it is named because the shape it closes by is settled per run
  rather than by the register, which reads as a reason to say nothing about it and is not
  one. An ADR and a `Test suite` are prose too and are absent from this list for the
  opposite reason: no task reaches either, so a constraint about them would be a rule
  handed to implementers who cannot act on it.
- **Each pointer task** names the layer guide for the layer *it* touches —
  `src/domain/CLAUDE.md`, `src/storage/CLAUDE.md`, `src/view/CLAUDE.md` — beside the note
  path, **and names the plan's own `## Global Constraints` by path as required reading**.
  A layer guide in Global Constraints would hand every implementer all three; in the task it
  is the one that binds. The back-reference is belt and braces against an ambiguity in
  `subagent-driven-development` itself: its numbered dispatch contract lists the brief,
  scene-setting, interfaces and ambiguity resolutions, while the paragraph two below it says
  a fresh subagent needs "its task, the interfaces it touches, and the global constraints".
  The second sentence is the one this design relies on; the back-reference means the brief
  carries the pointer either way, since `task-brief` extracts the task and nothing above it.

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
  **An `Issue` and a `Deliverable` close by their own shapes, not this one.**
  `docs/README.md` gives an Issue two shapes — a decision taken, or a limitation accepted —
  and **neither has an `## Outcome`**; writing one turns the note into a Task-shaped record
  of a different kind. A `Deliverable` has no documented shape at all, which is why
  `decompose-pbi` asks the user for one, so the shape agreed there governs and this rule
  must not overwrite it; the register also limits `closed:` to Tasks, Issues and Bugs, so a
  Deliverable never gains that key. For both, closing is `status: Done` and whatever the
  note's own shape already says — nothing added.
  **A `Bug` and an `Improvement` are not Task-shaped either.** A `Bug` takes `status: Done`
  and a `closed:` date, but its shape is *What happened · Fix · Lesson* and gains no
  `## Outcome`. An `Improvement` takes `status: Done` and closes by the shape phase 2 agreed
  for it — an `## Outcome` only if that shape has one, since the register documents none and
  inventing the heading here would undo the asking — and it takes no `closed:` key, which the
  register limits to Tasks, Issues and Bugs.
  **The `Test suite`'s shape and the ADR's are not in this section**, and their absence is
  the rule rather than an omission: no task reaches either, since phase 2 assigns both to
  this run's own close, so a constraint describing how to close them would be a rule handed
  to implementers who cannot act on it. Both rules live where the writing happens — close
  step 1. A `Test suite` is written and never closed: every suite in `docs/tests/suites/` is
  `Open`, because a suite is a persistent container for live-vault cases re-walked at each
  release and `RELEASING.md`'s sweep reads them, and closing one would report a verification
  nobody has run. An ADR is not a backlog item at all — `docs/adrs/README.md` gives it `adr`,
  `title`, `status`, `date` and `area`, where `status` is `Accepted`, `Proposed` or
  `Superseded` and there is no `closed:` and no `## Outcome` — so it is done when the record
  is written and its status is `Accepted`, and writing `Done` there is a value the register
  does not have.
  **The PBI itself is in neither place, because nothing closes it.** Every output reaching
  `Done` is a different claim from the use case's guarantee holding: acceptance criteria are
  read against the flow a person walks, and a PBI whose verification is a `Test case` cannot
  be judged by anything that never opened Obsidian. It keeps `status: Open` through this run
  and through the run the prompt starts, and the human closes it after the walk — decided
  that way rather than left that way. A run that flipped it on the strength of its children
  being closed would report a verification nobody performed, which is the same defect as
  closing a `Test suite`.
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

- The subject is **one PBI that has already been decomposed**. No outputs *at all* means
  the decomposition has not happened: stop and send the user to `decompose-pbi`. Children
  are not the test, and the refusal is applied in phase 0 rather than before it — a
  decomposition can produce a `Test case`, its `Test suite` and an ADR and no child at all,
  none of which carries a `parent`, so a refusal that fires on an empty `parent` search
  sends a decomposed PBI back to be decomposed again.
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

**That search returns candidates, and a second test turns a candidate into an output.** A
link is not evidence of parentage, and most of the register's links are not: a limitation
note names the PBI whose property it cannot migrate, a sibling use case names the rule it
rests on, a plan cites the one it argued from. `decompose-pbi`'s close supplies the test —
every output it writes names the PBI as a `[[wikilink]]` in the sentence saying **what
produced it** — which sits wherever that type's shape puts that sentence: the `Evidence`
section of a `Task`, `## Why this exists` in a `Test case`, the first paragraph in the rest.
Requiring the first paragraph is what rejects a real one, since a `Test case` opens with a
fixed lead and says what produced it in the heading below (Codex, PR #233).
A candidate whose only mention sits anywhere else is an unrelated note and is left
alone. Without the test the cost is not a wasted read: an unrelated note taken for an output
is assigned an owner, given a task, and closed by a run that had no business touching it.

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
fail, no coverage to move and no lint rule to refuse them. Asking those four rows of any of
them stalls the phase or invents engineering detail for a record that has none. What a prose
output is asked is what it can answer — what produced it, what it must say, and what would
make it wrong — and `docs/adrs/README.md`'s five things are that question for an ADR.

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
`Issue` and a `Bug` — the same three shapes the subagent owns — so the files row's answer
goes there rather than into prose. The other three name nothing: the failing test, the
coverage move and what would refuse the work belong with the steps that carry them out — the
`Approach` in a `Task`.

**The rows are named for a `Task`, and the subagent owns other shapes.** A `Bug` is
*What happened · Fix · Lesson*; a decision-or-limitation `Issue` has its own headings. Ask
each row of the children it applies to — the engineering four of the code-bearing ones, as
the rule above says — and write every answer into a section that child's own type already
has. And where the register documents no shape at all — an `Improvement` and a
`Deliverable` have no row in its shape table and no note in `docs/` to read as precedent —
phase 2 asks what shape the note takes, which is the ask `decompose-pbi` already makes for
those two. An unanswered shape blocks that output, and the readback says so. Inventing a
heading is never the answer: a shape the register does not document is `decompose-pbi`'s own
red flag.

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
this run's own close**, and that assignment decides which get a `## Task N` in the plan.
There is no fourth bucket for an output nobody owns: an earlier run's superseded handoff was
one until 2026-08-30, and leaving it ownerless left it `Open` in the backlog for good, which
is the state this phase's own red flag names.
Assigning only the non-child outputs would send an intentionally unanswerable note through
the TDD loop, because
`decompose-pbi` deliberately produces children that are not implementable:

| Output | Whose | Why |
| --- | --- | --- |
| A `Task` | The subagent's | It is engineering work with a test |
| A `Task` whose **first body line declares it a handoff** — the line after its frontmatter, not the `---` that opens it | This run's close | It is an earlier run's prompt, not work, so it gets no task — and **its own `status` decides what the close does with it, which is a write in one case only.** Still `Open`: this pass supersedes it and the close **drops** it — `status: Dropped`, `closed:` dated, one line naming **this run**, not a successor note, since the save question has a real no and the no-work path never asks it. Already `Done`: its run happened, so it is a record and is named as already landed and left alone — rewriting it to `Dropped` would turn a completed execution into a refusal. Already `Dropped`: an earlier rerun retired it, and re-dating it says a second run refused what one already had. `Done` is never written here either way, which would report a run that did not happen; `docs/README.md` gives `Dropped` for exactly the open case, "refused, kept for the record" |
| An `Issue` holding an **open question** | The human's | The work cannot settle it; that is why it is an Issue |
| An `Issue` recording a **decision or a limitation** | The subagent's | It is prose stating something already settled |
| A `Bug` | The subagent's | A defect with a fix and a test, and `docs/README.md` gives it a shape — the same work a `Task` is |
| An `Improvement` | The subagent's | Engineering work like a `Task`, but the register gives it no `closed:` key — the closing rule says how |
| An `Idea` | The human's | A proposal nobody has committed to. Implementing an Idea decides it, which is not this run's call |
| A `Deliverable` | Ask | A non-code artifact may be either, and the register documents no shape for it |
| An ADR *(not a child)* | This run's close | `decompose-pbi` already wrote it. Phase 2 reads the five things `docs/adrs/README.md` wants; whatever is missing is supplied here and written at close step 1, never dispatched |
| A `Test suite` *(not a child)* | This run's close | `decompose-pbi` already wrote it too — prose saying what the group walks, checking nothing itself. Repaired here if phase 2 finds it thin. Written, never closed — it stays `Open` while its cases are re-walked |
| A `Test case` *(not a child)* | The human's | A live vault, which no subagent reaches — Obsidian cannot run here |

**Every type the register lets a PBI hold has a row.** `docs/README.md` makes a PBI's legal
children `Task`, `Issue`, `Bug`, `Idea`, `Deliverable` and `Improvement`; phase 2 cannot
exit until each output is assigned, so a type with no row is a phase that cannot close over
a legal decomposition.

**The third bucket is three rows, and what they share is that this run writes them itself.**
An ADR and a `Test suite` are the two outputs `decompose-pbi` writes *complete* at
decomposition — the ADR under `docs/adrs/README.md`'s conventions with its index entry, the
suite as the shortest of the ones already in `docs/tests/suites/`. Neither is work owed to
anybody, so neither is the subagent's: phase 2 reads them, and whatever they still need is
written by this skill at close step 1 beside the children's edits. That is what keeps them
out of the plan's task list, and it is why the two-bucket split this design first drew was
wrong — with only "the subagent's" available, prose already on disk read as prose somebody
had to write.

A superseded handoff is the third row, and it is here for the opposite reason: not because it
is already finished but because, while it is still `Open`, it never will be, and something
has to retire it. One already `Done` is a record of a run that happened and needs nothing;
one already `Dropped` was retired by an earlier rerun. The close
**drops** it rather than completing it, when it is still `Open` — `status: Dropped`,
`closed:` dated, one line naming
this refinement pass as what superseded it — never the note step 4 may write, since the save
question has a real no and the no-work path never asks it. `Done` would report a run that
never happened, which is the
defect the PBI's own closure rule and the `Test suite`'s both guard against; `docs/README.md`
gives `Dropped` for exactly this case, "refused, kept for the record", so nothing has to be
invented for it.

The handoff row is the same kind of correction. The saved note is a `Task` child, so on a
rerun the `Task` row above sends it to the subagent and the plan dispatches an implementer
to run the prompt it is already running. The note's self-declaring first body line — the one after its frontmatter, since a `Task` is
written with frontmatter and a physical first line would be the `---` — is the marker;
this row is the rule that acts on it, and a marker with no rule behind it stops nothing. The
row does two things, because stopping the dispatch was only half of it: the older note is
also dropped by this run's close when it is still `Open`, since a handoff nobody will execute and nobody retires sits
`Open` in the backlog for good.

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
sequence: ask the user for what is missing, write the answers into the record at close step
1, and — where the answers do not come — block the output and say so in the readback.
Writing the five from what the code seems to imply is what that replaces; the ADR records a
decision somebody took, and nobody here took it.

**Exit when** every child is either "executable as written" or has an answer to write into
it, **every output, child or not, is assigned** to the subagent, to the human, to this
run's close, and **nothing is left blocked**. Blocked is a real state this phase can reach —
a shape the register does not document and nobody has settled, an ADR whose five headings are
empty, an open question the work cannot start without — and it belongs to non-child outputs
as much as to children, which the first clause alone does not reach. A blocked output gets
neither a task nor a repair: the plan omits it, its header names it as blocked, and the
readback says which and why. The gate
does not pass on the strength of an owner alone.

### Phase 3 — the readback gate

Read the ordered set back: each output with its rank, **whose it is**, and one sentence of
what gets delivered — the subagent's as the task it becomes, the human's as the thing the
run will not do, this run's close's as what it repairs or drops before committing — plus what you are
still assuming.

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

**The no-work path leaves at step 1.** When the filter left no task — every output landed,
or every remaining one the human's — steps 2, 3, 4 and 7 do not happen: no plan, no save
question, no prompt. Asking whether to save "this prompt" when there is no prompt would
write a handoff `Task` whose `Approach` points at a plan that was never created. The
children's edits are still written, and the gate and the commit run **only if there were
any**: a run that found the remainder executable as written leaves the tree clean, and an
empty commit is not how that is reported. The close says what remains and whose it is either
way. Everything below assumes there is work.

Otherwise, in this order, so the work lands in one commit and the prompt is the last thing
on screen:

1. Write every refined output's edits — the children, and the non-child outputs phase 2
   repaired: an ADR whose five things were supplied, a `Test suite` phase 2 found thin. The
   plan and the prompt only point at those notes; nothing carries the phase's conversation,
   so an edit left unwritten is an edit the implementer never sees. **This step is the only
   place those two are written**, since neither is dispatched — an ADR closes at
   `status: Accepted` with no `closed:` and no `## Outcome`, and a `Test suite` stays `Open`
   because it is a container for cases re-walked at each release. **An earlier run's
   superseded handoff is dropped in this same step, when it is still `Open`** —
   `status: Dropped`, `closed:` dated,
   one line naming **this refinement pass** as what superseded it — for the same reason:
   nothing downstream touches it, so a step that skipped it would leave it `Open` for good.
   **What supersedes it is the pass, never the note step 4 may write.** Step 3's question
   has a real no and the no-work path never reaches it, so a line naming the replacement
   would be one this step cannot always write — and the old prompt is stale either way,
   since it enumerates outputs by path from before this run's edits and names a plan this
   run did not write.
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
- read every non-child output **by path**, each marked as the human's or as prose already
  written — the ADR and the `Test suite` are context to write against, not work
- execute with `superpowers:subagent-driven-development` against
  `docs/superpowers/plans/<file>.md`, whose every task points at one of those notes
- for a task that writes code: red, green, `npm run check`, then commit — every step passes
  before the commit, never after. For a prose task — a decision-or-limitation `Issue`,
  a `Deliverable` — write, `npm run check`, commit: same gate, no red step, because
  there is no behaviour to make fail first
- close each note **a plan task dispatched you to**, in the shape its type owes, as Global
  Constraints states — and nothing else, save the one exception the bullet below states for
  itself when this prompt carries it. The notes two bullets up are context: an ADR and a
  `Test suite` are already written, a suite stays `Open` because its cases are re-walked at
  each release, and a `Test case` is a walk in a live vault nobody in this run can perform.
  Closing one of those reports a verification that did not happen
- *(only when a handoff was saved)* when every task is through, close the saved handoff
  `Task` the same way, then `npm run check` and commit — nothing else will, since it is
  not dispatched
- do not re-open the PBI — a child that contradicts it goes back to `adding-backlog-items` —
  and do not close it either: whether its guarantee holds is a walk only the human makes

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
- **The saved note says so in its own first body line**, after its frontmatter — *this note is the handoff, not a task
  to implement.* That is what a later run catches, since a rerun re-derives the children
  from `parent` and would otherwise find it there. **The line is a marker; the ownership
  table's own row is what acts on it.** Without that row the first guard fails exactly where
  it was meant to hold: the rerun's path list is a fresh one built from the rerun's own
  children, and it names the saved note because the note is one of them.

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
- A superseded handoff was left `Open`, or was closed `Done` as though the run it handed off
  had happened, or was dropped with a line naming a successor note this run never wrote.
- A handoff already `Done` was rewritten to `Dropped` by a rerun, turning the record of a run
  that happened into a refusal — or one already `Dropped` was re-dated by a second one.
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
