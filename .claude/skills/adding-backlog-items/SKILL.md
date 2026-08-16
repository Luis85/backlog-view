---
name: adding-backlog-items
description: Use when the user wants to add an Epic, Feature, PBI, user story or requirement to the backlog in docs/, or asks for a new capability, outcome or body of work the product does not have yet, before any code is written
---

# Adding backlog items

Interview the product owner until you share one understanding of the item, then write
**one** note into `docs/requirements/`. Write no source code.

**Announce at start:** "Using adding-backlog-items to interview you before anything is
written."

## Precedence over brainstorming

`superpowers:brainstorming` matches the same requests and, as a process skill, would
normally win. **For a request to record something in the backlog, this skill takes
precedence and `brainstorming` is not invoked.** Do not run both.

The reason is their endings, which are incompatible rather than merely different:
`brainstorming`'s terminal state is invoking `writing-plans`, and this skill's terminal
state is a backlog note plus a prompt for a *separate* session. An agent that starts in
`brainstorming` ends in an implementation plan, which is the one outcome the product owner
did not ask for.

This skill *is* the brainstorming process for a backlog item — the interview, the options,
the design gate — targeted at the register's own note shapes.

If the user asks to design or build the thing rather than to record it, that is
`brainstorming`'s request, not this one. Hand it over.

## What this skill teaches, and what it does not

Baseline runs without this skill already research `docs/` for prior art, find the note
that refused a design, pick a legal parent and a free sibling `order`, and write a note
that passes `npm run docs`. **None of that is repeated here** — the shapes live in
`docs/README.md` and the gate is `npm run docs`. Read them; do not restate them.

What baseline runs failed at, every time, is the whole of this skill:

| Measured baseline failure | The rule here |
| --- | --- |
| Inferred the type and proceeded | Phase 0 — the user names the type |
| Resolved its own contradictions by assumption | Phase 3 — one at a time, user picks |
| Wrote the note as the way to finish | Nothing on disk before phase 4 |
| Offered no follow-up | The close prints the handoff prompt |

## Two rules that hold across every phase

**Nothing reaches disk before phase 4 passes.** No note, no draft, no scratch file, no
"just capturing this so I don't lose it". A draft is the artifact the rest of the
interview defends instead of continuing.

**One question per message.** A batch of five gets one answer, and the four dropped are
the ones that would have found the contradiction.

## Phase 0 — type and place

**First, refuse what this skill does not write.** If the request is a defect, an open
question, an accepted limitation, or an uncommitted thought, it is a `Bug`, an `Issue` or
an `Idea` — a different shape in a different folder. Name which one it looks like, say
where it belongs, offer to write it as that, and stop. Do not convert it to a `PBI` to
stay useful: `docs/README.md` says a defect written as the wrong type loses the lesson.

Then **ask** which of `Epic`, `Feature` or `PBI` is wanted. Do not infer it. The register
calls the type a promise about the content and the first editorial decision; it is the
product owner's, and this is the step baseline runs skip.

Then the parent — **for a `Feature` and a `PBI` only**. An `Epic` is a root and gets **no
`parent` key at all**, omitted rather than blank, since a bare `parent:` still enrols the
note. Then the `order`, unique among its siblings.

**Exit when** the user named the type, and the parent is legal for it or the type takes
none.

## Phase 1 — the job

Jobs-to-be-Done, four questions, one per message: who is trying to do something, in what
situation, what they do today, and what makes today's way bad enough to change.

**Exit when** the job is one sentence with a real actor and a real situation. "A user
wants a better filter" names no situation and nothing it replaces.

## Phase 2 — the shape

Walk the slots the chosen type owes, one question per slot. The slots are in
`docs/README.md` under "What each kind of note holds" — read that section rather than
working from memory.

For a `PBI`, press hardest on the **guarantee**: it is what survives *every* branch, not
what the main flow achieves. Ask it against each extension you have collected.

**Exit when** every slot holds something, and every acceptance criterion maps to
something a test can assert or a human can check in a vault in under a minute.

## Phase 3 — contradictions

Two hunts, and every contradiction is raised **alone** — with two or three options and
your recommendation — and resolved by the user's pick before you raise the next.

**Internal** — a guarantee that dies on one of the item's own extensions, a criterion
that fights a step of the main flow, an extension labelled against a step that does not
exist, a parent illegal for the type.

**External** — a note in `docs/` that already owns this, an ADR under `docs/adrs/` that
refused it, an Epic whose definition of done this would break.

Do not resolve these yourself. Finding them is baseline behaviour; handing them back is
the skill.

**Exit when** every contradiction raised has a resolution the user picked, and a fresh
pass finds no new one.

## Phase 4 — shared understanding

Read the whole item back, and name what you are still assuming. The user says whether it
is right. **This gate is the only thing that unlocks writing.**

## The close

1. Write one note to `docs/requirements/<Title>.md`. Frontmatter in the register's
   vocabulary; the basename claimed against every note in `docs/`.
2. Run `npm run docs` and fix what it reports.
3. Commit the note alone. No push, no pull request.
4. Print exactly this, and nothing else in the block:

   ```
   Read docs/requirements/<Title>.md. Write an implementation plan for it
   using the writing-plans skill. Do not write code.
   ```

## Red flags — stop and go back

- You picked the type yourself because the request "was obviously a PBI".
- You resolved a tension because you knew the register's position on it.
- You wrote anything to disk to "keep track" before phase 4.
- You asked three questions in one message to "save the user time".
- You started sketching the implementation because the design felt settled.

All of these mean: the interview is not finished. Go back to the phase you left.
