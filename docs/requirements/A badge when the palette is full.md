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

This is [[The type palette has no unclaimed hue left]] coming due, and the first thing to
do is **recount**, because that note is stale and the code is the fact. `ALL_TYPES` holds
**nine** declared types today — four rungs, four extra types including the shipped
`Deliverable`, and `Milestone` — against Obsidian's **eight** chromatic families. The
issue's table is a snapshot from before `Deliverable` landed, and its "eight types, eight
hues, nothing shared" reading is no longer true of anything:

| | |
| --- | --- |
| Epic · Feature · PBI · Task | orange · purple · blue · **yellow** |
| Issue · Bug · Milestone | pink · red · cyan |
| Idea | **yellow**, shared with Task |
| Deliverable | green |

So the absolute this PBI would otherwise have leaned on was already spent. `styles/badges.css`
states the shared pair in as many words — *nine badges, eight theme tokens, so one pair has
to share, and which pair is a decision rather than an oversight* — and the pair it chose is
Idea and Task, separated by the type name the badge carries and by the ladder's own
indentation. The **Ladder Rule** is therefore not intact-and-unfollowable, as the issue has
it; it has been bent once, deliberately, with the reasoning written down beside the CSS.

That changes what this PBI is for. Tests are the **tenth and eleventh** types, so a second
sharing decision is coming whatever happens, and the question is whether it is taken pair
by pair — each new type reaching for whichever hue looks least crowded, which is how Idea
and Deliverable both reached for green on branches that could not see each other — or once,
as a rule. This PBI takes it once: hue stays identity, and the two test types are
distinguished by a **second axis** on the badge, the way `.pbl-implied` already proves a
badge can carry a second signal without a hue. A family axis is worth having precisely
because there are two of them arriving together; it is not a general answer for a lone type
and must not be closed as one.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone reading a row or a card |
| **Trigger** | A `Test suite` or `Test case` is rendered anywhere a badge is drawn |
| **Preconditions** | None |
| **Guarantee** | No shipped type changes colour. The nine existing badges keep their hues and their one documented sharing, nothing is minted in `styles/`, and no two types are distinguishable by icon alone. |

**Main flow**

1. The badge table gains `testSuite` and `testCase` entries — an icon each, and a class
   each.
2. Both take one borrowed hue and the **test axis**: a variant treatment stated once in
   `styles/badges.css`, applied to both, that says *this is a test* before the icon says
   which kind. Which hue they borrow is a decision to record beside the Idea/Task pairing
   and by the same standard: not whichever looks least crowded, but the one whose existing
   wearer a test is least likely to sit beside.
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
- **2b — the two test types are given two separate shared hues instead of one axis.** That
  is the pair-by-pair answer, and it is refused: it spends two more of the eight tokens'
  distinctness for two types nobody needs to tell apart *by colour*, and it is the shape
  that produced two greens on two branches. One axis, one borrowed hue, one decision.
- **3a — a third test type is added later.** The axis holds it — that is the property that
  makes this the right shape rather than a trick that works once — but nothing here builds
  for one. There is no third test type.
- **5a — a twelfth type is declared later, on its own.** This axis is not its answer: a
  lone type belongs to no family, so it is back to the issue's remaining options and to a
  second sharing decision. Closing the issue on this PBI's resolution must therefore say
  *what was resolved* — the test family, and the recount — and not read as a general
  answer, or the next type will inherit a solution that does not fit it.
- **5b — the issue note is corrected rather than closed.** That is what actually happens
  first, and it is part of this PBI rather than a tidy-up after it: a blocker whose stated
  arithmetic disagrees with the shipped CSS cannot be resolved, only argued with. The
  recount above is the correction.

## Acceptance criteria

- [[The type palette has no unclaimed hue left]] states the palette as it is: nine declared
  types, eight tokens, Idea and Task already sharing yellow by a recorded decision, and
  `Deliverable` shipped on green. That correction lands before the axis is designed, since
  the axis is an answer to the real count and not to the one in the note.
- No shipped type's hue changes, and no colour originates in `styles/` — the **Borrowed
  Palette Rule** holds, so the badges still track the user's theme.
- `Test suite` and `Test case` are distinguishable from each other and from all nine
  existing types, and the test asserting the badge table covers the whole vocabulary
  covers both.
- The distinction between the two test types does not rest on colour alone, and the
  distinction between a test and a non-test does not rest on icon alone.
- The legend names both types.
- [[The type palette has no unclaimed hue left]] is closed, with an outcome stating that
  the resolution is scoped to a same-family pair and is not a general answer for a
  standalone type arriving alone.
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
