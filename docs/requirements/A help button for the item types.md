---
type: PBI
parent: "[[User manual]]"
order: 10
status: Done
priority: P1
created: 2026-08-01
source: user request
files:
  - src/view/render/toolbar.ts
  - src/ui/prompts.ts
  - src/domain/itemTypes.ts
  - src/domain/settings.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-09
due: 2026-08-10
risk: ""
assignee: ""
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
- **4a — the reader wants to know what a move does to a type.** It does nothing: the
  section says so flatly, because a qualifier here would describe a view the reader does
  not have. An option that made moves re-type existed until 2026-08-11 and this extension
  used to be about stating its default correctly.
- **4b — the user drags a Task under an Epic.** Nothing refuses it. The section says the
  type rules are advisory, and scopes that to type compatibility: other drops *are* refused
  (onto an item's own descendant, into a group with no shared ranking) and those belong to
  [[Help for moving and ranking]].
- **4c — the user drags a `Task` out of a `Test suite` and onto the plan's top level.**
  That one *is* refused, and it is the only class of move refused for a **type** reason —
  4b's refusals stand beside it, for reasons that are not about type at all. The two ladders are
  drawn as separate projections, and a `Task` or a note with no `type` reads its ladder
  from where it hangs, so the row would leave the screen it was moved on. The entry states
  it as exactly that — leaving the projection, never a rule about types — names the drag,
  the outdent and BOTH parent-link actions together, and says the two rows it can happen to,
  since every other type answers from its own name and a backlog with no tests in it is
  refused nothing here. See [[Test suite and test case as a ladder of their own]].
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
- The projection refusal is written to the check and no wider: the two rows it can happen
  to are **named**, the reason given is the row leaving the screen it was moved on, and the
  narrowing sentence stands beside it — every other type keeps its own ladder wherever it
  lands, so a backlog with no tests in it is refused nothing here. Without that last
  sentence the entry would be as false as the "no drag is ever refused" it replaced, in the
  other direction. Those three are what `test/view/manualTypes.test.ts` asserts; that no
  OTHER sentence in the entry reads too widely is not something a substring check can see.
- `Task` is stated as **offered** in the test catalog, since it is the rung both ladders
  share. A sentence withholding "the plan's levels" there contradicts this same section's
  `Test case` entry ("Holds Tasks") two entries apart, and contradicts the view — see
  `test/view/testCatalog.test.ts`.
- `Set type` is described as narrowing in **every** projection, since each offers what it
  can draw. The two boards are one case of that rule rather than the whole of it, and the
  row's own **+** is not described as narrowed by it.
- The **displayed level** and the **written `type`** are kept apart: position implies the
  first and never rewrites the second.
- Nothing is written and nothing is persisted by opening, reading or closing it.
- The dialog scrolls, closes on Escape, and returns focus to the button that opened it.

## Where it lives

The dialog and its one opener are `src/ui/manualDialog.ts` — a `ui/` leaf that takes its
sections as a parameter, because `ui/` may not reach `domain/`. Its appearance is
`styles/manual.css`, which draws the split and lets Obsidian's own settings-modal rules
draw everything else.

The types section itself is `src/view/manual/typesSection.ts`, generated from `ALL_TYPES`
in `src/domain/typeVocabulary.ts` — the composition layer, which may reach `domain/` where the
dialog may not, and which is therefore where a badge class is resolved from a type name.

The **?** itself is `src/view/render/toolbar.ts` — a `.pbl-help-btn` in the toolbar's
zone 4, shed to the `⋯` at fit step 2 — and its overflow mirror is in
`src/view/render/toolbarControls.ts`'s `overflowEntries`, which opens the same dialog
without going through `pickAndRefocus` (a modal takes focus deliberately).
