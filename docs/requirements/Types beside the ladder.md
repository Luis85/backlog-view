---
type: PBI
order: 30
parent: "[[Work item hierarchy]]"
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

**As** someone tracking work that is not a plan, **I want** to raise an Issue or a Bug
against any level of the backlog and break it into Tasks, **so that** a defect found
against an Epic and one found against a PBI are the same kind of thing, filed where the
problem actually is, without pretending either is a Feature.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an item under a row, or setting an existing item's type |
| **Preconditions** | The parent row is an `Epic`, `Feature` or `PBI` |
| **Guarantee** | An extra type is never re-typed by a move. Its rank is a property of the type, so no drag can change it. |

**Main flow**

1. The user opens the **+** on an `Epic`, `Feature` or `PBI` row.
2. Because that row can hold more than one kind of child, the modal asks which — the
   ladder's own child first, then `Issue` and `Bug`.
3. The user picks `Bug`, names it, and the view writes `type`, `parent` and `order`,
   filing the note in the `Bug` folder ([[Where new items are filed]]).
4. The Bug renders with its own icon and colour, ranked as though it were a PBI wherever
   it hangs.
5. Opening **+** on that Bug offers `Task` alone, and asks nothing.

**Extensions**

- **2a — the row is a `Task`.** Nothing hangs below a Task; the modal is skipped.
- **2b — the row is itself an `Issue` or `Bug`.** Its only children are Tasks, so again
  nothing is asked.
- **3a — the user instead drags an existing Bug to a different parent.** Its type is
  left alone. `levelIndex === -1` means "not a rung", and the auto-type cascade has
  always treated those as deliberate user data.
- **4a — the Bug has no parent at all.** It stays in the model. A recognised type is
  enough to belong, and both "Set type → Bug" on a leaf and a drag to the top level
  produce exactly that.

## Acceptance criteria

- An `Issue` or `Bug` ranks the same wherever it hangs, and its children are Tasks under an
  Epic exactly as under a PBI.
- No move ever re-types one, including a move of a subtree that contains one nested inside
  it.
- `Epic`, `Feature` and `PBI` rows offer all three child kinds; `Task`, `Issue` and `Bug`
  rows offer only `Task`, and ask nothing.
- A parentless `Issue` or `Bug` stays in the model — a recognised type is enough to belong.
- Each has its own icon and badge colour, distinct from every level's and from each other's.
- The vocabulary is fixed at six names and is not a user setting.

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
- **A view option, on by default** (`Extra types`, default `Issue, Bug`) — *later
  reversed*. Making the vocabulary configurable meant every rule about levels had to hold
  for any list a user could type, and it bought a rename. `Issue` and `Bug` are now
  constants beside the four levels, and the collision rules, the "what folder does a name
  nobody chose get" question and the per-view generated schema went with the option.

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
[smoke-test checklist](../issues/Smoke%20test%20the%20visual%20changes.md).

## Follow-up: folders by type

A second request, built on the same vocabulary: each type files itself in its own folder
(`folderForType`), defaulting to `Epic/Feature/PBI → docs/requirements`, `Task →
docs/tasks`, `Issue → docs/issues`, `Bug → docs/bugs`, each its own folder picker in the
view options.

The decision worth recording is the **shipped default**. It was raised that non-empty
defaults will file new items outside a Base's filter — the view creates a note and then
shows it only if the query returns it, so a vault filtered to `Backlog/` gets an Epic in
`docs/requirements` that is not in the tree afterwards. The maintainer chose to ship the
mapping anyway; it is documented prominently in the README, and mitigated where it could
be without contradicting the choice: the **Create backlog** command writes
`typeFolders: ''` into the base it scaffolds, since that command writes a filter and a
creation folder in the same breath and would otherwise contradict itself on the first
Bug.

Two consequences of a fully-mapped default that are easy to mistake for bugs later:

- Folder **inference** and the folder **prompt** never run, because a type folder answers
  first. Both paths are still live for a cleared option, and several creation tests now
  pass `typeFolders: ''` to reach them.
- The landing folder depends on the type, which is chosen *inside* the modal — so the
  prompt's detail line had to become a function of the type rather than a string, or it
  would state the wrong folder at the moment the user confirms.

## Review findings

Two real bugs came out of automated review of the PR, both in the pinning rule, and both
worth recording because they are the same mistake at different depths:

1. **A nested extra type lost its rank** (P1). The dragged root carried its pinned rank,
   but the recursive walk descended into an extra type *below* it using the positional
   level — so moving a Feature containing a Bug rewrote that Bug's Tasks to PBIs, the Bug
   itself skipped and apparently untouched. The root and nested cases are now one rule
   (`rankOf`), applied at every step.
2. **A parentless extra type was pruned** (P2). `pruneOutsideHierarchy` asked whether a
   type was one of `settings.levels`, so a top-level Bug belonged to nothing and left the
   model — reachable both by `Set type` on a leaf and by dragging one to the top level,
   the rules being advisory. Membership now reads every declared type.

The lesson for anything added here later: **a rule that pins a rank has to hold wherever
that type appears** — at the root of a move, inside a moved subtree, and in the scope
test — not only where it was first noticed.

## Where it ended up

The shipped shape after the branch settled, which is not the shape this note was written
against — kept visible rather than edited away, because the reversals are the evidence:

- The **vocabulary is fixed** — six types, no options. A configurable ladder made every
  level rule conditional on a list someone could type; `src/domain/CLAUDE.md` lists what
  removing it deleted.
- **Folders are one picker per type**, defaulting under the home folder and built from the
  view's own config, so the box shows what creation will do.
- **Re-typing on move is off by default.** A move is a move, not a re-classification.
- Nothing is enforced against a drag — unchanged, and still the point: the rules decide
  what is *offered*, never what is *refused*.

## Known limitation

An extra type ranks with the second-lowest level, so `Show completed items`, rollups and
the level breakdown all treat it as that level. This is right for a Bug beside a PBI and
arbitrary for an extra type someone configures with a different intent in mind. No
evidence yet that anyone wants otherwise — revisit if a report says so.
