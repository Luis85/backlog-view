---
type: PBI
parent: "[[Theming and styling]]"
order: 30
status: Open
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

# One bound, not two

A width that CSS applies and TypeScript adds up is written once, so the two cannot drift.

**As** someone changing a width, **I want** to change it in one place, **so that** the
column-fit arithmetic cannot silently disagree with the stylesheet and clip a row.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin |
| **Trigger** | Changing any width the row's lead is made of |
| **Preconditions** | None |
| **Guarantee** | `columnFit`'s behaviour is unchanged. This is about where the numbers live, not what they are. |

**Main flow**

1. A developer changes a bound — a badge cap, an indent step, a column width.
2. They change it in one place.
3. Both the stylesheet and the fit arithmetic follow.

**Extensions**

- **1a — the bound is one Obsidian owns.** The two gap terms stay hand-maintained, with the
  existing accepted-cost note intact. This narrows the set; it does not empty it.
- **2a — a rule declines to read the published value.** Already happened: `--pbl-indent` is
  published and two drag-indicator rules hard-code `24px` anyway, so changing the indent
  moves every row and leaves the indicator behind.
- **3a — the two disagree anyway.** A check fails the build. One that cannot fail is not a
  check — prove it by moving a bound and watching it go red.

## The duplication

`columnFit` decides which columns fit a pane by summing what the row's lead costs:

```ts
const ROW_LEAD_WIDTH =
	8 +   // row padding, both ends
	18 +  // grip
	22 +  // chevron
	124 + // badge at its max-width
	64 +  // the title's min-width — below this it is not worth showing
	32 +  // the orphan and outside-filter markers, which a row can carry both of
	12 +  // the spacer that anchors the columns
	28;   // the row's own add button
```

Every one of those eight numbers is a bound that `styles.css` enforces. The comment above
it is honest about the arrangement — *"a sum of the bounds in styles.css rather than a
guess, so it can be checked against them"* — and the checking is manual. `TREE_PADDING`
and `INDENT_PER_DEPTH` are two more.

The failure mode is quiet and asymmetric. Widen the badge's `max-width` in CSS without
touching the constant and the sum under-counts, so `columnFit` keeps a column that no
longer fits and the row clips — the symptom `src/view/CLAUDE.md` predicts: *"A term that
grows without a bound, or one left out of the sum, comes back as a clipped row rather
than a dropped column."* Nothing fails. No test catches it, because jsdom reports zero
for every measurement, which is exactly why the tests stub `clientWidth` in the first
place.

## It has already happened once

This is not hypothetical. `INDENT_PER_DEPTH` **is** published to CSS as `--pbl-indent`,
and two rules ignore it and spell the number anyway:

| Rule | Indent term |
| --- | --- |
| `tree.css`, `.pbl-row` | `calc(var(--size-4-1) + var(--pbl-depth, 0) * var(--pbl-indent, 24px))` |
| `tree.css`, `.pbl-children::before` | `… * var(--pbl-indent, 24px) + 26px)` |
| **`dragDrop.css`, `.pbl-row.pbl-drop-before::before`** | `calc(var(--size-4-1) + var(--pbl-depth, 0) * 24px)` |
| **`dragDrop.css`, `.pbl-row.pbl-drop-before::after`** | `calc(var(--size-4-1) + var(--pbl-depth, 0) * 24px - 3px)` |

Two of the four indent-dependent rules read the property; two hard-code it. The two in
`dragDrop.css` are the drag indicators (each grouped with its `.pbl-drop-after` twin), so
changing `INDENT_PER_DEPTH` today moves every row and
leaves the drop indicator behind — silently, and only while dragging, which is the
hardest state to notice a few pixels in.

That is the mechanism failing exactly as predicted, in the one place it was already
supposed to be fixed. Publishing a custom property does not help if a rule can still
decline to read it.

## The direction already set

The fix pattern exists in the same file. The numbers TS owns are **published to CSS** as
custom properties by `renderTree` — `--pbl-prop-col`, `--pbl-prop-count`,
`--pbl-meta-col`, `--pbl-indent` — so the stylesheet reads them rather than repeating
them. Five of the
eight lead terms could follow, leaving only the ones that are Obsidian's.

That is a direction, not a decision: publishing a `max-width` the theme should arguably
control has a cost, and so does leaving the sum hand-maintained. Choosing between them —
per term — is what this PBI is for.

## Acceptance criteria

- Each of the eight `ROW_LEAD_WIDTH` terms, plus `TREE_PADDING` and `INDENT_PER_DEPTH`,
  is either **published from TS to CSS** as a custom property, or **checked** so a
  divergence fails `npm run check`, or **documented as deliberately unchecked** with the
  reason. No term is left in the current state of "checked by whoever remembers".
- Whatever the mechanism, it fails when a bound moves in CSS and not in TS. A check that
  cannot fail is not one — prove it by moving a bound and watching it go red.
- `columnFit`'s behaviour is unchanged. This is about where the numbers live, not what
  they are.
- The relationship is stated in `src/view/CLAUDE.md` beside the existing paragraph, which
  currently describes the manual arrangement as though it were the end state.
- The two drop-indicator rules read `--pbl-indent` as `.pbl-row` and `.pbl-children::before`
  already do, and a check
  keeps a fourth rule from spelling the number again. Publishing a value and then
  allowing a rule to bypass it is the same duplication with an extra step.
- The two gap terms Obsidian owns stay as they are, with the existing accepted-cost note
  intact. This PBI narrows the hand-maintained set; it does not pretend to empty it.

## Where it lives

**Nothing yet — this note is design.** `src/view/render/columns.ts` holds
`ROW_LEAD_WIDTH` and its eight terms, plus
`INDENT_PER_DEPTH` and `TREE_PADDING` · `src/view/render/rows.ts` publishes the TS-owned
values to CSS as custom properties in `renderTree` · `styles.css` applies them, and is
where two rules hard-code the indent instead of reading it · `src/view/CLAUDE.md` describes
the current hand-checked arrangement as though it were the end state.
