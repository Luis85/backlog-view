---
name: decompose-pbi
description: Use when a PBI in docs/requirements/ is agreed and needs its engineering work broken out — the user asks to decompose, break down, slice or plan out a PBI, or to see everything needed to implement one across all product perspectives, before any code is written
---

# Decomposing a PBI

Interview against **one** PBI until every perspective is answered, then write its child
notes into `docs/`. Write no source code, and no implementation plan.

**Announce at start:** "Using decompose-pbi to sweep every perspective before anything is
written."

## Precedence, and what this is not

- `adding-backlog-items` wrote the PBI. This skill is its follow-up and never re-opens it:
  a slice that contradicts the use case goes back there, it is not fixed here.
- `superpowers:brainstorming` and `writing-plans` both end in an implementation plan, which
  is not what is asked for. A decomposition is register notes with ranks and parents; a
  plan is one file for one session. Hand over when the user wants the plan.
- If the request is "build it", that is `writing-plans` against the PBI, not this.

## What this skill teaches, and what it does not

The note shapes, the legal parents, the frontmatter vocabulary and the `order` rule are in
`docs/README.md`, and `npm run docs` gates them. Read them; do not restate them here.

What this skill adds is the two things a decomposition gets wrong:

| Failure | The rule here |
| --- | --- |
| Tasks for the code, nothing for the rest | Phase 2 — every perspective answered out loud |
| Everything written as a `Task` | Phase 3 — the type is chosen per child |

## Two rules that hold across every phase

**Nothing reaches disk before phase 4 passes.** No note, no draft, no scratch list.

**One question per message.**

## Phase 0 — the subject

Read the whole PBI note, and three things around it:

- **Its parent Feature and that Feature's Epic.** A Feature may carry
  `## Landmines, before implementation`, which the register reserves for exactly what no
  single use case can state — the order the work must be done in, and the seams that fail
  silently in the wrong one. Read from the PBI alone and those constraints are invisible
  precisely because they were kept out of it.
- **Every note that already names the PBI as `parent`.** A PBI decomposed once before is
  not decomposed from nothing, and phase 3 already assumes those children exist when it
  ranks against them.
- **Every note that links to the PBI without being its child.** An earlier decomposition's
  `Test case`, `Test suite` or ADR names no `parent`, so the search above cannot find one;
  a `[[<Title>]]` search over `docs/` is what does. Miss them and the sweep writes the same
  verification or the same decision a second time under another title.

If the named note is not a `PBI`, stop: an `Epic` or a `Feature`
does not hold Tasks, and the child it does hold is another requirement — say which note is
wanted instead.

Report back its actor, its trigger, its preconditions, its guarantee, its main flow, its
extensions, its acceptance criteria and its `## Where it lives`, and ask whether that is
still what is being built. A decomposition of a
stale use case is worse than none.

**Exit when** the user confirms the PBI as read, and every note found around it is named
as already covering something or as covering nothing.

## Phase 1 — the slices

Walk the PBI's own structure for work, one question per slice: each step of the main flow,
each extension, each acceptance criterion, each path named under `## Where it lives` — then
its **trigger** and its **preconditions**, and the **guarantee**. Those last three are
walked separately because none of them belongs to a step. The trigger is the entry point,
which is wiring no step describes; a precondition is what must already hold, which is often
work rather than an assumption. The guarantee is what survives every branch, so it is the
one thing a decomposition can cover on paper and miss in fact: ask which child holds it on
each extension, not only on the main flow.

A slice is a child note when it can fail on its own. Two slices that can only pass or fail
together are one note. A slice an existing child already holds is **that child**, named as
such and not written again: `npm run docs` catches a repeated file name and never the same
work under a second title.

**Exit when** every step, extension, criterion, **path under `## Where it lives`**,
**the trigger and each precondition** is either claimed by a slice — new or existing — or
spoken for as needing none, and the guarantee is claimed on every branch. The gate covers exactly what the walk covered: a path named there and by no
step is precisely the cross-cutting module or test that vanishes from a decomposition.

## Phase 2 — the perspective sweep

This is the phase that makes the picture full, and it is done **out loud**: every row gets
a child note or an explicit "not needed, because …". Silence on a row is the failure this
skill exists to stop.

| Perspective | The question |
| --- | --- |
| Domain | What rule, rank, scope or placement changes in `src/domain/`? |
| Storage | Does anything new get persisted, and does it go through the write gate? |
| View | What is drawn, and which inputs reach it? |
| One move, three inputs | Drag, keyboard and menu — does each reach the one host method? |
| Undo | Is every new write takeable back? |
| Context rows | Can a new write path target an `outsideFilter` item? |
| i18n | Which sentences are new, and are they data or text? |
| Styles | Which partial, and does `index.css` order matter? |
| Tests | Node, jsdom, or both — and what does the coverage threshold move to? |
| Live vault | What can Obsidian only answer in a real vault? |
| Register | Does a new module in `src/` need a use case's `## Where it lives` or an ADR? |
| Changelog | What does `[Unreleased]` gain? |
| ADR | Was an alternative genuinely available? If not, there is no ADR. |

The ADR row is answered with the decision itself or not at all. `docs/adrs/README.md`
wants the context, the option taken, what each rejected option cost, what got **harder**,
and what would revisit it — and a record that could only ever have gone one way is
documentation, not an ADR. A decomposition does not hold any of that on its own, so when
the row says yes, ask for those five before phase 4 rather than at the close: an ADR
written from a one-line "an ADR is owed" is the empty record the register's own gate cannot
see, since it checks the five headings and never what is under them.

**Exit when** every row has a note or a stated reason.

## Phase 3 — the type of each child

A decomposition is not a pile of Tasks. Per child, ask which the content promises — the
type table in `docs/README.md` is the vocabulary, and three of its answers are easy to miss:

- An **open question** the work cannot settle is an `Issue`, not a Task with a question in
  it.
- A **non-code artifact** the work owes is a `Deliverable`.
- A **live-vault check** is a `Test case`, and it hangs from a `Test suite` — **not from
  this PBI**. It is still part of the picture; it just parents elsewhere. Name the suite it
  joins; when no existing suite fits, the new `Test suite` is itself an output of this
  decomposition, and filing the case under an unrelated suite instead is the failure. A
  `Test suite` is a **root** — no `parent`, and ranked against **every** parentless note
  rather than against the suites alone: `docs-check.mjs` groups orders by `parent` only, so
  one namespace holds the suites, the Epics and the Releases together, and a rank free in
  `docs/tests/suites/` can still be taken by a Release.

Then the ranks, **against the parent each child actually got** — a `Test case` ranks among
its `Test suite`'s cases, not among the PBI's children. Same rule either way: unique among
that parent's existing children, in the order the work must be done. Ranking a child
against the PBI it was decomposed from is how a `Test case` collides with a case it has
never met, or lands correct-looking and misplaced.

**An ADR is not a child of anything.** The sweep's ADR row produces a note with **no
`type`, no `parent` and no `order`** — `docs/adrs/README.md` puts it outside the work-item
hierarchy on purpose — so it is ranked against nothing and gated by none of the rules
above. It is still an output of this decomposition.

That makes two kinds of output, and the second kind is the one that gets lost: **a
`Test case`, any `Test suite` it needed, and an ADR are part of the picture and are not the
PBI's children.** Keep them by name from here on — they travel through phase 4 and the
handoff like everything else.

**Exit when** every child has a type legal under its parent and a free `order`, and every
output that is neither is named as such.

## Phase 4 — shared understanding

Read the whole set back — each output, its type, its parent, its rank, and one sentence of
what it delivers, with an ADR read back as carrying none of those three — and name what you
are still assuming. **This gate is the only thing that
unlocks writing.**

**Exit when** the user has answered — the readback is a question, not an announcement, and
a mistaken parent or rank is caught here or not at all. Reading it back and carrying on is
the gate not happening.

## The close

1. Write one note per **output** — every child, plus the ones phase 3 named as not being
   children — into the folder its type belongs to, **in the shape that type owes**. An ADR
   goes to `docs/adrs/` under that README's own conventions, its number and its index entry
   included; writing only the children leaves the handoff pointing at a path that was never
   created. — a `Task` skeleton over an `Issue` or a `Test case` passes `npm run docs`, which
   gates neither. Where `docs/README.md` documents a shape, follow it: a `Task` opens with
   **Evidence** and leaves `## Outcome` for after the work; a `Test case` opens with
   `Why this exists` and a `Preconditions` line; an `Issue` that records **a decision taken
   or a limitation accepted** says which in its first heading.

   **It does not document one for every type this skill can produce, and three of the gaps
   are on paths phase 3 sends work down.** An `Issue` holding an **open question** is one:
   the register names the question as an Issue and then gives shapes for the decision and
   the limitation only, so the documented headings would have the note answer a question it
   exists because nobody can answer. A `Deliverable` is the second: no row in the shape
   table, and no note of that type anywhere in `docs/` to read as precedent. For those two,
   ask the user for the shape rather than inventing one — the register owns shapes, this
   skill does not, and a shape invented here is ungated prose that passes the gate this
   skill names as its check. A new `Test suite` is the third gap and the one that needs no
   asking: no row in the shape table either, but `docs/tests/suites/` holds several to read
   as precedent, so follow the shortest of them — the prose that says what the group walks,
   and nothing to check itself. The gap is itself worth an `Issue` against `docs/`; offer it, do not write it
   unasked.

   Whatever the shape, the note says what produced it — the PBI slice or the perspective
   row — rather than opening with a proposal. In a `Task` that is the `Evidence` section by
   name; in the others it is the first paragraph. Name the PBI there as a **`[[wikilink]]`**,
   not in prose, and in every output including the ones that are not its children: a
   `Test case`, a `Test suite` and an ADR carry no `parent`, so that link is the only thing
   a rerun's phase 0 search can find them by, and prose naming the same PBI is invisible
   to it.
2. Run `npm run check` and fix what it reports. The full gate, not `npm run docs` alone:
   the diff is markdown under `docs/`, so the register step is realistically the only one
   of the five with anything to say about it, but root `CLAUDE.md` states the rule
   unconditionally and a skill that carves its own exception is where exceptions start.
3. Commit the notes alone. No push, no pull request.
4. Print exactly this, and nothing else in the block:

   ```
   Read docs/requirements/<Title>.md and its child notes, plus <every output that is
   not one of its children, by path>. Write an implementation plan for it using the
   writing-plans skill. Do not write code.
   ```

   The second half is not decoration. A `Test case`, its `Test suite` and an ADR are not
   reachable from the PBI's children, so a handoff that names only those hands the planner a
   picture missing exactly the verification and the decision this sweep just established
   were needed.

## Red flags — stop and go back

- A phase's exit gate asks for less than that phase's walk covered.
- You invented a note shape the register does not document, rather than asking for it.
- An output that is not a child of the PBI stopped being mentioned after the phase that
  found it — the close writing "per child" is that flag's usual spelling.
- An ADR is owed and nobody has said what the alternative was or what it cost.
- A perspective row went unmentioned because it "obviously does not apply".
- Every child came out a `Task`.
- You wrote a note before phase 4 to keep track.
- You started sketching the implementation because the slices felt settled.
- You changed the PBI to fit the slices.

All of these mean: the sweep is not finished. Go back to the phase you left.
