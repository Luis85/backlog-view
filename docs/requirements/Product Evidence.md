---
type: Epic
order: 130
status: Open
area: product
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Product Evidence

**The vault is already full of the reasons.** Interviews, support threads, analytics
readings, sales calls and research notes are what an Obsidian user has that a tracker does
not, and this view is the one that connects them to the work: a feature points at what
argues for it, and an evidence note points back at everything it supports.

**Outcome** — A decision to build something can be traced to what was observed, and a
feature nobody has evidence for is visible as exactly that.

## Why it is its own view

Evidence is a link, not a rung — the same shape as a dependency and as what a test covers,
and for the same reason: what justifies a feature has no place in the tree that ranks it.
The view exists because the interesting reads are the backward ones, and no other view has
a reason to do them: which opportunities rest on nothing, which evidence nobody used, and
how much of what a feature claims is actually supported.

## Definition of done, for anything under this epic

- Evidence lives in ordinary notes the vault already keeps. Nothing here creates a second
  place to put a customer interview.
- The link is one property, resolved the way every other link property is.
- **The base returns both populations, and the relationship tells them apart.** This view
  needs the work *and* the evidence — work with no evidence is one of its three reports —
  so one base holds both, and no marker property or evidence type is invented to label them.
  A returned note that **names** evidence is analyzed work; a returned note that is **named
  by** one is evidence. A note in neither relationship is placed by the register's own scope
  rule ([[What counts as a work item]]): with a supported type or a parent it is work nobody
  has evidenced, and with neither it is evidence nobody has used. That is what keeps the two
  reports apart — a zero-evidence Feature is work, an unlinked interview note is evidence,
  and neither is guessed at.
- **A link out of the population is a link, not a count.** An item linking a design note the
  base did not return gets a link that resolves and no count: the note is drawn as linked and
  named as outside the population, the way a context row is drawn and not counted. Widening
  the base is how a vault includes it, which is one filter rather than a second vocabulary to
  keep in step — and that is what the kind mapping stays optional to avoid.
- Every count says what it counted and never counts a note the base excluded — the two
  sentences above are the same sentence, and it is the one this epic's counts rest on.

## What this epic will not do

- **Judge evidence.** Strength is what someone recorded, never something the plugin infers
  from the note.
- **Import anything.** Getting a support thread into the vault is Obsidian's problem and
  the ecosystem's, not this plugin's.
