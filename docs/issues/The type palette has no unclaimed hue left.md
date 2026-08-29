---
type: Issue
order: 70
parent: "[[Theming and styling]]"
status: Done
priority: P3
area: design
created: 2026-08-08
source: review of PR
files:
  - styles/badges.css
  - src/view/render/rows.ts
  - src/domain/settings.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The type palette has no unclaimed hue left

## The limitation

`DESIGN.md`'s **Ladder Rule** says a type's colour is identity, assigned once, and that
**adding a type takes an unclaimed hue** — never a rotation, never a slot after the last
one. Obsidian ships eight chromatic families (`--color-red/orange/yellow/green/cyan/blue/
purple/pink-rgb`) and `ALL_TYPES` holds **nine** declared types, so the rule has already
run out and has already been bent:

| | |
| --- | --- |
| Epic · Feature · PBI · Task | orange · purple · blue · **yellow** |
| Issue · Bug · Milestone | pink · red · cyan |
| Idea | **yellow**, shared with Task |
| Deliverable | green |

So the honest statement is not "a ninth type has nowhere to go" — a ninth type went
somewhere, by sharing. A **tenth** has nowhere to go either, and the question this issue
is really holding open is whether each new type takes its own sharing decision or whether
one rule covers them.

## How it surfaced

`Idea` and `Deliverable` were built on branches that could not see each other and both
reached for green — the pair `styles/badges.css` calls the worst available, two extra
types at the same rung, side by side under one parent, told apart by icon alone. It was
resolved by moving `Idea` to **yellow**, which costs the rule that every extra type is
clear of the four levels and buys the lightbulb the colour a lightbulb is. Idea and Task
can still be siblings under a PBI, so it is a smaller collision rather than none: the type
name on the badge and the ladder's indentation separate them, and neither separated two
greens.

**This section said the opposite until 2026-08-08**, and the correction is the point.
It described `Idea` as holding green and `Deliverable` as specified-but-never-built, which
was true when it was written and stopped being true within the day. A note that states an
arithmetic and then goes stale is worse than one that states none, because the next piece
of work reasons from it: [[A badge when the palette is full]] was drafted against "eight
types, eight hues, nothing shared" and had to be rewritten from the CSS. The register is
where decisions live and the code is where the count lives — when a note's own numbers
can be read off `styles/badges.css`, check them there before building on them.

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
  by icon alone. Called the weakest here — it makes the badge's colour stop answering
  "which type", which is the only job the Ladder Rule gives it — and it is nevertheless the
  one that **shipped**, as Idea beside Task. Ranking an option last and then taking it is
  not a contradiction to tidy away: it is what "no unclaimed hue" means in practice, and
  the entry stays ranked last so the next round knows what it is spending.

## Where it stands

**Resolved for a same-family PAIR, and for nothing else.**
[[A badge when the palette is full]] took the first option above: hue stays identity for
the eight, and `Test suite` and `Test case` are told apart from every other type by a
**second axis** — a solid border in the borrowed hue, where every other badge carries a
transparent one, so a test reads as outlined where the rest read as filled. The hue they
borrow is **orange**, Epic's, and the reason is the rule rather than the crowding: an
`Epic` is a root by position in the plan and a `Test suite` is a root by nature in the
catalog, and after [[Tests stay out of the plan]] the two populations are disjoint by
construction, so no screen can draw both.

What it cost: the arithmetic is now **eleven declared types on eight tokens**, with two
documented sharings rather than one — Idea beside Task, and the test family beside Epic.
Nothing was minted in `styles/`, so the Borrowed Palette Rule holds and the badges still
track the user's theme.

**This is not a general answer, and closing it must not read as one.** The axis works
because there are TWO types arriving together and they are a family: it says *this is a
test* before the icon says which kind, and it would hold a third test type for free. A
twelfth type arriving ALONE belongs to no family, so it is back to the four shapes above
and to a second sharing decision taken on its own — which is exactly the pair-by-pair
habit that produced two greens on two branches. If that happens, reopen this rather than
reaching for the axis.

**Unverified here, as ever: appearance.** jsdom asserts classes rather than pixels, so
whether the outline reads as a test at a glance in a real theme, light and dark, is a
live-vault check and is on the smoke-test list rather than in the suite.

What this issue asks of that round is only that the decision be **one decision**. Pair-by-
pair is how two branches both reached for green.
