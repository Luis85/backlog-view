---
type: PBI
parent: "[[A catalog of tests]]"
order: 20
status: Done
priority: P2
created: 2026-08-08
source: user request
---

# A badge when the palette is full

**As** anyone reading a row, **I want** a test suite and a test case to be as recognisable
at a glance as an Epic or a Bug, **so that** two new types do not arrive wearing a colour
that already means something else.

This is [[The type palette has no unclaimed hue left]] coming due. The first thing it
needed was a **recount** — that note stated the palette as it stood before `Deliverable`
landed, and this epic was drafted against the stale figure before anyone checked it against
the CSS. The note now states the real one; what follows is that arithmetic, kept here
because it is what the axis is an answer to. `ALL_TYPES` holds
**nine** declared types today — four rungs, four extra types including the shipped
`Deliverable`, and `Milestone` — against Obsidian's **eight** chromatic families:

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

1. The badge table gains an entry per test type — an icon each, and a class each — keyed
   **`'test suite'` and `'test case'`**: lowercase, with the space kept. `renderBadge` looks
   the style up through `byName`, which lowercases the type name and then requires an exact
   key, so a camel-cased `testSuite` is simply never found. Nothing catches that:
   `Record<string, …>` accepts any key, and the miss surfaces as a badge with no icon and
   no colour rather than as an error.
   These are the **first multi-word type names** in the vocabulary — every existing one is a
   single word — so this is the first time that lookup convention is exercised with a space
   in it, and the same is true of every other key derived from a type name (`typeFolderKey`
   produces `typeFolder.test suite`). Whether a generated view-option key holding a space is
   acceptable to Bases is a live-vault question, not one this repository can answer; it is
   named here rather than assumed, and belongs on the smoke-test checklist with the badge.
2. Both take one borrowed hue and the **test axis**: a variant treatment stated once in
   `styles/badges.css`, applied to both, that says *this is a test* before the icon says
   which kind. Which hue they borrow is a decision to record beside the Idea/Task pairing
   and by the same standard: not whichever looks least crowded, but the one whose existing
   wearer a test is least likely to sit beside.
3. The suite and the case are told apart by icon and by rung, inside the shared axis, the
   way `Epic` and `Feature` are told apart by icon inside the ladder.
4. Nothing else is added to explain the axis. A badge already carries the type **in words**
   (`pbl-badge-text`), so the row that wears the axis also names what it is; a key would be
   a second surface repeating what the first one says in full.
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
- **4a — the roadmap legend is proposed as the place to name them.** It is the wrong
  surface twice over, and an earlier draft of this note asked for it. `renderLegend` is
  gated to the roadmap on its dated axis, where a test never appears at all, so a catalog
  reader would never see the key; and adding a swatch there would break the rule that
  module's own comment states — *a swatch exists only where a bar can draw the thing it
  keys* — which is the rule three state-colour bugs were fixed by. A key for something the
  screen cannot draw is the defect, not the omission.
- **5a — a twelfth type is declared later, on its own.** This axis is not its answer: a
  lone type belongs to no family, so it is back to the issue's remaining options and to a
  second sharing decision. Closing the issue on this PBI's resolution must therefore say
  *what was resolved* — the test family, and the recount — and not read as a general
  answer, or the next type will inherit a solution that does not fit it.
- **5b — the issue note's arithmetic is already corrected.** It was, in the same change
  that wrote this PBI, and the ordering is the point rather than a detail: a blocker whose
  stated figures disagreed with the shipped CSS could not be resolved, only argued with.
  What the note still holds open is the **decision**, not the count — which is what step 5
  closes.

## Acceptance criteria

- The arithmetic this PBI is built on is the shipped one — nine declared types, eight
  tokens, Idea and Task sharing yellow, `Deliverable` on green — and it is read from
  `styles/badges.css` rather than from any note. The issue's own statement of it was
  corrected first, and stays corrected: a criterion here that could pass while the register
  disagreed with the CSS would be the same defect one level up.
- No shipped type's hue changes, and no colour originates in `styles/` — the **Borrowed
  Palette Rule** holds, so the badges still track the user's theme.
- `Test suite` and `Test case` are distinguishable from each other and from all nine
  existing types, and the test asserting the badge table covers the whole vocabulary
  covers both. That test is what catches the **key** as well as the palette: a style
  looked up by a name the table does not hold produces a badge with no icon and no colour,
  which no colour assertion would report as a lookup failure.
- Every key derived from a type name survives the space in `Test suite` — the badge style,
  the folder option, and anything else `grep`ping for `typeName.toLowerCase()` turns up.
  Asserted rather than reasoned about, since these are the first type names that are not
  one word.
- The distinction between the two test types does not rest on colour alone, and the
  distinction between a test and a non-test does not rest on icon alone.
- No legend or key is added anywhere for the axis, and the roadmap legend is untouched —
  it keys what the dated axis draws, and it draws no tests.
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

`src/view/render/badges.ts` — the icon-and-colour table for every declared type, and its
one lookup. It is a module of its own now, where it used to be a `const` inside
`render/rows.ts`, and BOTH halves of that move were forced by this PBI.

The table gains `'test suite'` and `'test case'`, lowercase and with the space kept, and
loses its old name (`NON_RUNG_STYLE`), which the two test types falsify: they ARE rungs.
`badgeStyleFor` changed shape rather than gaining a branch — it asks the name the badge
SHOWS instead of `item.levelIndex`, which indexes whichever ladder the item is on. A
`Task` beneath a `Test case` is rung 2 there and rung 3 of the plan's, so the index alone
would have drawn it as a PBI in blue. The result is shorter than the code it replaced and
correct on both ladders without either being named in it.

It moved out of `rows.ts` because it needs a SECOND caller and could not have one there.
`view/manual/typesSection.ts` draws the same badges beside its own type entries, and it
was doing so from a duplicated four-line spelling rule kept on the stated grounds that
reaching across a module cost more than restating it. `Test suite` ended that:
`pbl-lvl-${name.toLowerCase()}` yields `pbl-lvl-test suite`, a token `classList.add`
rejects outright — so the copy became one that could both disagree with the stylesheet and
throw. Importing it back created a cycle (the manual reaches the rows, the rows reach
creation, creation reaches the manual), and the answer is not an exemption: a table of
icons and class names depends on nothing, so it belongs where nothing depends back.

`styles/badges.css` — one hue for both (`--color-orange-rgb`, Epic's) and the test axis
stated once beside the Idea/Task pairing: a solid border in that hue where every other
badge carries `border: 1px solid transparent`, so a test reads as OUTLINED where the rest
read as filled. It composes with `.pbl-implied` rather than fighting it — that rule comes
later in the file and overrides to dashed and transparent, so an implied `Test case` reads
as both. Nothing is minted: the hue is Obsidian's token, so the Borrowed Palette Rule holds.

Orange is Epic's, and the reason is the rule rather than the crowding: an `Epic` is a root
by position in the plan and a `Test suite` is a root by nature in the catalog, and after
[[Tests stay out of the plan]] the two populations are disjoint by construction, so no
screen can draw both.

`src/view/render/legend.ts` is **not** touched, per 4a. Nothing in `src/domain/` is
touched: which colour a type wears has never been a domain question.
