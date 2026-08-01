---
type: Issue
order: 70
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-01
source: 2026-08-01 review of PR #24, the last finding of the sequence
files:
  - docs-check.mjs
---

# The gate is tested only against invalid documents

## The limitation

This project verifies a mechanical rule by **planting the violation and watching the check
reject it**. That method is why `docs-check.mjs` exists in the shape it does, and it caught
every one of the two dozen findings in [[Make the register check itself]].

It asks one question: *does an invalid document fail?*

It never asks the other: *does a valid one pass?* And the last finding of the review was
the only one in the whole sequence that came from asking it — and the only one that would
have cost someone real time:

```
[the filter](<The quick filter on the board.md>)
```

`<…>` is Markdown's sanctioned way of putting a space in a link destination, and **every
note in this register has spaces in its filename**. The capture stopped at the first space
and resolved that to a file called `The`, so the one correct way to link these notes was
rejected. The register never hit it only because it uses percent-encoding everywhere.

## Why this direction is the harder one

A false pass is discovered by someone hunting for holes. A false failure is discovered by
someone who was doing something else, and their most likely response is to **change the
document**, not to suspect the checker:

> CI is red on a link I just wrote. Fine — I will write the link the other way.

The bug then survives, and it survives specifically in the form of a rule nobody can state:
"we don't use angle-bracket links here", believed by people who never learned why.

Twenty-odd findings looked for what an invalid document could sneak past. One looked for
what a valid document is allowed to contain, and it was the most expensive defect in the
file.

## What would lift it

Plant **valid** input, not just invalid: for every construct the checker parses, an example
exercising a legal form the register does not currently use. Angle-bracket links, `*` and
`+` bullets, headings with trailing whitespace, a `.base` file beside a note, a nested
folder. Each one asks "is this rejected?" and expects a green run.

That belongs beside the violations table in [[Make the register check itself]], as a second
table with the opposite expectation. It is filed rather than done because the shape of the
work is clear and the volume is not: the constructs worth covering come from Markdown, and
enumerating them exhaustively is the enumeration trap this checker keeps falling into.

## The trigger fired, and the prediction held

This note said to start the next time `docs-check.mjs` was changed at all. It has since
been changed **eleven times**, and the method arrived on its own:
[[Check that a feature lists its use cases]] now carries `Planted | Accepted` tables beside
its violations tables — the second table with the opposite expectation, in the shape
proposed above and reached without reference to this note.

It caught exactly the predicted class. The index-entry matcher encoded one spelling of a
bullet — a dash and exactly one space — so `-  [[Name]]` with two spaces, a tab, `*`, and
an ordered marker were all reported as missing children. That commit's own words:

> A false failure that blocks a contributor over whitespace.

Five legal spellings were planted and all five accepted. A valid document had been rejected
by the gate for six rounds, and no amount of planting violations would ever have shown it.

## What is still missing

**The planting is prose, not a test.** Every one of those eleven commits changed
`docs-check.mjs` and a task note; none added an executable check. So the corpus that proved
the widening correct exists only as a Markdown table describing a run somebody once did, and
the next tightening re-derives it by hand or not at all. `docs-check.mjs` still has no test
of its own.

That narrows this issue rather than closing it. The question is no longer whether anyone
will think to ask "does a valid document pass" — they now do — but whether the answer
survives the person who asked it.

## Acceptance criteria

- The spellings already planted by hand are captured somewhere that re-runs: a fixture
  corpus of legal forms the register does not itself use, asserted green.
- Raise the priority the next time a tightening lands with its evidence in prose only. That
  is the failure this note is now about.
