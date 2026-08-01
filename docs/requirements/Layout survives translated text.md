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

## The lesson, which this note had to learn three times

It claimed **one** remaining construct, then **two**, then **one** directional icon when
there are five. Every time, the count came from recalling what had been seen rather than
from running a search that lists every member of the category.

The second version wrote the category down — *"masks, gradients, shadows, and the choice
of a directional icon all encode a side without naming one"* — and then enumerated
neither the shadow nor four of the five icons it had just named. Naming a category and
enumerating one member of it is worse than not naming it, because the prose reads as
though the work was done.

So the lesson is not "remember that shadows count", and it is not a longer list to
memorise. It is a **method**:

1. Name the categories. A construct is direction-dependent if it takes an offset, an
   angle, a side or a directional keyword — whether or not the property has a logical
   twin to grep for, and whether or not it lives in CSS at all.
2. For each one, run the search that returns **every** member, and read the whole result.
   Not the members that come to mind; the ones the search returns.
3. Treat any category not enumerated that way as unaudited, and say so rather than
   omitting it.
4. Then ask which enumerated items are **coupled**, because a complete list of
   independently-correct fixes can still be wrong. The chevron below is the worked
   example: its icon and its rotation are separate entries that have to change together,
   and listing them apart is what let an earlier version call one of them safe.

Step 2 failed three times; step 4 failed once, on the chevron, and that one was not
fixed by enumerating harder. The tables in this note were produced by
running it — every `box-shadow` read for its x-offset, every icon name in `src/` listed
and classified — which is why they are worth more than the sentences they replaced.

The deeper reading is that this is not a discipline problem to be solved by resolving to
be careful, because three rounds of resolving to be careful did not solve it. It is an
argument for the check in `Styling rules are checks`, which is where a machine enumerates
the categories on every build instead.

### The category that is not in the stylesheet: icons

An icon does not mirror because its container has `dir="rtl"` — the SVG is drawn the way
it is drawn. So every directional icon name chosen in TS is a physical-left cue that CSS
cannot fix, and there are **five**, not one:

| Icon | Site | Why it points |
| --- | --- | --- |
| `chevron-right` + `rotate(90deg)` | `rows.ts`, styles.css:419 | **Icon and transform are one construct, not two** — see below |
| `corner-left-up` | `backlogView.ts:85` | The root-drop affordance |
| `corner-left-down` | `rows.ts:205` | The outside-filter marker |
| `indent-increase` | `menu.ts:125` | Indent, in the move menu |
| `indent-decrease` | `menu.ts:148` | Outdent |

Equally important is what must **not** be touched. `arrow-up`, `arrow-down`,
`arrow-up-to-line` and `arrow-down-to-line` — the four move commands — are vertical, and
vertical is vertical in every direction. An audit that mirrors them has made things
worse. `grip-vertical` and `separator-vertical` are the same case. `list-tree` is the one
to settle by looking rather than by reasoning.

**The chevron is a trap, and an earlier version of this note set it.** That version put
the icon in this table and declared the transform separately safe — *"rotate(90deg), which
is fine, down is down"* — which is true only while the base icon points right. Swap the
collapsed state to a left-pointing icon for RTL and keep the rotation, and the expanded
chevron points **up**: `←` rotated 90° clockwise is `↑`, not `↓`. An implementation could
tick every row of this table and ship every expanded row pointing the wrong way.

So the collapsed icon and the expanded rotation are **one construct with two halves**, and
RTL needs both: a left-pointing collapsed icon *and* `rotate(-90deg)`, or a dedicated
down-pointing icon for the expanded state. Auditing them independently is what produced
the wrong answer, and it is the reason this table's first column now names the pair.

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
- Keeping new ones out is `Styling rules are checks`, in `Theming and styling` — this PBI
  owns the sweep and the verification, not the lint. The two features have to land in
  that order or the check has nothing to go green against.
- Row indentation, the drag indicator and the root strip mirror correctly under
  `dir="rtl"`.
- All five directional icons are addressed — `chevron-right`, `corner-left-up`,
  `corner-left-down`, `indent-increase`, `indent-decrease` — and the four vertical arrows
  are deliberately left alone. Icons are a TS change, not a CSS one, so this criterion is
  not satisfied by any amount of stylesheet work.
- The chevron is verified **in both states**. A collapsed chevron pointing the right way
  with an expanded one pointing up is the specific failure this note previously invited,
  so "the icon is mirrored" does not satisfy it — the expanded row has to point down.
- The icon classification is written down as a list, not re-derived. It is the input to
  the check in `Styling rules are checks`, which is what stops a sixth directional icon
  arriving unnoticed.
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
