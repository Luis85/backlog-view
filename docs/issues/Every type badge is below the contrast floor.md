---
type: Issue
parent: "[[Cross-cutting concerns]]"
order: 50
status: Open
area: ux
priority: P2
created: 2026-08-08
source: measured while giving Idea a colour of its own, after Idea and Deliverable collided on green
files:
  - styles/badges.css
---

# Every type badge is below the contrast floor

## What was measured

A type badge draws its text in a theme colour and its background in the **same colour at
14 % alpha** (`styles/badges.css`). Text and background therefore share a hue, and all the
separation comes from the alpha — which is a fixed 0.14 whatever the colour's luminance is.

Computed over Obsidian's eight tokens in the LIGHT scheme, badge text against its own
background:

| Token | Type | Ratio |
| --- | --- | --- |
| yellow | `Task`, `Idea` | 1.88:1 |
| cyan | `Milestone` | 2.02:1 |
| green | `Deliverable` | 2.27:1 |
| orange | `Epic` | 2.55:1 |
| red | `Bug` | 3.44:1 |
| pink | `Issue` | 3.64:1 |
| blue | `PBI` | 4.07:1 |
| purple | `Feature` | 4.10:1 |

**Every one is below WCAG AA's 4.5:1 for normal text**, and the best is 4.10. This is not a
regression and nothing here caused it: it is what the rule has always computed, for every
type, since badges got colours.

## Why it surfaced now

`Idea` and `Deliverable` were built on branches that could not see each other and both took
green, so the merge had to move one. Giving `Idea` its own colour meant asking which
colours were free — and the answer was none, since there are nine badges and eight tokens.
Ranking the leftovers by contrast is what produced the table above, and the ranking was the
surprise rather than the collision.

`Idea` now takes yellow, the weakest slot. That is a deliberate trade for the lightbulb's
own colour and against a 0.39 drop from green, in a family that is already below the floor
everywhere — but it is a trade, and it is written here rather than left implied.

## What this is NOT

- Not a claim about a real vault. A theme replaces all eight tokens, so the numbers are
  Obsidian's defaults as `test/harness/theme.css` records them (ADR 0020 — the harness
  draws, it does not assert). The RULE is theme-independent; the ratios are not.
- Not a claim that the badges are unreadable. Each badge carries the type NAME, so colour
  is a redundant cue rather than the only one, and that is exactly why this has gone
  unnoticed and why it is P2 rather than higher.

## What would fix it

The alpha is the lever, not the palette. A background at 14 % of a light hue barely departs
from the page, so the text has nothing to sit against; darkening the text or deepening the
background would lift every badge at once rather than shuffling which type is worst.
`--pbl-badge-rgb` is one variable feeding both, so this is a change to two declarations in
one rule, and it needs a live-vault look under a few themes rather than a calculation —
which is why it is recorded rather than done here.

## What the 2026-08-10 review measured, on top of the above

Recorded as evidence, not as a fix — the note stays `Open`.

- **The table above is light-scheme only.** Dark was never measured, and it also fails:
  `PBI`/blue computes 3.59:1 in the dark scheme, `Bug`/red computes 4.13:1 — both still
  under WCAG AA's 4.5:1, so this is not a light-scheme-only defect.
- **The 0.14 alpha is confirmed as the weak lever, and by how much.** Dropping it alone to
  0.10 leaves light's worst ratio near 1.9:1 — barely moved, because the text colour is
  unchanged and the background is still close to the page. Mixing the text 50 % toward
  `--text-normal` instead — leaving the alpha where it is — reaches 5.11:1 in light and
  6.07:1 in dark, clearing the floor in both schemes. The lever that works is the text, not
  the alpha.
- **A solid pill has no workable ink across the eight tokens.** Neither fixed ink colour
  clears every hue: white text bottoms out at 1.41:1 on yellow, black text at 3.21:1 on
  purple. A solid-background badge would need a per-hue ink choice, not one constant, to
  clear the floor everywhere.
