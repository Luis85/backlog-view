---
type: Test case
order: 50
parent: "[[Smoke test the release view]]"
status: Open
priority: P1
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review; `Mark as released` and `Generate release notes` post-date the suite note and appear in no verification
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Closing a release, and its generated notes

A verification to run.

## Why this exists

`Mark as released` and `Generate release notes` shipped **after** [[Smoke test the release
view]] was written, so they appear in no verification at all. They are also the two riskiest
actions the plugin has: one writes a status and a date to a note, the other **writes a file**
— the only place the plugin puts prose on disk that a person did not type.

`P1` rather than `P2` for that reason: a wrong refusal here is an annoyance, and a wrong
write is a file somebody has to find.

**Preconditions** — as [[Release view registration and options]], with the status property,
the statuses that mean released, the status to write and the released-date property all
bound; one release holding unfinished members, one holding only finished ones, one already
released, and one with no members at all.

## How to check

**Mark as released**

- On the release with unfinished members, the dialog **lists them**, and each is openable
  from the dialog **without answering it**. Open one, come back, and the dialog is still
  there with the same list.
- A member finished by its **own** workflow — a `Deliverable`, say — counts as finished and
  is not listed.
- Confirming writes the configured released status and today's date **to the release note
  and to nothing else**. Check the member notes are untouched. Undo takes both keys back as
  one entry.
- The action is **withheld** on a release that is already out, that carries a date already,
  or whose status or date cannot be read — and says which option to bind when one is
  missing. The reason takes a line of its own rather than sitting inside the button.
- **Change the release, or its configuration, while the dialog is open** — retype the note,
  or unbind the status property in another pane — then confirm. Nothing is written.

**Generate release notes**

- The file is named for the release, grouped by type in the order the scope tree draws them,
  and says at its top that it was generated.
- **Regenerating is byte-identical.** Run it twice and diff.
- It **refuses** a file at that path that this view did not write, and one that belongs to
  another release — **including a second release that shares the first's basename**. Make
  that collision on purpose.
- A release with **no members** still gets a file saying so. An empty release notes file is a
  fact; a missing one is ambiguous.
- Inside an **embedded base** the action is withheld, because the view identity it needs
  cannot be resolved. Embed the base in a note and confirm.
- Read the generated file in Obsidian. Do the wikilinks resolve, and does it read as a
  document rather than as a dump?

## Acceptance criteria

- Both actions write exactly what they promise, refuse in every stated case, and the
  generated file is stable across regeneration.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
