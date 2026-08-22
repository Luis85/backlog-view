---
type: Epic
order: 4.9805
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

# Backlog Health

**A backlog decays quietly.** Items lose their parent, their type, their estimate or their
point; nothing breaks, and the list goes on looking like a plan. This view runs stated rules
over the backlog, lists what each one found, explains why it matters, and offers the safe
repairs.

**Outcome** — The parts of the backlog that have stopped being trustworthy are visible, and
the cheap ones can be fixed from the list.

## Why it is its own view

Every other view answers a question about the work; this one answers a question about the
data the other views depend on, which is why the requirements document puts it in the first
wave beside the backlog itself. Its settings are rules, thresholds and severities — nothing
another view has any use for — and its output is a list of findings, not a projection of the
tree.

The register already argues the underlying point in its own words: an invariant asserted in
a comment is not a check. A backlog convention nobody can run is the same thing one level
up.

## Definition of done, for anything under this epic

- Every rule is stated, individually enabled, and explains what it found in terms a reader
  can disagree with. A finding names the item, the rule and the reason.
- A number summarizing health can always be taken apart into the findings that produced it.
- A fix is offered only where it is unambiguous, is a normal gated write, and is undoable.
  Nothing is repaired without being asked.
- Nothing is deleted, ever, and "archive" means whatever the vault configured it to mean.

## What this epic will not do

- **Enforce.** No rule refuses a write, hides an item, or blocks anything. The plugin's
  standing rule is that rules decide what is offered, never what is refused.
- **Guess intent.** An item missing an estimate is reported, not estimated.
