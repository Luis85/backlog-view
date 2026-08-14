---
type: Issue
order: 180
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-08-08
source: measured on PR #97 — fifteen review rounds on one six-row table
files:
  - scripts/docs-check.mjs
  - scripts/docs-markdown.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A rule chased past the mistakes it prevents

## What happened

The hierarchy check exists for one defect, and a real one: `LEGAL_CHILDREN` learned
`Deliverable` and `docs/README.md`'s table did not, for a whole increment, because nothing
compared them. That check is about forty lines.

Fifteen review rounds later it was **172 lines and fourteen reject cases, for a table with
six rows and eight types.** Every round found something technically true, each fix was
measured against the real register before it landed, and every one of them was correct.
The sequence was still wrong.

## Where the line actually fell

Sorting the rules by whether they ever catch a MISTAKE puts it plainly.

Rules that do, and stayed:

- the table against the gate, both directions — the defect this exists for
- the null-prototype map — a real pre-existing bug, a note typed `toString` slipped past
  `unknown type` entirely
- a short row — the gate *crashed*, no report at all
- a duplicate row, and two tables under one heading set — merge artifacts
- a name written without backticks — people forget

Rules that do not, and were removed:

- `~~struck through~~`, `<del>` in a cell, in a header, wrapped around the whole table
- a table inside a blockquote (kept, but only because `headings` already refuses one for
  the same reason and it is one line)
- the node-type whitelist, the byte-exact `nothing` annotations, negating prose
  (`` `Bug`, but not `Deliverable` ``)

Every removed rule requires a maintainer to **obfuscate the register rather than mistype
it** — to write `~~`Deliverable`~~` instead of deleting the word. That is a threat model
for a document with adversaries. This one has two editors and a git history.

## The cost that made it a defect rather than a waste

Dead rules are cheap. These were not dead: the tightest of them — prose beside a code span
restricted to separators and `or` — **fails on the first legitimate sentence anybody adds
to that table.** The check would have started interrupting correct work, in a file whose
entire purpose is to be read by a contributor.

That is what turns "more thorough than necessary" into "wrong": a false alarm rate paid
forever, against mistakes nobody makes.

## What to do differently

The signal was available the whole time and was not looked at. Each round I asked *is this
finding real?* — always yes — and never *what mistake does this prevent, and does anyone
make it?* Two questions, and only the second one bounds the work.

A reviewer that generates findings will keep generating them; a finding being correct is
not a reason to act on it. **Ask what would have to happen for this rule to fire, and
whether that thing happens here.** When the answer is "someone would have to be trying",
stop.

Recorded as Done because the cut is made. It is kept rather than deleted because the
sequence is more instructive than the outcome — see the comment in `docs-check.mjs` that
names the removed rules, so the next person to think of strikethrough finds out it was
already built and taken out on purpose.
