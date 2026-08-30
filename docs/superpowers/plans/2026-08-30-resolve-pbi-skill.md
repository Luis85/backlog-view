# resolve-pbi Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the `resolve-pbi` skill — the third link after `adding-backlog-items` and
`decompose-pbi` — which makes a decomposed PBI executable, writes a pointer plan, and prints
the prompt a fresh session pastes to run it.

**Architecture:** One prose file, `.claude/skills/resolve-pbi/SKILL.md`, built section by
section against an approved spec, plus a two-line handoff edit in `decompose-pbi/SKILL.md`
so the chain points forward. No source code, no tests, no new dependency. The sibling skill
`decompose-pbi/SKILL.md` (231 lines) is the shape to match: phased interview, one question
per message, exit gates, a close, a red-flag list.

**Tech Stack:** Markdown. Nothing else.

## Global Constraints

**The spec is the source of truth for content.** It is
`docs/superpowers/specs/2026-08-30-resolve-pbi-skill-design.md`, approved and merged into
this branch. Every task below names the spec headings it implements. Read those headings;
do not invent content, and do not contradict the spec — if a task looks wrong against the
spec, say so rather than choosing.

**Match `decompose-pbi/SKILL.md`'s register and shape.** Read it in full before Task 1. It
is the sibling this skill sits beside, and a reader will meet them one after the other.
Same frontmatter form, same "Announce at start", same `**Exit when**` gate per phase, same
`## Red flags — stop and go back` close. Its house style is dense declarative prose that
states the rule and the failure it prevents — not bullet lists of advice.

**Name a rule, never restate it.** `docs/README.md` owns note shapes and frontmatter; root
`CLAUDE.md` owns the clean-code rules; `subagent-driven-development` owns the execution
loop. This skill points at them. A paraphrase is a second copy that goes stale — the spec
lists that as a red flag, and it applies to writing the skill as much as to the skill's own
output.

**ASD-STE100 Simplified Technical English**, per root `CLAUDE.md`. Short sentences, one
idea each.

**Nothing else changes.** Two files in the whole diff: the new SKILL.md and
`decompose-pbi/SKILL.md`. No `docs/` note (`docs-check.mjs` rule 7 covers `src/`, not
`.claude/`), no `CHANGELOG.md` entry (a Claude skill is not part of a plugin release — the
`decompose-pbi` PR added neither, and that is the precedent).

**`npm run check` must pass before every commit** — all five steps, per root `CLAUDE.md`.
Nothing in this plan can make it fail, which is the point of running it: a green gate is
the evidence the diff is inert outside `.claude/`.

**Verification honesty.** No gate in this repository reads `.claude/skills/`. Lint stops at
`src/`, `docs-check.mjs` stops at `docs/`. So the greps below check that a load-bearing
sentence is *present*, and nothing checks that it is *right* — the readback against the
named spec heading is the real review, and each task says so rather than letting a passing
grep read as a passing test.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `.claude/skills/resolve-pbi/SKILL.md` | The whole skill. Created in Task 1, extended in Tasks 2–4. |
| `.claude/skills/decompose-pbi/SKILL.md` | Modified once, in Task 1: its close hands off to this skill instead of to `writing-plans`. |

One file, built in four passes, because the spec drew eleven review findings and a reviewer
should be able to reject the phases without rejecting the scope, or the close without
rejecting the phases.

---

### Task 1: The skill's identity, its refusals, and the forward handoff

**Files:**
- Create: `.claude/skills/resolve-pbi/SKILL.md`
- Modify: `.claude/skills/decompose-pbi/SKILL.md` (its `## The close`, step 4)

**Interfaces:**
- Produces: the file every later task appends to, with its frontmatter `name: resolve-pbi`
  and the section order `## Precedence, and what this is not` → `## What this produces` →
  `## Two rules that hold across every phase`. Tasks 2–4 append `## Phase 0`…`## Phase 3`, `## The close`, and
  `## Red flags — stop and go back` in that order.

**Spec headings this implements:** `## Scope, and what it refuses`, and
`## Where the execution detail lands`.

- [ ] **Step 1: Read the two sources**

Read `.claude/skills/decompose-pbi/SKILL.md` in full — it is the shape to match — and the
two spec headings named above. Note how `decompose-pbi` writes its own `## Precedence, and
what this is not` section: it names each neighbouring skill and says what that skill is
*for*, so a reader who arrived at the wrong one leaves immediately.

- [ ] **Step 2: Write the frontmatter and the opening**

Create `.claude/skills/resolve-pbi/SKILL.md` starting with:

```markdown
---
name: resolve-pbi
description: Use when a decomposed PBI in docs/requirements/ is ready to be built — the user asks to resolve, refine, prepare or execute a PBI, or wants the prompt that runs its children, after decompose-pbi has written them and before any code
---

# Resolving a PBI

Make an already-decomposed PBI executable, then hand out the prompt that executes it.
Write no source code, and never execute.

**Announce at start:** "Using resolve-pbi to make every child executable before anything
runs."
```

The description's trigger words matter: `resolve`, `refine`, `prepare`, `execute`, plus
"the prompt that runs its children". It must not overlap `decompose-pbi`'s ("decompose,
break down, slice or plan out"), or the wrong skill loads.

- [ ] **Step 3: Write `## Precedence, and what this is not`**

Four entries, each one or two sentences:

- `decompose-pbi` wrote the children. This skill is its follow-up and never re-opens the
  PBI: a child that contradicts the use case goes back to `adding-backlog-items`.
- A PBI with **no children** has not been decomposed. Stop and send the user to
  `decompose-pbi` — there is nothing here to make executable.
- A note that is **not a `PBI`** is refused as `decompose-pbi` refuses one: an `Epic` or a
  `Feature` holds requirements, not Tasks. Say which note is wanted instead.
- `subagent-driven-development` is what the printed prompt invokes, in a **different
  session**. This skill never executes, and never writes source code.

- [ ] **Step 4: Write `## What this produces`**

The three outputs, from the spec's `## What it produces`: the children's edits, the pointer
plan at `docs/superpowers/plans/YYYY-MM-DD-<pbi-slug>.md`, and the inline prompt, optionally
saved as a `Task` child. One sentence each. Do not explain the pointer plan's rationale here
— Task 3 owns that.

- [ ] **Step 5: Write `## Two rules that hold across every phase`**

Mirror `decompose-pbi`'s section of the same name, with this skill's two rules:

- **Nothing reaches disk before phase 3 passes.** No note, no plan, no scratch list.
- **One question per message.**

Then one paragraph from the spec's `## Where the execution detail lands`: execution detail
goes **into the notes**, and the plan and the prompt point at them. State the reason, which
is the load-bearing part — a plan or prompt carrying detail inline is a snapshot that rots
when a note changes; one that points stays correct as long as the notes do.

- [ ] **Step 6: Hand off to this skill from `decompose-pbi`**

In `.claude/skills/decompose-pbi/SKILL.md`, find its `## The close` step 4 — the fenced
block that currently reads:

```
Read docs/requirements/<Title>.md and its child notes, plus <every output that is
not one of its children, by path>. Write an implementation plan for it using the
writing-plans skill. Do not write code.
```

Replace the last sentence pair so the block reads:

```
Read docs/requirements/<Title>.md and its child notes, plus <every output that is
not one of its children, by path>. Make it executable using the resolve-pbi skill.
Do not write code.
```

Leave the paragraph below that block untouched — it explains why the non-child outputs are
named, and that reason is unchanged.

**Then fix the second entry path in the same file**, which the fenced block does not cover.
`decompose-pbi`'s `## Precedence, and what this is not` currently ends with:

```
- If the request is "build it", that is `writing-plans` against the PBI, not this.
```

In a continuing session the user says "build it" rather than pasting the handoff, and that
line routes them straight past the executability pass into a plan built from unrefined
children. Replace it with:

```
- If the request is "build it", that is `resolve-pbi` against the decomposed PBI, not this
  and not `writing-plans` — the children have to be executable before anything runs them.
```

Both entry paths then use the same three-skill chain. Changing only the fenced block leaves
the faster path pointing at the old one.

- [ ] **Step 7: Verify what can be verified**

```bash
npm run check
grep -c "" .claude/skills/resolve-pbi/SKILL.md
grep -n "resolve-pbi skill" .claude/skills/decompose-pbi/SKILL.md
grep -n "writing-plans skill" .claude/skills/decompose-pbi/SKILL.md
```

Expected: `npm run check` exits 0. The line count is under 120 (the file is a quarter
written). The third command prints **two** lines — the fenced handoff and the precedence
routing. The fourth prints **nothing**: `writing-plans` should no longer appear in
`decompose-pbi` at all, and a surviving line means one of the two entry paths still points
at it.

Then the real check, which no command performs: read your `Precedence` section beside the
spec's `## Scope, and what it refuses` and confirm every refusal in the spec is in the file.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/resolve-pbi/SKILL.md .claude/skills/decompose-pbi/SKILL.md
git commit -m "Add resolve-pbi's identity and refusals, and point decompose-pbi at it"
```

---

### Task 2: The four phases

**Files:**
- Modify: `.claude/skills/resolve-pbi/SKILL.md` (append after `## Two rules that hold across every phase`)

**Interfaces:**
- Consumes: the file Task 1 created, and its section order.
- Produces: `## Phase 0 — the subject`, `## Phase 1 — the order`, `## Phase 2 —
  executability, per child, out loud` (containing `### Not every child is executable`), and
  `## Phase 3 — the readback gate`. Task 3's close opens with "Phase 3 has passed", so the
  gate must be named exactly `Phase 3`.

**Spec headings this implements:** `## The phases`, `### Phase 0 — the subject`,
`### Phase 1 — the order`, `### Phase 2 — executability, per child, out loud`,
`### Not every child is executable`, `### Phase 3 — the readback gate`.

- [ ] **Step 1: Write Phase 0**

What to read: the PBI, its parent `Feature` — for `## Landmines, before implementation` —
and that Feature's `Epic`; every note naming the PBI as `parent`; and every note that links
to it **without** being its child, found by a `[[wikilink]]` search over `docs/`. State why
that last search exists: a `Test case`, a `Test suite` and an ADR carry no `parent`, so the
parent search cannot see them.

Then the report back, and the question: is this still what is being built? A child whose
work already landed is named as such.

`**Exit when** the user confirms the decomposition as read, and every output found is named
as still owed or as already done.`

- [ ] **Step 2: Write Phase 1**

The rule: `order` is a rank, not a dependency graph. Walk the children in rank against the
Feature's `## Landmines` — the only place the order the work must be done in is stated, and
deliberately not in the PBI.

Two outcomes, stated as different repairs:

- A child that **cannot start until a sibling lands** says so as **step 1 of its
  `Approach`**, naming the sibling as a `[[wikilink]]`. Cite the precedent by name:
  `docs/README.md` documents this shape, and [[Split the view test suite]] cannot split
  anything until the shared harness moves, and says so as step 1.
- A child whose **rank itself is wrong** is re-ranked. A note explaining that the ranks are
  out of order is not a repair.

`**Exit when** every child's position is defended or corrected.`

- [ ] **Step 3: Write Phase 2's table**

One line per child, out loud. Only a thin child costs a question; **silence on a child is
the failure this phase exists to stop.** Then the table, copied from the spec's Phase 2
verbatim — Evidence, Approach, Acceptance criteria, Files, The failing test, Coverage, What
would refuse it, Risks.

Two paragraphs under it, both from the spec:

- the failing-test row is the specific assertion, never "add tests"; where the child's whole
  deliverable is an invariant, root `CLAUDE.md`'s rule applies and belongs in the `Approach`
  — the test is **watched failing**: revert the fix, run it, see red, restore.
- the "what would refuse it" row is the clean-code gate asked before the work rather than at
  lint time — the 400-line cap, the layer's `no-restricted-imports`, the write-boundary ban.
  A child that cannot land without splitting a file says so as a step in its `Approach`.

- [ ] **Step 4: Write `### Not every child is executable`**

The ownership rule and its table, from the spec heading of the same name. Open with why it
exists: assigning only the non-child outputs would send an intentionally unanswerable note
through the TDD loop, because `decompose-pbi` deliberately produces children that are not
implementable.

Copy the seven-row table verbatim — `Task`, open-question `Issue`, decision/limitation
`Issue`, `Deliverable`, ADR, `Test suite`, `Test case` — with its "Whose" and "Why" columns.
The two test rows split on the same line and that is the point of having both: a suite is
prose the subagent writes, a case is a live vault only a human reaches.

Then the two paragraphs the spec gives: the human's outputs are **named in the plan's
header, never given a task**; and an open question that *must* be answered before the work
can start is not deferred by the table — it is a phase 2 question, and it either gets an
answer that turns the Issue into work or it blocks the run. Say which, out loud.

`**Exit when** every child is either "executable as written" or has an answer to write into
it, and **every output, child or not, is assigned** to the subagent or to the human.`

- [ ] **Step 5: Write Phase 3**

The readback: each output with its rank, **whose it is**, and one sentence of what gets
delivered — the subagent's as the task it becomes, the human's as the thing the run will not
do — plus what you are still assuming.

`**Exit when** the user has answered.` Then `decompose-pbi`'s own sentence, which applies
unchanged: the readback is a question, not an announcement; a mistaken order or a misread
deliverable is caught here or not at all.

- [ ] **Step 6: Verify**

```bash
npm run check
grep -n "^\*\*Exit when\*\*" .claude/skills/resolve-pbi/SKILL.md
grep -n "watched failing\|no-restricted-imports\|Landmines" .claude/skills/resolve-pbi/SKILL.md
```

Expected: `npm run check` exits 0. The second prints **four** lines — one gate per phase; a
phase without one is a phase that cannot be exited. The third prints at least three lines:
the three rules this skill points at rather than restating.

Then the real check: read each phase beside its spec heading and confirm the exit gate asks
for everything that phase's walk covered. The spec's first red flag is a gate that asks for
less.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/resolve-pbi/SKILL.md
git commit -m "Write resolve-pbi's four phases, and the rule that not every child is executable"
```

---

### Task 3: The close — the pointer plan, the prompt, and the save offer

**Files:**
- Modify: `.claude/skills/resolve-pbi/SKILL.md` (append after Phase 3)

**Interfaces:**
- Consumes: `Phase 3` by that exact name, from Task 2.
- Produces: `## The close`, containing `### The pointer plan`, `### The prompt` and
  `### The save offer`. Task 4's red-flag list names failures in all three.

**Spec headings this implements:** `## The pointer plan, and why there is one`,
`### What every implementer must be handed`, `### Closing what the run finishes`,
`## The close`, `### The prompt`, `### The save offer`, and the half of
`## Clean code and TDD — named, not restated` that says where each rule travels. Task 2's
phase 2 table holds the other half — the per-child specifics — so between them that heading
is covered and neither task carries it alone.

- [ ] **Step 1: Write the close's ordered steps**

Seven steps, exactly as the spec's `## The close` gives them, and say why the order is what
it is: the work lands in one commit and the prompt is the last thing on screen to copy.

```
1. Write the children's edits.
2. Write the pointer plan.
3. Ask the save question.
4. Write the `Task` note if the answer is yes.
5. Run `npm run check` and fix what it reports.
6. Commit the notes and the plan alone. No push, no pull request.
7. Print the prompt.
```

On step 5, carry the spec's sentence: the full gate, not `npm run docs` alone — the diff is
markdown, so the register step is realistically the only one of the five with anything to
say about it, but root `CLAUDE.md` states the rule unconditionally and a skill that carves
its own exception is where exceptions start.

- [ ] **Step 2: Write `### The pointer plan`**

Open with why it exists, because a reader will otherwise ask why a plan is written at all
when the children already carry the order: `subagent-driven-development` cannot consume
child notes. Its three scripts each take a `PLAN_FILE` and exit 2 without one, and
`task-brief` extracts a task by matching `^#+[ \t]+Task[ \t]+N` **inside that file**.

Then the four construction bullets from the spec, unchanged in substance:

- the header `writing-plans` requires — goal, architecture, and **Global Constraints**;
- **one `## Task N` per output that is the subagent's *and* still owed**, child or not, in
  rank order, each naming the note's path and saying to read it — `N` is the dispatch index,
  not the note's `order`, consecutive from 1 over the tasks that survive the filter;
- **a plan with no tasks is not written at all** — both filters can empty it, and
  `task-brief` exits when the heading it asks for is absent, so a run with no work left
  reads that back at phase 3 and closes without a plan or a prompt, naming what remains and
  whose it is;
- **an output that carries no rank runs first** — an ADR has no `order`, a new `Test suite`
  is ranked among the roots rather than among the PBI's children, and both are context the
  ranked work rests on, so they take the low numbers and the children follow;
- everything filtered out is **named in the header** with its reason;
- nothing else. No steps, no code blocks, no acceptance criteria.

Then the spec's two closing notes: this is not `writing-plans` (that skill decides
granularity, file layout and TDD steps; here all three live in the register), and the stated
cost — SDD wants exact values only in the task brief, a pointer brief holds none, so the
single source of requirements moves to the note the brief names and the brief says so in
those words.

- [ ] **Step 3: Write what Global Constraints and each task must carry**

This is the load-bearing part of the whole skill and it earns its own paragraph. From the
spec's `### What every implementer must be handed` and `### Closing what the run finishes`:

Naming a rule in the printed prompt reaches the **controller** and stops there. `task-brief`
extracts from a `## Task N` heading onward, and SDD dispatches each fresh implementer with
that brief plus context the controller constructs — never the prompt. A rule that lives only
in the prompt reaches nobody who writes code.

So:

- **Global Constraints** carries what every task shares: root `CLAUDE.md`, `test/CLAUDE.md`,
  `superpowers:test-driven-development`, the red-green-`npm run check`-commit cycle, the
  `[Unreleased]` changelog rule, and **closing the note** — `## Outcome` written,
  `status: Done`, `closed:` dated, in the same commit as the work. Carry the spec's
  carve-out with it: that shape is the backlog's, and an ADR takes `status: Accepted` with
  no `closed:` and no `## Outcome`, because `docs/adrs/README.md` gives it neither. And a
  `Test suite` is **written but never closed** — every suite in `docs/tests/suites/` is
  `Open`, because a suite is a container for cases re-walked at each release, and closing one
  reports a verification nobody ran.
- **The red-green cycle is for the tasks that write code.** A decision-or-limitation
  `Issue`, an ADR and a `Test suite` are prose, with no behaviour to make fail first, so
  they run write, `npm run check`, commit. Global Constraints says which cycle each kind of
  output takes: a brief demanding red-green from prose is unsatisfiable, and an implementer
  handed an impossible instruction invents a test to satisfy it.
- **Each pointer task** names the layer guide for the layer *it* touches —
  `src/domain/CLAUDE.md`, `src/storage/CLAUDE.md`, `src/view/CLAUDE.md` — **and names the
  plan's own `## Global Constraints` by path as required reading**. In Global Constraints all
  three guides would reach every implementer; in the task it is the one that binds. Carry
  the spec's reason for the back-reference: SDD's numbered dispatch contract omits Global
  Constraints while the paragraph below it requires them, and `task-brief` extracts the task
  and nothing above it, so the pointer in the task closes the gap either way.

State why closure has to be said at all: SDD's completion record is its ledger, under a
gitignored `.superpowers/`, which never reaches the register. Without this, every child
stays `Open` with its `## Outcome` unwritten.

- [ ] **Step 4: Write `### The prompt`**

Fenced, and nothing else in the block. The eight bullets from the spec's `### The prompt`,
verbatim in substance — the reading, the PBI and its children by path in rank order with the
saved handoff excluded, the non-child outputs by path marked subagent's or human's, the SDD
invocation against the plan path, the red-green-check-commit cycle, per-child closure, the
controller-owned close of the saved handoff, and the refusal to re-open the PBI. Two
details in those bullets are easy to drop and both were review findings: the handoff bullet
is written **only when a handoff was saved**, and it carries its own `npm run check` and
commit, since no task's cycle covers a write the controller makes.

Then the spec's paragraph on why the non-child outputs are named — the same reason
`decompose-pbi`'s handoff names them: a `Test case`, its `Test suite` and an ADR are
unreachable from the PBI's children.

- [ ] **Step 5: Write `### The save offer`**

A question with no default, asked once. Then the self-reference rule and its two guards,
from the spec — the plan and prompt enumerate by path so a note written afterwards is
outside the set by construction, and the saved note says in its own first line that it is
the handoff and not a task, which is what a later rerun catches when it re-derives children
from `parent`.

Then the six-row shape table from the spec's `### The save offer`: Evidence, Why it matters,
Approach (the fenced prompt verbatim), Acceptance criteria (every sibling the run
**executes**, not every sibling — an open-question `Issue` sits beside them by design and a
criterion nobody can tick reads as unfinished work forever), Risks (**the prompt is a
pointer, not a snapshot**), Outcome. State that this is the `Task` shape `docs/README.md`
already documents — no invented shape.

- [ ] **Step 6: Verify**

```bash
npm run check
grep -n "Global Constraints" .claude/skills/resolve-pbi/SKILL.md
grep -n "task-brief\|sdd-workspace\|PLAN_FILE" .claude/skills/resolve-pbi/SKILL.md
grep -n "status: Done" .claude/skills/resolve-pbi/SKILL.md
grep -n "npm run docs" .claude/skills/resolve-pbi/SKILL.md
```

Expected: `npm run check` exits 0. The second prints at least two lines — the plan header
bullet and the "what every implementer must be handed" paragraph; if it prints one, the
rule that reaches every dispatch is only half stated. The third prints at least one line —
without it, nothing explains why a plan file exists. The fourth prints at least one line —
without it, nothing closes the register. The fifth prints **nothing outside a sentence that
contrasts it with `npm run check`**: read every hit; a bare `npm run docs` as the close's
gate is the defect this spec fixed.

Then the real check: read `### The prompt` and confirm every rule in it that an *implementer*
must obey also appears in the Global Constraints paragraph. The prompt reaches the
controller only.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/resolve-pbi/SKILL.md
git commit -m "Write resolve-pbi's close: the pointer plan, the prompt, and the save offer"
```

---

### Task 4: Red flags, and the whole-file pass

**Files:**
- Modify: `.claude/skills/resolve-pbi/SKILL.md` (append the final section, then edit anywhere the pass finds a defect)

**Interfaces:**
- Consumes: every section Tasks 1–3 wrote.
- Produces: nothing later tasks depend on. This is the last task.

**Spec headings this implements:** `## Red flags — stop and go back`, and a consistency pass
over the whole spec.

- [ ] **Step 1: Write the red-flag list**

Append `## Red flags — stop and go back`, ending with `decompose-pbi`'s own closing line:
*All of these mean: the sweep is not finished. Go back to the phase you left.*

Every entry from the spec's red-flag list — twenty-six items. Most were real defects in the
spec itself, caught by review, so none is decoration:

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
- The plan gave a task to an output the human owns, or to one phase 0 found already landed.
- A rule that every implementer needs was written into the prompt alone, where only the
  controller reads it.
- A run finished with its children's `## Outcome` unwritten and their `status` still `Open`.
- An empty plan was written, and a prompt printed, for a PBI with no work left in it.
- A saved handoff promised to close siblings the run was never going to touch.
- An ADR task was told to write `status: Done`, or to add a `closed:` or an `## Outcome`.
- A prose-only task was given a red-green cycle it cannot satisfy.
- A `Test suite` was closed because its prose was written.
- An output with no rank was given a task number among the ranked children.
- The prompt told a run to close a handoff the user declined to save.
- The controller's own close was left in the working tree, with no gate and no commit.
- The saved handoff `Task` appears in the set of outputs the plan executes.
- The prompt puts the commit before `npm run check`.
- The close committed on `npm run docs` alone.
- A child was re-scoped to fit the order, instead of the order being corrected.
- You wrote a note before phase 3 to keep track.
- You started writing source code.

- [ ] **Step 2: Run the whole-file pass**

Read `.claude/skills/resolve-pbi/SKILL.md` start to finish, then the spec start to finish,
and check three things. Fix what you find, in place:

1. **Coverage.** Every spec heading has a section that implements it. The spec has
   seventeen `##`/`###` headings; walk them.
2. **Contradiction.** No two sections disagree. The spec itself shipped this defect twice —
   phase 2 assigned ownership while the plan section still said "one task per child" — so
   look specifically for a rule stated in two places with different words.
3. **Restatement.** Nothing paraphrases `docs/README.md`, root `CLAUDE.md` or
   `subagent-driven-development`. Where the file explains a rule those own, replace the
   explanation with a pointer and keep only what this skill adds.

- [ ] **Step 3: Verify**

```bash
npm run check
grep -c "" .claude/skills/resolve-pbi/SKILL.md
grep -c "^- " .claude/skills/resolve-pbi/SKILL.md
git diff --stat main...HEAD
```

Expected: `npm run check` exits 0. The line count is in the 230–320 range — `decompose-pbi`
is 231 lines and this skill carries one more phase's worth of rules; far under says a
section is missing, far over says something was restated that should have been pointed at.
The third confirms the red-flag list is present. The fourth shows **two files** changed
under `.claude/`, plus this plan and the spec under `docs/superpowers/` — any other path in
that list is scope this plan did not ask for.

Then the real check, and it is the only one that matters: read the file as somebody who has
just been told to resolve a PBI and has never seen the spec. Can they run it? Every place
the answer is "only if they already knew X" is a place X has to be written down.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/resolve-pbi/SKILL.md
git commit -m "Close resolve-pbi with its red flags, and pass over the whole file"
```

---

## What this plan does not do

- **No test for the skill.** Nothing in this repository reads `.claude/skills/`, so there is
  no gate to add one to. The greps above check presence, the readbacks check correctness,
  and the honest statement is that a skill is verified by being run — which needs a real PBI
  and a human.
- **No `docs/` note and no changelog entry.** Stated in Global Constraints, with the
  `decompose-pbi` PR as the precedent.
- **No change to `subagent-driven-development`.** The pointer plan exists precisely so that
  skill does not have to change. Widening it to accept note paths was considered and refused
  during design — it edits a shared skill for one caller's benefit.
