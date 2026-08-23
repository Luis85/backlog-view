---
type: Epic
order: 6.25
status: Open
area: product
created: 2026-08-23
source: interview, 2026-08-23
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Product Marketing and sales

**The go-to-market work, in the vault that holds the product it is about.** Campaigns and
the content they produce, the personas they aim at, the positioning they argue from and
the channels they go out on — kept as notes, ranked as a plan of their own, and linked to
the features they are about rather than pasted from them.

**Outcome** — Somebody who markets the product plans it where the product is specified,
and a claim about a feature is a link to that feature rather than a copy of it.

## Why it exists

Marketing runs on its own cadence. A campaign is not scheduled by what engineering ships
this sprint, and the person running it uses a separate board — which costs three things at
once: **nothing connects**, so "what are we marketing that we are also building" is a
question answered by hand in two windows; **the copy drifts**, because what the other tool
says about a feature was true when it was pasted and nothing tells anybody when it stops
being true; and the work is **invisible**, so from the product side a launch is not work at
all.

That is the same gap the 2026-08-16 requirements document opens with — *"product decisions
remain directly connected to the knowledge, evidence, requirements, decisions, and
documentation that justify them"* — arriving one hop further out than that document drew
its boundary. **This epic knowingly extends the stated positioning.** The PRD scopes the
plugin between knowledge management, discovery, strategy, prioritization, planning and
backlog management, and ends its value chain at Review; marketing and sales are outside
it. The document is evidence and is kept unedited, so the disagreement is recorded here
rather than resolved by rewriting the source: the argument for going further is the PRD's
own principle, since a positioning claim that lives in another SaaS platform is exactly
the disconnection the whole architecture exists to refuse.

## A ladder of its own, and a view of its own

`Campaign` holds `Content asset`, and **neither type is ever a child of `Epic`, `Feature`
or `PBI`** — the shape [[Test suite and test case as a ladder of their own]] already built,
and for the same reason: the relationship between a campaign and the work it markets is a
link, and a schema offering two ways to say it would get both. A `Campaign` is a root by
nature. Marketing work therefore enters no rollup in the plan, holds no rank among
features, and cannot make a shipped feature look unfinished.

It is a **dedicated Bases view**, which is [[A view per capability]] applied rather than
argued: a vault that does no marketing installs no marketing view and meets none of its
settings, and this view reaches the others only through properties and links in the vault.

Two names, not six, and that is a decision rather than a first slice. `Persona`,
`Positioning` and `Channel` are ordinary notes addressed only by link, the way an ADR is —
they are pointed at, never ranked, which is the default
[[Ten capabilities want seventeen new types]] states for exactly this case. What a piece of
collateral *is* — a battlecard, a one-pager, a pricing sheet — is a configured value on a
content asset, the shape [[Kinds of evidence]] uses, not a type of its own.

## Definition of done, for anything under this epic

- **The two ladders never merge.** No drag, drop, indent, outdent or Set type moves a note
  between the marketing ladder and the plan, and no marketing note ever acquires a level in
  `Epic → Task`.
- **A marketing note links a product fact; it never copies one.** This is the whole answer
  to the drift the epic exists to end, so a feature that spells out what a note elsewhere
  already says is a defect under this epic rather than a convenience.
- **One deliberate crossing, stated where it happens.** A `Campaign` has a timeframe, so it
  draws on the roadmap's dated axis as its own row — because that view's own declared axis
  finds the date properties on the note, never because it learns anything about this one.
  Nothing else crosses: the backlog tree,
  the board and the Deliverables board ignore the marketing types entirely, the way they
  already ignore the test types. A rung of a foreign ladder on a plan projection has no
  precedent here — [[Milestones as their own type]] and the iteration are markers, which is
  a different genus — so the cost of that one crossing belongs in the note that builds it.
- **A content asset's workflow is this view's own, and reaches for nobody else's.** Its
  state property, its ordered states and its done values are settings of the marketing view,
  defaulting to this view's own suggestions the way every view's do. It does **not** fall
  back to the requirements or Deliverables board's fields, and an earlier draft of this note
  said it did: those two are projections inside one other view, so the field-by-field
  fallback [[Deliverables as a rootable extra type]] uses is legal between them and is the
  coupling [[A view per capability]] refuses across a view boundary — *"no view requires
  another to be present or configured"*, with *"no exception to that contemplated"*. An
  unconfigured key here is read as nothing, never as an error.
- **The boundary against `Deliverable` is the audience, and every note under this epic can
  be judged against it.** A `Deliverable` is produced for the team's own construction — a
  concept, a design, a spec — and lives in the work tree. A `Content asset` is produced for
  an audience outside the team and lives on the marketing ladder. A reader with a note in
  front of them can apply that test; "whichever ladder you filed it on" is not a boundary.

## What this epic will not do

- **No CRM.** No deal, no account, no pipeline, no quota, no revenue, ever. Sales here is
  the material that supports a conversation, never a record of one. A vault holding deal
  records is a different product with different privacy questions, and the register's own
  precedent for drawing this kind of line is [[Product Analytics]] refusing product
  telemetry to stay answerable.
- **No campaign execution.** Nothing sends, schedules, posts or publishes anything. A
  channel is a note that says where something went, not an integration.
- **No metrics.** Reach, conversion and pipeline influence are measurements of the market,
  and nothing in this vault can see them.

## What has to happen before any of this ships

[[Ten capabilities want seventeen new types]] is Open at P1 and its acceptance criteria
bind this epic by name: *"No capability epic ships a type until its bucket is recorded
here."* `Campaign` and `Content asset` belong in that issue's **bucket 2** — a ladder of its
own — and the two of them are one family arriving together, which is the one argument
[[The type palette has no unclaimed hue left]] left open when it refused to close as a
general answer and which [[A badge when the palette is full]] restates for a lone type. That
placement is an edit to that issue rather than a section of this epic, and it comes first.
