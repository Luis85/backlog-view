---
type: PBI
parent: "[[Moving cards]]"
order: 10
status: Open
priority: P1
created: 2026-08-01
files:
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/backlogView.ts
---

# Drag a card to a new state

Drop a card on a column and the state property is written — the whole interaction is
one `ItemWrite.state` batch through `applySafely`. The value written is the configured
string, exactly: one community Bases board writes a slugified column name into
frontmatter, which is the vocabulary-corrupting class of bug the single write boundary
exists to make impossible.

## Acceptance criteria

- Dropping on a column writes that state's canonical value; nothing transforms it on
  the way to disk.
- The write rides the gate: config problems block it, the inverse is captured, and
  undo restores the previous state. Cards are results by construction, so the
  outside-filter refusal never fires — and the invariant test that drives every entry
  point against context rows covers the board's too.
- Dropping a card on its own column is a no-op: no write, and the undo slot keeps the
  batch it had.
- Dropping on the no-state column removes the key — a remove-state write mirroring
  `removeParentKey` — and undo puts the value back; absence is already first-class in
  the restore machinery.
- The drop signal is the column highlight. There is no between-cards indicator,
  because there is no between: see [[Board order is derived not stored]].
- An over-limit column accepts the drop and signals.
