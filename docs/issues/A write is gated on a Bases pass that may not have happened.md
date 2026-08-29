---
type: Issue
order: 30
parent: "[[Safe writes]]"
status: Open
priority: P2
area: design
created: 2026-08-29
source: PR #219 review, 2026-08-29
files:
  - src/view/writeGate.ts
  - src/view/release/releaseClose.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A write is gated on a Bases pass that may not have happened

The write gate refuses a batch naming a note the Base excluded. It asks
`host.outsideFilter(path)`, which reads `item.outsideFilter` off the MODEL — and the model
is rebuilt only when Bases hands the view a fresh result set.

**Obsidian's metadata cache advances first.** So there is a window in which a note's
frontmatter has already changed, the change is visible to every reader in this plugin, and
Bases has not yet re-run its filter. If the changed property is one the Base filters on, the
model still says the note is a result, the gate still lets the batch through, and the write
lands on a note the Base has by then excluded.

Raised against the release view's closing action, where it is easiest to state — but it is
not that action's, and not that view's. Every write in this plugin passes the same gate and
inherits the same window: the backlog tree's moves, the board's card writes, the roadmap's
schedules, the estimation view's scores.

## Why the obvious fix is not available

The check would have to ask "would this note still pass the Base's filter", and nothing here
can answer it. The filter belongs to Bases; this plugin receives results and never evaluates
one. There is no API on the 1.12.0 surface that re-runs a filter for a single note, so the
view cannot re-derive inclusion at the moment of a write — only remember what the last pass
said.

That is the same wall [[The outcome report was built from one sentence]] hit from the other
side, and the root guide already states it: **nothing correlates a Bases pass with a write,
and a design that needs that correlation cannot be made to work here.** That note is about
reporting an outcome after a write; this one is about refusing one before it. One cause,
two symptoms.

## What IS available, and why it is not the same thing

A live re-read of the note's own frontmatter closes the part of the window that is about
values rather than inclusion. `closingFieldsMoved` (`view/release/releaseClose.ts`) does
exactly that for the two fields the closing batch writes, and `refusesLiveMembership`
(`domain/releases.ts`) does it for a membership link. Both compare what the note holds NOW
against what the row was built from.

Neither answers inclusion. A re-read tells you the note changed; it cannot tell you whether
the change took the note out of a filter it has never seen.

**And for a report over a POPULATION it is weaker still.** Generating the release notes from
`scope.rows` serializes the last pass's membership. Re-reading each row would drop a member
that has left, but nothing can discover a member that has JOINED since — it is not in the
row set to re-read. So a per-row refresh makes the file more accurate and still not
authoritative, which is the worse of the two failures: a report that looks complete and is
not.

## What this costs today

The window is small and needs an edit from outside the view — another window, sync, or a
plugin — landing between a Bases pass and a press. Nothing observed it in practice; it was
found by reading.

The honest cost is in what the guarantee SAYS. The root guide states that the view never
writes to a note the Base excluded, and `applySafely` is named as the structural reason.
That sentence is true of every path the view offers and false in this window, and the
difference has not been written down anywhere until now.

## What would have to be true to close it

Any of:

- a Bases API that evaluates a filter for one note, so inclusion could be re-asked at the
  write rather than remembered from the last pass;
- a signal that a metadata change is pending a Bases re-run, so a write could wait for it —
  which is the correlation the root guide says cannot be built here;
- a decision that the window is acceptable and the guarantee should be narrowed in the root
  guide to say "as of the last Bases pass", which is what the code actually promises.

The third needs no API and is the one available now. It is a change to what this repository
CLAIMS rather than to what it does, which is why it is recorded rather than taken: narrowing
a guarantee is the author's call.
