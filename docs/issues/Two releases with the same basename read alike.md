---
type: Issue
parent: "[[Release Management]]"
order: 500
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

**Membership already refuses the ambiguity.** `resolveReleasePath` (`src/domain/releases.ts`)
takes Obsidian's own resolution when a link resolves, and falls back to a basename match only
when it resolved nothing — where it returns no answer at all if two releases share that
basename, because picking the first would make membership depend on file order. So no item
is silently assigned to the wrong release. What is unresolved here is only what the reader
SEES.

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
