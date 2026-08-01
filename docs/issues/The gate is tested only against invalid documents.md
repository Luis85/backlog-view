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

## The evidence

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

## Acceptance criteria

None yet. Start it the next time `docs-check.mjs` is changed at all — every fix so far has
tightened a match, and tightening is exactly the operation that creates false failures.
