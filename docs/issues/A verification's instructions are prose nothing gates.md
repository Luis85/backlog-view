---
type: Issue
order: 170
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-08
source: three instances across two branches — PRs #97 and #101, all found by review rather than by the gate
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A verification's instructions are prose nothing gates

## The limitation

`docs-check.mjs` holds a verification note to a great deal: its frontmatter, its status
and cadence vocabulary, its parent link, every wikilink in it, and every source path it
names. What it cannot read is the part a human actually follows — **the steps**.

Three instances landed across two branches, all caught by review and none catchable by
`npm run check`:

1. [[Roadmap legend with two workflows]] told a runner that `docs-check.mjs` refuses
   `Deliverable` and to make scratch notes outside `docs/`. True when written; the very
   increment that added the check made it false, and the note was closed in the same commit
   without its setup being re-read.
2. [[Parent links Obsidian parsed, and ones it did not]] gave a console expression
   resolving `Child.md` by path — null the moment a base points at a folder, which the
   setup above it explicitly permits. The check had *just* been rewritten because its
   previous version asked for an observation that does not exist, so one rewrite produced
   an answerable check that could not be run.

3. [`test/CLAUDE.md`](../../test/CLAUDE.md) told a contributor that a bracketed parent value
   with no link entry is a cache Obsidian never hands out, and to reach for `parentLink`.
   Half true, and the wrong half is the half a fixture for an *unresolved* link needs —
   following it forces the parsed-link path and leaves the raw fallback untested. Broader
   than the other two, because this file is read before the code is written rather than
   during a vault session.

The shapes are different and the gap is one: an instruction can go stale, or be wrong on
arrival, or be right about one case and steer the other into a wall — and every gate this
register has reports the document as consistent.

The third instance also widens the scope. This is not only about `cadence: release` notes:
the layer guides are instructions too, and `test/CLAUDE.md` is loaded automatically when
someone works in `test/`. A wrong sentence there is executed by every contributor rather
than by whoever picks up one verification.

## Why this is worse than ordinary prose rot

A `cadence: release` note is not a record. It is a **checklist to re-run**, so its steps
are executed by a person, at a distance, in a state where being wrong costs a vault
session rather than a compile error. The rest of `docs/` states decisions; these notes
state procedures, and a procedure is the one kind of prose with a runtime.

It also fails in the direction that hides: a runner following stale setup reports back a
pass or a puzzled question, and neither reads as "the instructions were wrong".

## What would settle it

Nothing obvious, which is why this is Open rather than a task. What has been considered:

- **Check the fenced code in a verification note.** Would have caught instance 2 only if
  the checker knew Obsidian's API, which is reading a foreign language rather than English
  but no less out of scope.
- **Re-read every open verification note when the gate changes.** A convention, and this
  register's own evidence is that a convention stating a rule is not a check
  ([[A comment that states a rule is not a check]]).
- **Date the setup, and fail a note whose setup predates a change to `LEGAL_CHILDREN` or
  the schema.** The only mechanical option found so far. It is a staleness *alarm* rather
  than a correctness check, and its false-alarm rate is every schema change times every
  open verification — plausibly worse than the defect.

The honest position for now: this is a known hole with no proposed fix, recorded so the
next instance is the **fourth** of a known kind rather than the first of a new one.

A counted list in prose is itself the thing this note is about — the count above was raised
from two to three and this sentence was left saying "the third", which review caught. If a
fourth arrives, raise both, or replace the number with "one more".

## What to do meanwhile

When a change makes a verification note's SETUP wrong, fix the note in the same commit.
That is a convention and it is admitted as one — it is what failed in instance 1, by the
same person, in the commit that closed the note.
