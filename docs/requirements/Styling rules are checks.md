---
type: PBI
parent: "[[Theming and styling]]"
order: 60
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Styling rules are checks

The stylesheet properties that are true today become properties that stay true, enforced
by `npm run check`.

**As** someone adding a style, **I want** the stylesheet's rules enforced by the build,
**so that** they hold after the person who knew them has stopped reviewing every diff.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin |
| **Trigger** | `npm run check`, on every build |
| **Preconditions** | [[Nothing pins a physical side]] has landed, so the direction rules pass on today's file |
| **Guarantee** | Every rule passes on the file as it stands. A check added to a clean file is a check nobody has to argue about. |

**Main flow**

1. `npm run check` reads the stylesheet, which `eslint src test` never did.
2. Each rule runs: no literal rendered colour, no `!important`, `.pbl` scope, no
   direction-dependent value, no `:has()` on a container.
3. A separate rule reads TypeScript and classifies every icon name as directional or
   neutral.
4. The build passes.

**Extensions**

- **2a — the value is `transparent` or a mask stop.** Outside the rule by reason, not by a
  suppression list: one names the absence of a colour, the other an alpha.
- **2b — the literal sits in a `var()` fallback.** Still matched. The file's one instance is
  dead code and is deleted rather than exempted.
- **2c — the direction rule is keyed on property names.** It must not be: neither the
  shadow's x-offset nor the gradient has a logical twin to demand, and a manual audit
  missed both.
- **3a — an icon name is in neither list.** The build fails, so a seventh directional icon
  is classified rather than noticed. A name passed as a variable cannot be classified by
  any search, which is why this is the only mechanism that can be correct.
- **4a — a rule needs an exception.** Narrow, with a reason inline, matching how
  `usedClassMembers` declares framework-invoked members rather than suppressing them.

## The argument, already made and already won

`Codebase health` closed `Invariants as checks, not conventions` on exactly this
reasoning, and the root `CLAUDE.md` records what it bought: `no-restricted-syntax` bans
`processFrontMatter`, `vault.create` and `load/saveLocalStorage` outside `storage/`, *"so
a new write path cannot appear by accident."* `showAtMouseEvent` became a lint rule after
shipping as a bug once. `VISUAL_DEPTH` guards the two files that decide types.

Styling has the same shape and none of the enforcement. The audit in
`Theming and styling` found a clean file — no reachable literal colour, 0 `!important`,
every selector `.pbl`-scoped — and every one of those is a fact about an afternoon's grep,
twice corrected. The rules are real, they are followed, and they are written nowhere a
contributor would meet them.

Two things make the case sharper than it looks. `eslint .` ignores CSS entirely, so
*nothing* in the definition of done currently examines the stylesheet.
And the one rule already written down — `setCssProps` over inline styles, in `CLAUDE.md`
under marketplace rules — is followed everywhere, which is what a rule looks like right
up until it isn't.

## What to check

Each of these is a property the file already has, so every check should pass on the day
it is written. That is the point: a check added to a clean file is a check nobody has to
argue about.

| Rule | Today |
| --- | --- |
| No literal **rendered** colour — `var(--…)` only | 1, and it is dead code (`.pbl-badge.pbl-implied`) |
| No `!important` | 0 |
| Every selector inside the `.pbl` namespace | 0 outside it, keyframe steps aside |
| No physical `left`/`right` property where a logical twin exists | Fixed by [[Nothing pins a physical side]], which carries the inventory |
| No direction-dependent value in a shadow, mask or gradient | The same, and the group that has no twin to swap to |
| No `:has()` on a container | Already reasoned about in `src/view/CLAUDE.md` |
| `pbl-est-cur-current` is named by no rule in the sheet (the Spent Colour Rule, applied to a state word rather than a badge) | **Checked** 2026-08-21, `test/view/estimation/styleRules.test.ts`. Watched failing. Narrowed from *"`current` carries no colour class"*, which the code does not do and never did: `renderCurrencyChip` builds `pbl-est-cur-${currency}` for all six, so the element DOES carry the class. What is true is that nothing selects it, and that is what the check reads. A second assertion beside it holds the other half — the two currencies that DO spend colour still spend it, so deleting every currency rule would fail rather than pass |
| One radius across the chip family — state, horizon and currency alike (`var(--radius-s)`, never the pill's `var(--radius-l)`) | **Checked** 2026-08-21, same file, both directions per member. Watched failing. Its ceiling is that the family is ENUMERATED: a seventh chip class is outside the check until somebody adds it there, and a bare scan for `--radius-l` cannot replace the list because that value is correct on the pill shapes DESIGN.md reserves it for |
| The dimension-row divider asks what comes BEFORE a row (`.pbl-est-dim + .pbl-est-dim`), never what is last | **Checked** 2026-08-21 as a PAIR, and neither half alone would have caught the defect: `styleRules.test.ts` says the rule exists and the `:last-of-type` form is deleted, `test/view/estimation/dimensionRows.test.ts` says the rows are adjacent and the last div under the panel is not a row — the exact condition that made the old rule match nothing. Both watched failing |
| The panel's title wears DESIGN.md's Title WEIGHT (`var(--font-medium)`), and the Answer's `var(--font-semibold)` appears in no rule for it | **Checked** 2026-08-21, `test/view/estimation/styleRules.test.ts`, both directions. Watched failing. Found by reading computed style, not by looking: 15px/**600** against a Title entry declaring 500, whose other wearer (`.pbl-empty-title`) already obeyed it. `ruleAt` cannot read a computed weight — the pair's other half is `test/view/estimation/panel.test.ts`, which asserts the title is INSIDE the header the descendant selector addresses, the exact condition three type rules in this view lost silently |
| A decoration never sizes the box the value is centred in — `.pbl-est-strip` is `position: absolute` inside a cell that is `align-self: stretch`, and neither strip cell declares `flex-direction: column` | **Checked** 2026-08-21, same file, existence and absence. Watched failing. The column flex made the two strip cells ~24px against a plain cell's ~18px, so a row centring each cell as a whole started their numbers ~3px higher — in a table whose whole job is comparing numbers across a row. The strip stays INSIDE the cell because the three cell classes share `overflow: hidden`. What no rule check reaches is whether the four numbers actually land on one baseline: that is `?measure`'s `NUM` probe, read by hand in a headless browser, and jsdom lays nothing out |
| The sorted header draws a direction ELEMENT, and the two directions draw different glyphs | **Checked** 2026-08-21, `test/view/estimation/sort.test.ts` — a DOM check rather than a rule check, because the defect was a missing element and not a missing declaration. Watched failing. `aria-sort` alone was the only difference between ascending and descending, and it is not a supported attribute on a button at all: the direction survived neither a colour screenshot nor a screen reader. What no check here reaches is whether a 10px glyph READS on a real display — the live-vault smoke test's, and it stays owed |
| The gutter `.pbl-est-dim-head` holds open for the clear control is not narrower than the control (`var(--size-4-8)`, never the old 20px), and that head — not the row above it — is the box the control is positioned against | **Checked** 2026-08-21, `test/view/estimation/styleRules.test.ts`, both halves in both directions — the new token present and the old 20px one gone, the `position` present on the head and absent from the row. Watched failing. The vault-reported overlap was arithmetic and nothing else: an inset resolves against its containing block's PADDING box, and a padding box INCLUDES the padding area, so `inset-inline-end: 0` always landed on this head's outer edge and a 30px control pinned there reached 10px back over the last point out of a 20px gutter. 32px is `.clickable-icon`'s 4px/6px padding around an `--icon-m` glyph, 18px on the desktop root and 20px at the touch breakpoint. The `position` half is checked because a first fix MOVED it to `.pbl-est-dim`, which bought nothing on the inline axis and made `top: 0` resolve 8px high against that row's own `padding-block`; the assertion holds the revert. What no rule check reaches is whether the control lands inside the gutter, where it lands on the block axis, or what a theme setting its own `--icon-size` does to either — a live-vault look, and it stays owed |
| A row the keyboard steps to reserves the sticky header's own height as `scroll-margin-block-start` (`.pbl-est-row`) | **Checked** 2026-08-21, same file — the declaration's presence on the row, and nothing more. Watched failing. `block: 'nearest'` scrolls a row flush to the scroller's edge, which is under `.pbl-est-head`, so an upward step parked the selection behind the column labels; 32px is that header's own `min-height`. Two things beside it are UNCHECKED and stated rather than implied. The panel's matching absence is a deliberate **deviation from the spec**, which asked for the same declaration on `.pbl-est-dim` as well: it was declined on the argument that `renderPanel` restores the panel's scroll position so a refocused point button is already on screen, and that `.pbl-est-header`'s height is content-driven so a constant would be a guess — no check reaches either half of that argument and no vault look has been made. And whether the offset that DID ship is ENOUGH is a measurement jsdom cannot make: a theme that moves the row height or the font moves it. Both are bullets on [[Smoke test the estimation view's UX polish in a live vault]] |

### The colour rule needs one word of care

Stated as *"no literal colour value"* the rule reports violations against today's file
rather than zero, and every one of them is correct code. A tally is deliberately not
written here — the `transparent` occurrences move with every rule added, and this note
already had to correct the same table three times. The kinds are what the rule has to
know about:

| Literal | Where | Verdict |
| --- | --- | --- |
| `transparent` | Spread across the partials, wherever a background or a border is turned off, and in the tag mask's far stop | **Stays.** Not a colour — the *absence* of one, and no theme variable means "nothing" |
| `black` | The tag mask's near stop, `styles/tags.css`, `.pbl-tag-list` | **Stays.** A mask's channel is **alpha**. `black` there means fully opaque and is never rendered; tokenizing it would substitute a colour for an opacity |
| `128, 128, 128` | `styles/badges.css`, `.pbl-badge.pbl-implied` — `rgba(var(--pbl-badge-rgb, 128, 128, 128), 0.4)` | **Delete the fallback.** It is unreachable — see below |

So the rule is about **rendered** colour: a literal naming a colour the user sees. That is
a narrowing by reason rather than an exception list, which matters because an exception
list would have to be maintained and a reason does not — the next `transparent` is covered
without anyone adding a row.

The third row is the only literal rendered colour in the file, and it is **dead**. Tracing
the path settles it:

- `impliedType` is true in exactly one branch — the `else` in `computeLevel`
  (`src/domain/model.ts`), reached only when the note has **no** `typeName` at all. Any type name, known or not, takes the other
  branch and sets it false.
- That branch also sets `levelIndex = childSlot`, and `childLevelIndex` returns `0` for a
  root or `min(x+1, LEVELS.length-1)` otherwise — so an implied item's `levelIndex` is
  always in **0-3**.
- `renderBadge` then adds `pbl-lvl-${levelIndex % 8}`, and `.pbl-lvl-0` through `.pbl-lvl-3`
  each define `--pbl-badge-rgb` (`badges.css`).

So `.pbl-badge.pbl-implied` never renders without the property set, and the grey can never
appear. An earlier version of this note claimed the off-ladder `Bugfix` case reached it,
which is wrong twice over: an unknown type *has* a `typeName`, so it is never implied, and
it gets `pbl-lvl-unknown`, which `.pbl-badge[class*='pbl-lvl-']:not(.pbl-lvl-unknown)`
explicitly excludes from the colour rules entirely.

The right treatment is therefore neither "tokenize it" nor "exempt it" but **remove it**.
An unreachable fallback is dead code, which this repository already gates with fallow, and
deleting it leaves `rgba(var(--pbl-badge-rgb), 0.4)` — restoring the property the rest of
this PBI depends on: a check added to a file that already passes.

### How the colour audit was wrong three times

This claim has now been corrected three times. The first two were the *search* at fault
rather than the reading of it:

1. The first audit matched `#hex` and bare `rgb()`/`hsl()`, and reported zero. True of the
   forms it searched for, not of the rule — CSS colour **keywords** are a third form.
2. The second audit added the keywords but **excluded every line containing `var(--`**, on
   the reasoning that such a line reads a variable. `.pbl-badge.pbl-implied` reads a variable
   *and supplies a literal fallback*, so the filter removed the one rule that could still
   violate the rule.

The second is the same failure as the icon enumeration in `Layout survives translated
text`, and it happened *after* that note added **step 0 — verify the search finds what you
think it finds**. The step was written for the icon audit and never applied back here. A
method recorded in one note does not run itself in another.

The third correction is a different mistake and worth separating. Having accepted that the
fallback was a violation, this note then *explained why* — reaching for the off-ladder `Bugfix` case
without tracing whether that case sets `impliedType`. It does not. **The justification was
invented to fit a conclusion already accepted**, which is a failure the previous two
lessons do not cover: enumerating correctly says nothing about whether the reason attached
to an entry is true. Read the path, or write down that you did not.

The last two rows of the table are why this is not just "add stylelint and take the
defaults".

The direction rule has to match on **values**, not property names. `box-shadow: inset 2px
0 0` on `.pbl-row.pbl-selected` and `linear-gradient(to right, …)` on `.pbl-tag-list` both
pin a side, and neither
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

- `npm run check` examines the stylesheet — the partials under `styles/`, since
  `One stylesheet per concern` has landed and the root `styles.css` is now assembled from
  them. Whether that is stylelint, a script, or an eslint processor is an implementation
  call; that the definition of done stops ignoring them is not.
- Every rule in the table above fails the build when violated. Prove each one by
  violating it and watching it go red — the register has already recorded that a check
  which has never failed is a check nobody has tested.
- The **direction** violations are fixed by [[Nothing pins a physical side]], so this
  PBI either lands after it or lands with the direction rules staged. That note also owns
  the inventory, because the version this one used to carry was a count of a file that has
  since grown. Deleting the dead
  fallback on `.pbl-badge.pbl-implied` belongs to this PBI — it is housekeeping the rule motivates, not a
  defect it catches.
- The colour rule is scoped to **rendered** colour. `transparent` and mask stops are
  outside it by reason, not by a suppression list — if the implementation needs eight
  `/* stylelint-disable */` comments to go green, the rule is wrong rather than the
  stylesheet.
- It matches inside `var()` **fallbacks**, since a literal there still renders if the
  property is ever unset. The file's one instance (`.pbl-badge.pbl-implied`) is **deleted rather than
  tokenized**: the path that would show it does not exist, so it is dead code rather than
  a wrong colour. Removing it is also what lets this PBI keep its central property — every
  rule passing on the file as it stands.
- Rule messages name the fix, not the violation. `Use var(--text-muted); a literal colour
  ignores the user's theme` teaches; `unexpected hex value` gets suppressed.
- Exceptions are narrow and carry a reason inline, matching how `usedClassMembers`
  declares framework-invoked members rather than suppressing them.
- **Directional icons are checked too, even though they are not CSS.** An icon name is a
  physical-left cue the stylesheet cannot reach, and `Layout survives translated text`
  under-enumerated them three times running. The check is an explicit classification of
  every icon name in `src/` as directional or neutral, failing when a name appears that
  is in neither list — so a **seventh** directional icon has to be classified rather than
  noticed. This is the one rule here that reads TypeScript rather than the stylesheet,
  which is why it would never come out of a CSS linter.
- The rules are stated in `src/view/CLAUDE.md`, beside the render-cost notes, so they are
  loaded when someone is working on the view rather than read as one wall — the pattern
  the layer guides already follow.

## Where it lives

**Nothing yet — this note is design.** `eslint.config.mjs` holds the existing
`no-restricted-syntax` bans this copies, and does
not read CSS today · `package.json` chains the checks `npm run check` runs · the partials
under `styles/`, assembled by `styles-assemble.mjs`, are what gain a reader · `.fallowrc.json`
is the other static gate, for the precedent of a config with reasons written into it ·
`src/view/CLAUDE.md` is where the rules get stated beside the render-cost notes ·
`src/view/render/toolbar.ts`, `src/view/render/rows.ts`, `src/view/interactions/menu.ts`
and `src/view/backlogView.ts` choose the icon names the classification covers.
