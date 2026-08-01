---
type: PBI
parent: "[[Theming and styling]]"
order: 20
status: Open
---

# Obsidian variables, not values

Sizing and spacing come from Obsidian's design tokens wherever a token exists, so a theme
that rescales the app rescales this plugin with it.


**As** someone using a theme that rescales Obsidian, **I want** this plugin to rescale with
it, **so that** the backlog does not sit at one fixed size inside a UI that moved.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone using a theme that redefines Obsidian's tokens |
| **Trigger** | Rendering any row, column or control |
| **Preconditions** | `One stylesheet per concern` has landed, so edits go to partials |
| **Guarantee** | No visual change is intended. Any that appears is a bug in the mapping, not a decision. |

**Main flow**

1. Every raw pixel value in the stylesheet sources is classified.
2. Values with an Obsidian token become that token.
3. The three piles are written down, not just applied.

**Extensions**

- **1a — the value is a bound `columnFit` sums.** It stays a number, because a theme could
  otherwise change a number TypeScript is adding up; `One bound, not two` owns it.
- **1b — the value is a hairline or a radius.** Genuinely arbitrary, exempt by default, with
  a one-line reason. A border that scales with a spacing token is not a border.
- **2a — no token matches.** That is a finding worth stating rather than a reason to invent
  a mapping.
- **3a — the reader is adding a new rule.** They need to know which question to ask, which
  is why the piles are recorded rather than merely applied.

## What is left

Colour is done — 0 literal values, every colour expression already reads a variable,
including the accent (`hsla(var(--interactive-accent-hsl), …)`) and the semantic
`--color-green-rgb` / `--color-orange-rgb`. What has not had the same pass is
**dimension**: `styles.css` carries **97 raw pixel values**, the commonest being

| Value | Occurrences |
| --- | --- |
| `12px` | 20 |
| `1px` | 15 |
| `24px` | 11 |
| `2px` | 8 |
| `16px` | 5 |

Obsidian publishes `--size-2-*` and `--size-4-*` for spacing and `--font-ui-*` for type,
and the file already uses 47 distinct variables, so the idiom is established — it just
was not applied to every number.

## The half that must not move

This is why it is a PBI and not a find-and-replace. A subset of those pixels is
**load-bearing**, and `src/view/CLAUDE.md` says so:

> Everything the threshold counts has to be *bounded in CSS and summed here* …
> The terms that are Obsidian's (`--size-4-1` gaps, the tree padding) cannot be owned
> that way and stay as constants; a theme that redefines them moves the threshold by a
> few pixels, which is the accepted cost of not measuring.

`columnFit` decides which columns a pane can hold by arithmetic over bounds that live in
the stylesheet — the badge's `max-width`, the grip, the chevron, the title's min-width.
Turning one of those into a theme-controlled token means the theme can change a number TS
is adding up, and the symptom is a clipped row rather than a rescaled one. The existing
comment accepts that risk for the two gap terms deliberately; widening it silently is a
different decision.

So the sweep has to sort every raw pixel into one of three piles, and the sorting is the
deliverable as much as the edit is.

## Acceptance criteria

- Every raw pixel value in the stylesheet sources is classified as: **a token** (replaced with the
  Obsidian variable), **a bound `columnFit` sums** (left as a number, and covered by
  `One bound, not two`), or **genuinely arbitrary** (a border radius, a hairline) with a
  one-line reason.
- Nothing in the second pile changes value as part of this PBI. A layout change hiding
  inside a tokenization sweep is the thing that makes this reviewable or not.
- The three piles are written down, not just applied, so the next contributor adding a
  rule knows which question to ask.
- `1px` borders and hairlines are exempt from tokenization by default — a border that
  scales with the theme's spacing token is not a border.
- Font sizes go through `--font-ui-*` where one fits. `11px` appears four times, all of
  them small-text; if no token matches, that is a finding worth stating rather than
  working around.
- No visual change is intended. Any that appears is a bug in the mapping, and this PBI
  cannot be closed without the live-vault look from `Light, dark and reduced motion`.

## Where it lives

`styles.css` — after `One stylesheet per concern`, the source partials — holds the raw
values · `src/view/render/columns.ts` holds `ROW_LEAD_WIDTH`, `INDENT_PER_DEPTH` and
`TREE_PADDING`, the constants that make some of those pixels load-bearing ·
`src/view/CLAUDE.md` records why they are summed rather than measured.
