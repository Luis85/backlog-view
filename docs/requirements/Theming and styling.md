---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 20
status: Open
started: ""
finished: ""
horizon: ""
start: 2026-09-07
due: 2026-09-13
risk: ""
assignee: ""
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
| Literal **rendered** colours | One, and unreachable — the grey `var()` fallback on `.pbl-badge.pbl-implied` in `styles/badges.css`, which no render path can show. The `transparent` values and the tag mask's stops name an absence and an alpha, not a colour |
| `!important` | None |
| `var(--…)` uses | The idiom throughout, across dozens of distinct variables |
| Selectors outside the `.pbl` namespace | None — the only unscoped rules are `@keyframes` steps |
| `prefers-reduced-motion` | Handled, in `styles/motion.css`; `hover: none` in `styles/touch.css` and beside the two revealed controls |
| Inline styles | None — `setCssProps` throughout, already a marketplace rule in `CLAUDE.md` |

So the plugin passes the styling bar today — the single literal colour is in a branch
nothing can reach. **The problem is that nothing holds any of it.** Every row above is a
fact about the file on one afternoon, established by grep. None of them is a check, none
is written down where a contributor would meet it, and the one test harness this
repository has renders nothing at all.

The tallies this table used to carry are gone on purpose, and their going is part of the
argument. They cited line numbers into a `styles.css` that is now generated, and they
counted a file that grew by most of its own size while they sat unchanged — the same way
the direction inventory in [[Layout survives translated text]] was overtaken by the
roadmap arriving underneath it. A number in a note is true on the day it is written; only
a rule is true afterwards.

That is the same argument `Codebase health` made for the layering rules, and it got the
same answer: *invariants as checks, not conventions*. This feature converts a good
stylesheet into a stylesheet that cannot quietly stop being good.

## What is actually open

The gaps, each its own PBI:

- ~~**One file, 1143 lines.**~~ **Done 2026-08-03** — `One stylesheet per concern`. It
  was 1995 by the time it was split, into sixteen partials under `styles/` that the build
  assembles; the root `styles.css` is now a generated artifact. It went first for the
  reason stated here: every other PBI below edits the stylesheet, and each now edits a
  page rather than a fifth of a two-thousand-line file.
- **Raw pixel values**, where Obsidian publishes `--size-*` tokens a theme can rescale.
  Not all of them can go — some are load-bearing, which is the interesting part. How many
  there are is asked of the file when the sweep runs, not read out of this list.
- **A bound spelled in two places.** `ROW_LEAD_WIDTH` in `columns.ts` sums eight widths
  that live in `styles/tree.css` and `styles/columns.css`, and the comment says it is
  *"a sum of the bounds in styles.css rather than a guess, so it can be checked against
  them."* Checked by hand, by whoever remembers.
- **A physical side, named.** Logical properties are the idiom, and the places the idiom
  did not reach are what [[Nothing pins a physical side]] enumerates and fixes — including
  the ones whose *value* names a side and so have no twin to swap to. It goes before
  [[Styling rules are checks]], which needs a file its direction rules can pass on.
- **No restyling contract.** The `--pbl-*` custom properties exist, but they are internal
  plumbing set per render, not a surface a snippet author can rely on.
- **No enforcement, and no way to see the result.** The rules above, plus light/dark and
  reduced motion, which this repository structurally cannot verify.

## The seam with Multilang

Direction is where the two features meet, and the line is drawn once. **This feature owns
the mechanism** — logical properties, no direction-dependent value in a shadow, mask or
gradient, and the lint that keeps new ones out: [[Nothing pins a physical side]] for the
fix and [[Styling rules are checks]] for the rule that keeps it. **`Multilang` owns the
verification** — that the view still reads correctly with long compounds in fixed-width
columns and with the tree running right-to-left, plus the two categories the stylesheet
cannot reach at all: the directional icons and the arrow keys. See
[[Layout survives translated text]].

The inventory moved with the mechanism, and that was the correction this round made. It
sat in the verification note, where it went stale as the roadmap and the timeline grew
underneath it; a note that fixes a list is the one that has to re-derive it.
