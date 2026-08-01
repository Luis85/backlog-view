---
type: PBI
parent: "[[codebase-health]]"
order: 100
status: Done
priority: P2
area: feature
closed: 2026-08-01
created: 2026-08-01
source: user request
files:
  - src/domain/itemTypes.ts
  - src/domain/model.ts
  - src/domain/writePlan.ts
  - src/ui/prompts.ts
---

# Issue and Bug: types that sit beside the ladder

## The request

Two new item types, `Issue` and `Bug`. Both may have `Epic`, `Feature` or `PBI` as a
parent, and both may have only `Task` as children. The row's **+** button must ask which
kind of item to create, since a row can now hold more than one.

## Why this is not a fifth level

`settings.levels` is a *ladder*: every level rule in the codebase is "one rung below the
parent" (`nextLevelIndex`), and each rung's children are the next rung down. That shape
cannot express these two types, because their position and their contents are
independent — a Bug holds Tasks whether it was raised against an Epic, a Feature or a
PBI. A fifth rung would have to be *three* rungs at once.

So the rank belongs to the **type**, not to where the item sits:

> An **extra type** is a declared type that is not a rung. It ranks at `extraTypeRank` —
> the rung whose children are the deepest level — always, and it has no `levelIndex`.

Everything asked for falls out of those two properties, which is the reason to prefer
this framing over a rules table of allowed parent/child pairs:

- **Children are always Tasks.** Its rank is pinned, so `childLevelIndex` answers with
  the deepest level under an Epic exactly as under a PBI.
- **It is never re-typed by a move.** `levelIndex === -1` already means "not a rung", and
  the autoType cascade has always skipped those as deliberate user data.
- **It may hang from Epic, Feature or PBI.** `childTypeChoices` offers it under any real
  rung above the deepest — not under a Task, which holds nothing, and not under another
  extra type, whose only children are Tasks.

## Decisions taken

Two questions changed what got built, and both were the user's to answer:

- **Advisory, not enforced.** The rules drive what is offered and what is written; no
  drag is refused. This is how the ladder has always behaved — it guides inference and
  never blocks a deliberate move — and enforcement would have meant validation in
  drop-target maths, the move/indent/outdent commands and the menu, plus a refusal
  message for each, interacting with context rows whose real siblings the view cannot
  see. Advisory keeps the feature additive.
- **A view option, on by default** (`Extra types`, default `Issue, Bug`). Hardcoding two
  English names would contradict the plugin's premise that the vocabulary is yours: a
  vault running Theme/Initiative/Story would get two words it did not choose. The cost is
  that notes already typed `Issue` start rendering as Issues on upgrade — a favourable
  change, and one a user can undo by clearing the option.

## What it touched

- `domain/itemTypes.ts` (new) — the vocabulary, and the ladder math moved out of
  `model.ts` (`childLevelIndex`, `nextLevelIndex`, `displayType`) so this could be a leaf
  the model imports while it is still building a tree.
- `computeLevel` — one branch: an extra type takes `extraTypeRank` where an *unknown*
  custom type still takes `childSlot`. That contrast is the invariant worth keeping:
  **declared pins, undeclared inherits.**
- `computeTypeChanges` — the dragged item is not re-typed when it is an extra type, and
  its subtree descends from the extra rank rather than from where it landed. Without the
  second half, dropping a Bug under an Epic would have turned its Tasks into PBIs.
- `collectFocusRoots` — an extra type has no `levelIndex` to match, so focusing its rank
  would have made it vanish from the view rather than rank beside the level it sits level
  with.
- The new-item modal gained a type picker, shown only when there is a choice; the context
  menu lists the types directly, since a menu is already a list of choices and naming
  them there is one click shorter.

## Verification

18 new tests (401 total, all green), covering the pinned rank under both the shallowest
and deepest legal parent, the contrast against an undeclared custom type, every branch of
`childTypeChoices`, the drag that must not re-type, focus re-rooting, option resolution
(cleared vs unset, dedupe, a name that is already a level), and the creation flow driven
through the real modal.

Not verifiable here, as ever: the badge. Added to the
[smoke-test checklist](smoke-test-the-visual-changes.md).

## Known limitation

An extra type ranks with the second-lowest level, so `Show completed items`, rollups and
the level breakdown all treat it as that level. This is right for a Bug beside a PBI and
arbitrary for an extra type someone configures with a different intent in mind. No
evidence yet that anyone wants otherwise — revisit if a report says so.
