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
**three** direction-dependent constructs — and only one of them is a physical property:

| Line | Construct | In RTL |
| --- | --- | --- |
| 96 | `margin-left: var(--size-4-1)` on `.pbl-filter` | `margin-inline-start` and done |
| 336 | `box-shadow: inset 2px 0 0 var(--interactive-accent)` on `.pbl-row.pbl-selected` | The selection accent stays on the physical left instead of mirroring to the inline start |
| 748-749 | `mask-image: linear-gradient(to right, black calc(100% - 12px), transparent)` on `.pbl-tag-list` | The overflow edge moves to the start of the line but the mask does not, so tags fade where nothing overflows and clip hard where something does |

The audit behind that table is exhaustive rather than a spot check, which matters because
the first two versions of this note were not. Every `box-shadow` was read for a non-zero
x-offset (line 336 is the only one — 167 and 1043 are symmetric `inset 0 0 0` rings, 1064
is the theme's own `--shadow-s`); every `border-radius` is single-value, so none is
asymmetric; and there is no `background-position`, `transform-origin`, `clip-path`,
`float`, `inset` shorthand, physical `left:`/`right:` positioning, or `translateX`
anywhere in the file. `text-align: end` (line 551) is already logical.

## The lesson, which this note had to learn twice

It first claimed **one** remaining rule, then **two**. Both times the number came from
grepping for physical `left`/`right` *properties*, and both times something encoding a
side without naming one was sitting outside that grep.

The second version even wrote the category down — *"masks, gradients, shadows, and the
choice of a directional icon all encode a side without naming one"* — and then failed to
enumerate the shadow it had just named. So the rule is not "remember that shadows count".
It is: **name the categories, then enumerate each one, and treat a category you have not
enumerated as unaudited.** A construct is direction-dependent if it takes an offset, an
angle, a side or a directional keyword — regardless of whether the property has a logical
twin to grep for.

There is one final category that is not in the stylesheet at all: the chevron. Its
expanded state is `transform: rotate(90deg)` (line 419), which is correct in both
directions because down is down. Its collapsed direction comes from the **icon chosen in
TS**, so if it points right it keeps pointing right in RTL. That is checked by looking,
not by grepping, and it belongs to the verification pass.

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

- All three constructs in the table are fixed: the physical property (96), the selection
  accent shadow (336) and the tag-list mask (748-749). Two of them have no logical twin,
  so "replace the physical properties" is not the whole job and never was.
- Keeping new ones out is `Styling rules are checks`, in `Theming` — this PBI owns the
  sweep and the verification, not the lint. The two features have to land in that order
  or the check has nothing to go green against.
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
