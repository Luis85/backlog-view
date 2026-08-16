# A product-owner skill for adding backlog items

A new skill at `.claude/skills/adding-backlog-items/SKILL.md`. It interviews the
product owner until both sides share one understanding of a wanted `Epic`,
`Feature` or `PBI`, then writes that item into `docs/requirements/` in this
register's own shape, verifies it against `npm run docs`, commits it, and offers a
copy-and-paste prompt for a fresh session that will plan the implementation.

It writes no source code.

## Why this exists

`docs/README.md` states what each kind of note must say and why: an `Epic` that
only restates its own name was a heading, a `Feature` carrying detail no use case
owns has put that detail where nothing can test it, and a `PBI` is a use case whose
extensions are where this plugin's hard-won behaviour actually lives. None of that
is enforced by a checker — `docs-check.mjs` sees whether a heading is present, never
whether the paragraph under it says anything.

So the quality of a backlog note rests entirely on the interview that produced it,
and there is currently no interview. An item added in one pass is an item whose
guarantee was never tested against its own extensions.

## What it is not

Not a second copy of the register's conventions. `docs/README.md` specifies every
note shape and `docs-check.mjs` gates the enforceable part of it; the skill names
the section to read and adds only what is missing — the interview, the contradiction
hunt, and the close. A template file per type was considered and rejected for
exactly the reason this repository states elsewhere: an enumeration of something the
register already owns is wrong the moment the register moves, and nothing fails when
it is.

Not a use of the `brainstorming` skill either. That skill's terminal state is
invoking `writing-plans`, and this one's terminal state is deliberately a *prompt for
a different session*. Overriding another skill's ending costs more than not using it.

## Identity

```yaml
name: adding-backlog-items
description: Use when the user wants to add an Epic, Feature or PBI to the backlog
  in docs/, or describes a want, problem or idea that should become a backlog note
  before any code is written
```

The description states triggering conditions and no workflow. `writing-skills`
records why: a description that summarises the process becomes the shortcut an agent
follows *instead of* reading the body — which for this skill means one question and a
written note, the exact failure it exists to prevent.

## The five phases

Each phase has an exit condition an agent can observe. "Relentless" without one
either never terminates or stops at the first plausible answer.

### Phase 0 — type and place

Ask which of `Epic`, `Feature` or `PBI` is wanted. The type is not inferred: the
register calls it a promise about the content and the first editorial decision, so
it belongs to the product owner.

Then the parent — **for a `Feature` and a `PBI` only**. An `Epic` is a root: the
legal-children table in `docs/README.md` gives it no legal parent, and `docs-check.mjs`
holds every note to that map, so an `Epic` carrying a `parent` key fails the gate. The
key is omitted, not blanked — a bare `parent:` with no value still reads as an explicit
root and enrols the note.

Then the sibling `order`, read off the notes that already share that parent — or, for an
`Epic`, off the other roots.

**Exits when** the type was chosen by the user, and either the parent is legal for that
type or the type is one that takes none.

### Phase 1 — the job

Jobs-to-be-Done, four questions: who is trying to do something, in what situation,
what they do today, and what makes today's way bad enough to change.

This phase exists because its output lands directly in the note. A `PBI` opens with
`**As** … **I want** … **so that** …` and a `Feature` states one `Outcome` sentence
in the user's terms; both are a job statement already.

**Exits when** the job reads as one sentence with a real actor and a real situation.
"A user wants a better filter" is not a job — it names no situation and nothing it
replaces.

### Phase 2 — the shape

Walk the slots the chosen type owes, one question per slot:

| Type | Slots |
| --- | --- |
| `Epic` | Why this body of work exists · what "done" means for everything beneath it |
| `Feature` | The one `Outcome` sentence · optionally the landmines, only if the hazard belongs to no single use case |
| `PBI` | Actor · trigger · preconditions · **guarantee** · main flow · extensions · acceptance criteria · where it lives |

The guarantee gets its own insistence, because the register does: it is what survives
**every** branch, not what the main flow achieves. Ask it against each extension.

**Exits when** every slot holds something and every acceptance criterion maps to
something a test can assert or a human can check in a vault in under a minute.

### Phase 3 — contradictions

Two hunts. Each contradiction found is raised **alone**, with two or three options
and a recommendation, and resolved by the user's pick before the next is raised.

**Internal** — a guarantee that does not hold on one of the item's own extensions, an
acceptance criterion that contradicts a step of the main flow, an extension labelled
against a step the main flow does not have, a parent illegal for the type.

**External** — a note in `docs/` that already owns this, an ADR under `docs/adrs/`
that considered it and refused it, an `Epic` whose definition of done this item would
break. This hunt is the reason the skill reads the register rather than reasoning
from the code: the duplicate and the already-rejected alternative exist nowhere else.

**Exits when** every contradiction raised has a resolution the user picked, and a
fresh pass over the item finds no new one.

### Phase 4 — shared understanding

Read the whole item back, and name what is still being assumed. The user says whether
it is right.

**Nothing is written before this passes.** No note, no draft, no scratch file. A draft
on disk becomes the thing the rest of the interview defends instead of continuing.

## The close

On approval, in order:

1. Write one note to `docs/requirements/<Title>.md`. Frontmatter in the register's
   vocabulary: `type`, the `order` established in phase 0, `status: Open`, and
   `parent` as a quoted wikilink **for a `Feature` and a `PBI`**. An `Epic` gets no
   `parent` key at all. The basename is claimed against every note in `docs/` — a
   collision makes every `[[wikilink]]` and `parent:` to either one ambiguous.
2. Run `npm run docs` and fix what it reports. This is the skill's own gate. It
   catches the duplicate sibling order, the illegal parent, the unresolved wikilink
   and the missing use-case section, so the skill restates none of those rules.
3. Commit the note alone. No push and no pull request: a backlog note is not a branch
   of work.
4. Print the handoff prompt as a fenced block with nothing else inside it:

   ```
   Read docs/requirements/<Title>.md. Write an implementation plan for it
   using the writing-plans skill. Do not write code.
   ```

## Two rules carried in the body

- **One question per message.** A batch of five questions gets one answer, and the
  four unanswered ones are the ones that would have found the contradiction.
- **No source code, ever.** Written as a prohibition because it is a discipline
  failure rather than a shaping one: an agent that has just spent an interview
  understanding a problem is at its most tempted to start solving it.

## How the skill itself is checked

`writing-skills` RED then GREEN, subagent runs on a request shaped like an ordinary one
from a product owner: a wanted capability in one sentence, with the type unstated.

**The prompts are not written down here, and this is the rule rather than an omission.**
The first baseline run was void because of it: the spec quoted its eval prompt verbatim,
the spec lives in the repository the eval runs in, the baseline agent searched `docs/`,
found this file, and came back with questions in this file's own phrasing. A control
that has read the treatment is not a control. So a prompt is composed at run time and
never committed, and a run whose report shows it read this file is discarded rather than
interpreted.

**RED, without the skill.** The run happens in a checkout of a commit that predates both
the skill and this spec, outside the working tree, so the isolation is structural rather
than an instruction the agent is asked to honour. The expected baseline is a note written
after zero or one questions. If the baseline agent already interviews across phases, the
skill teaches nothing and is not shipped; that outcome is reported rather than worked
around.

**GREEN, with the skill.** Endpoints alone are too weak a gate — an agent can run five
phases and still batch its questions, write the wrong shape, or start coding. All of the
following are checked:

- No file of any kind exists before the phase-4 confirmation.
- **Every message carries at most one question.** Counted, not judged.
- The note produced has the frontmatter and the sections its type owes, and `npm run
  docs` passes on it unmodified.
- No file under `src/`, `test/` or `styles/` was touched.
- Every contradiction the run raised has a resolution recorded before the note was
  written.
- The closing message carries the fenced handoff prompt and nothing else in the block.

**Two GREEN prompts, not one.** A single flow-shaped request exercises the `PBI` branch
only, and the branches differ in exactly the place a defect has already been found: an
`Epic` takes no `parent`, and a run that never produces an `Epic` cannot catch a skill
that gives one. The second prompt asks for a body of work rather than a capability, and
its note is held to the same list above.

Rationalizations the RED run produces go into a rationalization table in the skill
body. That table is the only part of the skill written from evidence rather than from
this document, so it cannot be drafted here.

## Where it lives

`.claude/skills/adding-backlog-items/SKILL.md`, one self-contained file. No supporting
files: the reference material it needs is `docs/README.md`, which is already in the
repository and already gated.
