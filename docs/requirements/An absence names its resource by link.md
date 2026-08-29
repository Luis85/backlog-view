---
type: PBI
parent: "[[Resources as notes]]"
order: 30
status: Done
created: 2026-08-20
source: user request
files:
  - src/domain/absences.ts
  - src/domain/noteFields.ts
  - src/domain/roadmap.ts
  - src/storage/absenceNotes.ts
  - src/storage/createNote.ts
  - src/ui/prompts.ts
  - src/view/interactions/absences.ts
  - src/view/render/lanes.ts
started: 2026-08-29
finished: 2026-08-29
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
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

`src/domain/absences.ts`: `Absence.resource` and `AbsenceFacts.resource` are `LinkEntry`
rather than `string`, and `readAbsence` reads the resource through the same
`readFirstLinkEntry` helper the assignee uses. `absenceTitle` takes the collision-aware LABEL
as its own argument rather than reading `facts.resource.file.basename` — added 2026-08-29
once two `Resource` notes sharing a basename in different folders turned out to derive the
identical absence name (see [[Resource absences]] 4l and 4o for the cost this still leaves).

`src/domain/noteFields.ts` gained `readFirstLinkEntry` exported (moved from `readItems.ts`,
private there) so `absences.ts` can read a link without an import cycle back through
`readItems.ts`.

`src/domain/roadmap.ts`'s `deriveLanes` attaches an absence to its row by
`byPath.get(absence.resource.file.path)` — the same map `placeAssigned` looks up into for an
item's assignee — never a name or label scan.

`src/storage/absenceNotes.ts` is the only place an absence reaches the vault, and both
`createAbsenceNote` and `updateAbsenceNote` write the resource as a wikilink on the assignee
key, from the same setter, which is what keeps 2a unreachable — every row is now a `Resource`
note the base returned. `src/storage/createNote.ts`'s `sanitizeTitle` is where 4o's residual
ambiguity comes from: the character-class fold that makes a filename safe is what two
distinct disambiguated labels can still collide on.

`src/ui/prompts.ts`'s absence prompt takes a chosen resource id (a note path) rather than a
typed name — there is no longer anything a typed name could mint, since [[Rows from the
Resource notes]] made every row a `Resource` note.

`src/view/interactions/absences.ts` is the form, driven by the row's own `Resource` note
rather than by its caption text, for both the create and the edit path. `src/view/render/lanes.ts` puts the absence in that resource's row and reads
`absenceTitle`/`absenceSaid` back through the same label.
