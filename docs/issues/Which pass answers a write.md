---
type: Issue
order: 30
parent: "[[New cards in place]]"
status: Open
priority: P2
area: design
created: 2026-08-30
source: Decomposition of [[New cards in place]]; inherited from [[The outcome report was built from one sentence]]
files:
  - docs/requirements/New cards in place.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Which pass answers a write

## The question

[[New cards in place]] extensions 4a and 4b require the view to report a note it just
created that the next render does not show — excluded by the base's filter, or born done
while finished work is hidden. Reporting it needs one thing nobody has decided: **given a
data pass, which write does it answer?**

This is not a new question. [[The outcome report was built from one sentence]] closed by
handing exactly this one forward, as the criterion it could not meet: *"rule 1 above is
decided and written down before the mechanism is built again. This note closes because
its decision is taken; that criterion travels to the note that owns the mechanism."*
This note is where it travelled.

## What blocks it

Nothing in a Bases result set says which write it was computed after, and the obvious
proxy does not work: checking that the note now carries what the write wrote proves the
**metadata cache** has seen it, which is upstream of the query and equally true of a
stale result set.

Passes also arrive from causes that have no write at all — an edit in another pane, a
rename, any vault change. A pass of that kind, arriving between a write and its own
response, retires a watch on a result set that predates the write.

That is the finding the previous attempt could not fix by narrowing further, because
every narrowing rested on the same false assumption: that every data pass belongs to a
queued write.

## What would settle it

A design that does not need the correlation at all. Three were named when the mechanism
came out, none chosen:

- **Quiescence** — answer once the passes stop, rather than on a particular one.
- **A debounce** — a window after the write, accepting that a slow vault reports late.
- **Comparing successive result sets** — ask what changed between passes rather than
  which write a pass belongs to.

Three further rules were reached last time and are in PR #47's history rather than lost:
what two writes outstanding at once mean, on different notes and on the same note; which
of the two ways out is named, since the filter and the hidden-done case send a reader to
different settings; and what the report offers — a way back to the note, reachable
without a pointer.

## Acceptance criteria

- Rule 1 is decided and written down **before** any code, as extensions on
  [[New cards in place]] — which is `adding-backlog-items`' work on that use case, not a
  Task under it.
- The three rules already reached are written with it, so the next attempt starts from
  four rules rather than one sentence.

Until then [[New cards in place]] cannot reach Done: the second half of its guarantee —
*"if the result is not visible on the next render, the view says so rather than letting
it vanish"* — is held by nothing else. The first half is held by
[[Creating a card in a column's state]] on every branch.

The cost of leaving it open is a card created into a filtered-out state that vanishes
silently — the behaviour everywhere else in the plugin before PR #47, and never a wrong
write.
