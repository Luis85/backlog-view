---
type: Issue
parent: "[[Every release in one list]]"
order: 500
priority: P3
area: design
status: Open
created: 2026-08-23
source: automated review on PR #191, 2026-08-23
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Two releases with the same basename read alike

Obsidian allows `Releases/1.0.md` and `Archive/1.0.md` in one vault. Both draw a row on the
index reading `1.0`, and both draw a header reading `1.0`. Where their other figures are
equal or unconfigured, nothing on screen tells them apart: the path that distinguishes them
is carried in `data-path` and never shown.

## What is already decided, and is not this

**Membership is decided by Obsidian's own link resolution, and by nothing this plugin adds.**
`membershipTarget` (`src/domain/releases.ts`) hands the value to `getFirstLinkpathDest` and
takes its answer: a value naming no note at all is reported as unresolved, and a resolved
note that is not a release is reported the same way rather than reassigned. There is no
basename search of ours to be ambiguous — `[[1.0]]` under two `1.0` notes names whichever
one that link would OPEN from the same note, which is the vault's own rule and the one a
writer can settle by qualifying the link. What is unresolved here is only what the reader
SEES.

(This paragraph named a `resolveReleasePath` with a basename fallback of its own until
2026-08-23. That function is from the plan under `docs/superpowers/plans/`; it was never
built, and the note rested a ruling on behaviour no module has.)

## Why it is recorded rather than fixed

Qualifying a name is a display decision with no stated standard behind it, and it lands on
both screens plus anything later that names a release. The iteration picker qualifies with
the containing folder, which is the precedent to weigh — but it qualifies ALWAYS, and doing
that here would put a folder beside every release name in the common case where no collision
exists, to serve the rare one where it does. Qualifying only on collision means the name a
release draws depends on which OTHER notes the base returned, which is a different rule from
anything else in this plugin and wants stating before it is written.

It arrived on a branch that had already grown to 108 files, on an increment whose remaining
risk is a live-vault check nobody has run. Landing a new naming rule there would add surface
to the thing that most needs to stop moving.

## What would close it

A ruling on which of the two shapes applies — always qualified, or qualified on collision —
stated in [[Every release in one list]], and then applied to the index row, the scope header
and any later surface that names a release from one place rather than three.
