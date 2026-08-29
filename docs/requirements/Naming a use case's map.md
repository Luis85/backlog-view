---
type: PBI
parent: "[[A storymap is a note of its own]]"
order: 20
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Naming a use case's map

**As** someone assembling a journey, **I want** to say which map a use case belongs to,
**so that** the map draws it without me copying the use case anywhere.

One property on the PBI, holding a link to a storymap — the shape work already uses to name
its release and its iteration. Membership lives on the item, in one place, and the map holds
no list that could disagree with it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking a map from the use case's `Set map` menu |
| **Preconditions** | The map property is configured, and at least one storymap note exists |
| **Guarantee** | Exactly one value is written to the use case's own map property, through the one gate, undoable as one batch. An unconfigured property is never written to, and no storymap note is edited. |

**Main flow**

1. The user opens a use case's context menu and picks a storymap under `Set map`.
2. The view plans one write: the link to that map, into the configured property.
3. The gate applies it, and the item appears on that map on the write's own refresh.
4. Undo takes it back as one batch.

**Extensions**

- **1a — the item is already on that map.** The entry is checked, no write is planned, and
  the undo slot is not consumed. The checkmark is asked of the plan, never of a comparison
  written beside it.
- **1b — the item is on no map, or is being taken off one.** `No map` is an entry like any
  other and removes the key rather than writing an empty value. Absence is a value.
- **1c — the property is not configured.** The menu offers nothing and says why, and the
  toolbar's binding action is the way out. Nothing is written to a key nobody has named.
- **1d — the row is outside the base's filter.** `Set map` is withheld entirely, like every
  other state and type action on a context row.
- **2a — the user cannot use a menu.** The keyboard reaches the same entries and writes the
  identical batch.

## Acceptance criteria

- The map property is optional and unconfigured by default; with no key bound, no menu
  appears and no write is attempted.
- Picking the map an item already has plans an empty batch, and the undo slot is unchanged
  after it.
- `No map` deletes the key rather than writing `""`, verified by reading the frontmatter
  after the write.
- A context row offers no `Set map` entry, and a batch that would target one is refused
  whole — the existing structural check, not a filter.
- The write is one batch and one undo, whichever input produced it.

## Where it lives

The key is one more entry in `src/domain/optionalProperties.ts`, surfaced by
`src/domain/viewOptions.ts`. The batch is planned in `src/domain/writePlan.ts` and applied by
`applyLabels` in `src/storage/frontmatter.ts` — the loop that already pairs a planned value
with a configured key for the risk, the priority and the assignee, which is why a fourth label
property costs a row in that list and no new shape. The menu path is
`src/view/interactions/menu.ts` and `src/view/interactions/labels.ts`, over the gate in
`src/view/writeGate.ts`.
