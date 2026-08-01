---
type: PBI
parent: "[[Multilang]]"
order: 60
status: Open
---

# Layout survives translated text

Translated strings are a different length and sometimes a different direction. The view
has a fixed-width column model and a depth-indented tree, so both are load-bearing.

## What the evidence says

**Direction is mostly free already, but not entirely.** `styles.css` is 1143 lines and
uses CSS logical properties in 11 places (`inline-start` / `inline-end`). What is left is
**two** direction-dependent constructs, and only one of them is a physical property:

- `margin-left: var(--size-4-1)` on `.pbl-filter` (line 96) — the straightforward one,
  `margin-inline-start` and done.
- The tag-list overflow fade (lines 748-749):
  `mask-image: linear-gradient(to right, black calc(100% - 12px), transparent)`. A mask
  is not a property with a logical twin, so a search for `left`/`right` *properties*
  misses it. In RTL the flex overflow edge moves to the start of the line while the mask
  stays put, so tags fade on the side that is not overflowing and clip hard on the side
  that is. `to right` becomes `to inline-end` (or the rule is flipped under `[dir='rtl']`).

Worth stating plainly because this note first claimed there was exactly one: **grepping
for physical properties is not the same as auditing for direction.** Masks, gradients,
shadows, and the choice of a directional icon all encode a side without naming one.

The chevron is the third thing to look at and it is not in the stylesheet at all: the
expanded state is `transform: rotate(90deg)` (line 419), which is correct in both
directions because down is down. The collapsed state's direction comes from the *icon*
chosen in TS, so if it points right it keeps pointing right in RTL. That belongs to the
verification pass rather than to a CSS sweep.

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

- No physical `left`/`right` property remains in `styles.css` where a logical one exists,
  **and** no direction-dependent value survives in a construct that has no logical twin —
  the tag-list mask included. Keeping new ones out is `Styling rules are checks`, in
  `Theming`; this PBI owns the sweep and the verification, not the lint.
- Row indentation, the chevron, the drag indicator and the root strip mirror correctly
  under `dir="rtl"`. The chevron's collapsed direction is an icon choice in TS, so it is
  checked by looking rather than by grepping.
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
