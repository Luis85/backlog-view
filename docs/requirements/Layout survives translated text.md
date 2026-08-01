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

## The lesson, which this note has now had to learn four times

The CSS constructs went **one**, then two, then three. The directional icons went **one**,
then five, then six. Every correction came from review, not from the note.

The first three misses had one cause: recalling what had been seen instead of running a
search. That produced the method below, and steps 1-3 are still right. But the icon miss
had a *different* cause, and it is the more useful one, because the method as written did
not prevent it.

**The search itself was wrong.** The enumeration that produced "five directional icons"
matched `setIcon(el, 'name')`, `.setIcon('name')` and `icon: 'name'`. This codebase does
not call `setIcon` directly for its toolbar: it goes through local helpers, so
`iconButton(barEl, 'undo-2', …)` and `collapseButton(host, barEl, 'chevrons-up-down', …)`
matched nothing. Six names were invisible to a search that was read carefully and reported
confidently: `undo-2`, `sparkles`, `chevron-down`, `chevrons-up-down`, `chevrons-down-up`,
and the `showing ? 'eye' : 'eye-off'` ternary at `toolbar.ts:154`.

So the method needs a step before its first:

0. **Verify the search finds what you think it finds.** A regex is a hypothesis about the
   shape of the code. Check it against a site you already know, and against the shapes this
   codebase actually uses — which include its own wrapper helpers, ternaries and variables.
1. Name the categories. A construct is direction-dependent if it takes an offset, an
   angle, a side or a directional keyword — whether or not the property has a logical
   twin to grep for, and whether or not it lives in CSS at all.
2. For each one, run the search that returns **every** member, and read the whole result.
   Not the members that come to mind; the ones the search returns.
3. Treat any category not enumerated that way as unaudited, and say so rather than
   omitting it.
4. Then ask which enumerated items are **coupled**, because a complete list of
   independently-correct fixes can still be wrong.

Step 2 failed three times, step 4 twice (the chevron rotation, then its keyframes), and
step 0 once — which was enough to make a table this note called exhaustive wrong by six
entries.

**And even step 0 does not save the icon audit.** `toolbar.ts:278` passes `icon` as a
*parameter*: at that call site the name is not a literal at all, so no search over source
text can classify it. That settles an argument this register has been having with itself
for four rounds: the directional-icon question **cannot** be answered by grep, and the
check in `Styling rules are checks` — an explicit classification of every icon name, failing
on any name in neither list — is not a belt-and-braces addition to a manual audit. It is
the only thing that can be correct.

### The category that is not in the stylesheet: icons

An icon does not mirror because its container has `dir="rtl"` — the SVG is drawn the way
it is drawn. So every directional icon name chosen in TS is a physical-left cue that CSS
cannot fix, and there are **six**:

| Icon | Site | Why it points |
| --- | --- | --- |
| `chevron-right` + its rotations | `rows.ts`, styles.css:419 and 1033-1039 | **Icon and transforms are one construct** — see below |
| `corner-left-up` | `backlogView.ts:85` | The root-drop affordance |
| `corner-left-down` | `rows.ts:205` | The outside-filter marker |
| `indent-increase` | `menu.ts:125` | Indent, in the move menu |
| `indent-decrease` | `menu.ts:148` | Outdent |
| `undo-2` | `toolbar.ts:49` | A curved arrow that travels leftward |

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

The construct has **three** parts, not two, and the third was missed on the round that
found the second: `@keyframes pbl-expand-nudge` (styles.css:1033-1039) rotates the same
chevron through `45deg` to `90deg` while a collapsed row auto-expands under a drag hover.
Fixing the static rule at 419 and leaving the keyframes rotates the icon upward for the
600ms of the nudge — the identical bug, in the state a user is least able to screenshot.

So the collapsed icon, the expanded rotation and the hover-expand keyframes are **one
construct in three parts**, and RTL needs all of them: a left-pointing collapsed icon plus
negated rotations, or a dedicated down-pointing icon for the expanded state. Auditing them
independently is what produced the wrong answer twice.

### The category that is not visual at all: keyboard direction

Both categories above are things you can see. The third is a thing you press, and it is
the one an RTL implementation is most likely to ship broken, because every visual check
can pass while it is wrong.

`view/interactions/keyboard.ts` binds four direction keys, all of them physical:

| Key | Does | In RTL should |
| --- | --- | --- |
| `ArrowLeft` | Collapse, else go to parent | Be `ArrowRight` |
| `ArrowRight` | Expand, else go to first child | Be `ArrowLeft` |
| `Alt+ArrowLeft` | Outdent | Be `Alt+ArrowRight` |
| `Alt+ArrowRight` | Indent | Be `Alt+ArrowLeft` |

Once the children and the collapsed chevron mirror toward the inline start, pressing the
key that points at a row's children moves away from them. This is not a preference: the
WAI-ARIA authoring practices for `tree` specify that the two arrow behaviours swap under
RTL, so a tree that keeps them is wrong by the pattern it claims to implement — and
`src/view/CLAUDE.md` is explicit that the tree is one tab stop whose arrows *are* the
navigation, which makes this the primary interaction rather than a shortcut.

It is also the category most cheaply verified, because unlike everything else in this note
it **can** be tested here: the jsdom harness dispatches real `keydown` events and
`test/view/` already drives them. Direction-aware navigation is the one part of RTL that
does not need a live vault.

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
- All six directional icons are addressed — `chevron-right`, `corner-left-up`,
  `corner-left-down`, `indent-increase`, `indent-decrease`, `undo-2` — and the vertical
  ones are deliberately left alone: `arrow-up`/`arrow-down`(`-to-line`),
  `chevrons-up-down`, `chevrons-down-up`, `chevron-down`. Icons are a TS change, not a CSS
  one, so no amount of stylesheet work satisfies this.
- The chevron is verified in **all three** of its parts: collapsed icon, the static
  expanded rotation (419), and the `pbl-expand-nudge` keyframes (1033-1039) that run while
  a row auto-expands under a drag hover. A collapsed chevron pointing the right way with
  an expanded one pointing up is the failure this note twice invited, so "the icon is
  mirrored" does not satisfy it.
- The icon classification is written down as a list, not re-derived. It is the input to
  the check in `Styling rules are checks`, which is what stops a seventh directional icon
  arriving unnoticed.
- **`ArrowLeft`/`ArrowRight` and `Alt+` the same, follow the inline direction**, in
  navigation and in structure moves alike. Unlike the rest of this note, this has jsdom
  tests rather than a checklist — the harness dispatches real `keydown` events, so an RTL
  navigation test is ordinary work and its absence would be a gap, not a limitation.
- A label longer than its column truncates or wraps by the rule `Property columns`
  already sets — it does not overflow, and it does not push the columns out of alignment.
  Whatever the toolbar does when its controls no longer fit, it does the same in every
  language.
- Nothing measures text to decide layout. A width computed from an English string is a
  layout that only holds in English.

## This one needs eyes

The jsdom harness renders nothing, and `docs/issues/Smoke test the visual changes.md`
records that as a standing limitation with `npm run test-build` as the answer. **This PBI
cannot be closed from this repository.** It needs a live vault and a re-runnable
checklist in `docs/issues/`, the way the appearance check did, because the next locale
added will need the same look.

What it does **not** need is a second language, which is just as well: `English ships
alone` rules one out for this round. Setting Obsidian to German would show this plugin in
English and prove nothing. The two conditions come from development-only tooling instead
— a **pseudo-locale** for the expansion half, padding every string by a known factor, and
a forced `dir="rtl"` for the direction half. Both are reachable from a
`npm run test-build` vault and neither ships.

The pseudo-locale earns its place twice over here, because its bracketing makes the sweep
visible: any string still rendering as plain English is one the sweep missed. That is a
completeness check on `Every surface translated` that no lint rule can perform, and it is
available in round one precisely because it is not a translation.
