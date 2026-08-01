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

A **?** button in the toolbar opens the manual on its first section: the six item types,
what each one is for, and how the view treats them. This PBI builds the surface every
other section then lands in.

## What the section says

One entry per type, generated from the vocabulary rather than retyped beside it:

| Type | Intent | How the view treats it |
| --- | --- | --- |
| `Epic` | The outcome — a body of work with no parent above it | Top of the ladder; a root |
| `Feature` | A capability under an Epic | One rung down |
| `PBI` | A deliverable slice a team can finish | One rung down |
| `Task` | The engineering step that gets a PBI done | The deepest rung — the ladder ends here, so the only child offered under a Task is another Task |
| `Issue` | A question, verification or decision to record | Beside the ladder, under any rung above the deepest; holds Tasks |
| `Bug` | A defect raised against something that exists | The same |

Plus the three rules that are invisible on screen and decide what the view does:

- A child's level is **one rung below its parent's**, clamped at the deepest — that is
  what the ladder means, it is the level an untyped item is shown as, and the clamp is
  why a Task's **+** offers another Task rather than nothing.
- An item with **no `type`** shows the level its position implies, and nothing is written
  until you ask for it.
- **A move does not re-type anything.** Drag a PBI under an Epic and it stays a PBI;
  `Assign item type when moving` (off by default) is what turns the rewrite on, and even
  then `Issue` and `Bug` keep their pinned rank and are never re-typed.
- The rules are **advisory**: they decide what is offered, never what is refused. Any drag
  is allowed, and a deliberate structure is kept.

## Acceptance criteria

- A real `<button>` in the toolbar, sentence-case label, reachable by Tab like every other
  toolbar control, opening the manual with keyboard and mouse alike.
- Every type in `ALL_TYPES` has an entry, enforced by a test that reads the vocabulary —
  a seventh type cannot ship without its explanation.
- Each entry's "what can go under this" agrees with `childTypeChoices`, not with the
  ladder read literally: the clamp at the deepest rung means a Task offers a Task, and an
  entry saying otherwise would contradict the **+** button on the row beside it.
- The section states the pinned rank of the extra types and the advisory rule, since both
  are places a user's mental model would otherwise be wrong rather than merely incomplete.
- The **displayed level** and the **written `type`** are kept apart: position implies the
  first and, with re-typing off by default, never rewrites the second. Conflating them
  here would contradict [[Help for moving and ranking]] and teach the wrong default.
- Nothing is written and nothing is persisted by opening, reading or closing it.
- The dialog scrolls, closes on Escape, and returns focus to the button that opened it.

## Evidence

- User request, 2026-08-01 — this PBI, in these words: a help button describing and
  explaining the types, their intent, and usage.
- `src/domain/itemTypes.ts` and `src/domain/settings.ts` — `LEVELS`, `EXTRA_TYPES`,
  `extraTypeRank`, `nextLevelIndex`: the behaviour the entries have to match.
- [[Types beside the ladder]] — why the two shapes exist, and
  the two review findings that came from the pinned rank being subtle.
- [[Level ladder and implied types]] — the implied-level rule and the ladder being fixed.
- `README.md`, sections *How it works* and *Issues and bugs sit beside the ladder* — the
  long form this section condenses.
