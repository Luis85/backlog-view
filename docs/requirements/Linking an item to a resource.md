---
type: PBI
parent: "[[Resources as notes]]"
order: 20
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/settings.ts
  - src/domain/vocabulary.ts
  - src/domain/writePlan.ts
  - src/domain/roadmap.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/labels.ts
  - src/view/render/columns.ts
  - src/ui/prompts.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Linking an item to a resource

**As** a delivery lead, **I want** an item to point at a resource's note rather than repeat
their name, **so that** two spellings stop being two people and opening "who has this" opens
the person.

This is the breaking half of [[Resources as notes]]. The property keeps its key and its
mapping ([[Setting the assignee on an item]] named it and nothing about that changes) — only
the **value** changes shape, from a name to `"[[Sarah]]"`, the same wikilink form `parent`
already uses. A rename in Obsidian then updates every item that names them, which is the
whole reason for the shape.

**A name that is not a link is not a resource.** No fallback, no coexistence, no migration:
the epic states that cost and why it is being paid.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Setting who is on an item — from the row's chip, the card menu, or a drop onto a resource row |
| **Preconditions** | The assignee property is configured. Setting a resource does not require any resource property to be |
| **Guarantee** | The value written is a link to a note or nothing at all. A plain name is never written by this view, and an unconfigured key is never written to |

**Main flow**

1. The user opens the assignee chip on a row or a card.
2. The menu lists the `Resource` notes the base returned, plus `Clear`, plus
   `New resource...`.
3. The user picks one, and one gated batch writes the link to the assignee key.
4. The chip shows the resource's name — the note's own title, resolved through the link,
   never the raw `[[...]]` text.
5. The roadmap's resources axis puts the item in that resource's row, by the dates it already
   reads ([[The timeline]]).

**Extensions**

- **2a — no `Resource` note is in the results.** The menu offers `New resource...` and
  nothing else, and says so rather than opening empty. That is the same failure the roadmap
  reports from the other end ([[Rows from the Resource notes]]), and it is a base-filter
  problem both times.
- **2b — the row is a context row.** No menu at all. An `outsideFilter` item renders its
  assignee as a static chip and is never a write target, exactly as it does today; nothing in
  this use case relaxes that.
- **2c — the user picks `New resource...`.** The note is created first, through the ordinary
  gated creation path, and the link written to the item in the same action. Two writes,
  because a link to a note that does not exist is the one value this use case must not
  produce.
- **3a — the picked resource is what the item already names.** The plan writes nothing, and
  the menu's checkmark comes from that plan rather than from a comparison beside it. This is
  the rule two properties already drifted on once, and a link is a third value shape for it
  to drift on.
- **4a — the link does not resolve.** It renders as its text, unstyled, and carries no
  properties and no row. That covers both the note somebody deleted and the plain string left
  over from before this shipped — the same treatment [[Broken links still render]] gives every
  other link this view draws, so it needs no rule of its own.
- **5a — the assignee property is not configured.** Nothing is read and nothing is written,
  and no menu appears. Absence is a value, and an unconfigured key is never written to.

## Acceptance criteria

- The value written is a wikilink, quoted so YAML keeps it, and the plan is the single source
  of both the write and the menu's checkmark.
- Every reader of the assignee property resolves the link: the property column's chip, the
  card, the roadmap's row membership, and the drop target. A reader that still compares raw
  text is a reader that silently draws an empty row.
- **Case folding over a resource name is gone.** A link resolves or it does not. The
  case-insensitive comparison the typed roster needed has no meaning here, and every site
  still doing it is a site still thinking in strings.
- A value that is not a link resolves to nobody: no row, no chip styling, no menu entry, no
  membership. It is not an error and is not repaired.
- `New resource...` creates the note before it writes the link, and a failed creation writes
  no link.
- A context row is never a write target and its assignee is never a source of vocabulary —
  the resources a menu offers come from result rows alone.
- The write is one batch through the existing gate, with one inverse, and one undo slot.

## Where it lives

**Nothing yet — this note is design.** The write it needs already exists and plans the wrong
value shape.

`src/domain/writePlan.ts` holds `computeAssigneeWrites`, which plans the value this use case
changes · `src/storage/frontmatter.ts` writes it through `applyLabels`, the one loop over the
plain label properties — a link is still a plain value, so this must not grow a fourth shape
· `src/domain/vocabulary.ts` observes what the results carry, and is where "every name on a
note" becomes "every resource note" · `src/view/interactions/labels.ts` builds the menu and
the roster union this use case collapses · `src/view/render/columns.ts` draws the chip ·
`src/domain/roadmap.ts` decides which row an item sits in · `src/ui/prompts.ts` suggests the
names · `src/domain/settings.ts` carries the key.
