---
type: Epic
order: 230
status: Open
area: product
created: 2026-08-21
source: user request, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: "[[Sabrina]]"
priority: ""
iteration: ""
---

# My work

**"What is mine, what is next" costs a saved Base per person.** A Base can filter on
`assignee` today, so one person's work is reachable — but only by building and keeping a
view for that person. A new joiner means a new saved view, and a scrum master walking the
team in standup opens a different view for every name.

This epic makes the **person a pick in the view**: a header row of the people the vault
knows, and below it that person's work, of every type. It is the assignee's own list first
— what is mine, what is next — and the scrum master's second, because switching person is
one click rather than one saved view.

**Outcome** — Anybody's work is one view and one pick, and it is a place to work rather
than a place to look.

## What it does not own

Comparing people, summing load, or answering how much capacity a team has, belongs to
[[Product Operations]]. This epic stops at one person. That line exists because both epics
were written on the same day and both wanted the same calculation; one calculation in two
notes is how the two drift.

## Definition of done, for anything under this epic

- **The person is picked in the view, never in the Base.** One saved view serves everybody.
  The pick is device UI state like the mode toggle and the focus level, and never a `.base`
  setting — a value is one or the other, which is what ADR 0011 cost.
- **The picker lists declared people**, the resource notes of [[Resource Management]], not
  the `assignee` strings the results happen to carry. Two spellings must not be two people,
  and somebody with nothing assigned yet must still appear. Nothing under this epic ships
  before that one does; that is the accepted price of a roster that can be asked something.
- **"What is next" is plan order.** The answer is the first unfinished **result** of mine
  when the tree is walked, because plan order already says what the product owner ranked
  highest. The walk goes *through* a context row and never stops on one: a row the Base
  excluded is not actionable, so offering it as what to do next would name a row the same
  list refuses to write to. There is no personal rank either: a second `order` per person is
  a second ranking graph, and this register refuses those.
- **It is a place to work.** An item can be acted on from the list, and every such write goes
  through the same gate and the same context-row refusals as every other projection — a row
  the Base excluded is never written to. **Narrowed against the release scope's own walk,
  which this tree reuses ([[One person's tree]]):** an `outsideFilter` ancestor is not the row
  this tree draws as context — it is skipped, and the walk continues upward to the nearest
  INCLUDED ancestor, exactly as `scopeRows` does for a release. Rendering it anyway would put
  a row this base excluded on screen as scaffolding, which is a source derived from something
  outside the results; skipping it re-roots the member one level up instead. The one thing
  unchanged is the refusal itself — an excluded row, wherever it sits, is still never a write
  target.
