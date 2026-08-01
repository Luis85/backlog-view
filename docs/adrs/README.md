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

| # | Decision | Status | Area |
| --- | --- | --- | --- |
| [0001](0001-build-on-the-bases-custom-view-api.md) | Build on the Bases custom view API | Accepted | platform |
| [0002](0002-keep-the-hierarchy-in-frontmatter.md) | Keep the hierarchy in frontmatter | Accepted | domain |
| [0003](0003-four-layers-enforced-by-lint.md) | Four layers, enforced by lint | Accepted | architecture |
| [0004](0004-one-write-boundary-planning-separate-from-applying.md) | One write boundary, planning separate from applying | Accepted | architecture |
| [0005](0005-ship-with-no-runtime-dependencies.md) | Ship with no runtime dependencies | Accepted | tooling |
| [0006](0006-jsdom-is-the-substitute-for-obsidian.md) | jsdom is the substitute for Obsidian | Accepted | testing |
| [0007](0007-npm-run-check-is-the-whole-gate.md) | `npm run check` is the whole gate | Accepted | tooling |
| [0008](0008-rank-siblings-with-fractional-orders.md) | Rank siblings with fractional orders | Accepted | domain |
| [0009](0009-the-type-rules-are-advisory.md) | The type rules are advisory, never enforced | Accepted | domain |
| [0010](0010-load-excluded-ancestors-as-context-rows.md) | Load excluded ancestors as context rows | Accepted | domain |
| [0011](0011-keep-collapse-state-out-of-the-base-file.md) | Keep collapse state out of the `.base` file | Accepted | storage |
| [0012](0012-make-the-type-vocabulary-configurable.md) | Make the type vocabulary configurable | **Superseded** by 0013 | domain |
| [0013](0013-fix-the-type-vocabulary-at-six-names.md) | Fix the type vocabulary at six names | Accepted | domain |
| [0014](0014-rank-extra-types-by-type-not-by-position.md) | Rank extra types by type, not by position | Accepted | domain |
| [0015](0015-undo-by-captured-inverses.md) | Undo by captured inverses, not snapshots | Accepted | storage |
| [0016](0016-break-compatibility-freely-before-1-0.md) | Break compatibility freely before 1.0 | Accepted | platform |
| [0017](0017-bounded-undo-history-with-an-explicit-redo.md) | Bounded undo history with an explicit redo | **Proposed** | storage |
