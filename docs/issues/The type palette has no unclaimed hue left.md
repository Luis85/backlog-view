---
type: Issue
order: 70
parent: "[[Theming and styling]]"
status: Open
priority: P3
area: design
created: 2026-08-08
source: review of PR #98
files:
  - styles/badges.css
  - src/view/render/rows.ts
  - src/domain/settings.ts
---

# The type palette has no unclaimed hue left

## The limitation

`DESIGN.md`'s **Ladder Rule** says a type's colour is identity, assigned once, and that
**adding a type takes an unclaimed hue** — never a rotation, never a slot after the last
one. Obsidian ships eight chromatic families (`--color-red/orange/yellow/green/cyan/blue/
purple/pink-rgb`) and, with [[Ideas as a type beside the ladder]] shipped, the eight
declared types wear all eight:

| | |
| --- | --- |
| Epic · Feature · PBI · Task | orange · purple · blue · yellow |
| Issue · Bug · Milestone · Idea | pink · red · cyan · green |

So the rule is still right and is no longer *followable*. A ninth declared type has
nowhere to go, and the two obvious escapes are the two the rule names as wrong: rotating
back to a used hue, or taking the neutral slot after the last one.

## How it surfaced

`Idea` took green, which `DESIGN.md` had pencilled in for `Deliverable` — a type
specified in [[Deliverables as a rootable extra type]] and never built. That is a
defensible resolution (a hue held for something unbuilt is a hue nothing is wearing) and
it is not a general answer: it worked once, because one of the two claimants did not
exist. If `Deliverable` is built, it is the ninth type and this issue is its blocker.

## What is NOT the problem

Automated review of PR #98 read the green badge as a completion signal, citing the
**Done Green** entry's "never used for good, success or emphasis". That reads the wrong
rule at the badge. Inside a badge colour means IDENTITY — `DESIGN.md` says so in the same
breath as "a screen with no problems on it is monochrome apart from its badges" — and the
overlap it objects to is deliberate and already shipped twice: **Bug red** beside
over-limit red, **Milestone cyan** beside marker cyan. The Spent Colour Rule governs
*outside* the badges. A rule that forbade a badge hue from matching a state hue would
have to unship two existing types, and it would leave five hues for eight types rather
than solving anything.

The real constraint is arithmetic, and it is the one above.

## Shapes that could answer it

None is chosen; each is written down so the next round starts from four options rather
than from one.

- **A second axis on the badge.** Hue stays identity for the eight, and a ninth type is
  distinguished the way `.pbl-implied` already is — the dashed, transparent variant proves
  the badge can carry a second signal without a hue. Cheapest, and the only one that does
  not touch a shipped type.
- **Retire a hue by retiring a type.** The vocabulary is fixed but not sacred; if a
  declared type is not earning its place, taking it out returns a hue.
- **Stop borrowing.** `DESIGN.md`'s **Borrowed Palette Rule** is what caps this at eight —
  no colour originates in `styles/`. Minting one would break the rule this plugin is most
  opinionated about, and would stop tracking the user's theme. Named to be refused, not
  built.
- **Accept a shared hue with a stated pairing rule.** Two types on one hue, distinguished
  by icon alone. Weakest — it makes the badge's colour stop answering "which type", which
  is the only job the Ladder Rule gives it.

## Why not now

Nothing is blocked. Eight types have eight hues and the view is correct today; this is a
constraint waiting for a ninth type, and the shape to build depends on what that type is
for. Building a second badge axis before anything needs one is scaffolding for later.
