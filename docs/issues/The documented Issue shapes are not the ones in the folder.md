---
type: Issue
parent: "[[The sweep query rests on a checked convention]]"
order: 10
status: Open
area: docs
priority: P3
created: 2026-08-03
source: Measured while scoping the Issue-shape gate, PR #61
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The documented Issue shapes are not the ones in the folder

## The decision

`docs/README.md` documented three shapes an `Issue` could take, when this was measured — a
decision taken, a limitation accepted, a verification to run — each as a named sequence of
sections. Checking the folder against them was the obvious reading of finding 13, and it is
**not** what landed. Only the sweep's convention is gated.

The third shape has since left `Issue` outright: the 2026-08-11 test catalog migration gave
"a verification to run" its own type, `Test case`, filed under `docs/tests/cases/` rather
than `docs/issues/`. `docs/README.md` now documents two `Issue` shapes, not three, and what
follows measures those two against this folder — the verification shape's own conformance
is a question for `docs/tests/cases/` now, unmeasured here.

The reason is that the documented shapes and the written notes disagree, in most of the
folder. Derive it rather than trusting a number here — key each note by its opening heading
and ask whether the rest of that shape's sections are present and in order:

```bash
grep -c "" docs/issues/*.md | wc -l          # the folder
grep -l "^## The limitation" docs/issues/*.md | wc -l   # one shape's notes
```

…then read a few against the sequence `docs/README.md` names for them. Sections are missing
throughout, and two notes open with headings (`## The failure mode`, `## The defect`)
belonging to no documented shape at all.

## Why

Two different things were tangled here, and only one was a defect.

**`## Outcome` was not a defect — back when a verification was still an `Issue`.** The
README said an outcome is written *after* the work, and most verifications had not been run
yet; their missing `Outcome` was the schema being honest, and a gate demanding one would
have been answered by writing an empty section, which says less than the absence does. That
tangle left with the shape: `## Outcome` belongs to `Test case` now, and
[[The sweep query rests on a checked convention]] makes the same refusal for `Test case`
specifically (its own extension 2b). Neither of `Issue`'s two remaining shapes documents an
`Outcome` at all, so the question does not apply to this folder any more.

**The rest is unresolved.** Either the README describes an aspiration nobody has followed,
or dozens of notes are malformed. That is a question about what the register is *for*, and
answering it by making the checker pick a side would decide it silently — the same move
this round keeps finding and undoing. Nothing depends on these shapes today; the one thing
that came to depend on an `Issue`'s shape now has its own gate.

## What a real fix would look like

Pick a side deliberately, and record which:

- **The shapes are real** — normalize the folder, then extend the gate the way
  [[The sweep query rests on a checked convention]] extends it for `## How to check`, with
  a per-shape rule keyed on the opening heading and both directions planted.
- **The shapes are guidance** — say so in `docs/README.md`, so a contributor reading it
  knows they are describing what most notes do rather than a schema, and the next person
  scoping a gate does not measure this again.

Whichever, the two headings in no shape at all get a home first: they are either a fourth
shape worth documenting or two notes to rewrite, and that is answerable without settling
the larger question.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. Gating
these shapes is not scheduled, and this note exists so that a later attempt starts from the
measurement rather than from the README.
