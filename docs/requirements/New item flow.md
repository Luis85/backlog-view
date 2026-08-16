---
type: PBI
parent: "[[Creating items]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# New item flow

**As** someone breaking work down, **I want** to add a child to a row and only have to
name it, **so that** the thought I was having survives the act of writing it down —
instead of being spent on which folder, which type and which order number.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The **+** on a row, the **New** button in the toolbar, or `New <type>` in the context menu |
| **Preconditions** | The view options are valid — creation goes through the same config gate as every other write |
| **Guarantee** | The user supplies a title. The view supplies `type`, `parent`, `order` and the folder. |

**Main flow**

1. The user presses **+** on a row.
2. The view works out what that row can hold ([[Types beside the ladder]]).
3. Because there is more than one answer, the modal asks which kind — defaulting to the
   ladder's own child, with `Issue` and `Bug` beside it.
4. The modal shows **where the note will land**, and the folder follows the type as the
   user changes it ([[Where new items are filed]]).
5. The user types a title and confirms.
6. The view creates the note with `type`, `parent` and an `order` that puts it at the end
   of its new siblings.
7. The parent row is expanded — collapsed or not — so that when the Base returns the new
   note it renders where it landed rather than inside a shut branch, and a notice confirms
   the title. The note is **not** opened: adding several items in a row is the common case,
   and being pulled into each one would interrupt it. [[Opening the work]] is one click
   away.

**Extensions**

- **1a — the trigger is the toolbar's **New**.** The item is top level: an `Epic`. The
  chevron beside it offers the other types for a root that is not one.
- **1b — the trigger is the context menu.** Same flow, reached from the keyboard.
- **2a — the parent row came from outside the Base's filter.** `New <child>` stays
  available: it writes a *different* note. But folder inference counts only result rows,
  and folder mode's "children go beside the parent's folder note" rule is skipped — the
  explicit parent link keeps the hierarchy right wherever the note lands.
- **3a — the row can hold only one kind of item** — a `Task`, an `Issue` or a `Bug` row,
  each of which offers `Task` alone. Nothing is asked; the modal goes straight to the
  title. (Every rung *above* the deepest offers three, `Issue` and `Bug` beside the
  ladder's own child, so a `PBI` row does ask.)
- **5a — the title names a note that already exists in that folder.** A number is
  appended (`Checkout 2`) rather than the write failing or the existing note being
  touched. Two items in a backlog may legitimately share a name.
- **6a — the folder does not exist.** It is created, the whole chain of it.
- **6b — the write fails.** A notice says so and points at the console. The **note** is
  never half-made — the frontmatter goes in with the file in one `create`, not as a
  create-then-update pair that could fail in between — but a folder created for it at
  step 6a is left behind. See [[Failed creation leaves its folder behind]].
- **7a — the new note does not match the Base's own filter.** It is created correctly and
  the tree does not show it, because the Base does not return it. Plain creation — no
  surface placement, no template — writes `type`, `parent` and `order` and nothing else,
  so a base requiring a tag or a status will omit it — and so will a folder-filtered base
  if the type's folder sits outside that folder. Expanding the parent cannot reveal a row
  the query did not return. The **Create backlog** command exists partly to avoid this by
  construction ([[Scaffolding a backlog]]): it points the home folder at the folder it
  filters on, so every type folder defaults inside it. Two things already widen "nothing
  else," both already true of the shipped flow: a bucket's **New** already rides its own
  `horizon` into the same write ([[Buckets from a horizon property]]), and a board
  column's preset `state` will too once [[New cards in place]] is built. A third widens
  it once [[Item Templates]] lands: [[Creating an item from a template]] merges a chosen
  template's own extra frontmatter in as well — so a base filtering on a tag, a state or
  a horizon can be satisfied by the surface a note was created from, a template, or both,
  never only by these three.

## Acceptance criteria

- Where a row can hold more than one kind of item, the modal asks which, defaulting to the
  ladder's own child.
- A row with one option asks nothing.
- The modal says where the item will land before it is created.
- Creation goes through the same config gate as every other write.
- Exactly one note is created and nothing else in the tree is written — the new item's
  `order` places it after its siblings rather than renumbering them.
- The parent is expanded, so a new note the Base returns renders where it landed rather
  than inside a shut branch. Whether the Base returns it is the Base's to decide.
- The note is not opened.
- The note is written atomically: it never exists without its hierarchy properties.

## Where it lives

`src/view/interactions/create.ts` (the flow and folder inference) ·
`src/ui/prompts.ts` (the modal) · `src/storage/createNote.ts` (`createBacklogItem`, and
the path and folder helpers it shares with the absence writer — the only place a work
item is created; split out of `src/storage/frontmatter.ts` on 2026-08-16, which keeps
the editing half and the write boundary the whole directory states) ·
`src/domain/itemTypes.ts` (`childTypeChoices`).
Tests: `test/view/creation.test.ts`, `test/ui/prompts.test.ts`,
`test/domain/itemTypes.test.ts`.
