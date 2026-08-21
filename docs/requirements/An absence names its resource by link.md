---
type: PBI
parent: "[[Resources as notes]]"
order: 30
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/absences.ts
  - src/storage/absenceNotes.ts
  - src/view/interactions/absences.ts
  - src/view/render/lanes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An absence names its resource by link

**As** a delivery lead, **I want** a logged absence to point at the same resource note the
work does, **so that** the days somebody is away land in that person's row instead of minting
a second person who is only ever absent.

[[Resource absences]] shipped writing the assignee key as a plain name, from a module of its
own that deliberately does not go through the batch writer — an absence is not a write target
of this backlog, so it has no batch, no captured inverse and no undo slot. That reasoning is
still right, and it is exactly why this use case is easy to miss: a sweep of the batch writer
finds nothing, and the absence writer goes on spelling a resource the old way while everything
else spells it the new way.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Adding or editing an absence from a resource's row on the roadmap |
| **Preconditions** | Absences are configured, and the row was opened on a resource that has a note |
| **Guarantee** | One fact has one spelling: an absence names its resource in the identical form the work does, so no absence can mint a row no item can be assigned to |

**Main flow**

1. The user opens the absence form from a resource's row.
2. The form names the resource by that row's note, not by its caption text.
3. The note is created with the resource written as a link, on the same key and through the
   same setter the create and edit paths already share.
4. The absence draws in that resource's row, and in no other row.

**Extensions**

- **1a — the row belongs to a resource with no note.** There is no such row after
  [[Rows from the Resource notes]]: every row is a `Resource` note the base returned, which is
  what removes the case the old form had to carry.
- **2a — the user retargets an existing absence at another resource.** The edit path writes
  the link on the same key, so a note written by the create path and edited here cannot end up
  with two spellings of one fact — the rule that module already states, over a new value
  shape.
- **3a — the link does not resolve.** The absence draws nowhere. It is not an error and does
  not become a row of its own: a row comes from a `Resource` note, and an absence is not one.
- **4a — the resource note is renamed.** Obsidian rewrites the link, and the absence follows
  its person. That is the whole reason the value is a link and not a name.

## Acceptance criteria

- The absence writer writes a link, not a name, on the same key it writes today.
- The create path and the edit path write the identical form, from the same setter.
- The absence form is driven by the row's `Resource` note. It offers no typed name, because
  there is no longer anything a typed name could mint.
- An absence whose link does not resolve renders nowhere and mints no row.
- An absence remains outside the write gate — no batch, no inverse, no undo slot. This use
  case changes the value it writes and nothing about how it writes.

## Where it lives

**Nothing yet — this note is design.** The writer exists and spells a resource as a name.

`src/storage/absenceNotes.ts` is the only place an absence reaches the vault, and holds both
the create and the edit path this use case keeps identical · `src/domain/absences.ts` carries
the facts an absence is made of · `src/view/interactions/absences.ts` is the form and the
place a typed name is offered today · `src/view/render/lanes.ts` puts the absence in a row.
