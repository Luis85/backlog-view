---
adr: 33
title: A rule that can go stale between plan and apply is decided at the writer
status: Proposed
date: 2026-09-02
area: architecture
---

# 0033 — A rule that can go stale between plan and apply is decided at the writer

## Context

[ADR 0030](0030-domain-is-the-kernel.md) says a use case is a host method plus a pure
planner. A planner reads the **model**, and the model is a Bases pass — it can be a refresh
behind the note by the time the batch it produced actually lands. Between the two, a person
can type in the file, another view can write it, and an earlier write in the same batch can
change it.

For most rules that gap is harmless: a parent, a rank, a type or a label is planned from
what the reader could see, and writing it is the point. It stops being harmless the moment a
rule's truth is a **question about the note's current contents** — "is this key empty",
"would this reverse the span", "is this pick still a change". Those are exactly the rules a
plan cannot carry, because the answer it computed may no longer be the answer.

The register already holds three notes in this class and had no written decision for any of
them: [[A pick compared against the model reads as a no-op]],
[[A stale release or iteration target can still be committed]], and
[[Joining a release dates the work]] 6c. The codebase already answers it three times in
`src/storage/frontmatter.ts` — `leaving` reads the live state before the write replaces it,
`refusesLiveType` and `schemaEnds` ask the live type, the stub loop asks live key presence —
and `applyAxis`'s own `sameCivil` comment states the reason in as many words: *"This is the
question the planner used to answer from the model, where the value could be a refresh
behind."* Three instances, three comments, no decision.

What forced the question into writing was review. Two rounds on
[[Joining a release dates the work]] found four defects in the specification before any code
existed, and all four were one mistake: a rule stated at the planner that only the writer
can keep. A guarantee written ahead of the check that could reach it is the register's own
named failure, and here it was reachable only by moving the check.

## Decision

**A write rule whose truth can change between planning and applying is decided at the
writer, inside the same `processFrontMatter` call that lands the write. The planner carries
the values; it does not pre-filter on them.**

Three consequences follow, and they are the decision rather than commentary on it:

- **The plan carries every candidate, unfiltered.** An end the planner dropped is an end the
  writer cannot reinstate, so filtering at plan time is not an optimisation — it is the
  defect. What the planner contributes is the values the writer cannot know: a date off
  another note, a clock reading, a picked target.
- **Live behaviour rides a flag on the write, never the writer's default.** `applyAxis` is
  shared by the horizon drag, the timeline resize, the iteration join and the release join,
  and they disagree on purpose — the iteration join OVERWRITES
  ([[An iteration's timeframe schedules its items]] 2a) where the release join fills only
  what is empty. A rule learned as a default silently retires the other's.
- **The check goes where the rule went.** A rule decided at the writer is tested at the
  writer, plan-then-edit-then-apply, because a planner-only test passes while the behaviour
  is wrong. That is the register's *category invariant is checked at the forbidden thing*
  applied to a race.

This does not move validation, refusal, ranking, placement or eligibility. Those are
questions about the **shape of the change**, they are `domain/`'s, and ADR 0030 is confirmed
rather than narrowed: the planner is still pure, still node-tested, and still the only place
a use case's batch is composed.

## Consequences

**`Proposed`, not `Accepted`: the decision is PARTIALLY implemented, and
[[A pick compared against the model reads as a no-op]] is the gate.** Since
[[Dates ride the release join]] landed (2026-09-02), code does follow this record — the
release join carries both candidates unfiltered and `plannedAxis`/`suppressedAxis` decide
emptiness, ordering and the join test against the live note. What is not yet true is the
record's own reach: `computeReleaseWrites` still returns an empty plan from the CAPTURED
membership, so where another view moves the item first there is no writer check to run at
all, and [[Joining a release dates the work]] 6c concedes exactly that. `docs/adrs/README.md`
defines `Accepted` as "in force — the code follows it", and a decision one of its own named
examples still violates is not in force.

So the increment that moves the last stale planner is the one that accepts this record —
that is [[A pick compared against the model reads as a no-op]], which owns all three, and
never [[Dates ride the release join]], which for one commit claimed the flip as its own
definition of done. This paragraph said "until [[Dates ride the release join]] lands" and
"no code follows this yet" until 2026-09-02; both stopped being true the moment that task
landed, while the verdict they were arguing for did not change. Corrected in the pull
request that made them stale (Codex, PR #242), after two earlier rounds read the status
against the README's vocabulary and then read the task against this paragraph.

**The plan no longer fully describes the write.** Reading `computeReleaseWrites` alone no
longer tells you what lands on disk, and the flag is the only thing linking the two halves.
That is the real price, and it is paid in comprehension: two files have to be read together
where one used to be enough.

**A planner-only test can pass while the behaviour is wrong.** This is the same cost stated
as a testing hazard, and it is why the acceptance criteria that matter most now live in
`test/storage/`.

**`storage/` grows decisions, not just serialization.** It was already true three times over;
this makes it deliberate. The boundary that keeps it from growing without limit is the
sentence above — only rules whose truth can go stale, never rules about the shape of a
change.

**Undo is unaffected.** `touchedKeys` reads `axisEntries`, whose loop is over `AXIS_FIELDS`,
so a flag is neither an entry nor a captured key; and a write the writer suppresses changes
no value, so `captureInverse` records no inverse for it.

## Alternatives

**Decide it at the planner, and accept the window.** Rejected: it makes the guarantee
unreachable, and the failure is data loss rather than a stale read — a due somebody typed
between the row being drawn and the pick being applied is silently overwritten, because
`applyAxis` reads the live value only to skip an equal civil date. This was not a predicted
risk; it is what review found in the note that promised the opposite.

**Re-read the note in the planner.** Rejected outright: `domain/` may not touch the vault
([ADR 0003](0003-four-layers-enforced-by-lint.md), ADR 0030), and a planner that did would
stop being pure and node-tested — trading a narrow race for the whole reason that layer is
testable at all. It also would not close the window, only shorten it.

**Make the live check the writer's default.** Rejected: it silently retires the iteration
join's overwrite rule, which is a decision somebody made on the record. The cost of the flag
is one boolean; the cost of the default is a rule disappearing without anyone editing the
note that states it.

**Have the writer report back and let the caller reconcile.** Rejected for this increment.
It is the only option that would let a view announce what actually landed, but it reverses
the capture rule every card move already keeps — `applyCardMove` reads its naming vocabulary
BEFORE the await, because the batch's own refresh rebuilds the model — so it is a change to
how every projection announces, not to one write. What it buys is left unbought: the release
move's sentence claims the membership only, and says nothing about dates.

## Revisit when

**A third or fourth such flag appears on one write type.** Two is a pair of decisions; four
is a language, and at that point the flags want a shape — a stated live-rule set the writer
interprets — rather than more booleans nobody can enumerate.

**A rule about the shape of a change starts wanting to live here.** That is the boundary
being crossed, and it means this ADR was read as "the writer decides" rather than as what it
says.

**Bases gains a way to correlate a pass with a write.** Then a planner could know whether it
is current, the window becomes detectable rather than merely narrow, and the whole class —
including [[The outcome report was built from one sentence]], which is the same gap seen
from the other end — is worth reopening together.
