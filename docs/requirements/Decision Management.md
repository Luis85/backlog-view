---
type: Epic
order: 190
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

# Decision Management

**Plans change, and the reason is what gets lost.** A decision to reprioritize, defer or
drop something leaves a reordered backlog and no record of why it was reordered. This view
keeps decisions as notes, links them to what they affected, and reads them back in the order
they were taken.

**Outcome** — When somebody asks why this is no longer being built, the answer is in the
vault next to the work.

## Why it is its own view

This register has believed the underlying claim since its first page: a closed note is kept
because its outcome is the record of why the code looks as it does, and an ADR exists so an
alternative already refused is not re-proposed. A decision register is that argument applied
to the product plan instead of the architecture — and it is a chronology, which no other
view here draws.

It is deliberately not the ADR folder. An ADR records how the plugin is built; a decision
records what the product chose. Same instinct, different subject, and the two must not be
filed together.

## Definition of done, for anything under this epic

- A decision is an ordinary note with a date and a status, readable without the plugin.
- What a decision affected is a link from one side; nothing is copied into the items.
- Nothing here reconstructs history. A decision exists because somebody wrote it.

## What this epic will not do

- **Event-source the vault.** No log of every property edit, no automatic capture of what
  changed. The requirements document rules that out explicitly, and it is right to: a record
  of every edit is not a record of a decision.
