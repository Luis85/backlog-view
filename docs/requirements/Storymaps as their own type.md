---
type: PBI
parent: "[[A storymap is a note of its own]]"
order: 10
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

# Storymaps as their own type

**As** someone about to map a journey, **I want** to make the map itself, **so that** the
thing my use cases will point at exists before I point at any of them.

A declared marker: a name in the vocabulary, a badge, a creation folder, and a row in the
top-level type menu. It occupies no rung, holds nothing, and hangs from nothing — the
[[Milestones]] shape, on the same three counts.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Choosing `New storymap` at the top level |
| **Preconditions** | None |
| **Guarantee** | A storymap is a note in the vault with a `Storymap` type and nothing else asserted about it; it takes no rung, is offered no children, and is never re-typed by where it sits. |

**Main flow**

1. The user picks `New storymap` from the top-level type menu.
2. The plugin creates the note in the folder configured for the type, through the same
   creation path and the same gate as every other note it makes.
3. The note draws with its own badge, ranked out of the ladder.

**Extensions**

- **1a — the user drops the note under an Epic.** It stays a storymap. A marker has no
  `levelIndex`, so nothing re-types it by position, and the drop is refused rather than
  silently reparenting it into the plan.
- **1b — the type is offered nowhere else.** `New storymap` appears at the top level only:
  a marker hangs from nothing, so an item's child menu must not list it.
- **2a — the configuration gate refuses.** Nothing is created and the reason is shown, as
  with every other write.

## Acceptance criteria

- `Storymap` is in `MARKER_TYPES` and in `ALL_TYPES`, and in neither `LEVELS` nor
  `EXTRA_TYPES`. A test asserts all four, so a later edit cannot move it quietly.
- A storymap's children list is empty and its legal parents list is empty, checked both ways
  against the hierarchy table in `docs/README.md` by the register's own gate.
- A storymap note dropped onto an Epic, a Feature, a PBI and a Step is refused in all four
  cases, and its type is unchanged afterwards.
- The badge is distinguishable from every other declared type at the contrast floor the
  register already measures against.

## Where it lives

The name joins `MARKER_TYPES` in `src/domain/typeVocabulary.ts`, and `src/domain/itemTypes.ts`
is where a marker's three refusals already live — no rung, no children, no parent — so this
use case adds an entry rather than a rule. `src/domain/settings.ts` carries the per-type
creation folder, `src/storage/createNote.ts` makes the note, and `src/view/render/badges.ts`
with `styles/badges.css` draws the badge. The hierarchy table in `docs/README.md` gains its
row, and the register's own gate checks it against `LEGAL_CHILDREN` both ways.
