---
type: Epic
order: 200
status: Open
area: product
created: 2026-08-19
source: user request, 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Storymaps

**A story map is the backlog rotated, not a second copy of it.** A product owner who has to
show stakeholders what the product does and where the next release cuts builds that picture
in Miro or storymaps.io today, and every card on it is a word rather than a note — so the
session's output is re-typed into the vault by hand and the two copies drift from the moment
either one changes. This view draws the map from the notes that are already there.

**Outcome** — The journey, its steps and the cards under them are the vault's own notes,
arranged as a map. Nothing is exported to build the picture and nothing is re-typed to act
on it.

## Why this is an epic rather than one more projection

The board and the roadmap each take the tree and re-arrange it along **one** axis — a state,
a horizon, a pair of dates. A map has two at once, and the horizontal one is a *narrative*:
what someone does, in order, which no property in this vault holds today. That is the part
that needs an epic rather than a toggle, because answering it decides what a step IS before
anything can draw one.

The answer this epic is built on is that **nothing new is invented above the PBI**. A use
case already is an activity — it names an actor, it has a flow, it is ranked among its peers.
So the map's rows are the register's own vocabulary read at a different angle:

| Row on the map | What it is in the vault |
| --- | --- |
| The map | A `Storymap` note, a declared marker beside `Iteration` — a root by nature, holding nothing, pointed at and never ranked. A PBI names its map in one property, the way work names its iteration. |
| Users | The PBI's actor, as a property. The observed values group the activity columns, exactly as the board derives its columns from the states it observes. |
| Activities | The PBIs themselves, left to right by `order` **compared across parents**, so one map can span Features. |
| Steps | `Step` notes, children of the PBI. An extra type, not a rung. |
| Cards | The `Task` children a `Step` already holds. |
| Slices | The release-membership property [[Release Planning]] specifies, so "what is in the MVP" has one home — [[A release is a note of its own]] — and this view adds no second idea of it. |

## A step is an extra type, and that was the cheaper of two true answers

The mental model puts a step between a PBI and its Tasks, which reads as a fifth rung. It is
not built as one. `LEVELS` is fixed for reasons stated where it is declared, and inserting a
rung there changes what a typeless child of a PBI MEANS in every vault that already has one,
shifts the rank every extra type is pinned to, and edits a hierarchy table that is gated both
ways.

An extra type needs none of that, because the contract the register already declares for
`EXTRA_TYPES` is a step's contract with the rung filed off: *hangs from an Epic, a Feature or
a PBI; holds Tasks; never re-typed by position.* Depth is a separate question from rung, so a
`Step` still draws under its PBI and over its Tasks. The map gets the structure it needs and
no existing vault changes behaviour.

**What it costs is a menu row nobody wants.** Extra types travel as one set repeated at every
rung, so `New Step` is offered under an Epic and under a Feature as well. That is accepted
rather than fixed: narrowing the set per type would rewrite the child-type rule, the legal
children map and that gated table for all five extra types to tidy one entry.

## Two names, and the gate already in front of them

This epic asks for `Storymap` and `Step`. Read beside the other capabilities that is not two
names, it is two more on a count that was already the subject of a decision nobody has taken
— [[Ten capabilities want seventeen new types]] — and two more badges against a palette that
[[The type palette has no unclaimed hue left]] says has nothing unclaimed, on an axis
[[A badge when the palette is full]] bought for exactly two types while refusing to answer
the general case.

Neither name is argued here. What this epic states is the **order**: the placement decision
comes first, and it is that issue's to make. Both names also sit in a bucket that issue does
not have — one is a marker and the other is an extra type, while all three of its buckets are
for types off the plan ladder — so this epic adds the question rather than claiming an answer
to it.

## Definition of done, for anything under this epic

- **Every card is a note.** No card, no column, no slice and no arrangement is stored
  anywhere but as a note or a property a human, a Bases filter or another plugin can read
  with this plugin uninstalled.
- **The tree stays authoritative.** A map is a projection of the same notes. Remove the view
  and no product knowledge goes with it.
- **A registered view type with its own options and empty state**, per [[A view per capability]],
  adding nothing to any other view's toolbar and requiring no other view to be configured.
- **Nothing ships a declared name early.** No slice adds `Step` or `Storymap` until
  [[Ten capabilities want seventeen new types]] places them and the palette question is
  answered for both.
- **A move on the map is one of the moves this plugin already makes** — re-parenting a Task
  between step columns, or writing release membership between slice rows — planned, gated and
  undoable like any other, with no third kind of move invented for the map.

## What this epic will not do

- **Round-trip storymaps.io.** No JSON, YAML or CSV import or export. The vault is the format;
  a map that has to be exported to be read is the drift this epic exists to remove.
- **Collaborate in real time.** No cursors, no viewer counts, no activity feed. Obsidian's own
  sync is whatever the vault already uses.
- **Read prose.** A PBI's `## Main flow` stays prose and is never parsed and never written.
  `Step` notes are the structure, which is why they exist at all.
- **Hide its own notes.** `Storymap` and `Step` notes will show up in a backlog base that does
  not filter them out, and the filter is the mechanism [[A view per capability]] already names.
  No hidden discriminator will be added to pretend otherwise.
