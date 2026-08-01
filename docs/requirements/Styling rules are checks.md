---
type: PBI
parent: "[[Theming and styling]]"
order: 60
status: Open
---

# Styling rules are checks

The stylesheet properties that are true today become properties that stay true, enforced
by `npm run check`.

## The argument, already made and already won

`Codebase health` closed `Invariants as checks, not conventions` on exactly this
reasoning, and the root `CLAUDE.md` records what it bought: `no-restricted-syntax` bans
`processFrontMatter`, `vault.create` and `load/saveLocalStorage` outside `storage/`, *"so
a new write path cannot appear by accident."* `showAtMouseEvent` became a lint rule after
shipping as a bug once. `VISUAL_DEPTH` guards the two files that decide types.

Styling has the same shape and none of the enforcement. The audit in
`Theming and styling` found a clean file — 0 literal colours, 0 `!important`, every
selector `.pbl`-scoped — and every
one of those is a fact about one afternoon's grep. The rules are real, they are followed,
and they are written nowhere a contributor would meet them.

Two things make the case sharper than it looks. `eslint src test` does not read
`styles.css` at all, so *nothing* in the definition of done currently examines the file.
And the one rule already written down — `setCssProps` over inline styles, in `CLAUDE.md`
under marketplace rules — is followed everywhere, which is what a rule looks like right
up until it isn't.

## What to check

Each of these is a property the file already has, so every check should pass on the day
it is written. That is the point: a check added to a clean file is a check nobody has to
argue about.

| Rule | Today |
| --- | --- |
| No literal colour value — `var(--…)` only | 0 violations |
| No `!important` | 0 |
| Every selector inside the `.pbl` namespace | 0 outside it, keyframe steps aside |
| No physical `left`/`right` property where a logical twin exists | 1 (line 96) |
| No direction-dependent value in a shadow, mask or gradient | 2 (line 336, lines 748-749) |
| No `:has()` on a container | Already reasoned about in `src/view/CLAUDE.md` |

The last two rows are why this is not just "add stylelint and take the defaults".

The direction rule has to match on **values**, not property names. `box-shadow: inset 2px
0 0` (line 336) and `linear-gradient(to right, …)` (748-749) both pin a side, and neither
property has a logical twin for a property-name rule to demand. A check that greps for
`left`/`right` passes both — which is not hypothetical: `Layout survives translated text`
missed one of them twice while being written, and the second miss was a category that
note had already named in prose. **If a human enumerating the file by hand missed it
twice, a rule that only matches property names will miss it every time.** The check is
worth writing precisely because the manual audit demonstrably does not hold.

`:has()` is the other one a generic ruleset gets wrong, in the opposite direction: it is
banned here for a *performance* reason specific to a tree that rebuilds on every data
update — Obsidian's plugin review flags it, and the view already avoids it with a class
instead. Neither rule comes out of a default config.

## Acceptance criteria

- `npm run check` examines `styles.css`. Whether that is stylelint, a script, or an
  eslint processor is an implementation call; that the definition of done stops ignoring
  the file is not.
- Every rule in the table above fails the build when violated. Prove each one by
  violating it and watching it go red — the register has already recorded that a check
  which has never failed is a check nobody has tested.
- The two current violations are fixed by `Layout survives translated text`, so this PBI
  either lands after it or lands with the direction rules staged.
- Rule messages name the fix, not the violation. `Use var(--text-muted); a literal colour
  ignores the user's theme` teaches; `unexpected hex value` gets suppressed.
- Exceptions are narrow and carry a reason inline, matching how `usedClassMembers`
  declares framework-invoked members rather than suppressing them.
- The rules are stated in `src/view/CLAUDE.md`, beside the render-cost notes, so they are
  loaded when someone is working on the view rather than read as one wall — the pattern
  the layer guides already follow.
