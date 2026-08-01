# docs/adrs — architecture decision records

Decisions about **how this plugin is built**, not about what it should do. The backlog in
`docs/requirements/` says what the product does and why someone wants it; these say what
was chosen to make that possible, what it cost, and what would make us choose again.

An ADR earns its place when **an alternative was genuinely available**. A record that
could only ever have gone one way is documentation, not a decision — it belongs in a
`CLAUDE.md` beside the code.

## Not part of the backlog

These notes are deliberately outside the work-item hierarchy: **no `parent` and no
`type` at all** — an ADR's frontmatter carries `adr`, `title`, `status`, `date` and
`area`, and nothing the view reads. The consequence is worth knowing, because it is the
plugin's own behaviour applied to itself — the base filters on `file.inFolder("docs")`,
so these files **are** returned by the query, and [[What counts as a work item]] then
drops them: a note belongs if it has a supported type *or* a parent, and an ADR has
neither. The toolbar counts them in its "not backlog items" advisory, which is the
honest report.

If that advisory becomes noise, narrow the base's filter to exclude this folder rather
than giving these notes a `parent` — a decision record is not a work item, and making one
look like a Task to quiet a counter would put a lie in the register.

## Frontmatter

```yaml
---
adr: 7                    # the number, matching the filename
title: A short imperative # what was decided, not what was discussed
status: Accepted          # see below
date: 2026-07-30          # when it was decided, not when it was written up
area: architecture        # architecture · domain · platform · storage · testing · tooling
supersedes: 3             # optional, the ADR this replaces
superseded-by: 13         # optional, the ADR that replaced this one
---
```

**Status** is one of:

| | |
| --- | --- |
| `Accepted` | In force. The code follows it. |
| `Superseded` | Replaced by a later ADR, which must be named in `superseded-by`. The record stays: why it was reversed is usually more useful than the reversal. |
| `Proposed` | Written down, not yet acted on. |

A superseded ADR is **never edited to say the new thing** and never deleted. It is the
evidence for why the new one exists.

## Body

Four headings, in this order, plus one that is this project's own habit:

| Heading | Answers |
| --- | --- |
| **Context** | What forced a choice. Facts, not preferences. |
| **Decision** | What we do, stated so code can be checked against it. |
| **Consequences** | What follows — including what got harder. An ADR with only good consequences has not been thought about. |
| **Alternatives** | What was rejected, and the specific reason. "Simpler" is not a reason; "cost N and bought a rename" is. |
| **Revisit when** | The observation that would reopen it. Every decision here is provisional; this says what evidence would change it, so a future reader argues with the trigger rather than with the conclusion. |

## The records

Linked here so every record is reachable from one place; **not** restated here, because a
second copy of a status or an area is one this page could say wrong the day after the
record itself changes. Open a record for its current status, area and any
`supersedes`/`superseded-by` link — that frontmatter is the one copy worth trusting.

- [0001 — Build on the Bases custom view API](0001-build-on-the-bases-custom-view-api.md)
- [0002 — Keep the hierarchy in frontmatter](0002-keep-the-hierarchy-in-frontmatter.md)
- [0003 — Four layers, enforced by lint](0003-four-layers-enforced-by-lint.md)
- [0004 — One write boundary, planning separate from applying](0004-one-write-boundary-planning-separate-from-applying.md)
- [0005 — Ship with no runtime dependencies](0005-ship-with-no-runtime-dependencies.md)
- [0006 — jsdom is the substitute for Obsidian](0006-jsdom-is-the-substitute-for-obsidian.md)
- [0007 — `npm run check` is the whole gate](0007-npm-run-check-is-the-whole-gate.md)
- [0008 — Rank siblings with fractional orders](0008-rank-siblings-with-fractional-orders.md)
- [0009 — The type rules are advisory, never enforced](0009-the-type-rules-are-advisory.md)
- [0010 — Load excluded ancestors as context rows](0010-load-excluded-ancestors-as-context-rows.md)
- [0011 — Keep collapse state out of the `.base` file](0011-keep-collapse-state-out-of-the-base-file.md)
- [0012 — Make the type vocabulary configurable](0012-make-the-type-vocabulary-configurable.md)
- [0013 — Fix the type vocabulary at six names](0013-fix-the-type-vocabulary-at-six-names.md)
- [0014 — Rank extra types by type, not by position](0014-rank-extra-types-by-type-not-by-position.md)
- [0015 — Undo by captured inverses, not snapshots](0015-undo-by-captured-inverses.md)
- [0016 — Break compatibility freely before 1.0](0016-break-compatibility-freely-before-1-0.md)
- [0017 — Bounded undo history with an explicit redo](0017-bounded-undo-history-with-an-explicit-redo.md)
