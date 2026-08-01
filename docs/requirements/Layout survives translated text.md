---
type: PBI
parent: "[[Every surface translated]]"
order: 40
status: Open
---

# Layout survives translated text

Translated strings are a different length and sometimes a different direction. The view
has a fixed-width column model and a depth-indented tree, so both are load-bearing.

## What the evidence says

**Direction is nearly free already.** `styles.css` is 1143 lines and uses CSS logical
properties in 11 places (`inline-start` / `inline-end`). Exactly **one** physical
direction rule is left — `margin-left: var(--size-4-1)` on `.pbl-filter` (line 96). So
RTL is a small change to make and a large one to verify, and the ratio is the reason this
is a PBI rather than an epic of its own.

**Width is not free.** `Property columns` is `Done` on the criteria *"Columns are
fixed-width so values line up across rows regardless of title length"* and *"A pane too
narrow drops whole columns rather than shrinking them out of alignment."* Those were
written against English labels. German runs roughly 30% longer; the column header labels,
the state chip and the toolbar's `New <type>` button all sit in space measured for
English.

**Indentation is direction-sensitive by nature.** The tree indents by depth, the drag
indicators are drawn at an inset, the chevron points at the children, and the root
drop strip runs along one edge. Every one of those has a mirrored meaning in RTL.

## Acceptance criteria

- No physical `left`/`right` property remains in `styles.css` where a logical one exists.
  The one on line 96 goes; a lint or a review checklist keeps a new one from appearing.
- Row indentation, the chevron, the drag indicator and the root strip mirror correctly
  under `dir="rtl"`.
- A label longer than its column truncates or wraps by the rule `Property columns`
  already sets — it does not overflow, and it does not push the columns out of alignment.
  Whatever the toolbar does when its controls no longer fit, it does the same in every
  language.
- Nothing measures text to decide layout. A width computed from an English string is a
  layout that only holds in English.

## This one needs eyes

The jsdom harness renders nothing, and `docs/issues/Smoke test the visual changes.md`
records that as a standing limitation with `npm run test-build` as the answer. **This PBI
cannot be closed from this repository.** It needs a live vault, with Obsidian set to a
long-word language and to an RTL one, and it should leave behind a re-runnable checklist
in `docs/issues/` the way the appearance check did — because the next locale added will
need the same look.
