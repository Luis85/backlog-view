---
type: PBI
parent: "[[User manual]]"
order: 10
status: Open
priority: P1
created: 2026-08-01
source: user request
files:
  - src/view/render/toolbar.ts
  - src/ui/prompts.ts
  - src/domain/itemTypes.ts
  - src/domain/settings.ts
---

# A help button for the item types

**As** someone meeting a typed backlog for the first time, **I want** to ask what an Epic,
a PBI or a Bug is actually *for* without leaving the view, **so that** I pick the right
type deliberately instead of inferring it from a coloured badge.

A **?** button in the toolbar opens the manual on its first section: every item type in
the vocabulary, what each one is for, and how the view treats them. This use case builds
the surface every other section then lands in.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Clicking the **?** button in the toolbar, or opening the manual from anywhere that deep-links to this section |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Reading the manual writes nothing: no note is created, no frontmatter is touched, and nothing about the dialog is persisted to the `.base` or to local storage. |

**Main flow**

1. The user clicks **?** in the toolbar.
2. The manual opens on the types section, scrolled to the top.
3. The section names every type in the vocabulary — generated from `ALL_TYPES` rather
   than retyped beside it — with its intent and what the view offers under it.
4. It then states the three rules that decide behaviour and are invisible on screen: a
   child's level is one rung below its parent's *clamped at the deepest*, an untyped item
   is shown at the level its position implies, and a move does not re-type.
5. The user closes the dialog with Escape or the close button; focus returns to the **?**.

**Extensions**

- **1a — the user has no mouse.** The **?** is a real `<button>` in the toolbar's tab-stop
  zone, so Tab reaches it and Enter or Space opens the manual, unlike the per-row controls
  inside the tree's single stop.
- **3a — a `Task` row.** `childLevelIndex` clamps at the deepest rung, so `childTypeChoices`
  answers `Task` for a Task parent and the row's **+** offers another Task. The entry says
  so; "holds nothing" would be the ladder read literally and would contradict the button
  beside it.
- **3b — another type is added later.** The section is generated from `ALL_TYPES`, so a
  type without an explanation fails a test rather than shipping as a gap.
- **4a — `Assign item type when moving` is on.** The rule is stated with its default (off)
  and its effect when enabled, so the section describes the view in front of the reader
  rather than the one the option would make.
- **4b — the user drags a Task under an Epic.** Nothing refuses it. The section says the
  type rules are advisory, and scopes that to type compatibility: other drops *are* refused
  (onto an item's own descendant, into a group with no shared ranking) and those belong to
  [[Help for moving and ranking]].
- **5a — the manual was opened from another section's link.** Closing returns focus to
  whatever opened it, so the dialog never strands the keyboard at the top of the pane.

## Acceptance criteria

- A real `<button>` in the toolbar, sentence-case label, reachable by Tab like every other
  toolbar control, opening the manual with keyboard and mouse alike.
- Every type in `ALL_TYPES` has an entry, enforced by a test that reads the vocabulary —
  a type added without an explanation cannot ship.
- Each entry's "what can go under this" agrees with `childTypeChoices`, not with the
  ladder read literally: the clamp at the deepest rung means a Task offers a Task, and an
  entry saying otherwise would contradict the **+** button on the row beside it.
- The section states the pinned rank of the extra types and the advisory rule, since both
  are places a user's mental model would otherwise be wrong rather than merely incomplete.
- "Advisory" is scoped to **type compatibility**, not to drops in general: `isInvalidParent`
  and the reorderable-group checks do refuse drops, and an unqualified "any drag is
  allowed" contradicts [[Help for moving and ranking]] as well as the view.
- The **displayed level** and the **written `type`** are kept apart: position implies the
  first and, with re-typing off by default, never rewrites the second.
- Nothing is written and nothing is persisted by opening, reading or closing it.
- The dialog scrolls, closes on Escape, and returns focus to the button that opened it.

## Where it lives

**Nothing yet — this note is design.** The button joins the toolbar in
`src/view/render/toolbar.ts`; the vocabulary the section is generated from is
`src/domain/itemTypes.ts` and `src/domain/settings.ts`; the dialog belongs beside
`src/ui/prompts.ts`, which is the existing example of a modal that takes its content as a
parameter rather than reaching for app structure.
