---
type: PBI
parent: "[[A catalog of tests]]"
order: 20
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# A badge when the palette is full

**As** anyone reading a row, **I want** a test suite and a test case to be as recognisable
at a glance as an Epic or a Bug, **so that** two new types do not arrive wearing a colour
that already means something else.

This is [[The type palette has no unclaimed hue left]] coming due. That issue records the
arithmetic — Obsidian ships eight chromatic families, the eight declared types wear all
eight, and `DESIGN.md`'s **Ladder Rule** forbids answering a ninth with a rotation or with
the neutral slot after the last one — and it closes by saying the shape to build depends on
what the ninth type is *for*. The ninth and tenth are a **pair from one family**, which is
the case the issue's cheapest option was written for: hue stays identity for the eight, and
the tests are distinguished by a **second axis** on the badge, the way `.pbl-implied`
already proves a badge can carry a second signal without a hue.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a row or a card |
| **Trigger** | A `Test suite` or `Test case` is rendered anywhere a badge is drawn |
| **Preconditions** | None |
| **Guarantee** | No shipped type changes colour. The eight existing hues keep their meanings, nothing is minted in `styles/`, and no two types are distinguishable by icon alone. |

**Main flow**

1. The badge table gains `testSuite` and `testCase` entries — an icon each, and a class
   each.
2. Both take one borrowed hue and the **test axis**: a variant treatment stated once in
   `styles/badges.css`, applied to both, that says *this is a test* before the icon says
   which kind.
3. The suite and the case are told apart by icon and by rung, inside the shared axis, the
   way `Epic` and `Feature` are told apart by icon inside the ladder.
4. The legend names both, so a reader who has not learned the axis can read what it means
   rather than infer it.
5. [[The type palette has no unclaimed hue left]] is closed with the shape that was chosen
   and what it cost, since it is that issue's resolution and not merely its consumer.

**Extensions**

- **2a — the borrowed hue is one a state colour also uses.** Allowed, and already shipped
  twice: `Bug` red beside over-limit red, `Milestone` cyan beside marker cyan. Inside a
  badge, colour means IDENTITY; the **Spent Colour Rule** governs outside them. That
  reading was already tried against this codebase by automated review and recorded as
  wrong in the issue — it is repeated here because the next reviewer will reach for it too.
- **2b — the axis is proposed as a rotation onto a second used hue instead.** Refused by
  the Ladder Rule, which is the rule this PBI is here to keep rather than to spend.
- **3a — a third test type is added later.** The axis holds it — that is the property that
  makes this the right shape rather than a trick that works once — but nothing here builds
  for one. There is no third test type.
- **5a — `Deliverable` is built afterwards.** It is then the eleventh type and this axis is
  not its answer: a deliverable is not a test, so it cannot join a family axis, and it is
  back to the issue's remaining options. Closing the issue on this PBI's resolution must
  therefore say *what was resolved* — the test family — and not read as a general answer,
  or the next type will inherit a solution that does not fit it.

## Acceptance criteria

- No shipped type's hue changes, and no colour originates in `styles/` — the **Borrowed
  Palette Rule** holds, so the badges still track the user's theme.
- `Test suite` and `Test case` are distinguishable from each other and from all eight
  existing types, and the test asserting the badge table covers the whole vocabulary
  covers both.
- The distinction between the two test types does not rest on colour alone, and the
  distinction between a test and a non-test does not rest on icon alone.
- The legend names both types.
- [[The type palette has no unclaimed hue left]] is closed, with an outcome stating that
  the resolution is scoped to a same-family pair and is not a general answer for a
  standalone ninth type.
- Not verifiable here, as ever: **appearance**. jsdom asserts classes rather than pixels,
  so what this PBI actually claims — that the axis reads as a test at a glance in a real
  theme, light and dark — is a live-vault check, and it is added to
  [[Smoke test the visual changes]] rather than asserted by the suite. `npm run harness`
  can show the layout and the shape against the real stylesheet; it cannot answer the
  colour, which is precisely the question here.

## Where it lives

**Nothing yet — this note is design.** The badge table is in `src/view/render/rows.ts`,
which maps a type to an icon and a class; the axis and the borrowed hue are one rule in
`styles/badges.css`, and the partial that must state *why* those two entries share a hue
where every other type has its own. The legend is `src/view/render/legend.ts`. Nothing in
`src/domain/` is touched: which colour a type wears has never been a domain question.
