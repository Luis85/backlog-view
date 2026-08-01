---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 20
status: Open
---

# Theming and styling

Everything the plugin draws is expressed in Obsidian's own design tokens, so it looks
like part of the app in any theme the user installs — and the stylesheet that does it is
organised, bounded and checked like the rest of the codebase.

Two halves, and the name says both. **Theming** is what the user sees: tokens, theme
variants, a restyling surface, reduced motion. **Styling** is the file that produces it:
one stylesheet per concern, a build step, and rules that hold.

## What the theming half is not

It is not a cleanup. `styles.css` is disciplined on every axis, which the audit behind
these PBIs establishes rather than assumes:

| Checked | Result |
| --- | --- |
| Literal **rendered** colours | **1**, and unreachable — the grey `var()` fallback at 642, which no render path can show. The 8 `transparent` and the 2 mask stops name an absence and an alpha, not a colour |
| `!important` | **0** |
| `var(--…)` uses | **202**, across 47 distinct variables |
| Selectors outside the `.pbl` namespace | **0** — the only unscoped rules are `@keyframes` steps |
| `prefers-reduced-motion` | Handled (line 915), and `hover: none` too (line 940) |
| Inline styles | None — `setCssProps` throughout, already a marketplace rule in `CLAUDE.md` |

So the plugin passes the styling bar today — the single literal colour is in a branch
nothing can reach. **The problem is that nothing holds any of it.** Every one of those
numbers is a fact about the current file, established by
grep, on one afternoon. None of them is a check, none is written down where a
contributor would meet it, and the one test harness this repository has renders nothing
at all.

That is the same argument `Codebase health` made for the layering rules, and it got the
same answer: *invariants as checks, not conventions*. This feature converts a good
stylesheet into a stylesheet that cannot quietly stop being good.

## What is actually open

Five gaps, each its own PBI:

- **One file, 1143 lines.** The root `CLAUDE.md` opens on *"one file per concern,
  400-line max enforced by lint"*, and `styles.css` is 2.8× that cap. It is the only file
  in the repository exempt from the rule the repository is built on, and it is exempt
  because `eslint src test` does not read CSS — an accident, not an argument. It splits
  first: every other PBI here edits the stylesheet, and doing that in nine small files is
  the difference between a reviewable diff and a 1143-line one.
- **97 raw pixel values**, where Obsidian publishes `--size-*` tokens a theme can
  rescale. Not all of them can go — some are load-bearing, which is the interesting part.
- **A bound spelled in two places.** `ROW_LEAD_WIDTH` in `columns.ts` sums eight widths
  that live in `styles.css`, and the comment says it is *"a sum of the bounds in
  styles.css rather than a guess, so it can be checked against them."* Checked by hand,
  by whoever remembers.
- **No restyling contract.** Eight `--pbl-*` custom properties exist, but they are
  internal plumbing set per render, not a surface a snippet author can rely on.
- **No enforcement, and no way to see the result.** The rules above, plus light/dark and
  reduced motion, which this repository structurally cannot verify.

## The seam with Multilang

Direction is where the two features meet, and the line is drawn once. **This feature owns
the mechanism** — logical properties, no direction-dependent value in a shadow, mask or
gradient, and the lint that keeps new ones out. **`Multilang` owns the verification** —
that the view still reads correctly with long compounds in fixed-width columns and with
the tree running right-to-left. See `Layout survives translated text`, which carries the
inventory of what is left to fix.
