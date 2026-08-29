---
type: PBI
parent: "[[What a resource carries]]"
order: 30
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/settings.ts
  - src/domain/settingsResolve.ts
  - src/domain/optionalProperties.ts
  - src/domain/viewOptions.ts
  - src/domain/readItems.ts
  - src/domain/roadmap.ts
  - src/view/cardMoves.ts
  - src/view/interactions/labels.ts
  - src/view/render/lanes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Retiring a resource

**As** a delivery lead, **I want** to mark somebody as no longer on the team without deleting
their note, **so that** they stop being offered for new work while everything they did stays
attributed to them.

One flag on the resource's note. **Retiring changes what is offered, never what is drawn.**
An inactive resource with work still on them keeps their row and keeps their bars — otherwise
marking somebody inactive would hide unfinished work, and a plan that quietly loses items is
the one failure mode the resources axis exists to prevent.

That is the whole rule, and it is the half that is easy to get wrong: "inactive means no row"
is the obvious implementation and it deletes information from the screen.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Marking a resource inactive on their note, or opening the assignee menu afterwards |
| **Preconditions** | The active key is configured |
| **Guarantee** | No work becomes invisible and no attribution changes. An inactive resource keeps their row for as long as anything names them, and every item that names them still says so |

**Main flow**

1. The user sets the flag on a resource's note.
2. That resource stops appearing in the assignee menu, so no new item can be given to them.
3. Their row stays on the roadmap while anything is still assigned to them, marked as
   inactive, with every bar where it was.
4. When nothing names them any more, the empty row goes: an inactive person with no work is
   the one case that needs no row at all.

**Extensions**

- **1a — the key is not configured.** Nobody is inactive, and nothing changes anywhere.
- **2a — an item already names an inactive resource.** It keeps naming them. Nothing is
  reassigned, nothing is cleared, and the chip reads exactly as it did.
- **2b — the user wants to assign work to an inactive resource anyway.** They un-retire them.
  This use case does not add an override, because an override is how a flag stops meaning
  anything.
- **3a — the reader drops a card into an inactive resource's row.** Refused, with the reason
  said out loud. A row that is on screen and not a target has to explain itself, or it reads
  as a bug.
- **3b — an absence names an inactive resource.** It still draws in their row, for as long as
  the row is there. An absence is a fact about a person, not an offer of work.
- **4a — the last item is moved off an inactive resource.** Their row goes on the next
  refresh. Their note is untouched: retiring is a property, and nothing here deletes anything.

## Acceptance criteria

- One key, one flag, read as written. With the key unconfigured, nobody is inactive.
- An inactive resource is absent from every menu that offers a resource, including
  `New resource...`'s suggestions and the absence form's picker.
- An inactive resource **keeps their row while anything names them**, is marked as inactive on
  it, and every bar stays where it was.
- An inactive resource with nothing assigned draws no row.
- Their row refuses drops, keyboard moves and menu moves alike — one refusal, at the one place
  a card move is planned, not three guards at three inputs.
- Nothing is reassigned, cleared or rewritten when a resource is retired. It is one property
  on one note.
- The key joins the optional properties the toolbar's setup action binds and backfills
  ([[Backfill missing properties]]).

## Where it lives

**Nothing yet — this note is design.**

`src/domain/settings.ts`, `src/domain/settingsResolve.ts` and `src/domain/viewOptions.ts`
carry the key · `src/domain/optionalProperties.ts` holds the suggested name and the backfill ·
`src/domain/readItems.ts` reads the flag · `src/domain/roadmap.ts` decides which resources get
a row, which is where "inactive, but still named" is answered · `src/view/cardMoves.ts` is the one place a
card move is planned, so it is the one place the refusal belongs ·
`src/view/interactions/labels.ts` filters the menu · `src/view/render/lanes.ts` marks the row.
