---
type: Test case
order: 70
parent: "[[Smoke test the roadmap]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: [[Live-vault checks for the resource chip and axis]], the open task that names this check as owed
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The resources axis and its absences

A verification to run.

## Why this exists

The second half of what [[Live-vault checks for the resource chip and axis]] records as owed.
The resources axis draws one lane per `Resource` note the base returns, with each person's
assigned work on their own row and an absence band for time they are away — and jsdom lays
out none of it. Four of this repository's absence bugs were **appearance** defects that every
test passed through.

**Preconditions** — as [[The assignee chip and Set assignee]], with the roadmap on its
resources axis, at least three resources, one of them with no assigned work, and one absence
that overlaps the edge of the drawn window.

## How to check

- One lane per `Resource` note the base returns — including the resource with **no** assigned
  work, which is a lane with nothing on it rather than a missing lane. The roster is the notes
  the base returns; there is no list to keep in step.
- **An absence that runs off the edge** of the drawn window still reads as continuing rather
  than as ending at the edge.
- An absence **does not draw on the line below its own name**, and reads at least as strongly
  as the decoration behind it. Both have been defects here.
- An absence **stretch is not a dead spot**: hovering and clicking inside one behaves.
- Marking or editing an absence **refuses** when the resource it names stopped being a
  resource — retype a `Resource` note while an absence editor is open, then save.
- **Alt+Up/Down on a milestone's card writes no assignee.** A milestone is on no lane; confirm
  the keys do nothing rather than assigning one.
- Create a resource from the axis itself and confirm the new lane appears without a reload.

## Acceptance criteria

- Every resource the base returns has a lane, absences draw and refuse correctly, and no
  keyboard path assigns a resource to something that cannot hold one.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
