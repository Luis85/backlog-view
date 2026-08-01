---
type: PBI
parent: "[[User manual]]"
order: 50
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/backlogView.ts
  - src/storage/frontmatter.ts
  - src/domain/settings.ts
---

# Help for safe writes and undo

The manual section on what the view writes to your notes, and how to take it back. The
view edits real files with no save step and no confirmation dialog, so this is the
section that decides whether a new user trusts it.

## What the section says

- **Exactly three properties are the view's to maintain** — `parent`, `order`, `type` —
  plus the state and tags properties you configure. Nothing else in a note is touched,
  and the note stays an ordinary note.
- **Every property change can be taken back**, however many notes it touched: **↩** in the
  toolbar or <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> in the tree, and again to redo. One level,
  per view and per session. A no-op does not spend it.
- **Undo restores, it does not overwrite.** A property you edited by hand in the meantime
  is kept, a note deleted since is skipped, and a notice says when either happened.
- **Creating an item is the exception**: undo never deletes a note. Delete the note to
  take a creation back — and the undo slot still points at the change before it.
- **The view never writes to a note your Base excluded.** A context row is not a write
  target, and a batch naming one is refused **before any of it is written** rather than
  applied in part.
- **A misconfigured view writes nothing at all.** `Check view options` in the toolbar
  means the write gate is closed until the configuration is valid.
- **A batch that fails partway leaves what it already wrote.** Files are written one at a
  time, so a change touching many notes can stop halfway; the part that landed is on
  screen and is exactly what undo takes back. This is the honest version of "safe" — not
  all-or-nothing, but nothing left that you cannot see or reverse.

## Acceptance criteria

- The three properties are named explicitly, because "it edits your notes" without a list
  is exactly the sentence that stops someone from trying a plugin.
- Undo is described with its two limits — one level, and creation — rather than as an
  unbounded history.
- The whole-batch refusal is scoped to what it actually guarantees — a batch **rejected
  before writing** — and is not written as atomicity. `applyWrites` writes sequentially
  and a mid-batch failure keeps the applied prefix, so the section says so and points at
  undo rather than promising all-or-nothing.
- The section is reachable from the busy indicator and from the config warning, since both
  are moments the user is already asking what the view is doing to their files.

## Evidence

- `src/storage/frontmatter.ts` — the only module that writes, and where inverses are
  captured.
- `src/view/backlogView.ts` — `applySafely`, `undoLast` and the `runExclusively` gate.
- [[The write gate]], [[Undo and redo]], [[Safe writes]] — the built behaviour, including
  the recovery cases this section deliberately does not enumerate.
- `README.md`, section *Undo*.
