# The estimation view's UX/UI polish pass — design

Written 2026-08-20. No new capability: the estimation view's four projections-worth of
register work (the matrix, the health dashboard, the presets, the weighting scenarios) all
stay Open and untouched. This is the table and the panel that already ship, made readable.

**Revised twice the same day.** The second pass checked every decision against DESIGN.md
and found three that broke its own named rules — the Spent Colour Rule, the
Shape-Before-Colour Rule, and the revealed-control rule. The third pass **measured computed
type and found four more**, three of which this spec's own restructure had caused: moving the
summary and the title into a sticky header stopped three type rules from matching anything,
silently. Each is corrected in place with the rule named rather than quietly rewritten.

Two lessons are worth keeping, because both cost a pass. **A rule that addresses the DOM by
POSITION breaks when the DOM moves, and breaks in silence** — `.pbl-est-decomp .pbl-est-total`
and `.pbl-est-panel > .pbl-est-title` did not error, they just stopped applying, and the
screenshot only looked slightly flat. And **getting colour wrong in a system whose whole
premise is *colour is spent, not applied* looks like care and is the opposite of it**: a green
`current` chip would have lit up every row of a healthy backlog.

**Everything here was drawn before it was specified.** `test/harness/mock.ts` decorates the
REAL view over the REAL `estimationVault()` fixture against the REAL assembled stylesheet,
and three proposals from the first draft were killed by looking at them. Each is recorded
below as a refusal rather than dropped silently, because the next person to read the code
will have the same idea.

## What is on screen today

`renderTable.ts` draws six sortable columns of bare digits; `panel.ts` draws one row per
dimension and per bound scale, then the decomposition, then the two derived numbers. There
is no toolbar. `estimationView.ts` renders straight into a two-track grid whose second track
is reserved and empty until a row is clicked.

## Decisions

### 1. An encoding strip on value and coverage — and on nothing else

Each of the two cells keeps its exact number and gains a 3px strip under it. Value's
denominator is the model's own **declared output range** (`outputMin`/`outputMax`), never the
spread of what the base returned: a bar that follows the population moves when somebody adds
an item, which is the argument `docs/requirements/The value against effort matrix.md`
already settled for its threshold lines. Coverage's denominator is `coverage.enabled`.

**Confidence and effort get no strip.** They had one in the first draft. At 3px under a
right-aligned digit it reads as a stray underline, and a stored `-2` effort clamps to an
empty strip — which says *low* where the truth is *invalid*, directly beside a table cell
showing the number the user typed.

**The radius is `3px`** — `rounded.bar` in DESIGN.md, the declared value for a bar, rather
than the `2px` the first draft copied off `barProgress.css`.

**The accent on the value strip is a colour spend, and this is its licence.** The Spent
Colour Rule reserves the accent for *active or targeted*, and a magnitude is neither — but
`components.bar` already declares the accent for the timeline bar, which is also a magnitude.
The precedent exists, so this is a second use of it rather than a new meaning. Stated here so
a later audit finds the argument instead of the violation. With the green gone from `current`
(decision 2), it becomes the only colour on a healthy screen: the column the reader came for.

**The value strip is weak on the shipped default, and that is honest.** Every total in the
fixture lands between 3.09 and 4.0 on a 1–5 output range, so every bar is about half full.
That is the model failing to separate the items, and a population-relative bar would hide it
by lying. Do not expect the strip to rank at a glance; expect it to say how much of the
declared range an item reached.

### 2. The currency chip — colour only where something needs doing

| Currency | Treatment | What it claims |
| --- | --- | --- |
| `current` | **the plain chip, no colour** | the stored number is this model's and matches |
| `stale` | attention orange **plus a `refresh-cw` icon** | re-estimate this |
| `orphan` | attention orange **plus an `unlink` icon** | the inputs it was computed from are gone |
| `foreign`, `handwritten` | dashed edge, no fill | the number did not come from here |
| `none` | the dash alone, **no chip shell** | nothing stored to judge |

**`current` had a green tint in the first draft, and that broke the Spent Colour Rule.**
Green in this system means *finished*, "never used for 'good', 'success' or emphasis" — and a
current total is trustworthy, not done. The failure is larger than a mis-picked token: a
fully estimated backlog would have lit up green on every row, which is exactly the screen
DESIGN.md says must be "monochrome apart from its badges". Plain, and colour is spent only
where there is something to do — so the eye goes to the two rows that need work and nowhere
else. Verified in the harness, both schemes.

**The two attention chips carry an icon as well as the colour** — the Shape-Before-Colour
Rule, and the same colour-and-icon pair the WIP over-limit count already uses, so the state
survives a monochrome screenshot. Two states, two icons; the word does the rest.

**The dashed pair is the Dashed Line Rule meant exactly as written** — *present, but not
asserted*. A foreign or hand-written total is a number that exists and that this model does
not vouch for, which is the same claim a context row's card and an unset state chip make.

`none` losing its shell is the second refusal: an empty outlined pill beside four marked ones
reads as an empty input field. The `:empty::before` dash stays; the shell goes.

### 2a. The chip joins the family it belongs to

`.pbl-est-currency` was the only pill-shaped chip in the plugin — `var(--radius-l)` on
`var(--background-modifier-hover)`. DESIGN.md reserves the pill for counts, tags and the
tag-add button; a currency word is a **state chip**, and the state and horizon chips are
`var(--radius-s)` on `var(--background-secondary)` — "one shape for two properties", because
they sit in adjacent columns on the same row "and a second look would read as a second kind
of thing". Currency is a third such column and now reads the same way.

`components.chip` in DESIGN.md declares `width: 140px`. That is the number decision 8's
alignment fix arrived at independently: the token was already there.

**But not that family's FILL, and the difference is a fact rather than a drift.** The state
and horizon chips use `var(--background-secondary)`, and they are drawn on rows only — one
surface, painted `var(--background-primary)`. The currency chip is drawn on **two**: a table
row, and the panel, which is itself painted `var(--background-secondary)`. Given the sunken
fill it vanished into the panel behind it while the coloured chips still read — seen in the
harness, both schemes. So it takes `var(--background-modifier-hover)`, which is DESIGN.md's
own "field behind counts and badges" and, being an overlay, reads against either surface.
Same radius, same width, same border as the family; one fill that survives both grounds.

Net effect worth stating plainly, so nobody "finishes" the job later: **the fill does not
change from what ships today** — only the radius and the width do. The intermediate version
that moved the fill to `var(--background-secondary)` for family consistency was built, looked
at, and reverted, because consistency with a family that lives on one surface is not a reason
to disappear on a second.

### 3. A toolbar, reusing the one that exists

`.pbl-toolbar`, `.pbl-icon-btn` and `.pbl-toolbar-spacer` (`styles/toolbar.css`) as they are,
so the only new rule is the count's. It carries three things, all of which the view already
has and cannot reach:

- **✨** — `runEstimationInit`, today reachable only from the guided empty state, so a view
  that gained a dimension after setup has no way to bind and backfill it.
- **Undo** — `WriteGate.canUndo()`/`undoLast()` are public and have no production caller at
  all. `estimationView.ts` says so in a comment; this is what closes it. Disabled to the
  slot's state, and disabled while a batch runs, the backlog toolbar's own rule.
- **A count** — `9 of 11 scored`, which is also where write progress is published: `syncBusy`
  has only `aria-busy` on the whole pane to say anything with today. The wording is the
  filtered count's own idiom ("3 of 12"), muted and `tabular-nums` per the Tabular Number
  Rule — **one quantity in two parts**, not the two quantities joined by a separator that
  `11 items · 9 scored` was.

### 4. The panel says the answer first, and keeps saying it

A sticky header block at the top of the panel holds, in this order: the **item title**; then
one baseline line carrying the **total**, its **coverage** and the **currency chip**; then the
two **derived lines**.

The summary's own two members swap: `panel.ts` draws coverage then total, so the header read
`8/8  3.49` — the qualifier ahead of the thing it qualifies. Total first, coverage after it.

**The chip joins that line rather than following the derived ones**, and adjacent to the
numbers rather than pushed to the header's far end by an auto margin: it is a verdict on the
total, and at ~250px away it read as a status for the panel instead. Under two derived
sentences it read as a third one.

**The header owns its own type rather than inheriting it by position** — see decision 12,
which is what forced the change.

**The panel gives up its block-start padding and the header takes it.** DESIGN.md: *"Padding
never sits on an edge something is pinned to. A sticky child pins at the scroller's content
edge, so whatever wants a gap owns it inside the box that pins."* Left on the panel, the
padding was a band above the pinned header that rows scrolled visibly through — a named rule,
broken, and visible in a screenshot at `?scroll=460`. The roadmap's pinned strips already do
it the prescribed way.

Two facts drove the block. The total used to sit under eleven rows of buttons, and the panel
never stated currency at all, so selecting a stale row lost the one fact that says its number
is wrong. The title is INSIDE the sticky block, not above it: scrolled out of view, the panel
stopped saying which item the points belong to. Found by looking, at `?scroll=520`.

Two headings join the one that exists (`Effort and complexity`): **Value dimensions** over
the dimension block, and **Why this scored what it scored** over the decomposition, which was
an unlabelled list of sentences.

### 5. One-line rows, and what they cost

A row puts its label and its point buttons on one line (~106px → ~76px, measured), with the
rubric sentence keeping its own line below. Eleven rows at 106px is ~1170px in a ~700px
track; at 76px it is ~840px, and the sticky header means the scrolling that remains no longer
costs the reader the answer.

Three mechanical details, all from the mock rather than from reasoning:

- **The clear ✕ is absolutely positioned at the row's top-right**, not a flex item. As a flex
  item it wrapped to a line of its own, which made the row TALLER than the stack it replaced.
- **And it is revealed, not resident.** Eleven always-visible clear controls broke "controls
  that are not currently needed are not currently visible". It takes `.pbl-add`'s pattern
  exactly: `opacity: 0` → `1` on the row's hover or the button's own `:focus-visible`, 120ms
  ease-in-out, with its own `@media (hover: none) { opacity: 1 }` **immediately after the
  hide it undoes** — the Reveal-Beside-Its-Rule Rule, whose ordering
  `test/view/rendering.test.ts` already checks for the four existing controls. Being
  absolutely positioned it never entered the box model, so the No-Reflow Feedback Rule holds
  by construction rather than by reserving space; the head's own `padding-inline-end` holds
  the gap open at rest.
- **`flex-wrap` is the fallback, not a breakpoint.** A range as wide as the fixture's 1–12
  enablement cannot share a line with its own label, so its points wrap to the line below on
  their own — and a pane too narrow does the same for every row. No media query, no
  `@container`.

**The panel track widens to `minmax(320px, 420px)`** from `minmax(280px, 360px)`. A label,
five points and a clear control do not fit in 360px — measured, not estimated. The table
pays, which is what its own `minmax(0, 1fr)` floor already says it should: it shrinks first by
design.

### 6. The rubric sentence stays visible

The obvious way to shorten a row is to move the rubric sentence to hover, where every point's
sentence already lives (`aria-label`/`title`).
`docs/requirements/A rubric for every point.md` forbids it: *a row with an answer is never
silent about it*. Recorded so the next reader does not re-derive it from the code, where
nothing says so.

### 7. Keyboard: one tab stop per row instead of five, and a route into the panel

Each `.pbl-est-points` becomes a `role="radiogroup"` with a roving `tabindex` — one stop per
row, arrows to move and pick, `aria-checked` in place of `aria-pressed`. On the shipped
default (8 dimensions at 1–5, plus three 1–5 scales) that is **11 rows, 55 point buttons and
up to 11 clear buttons — 66 tab stops today**, every one of which a keyboard user must pass
through to reach the note below the table.

The clear control sits outside the radiogroup, which is the other half of why it moved to the
row's top-right: inside, it was a sixth arrow-key stop on a five-point scale.

`ArrowRight` on a table row moves focus into that row's panel. `Enter` keeps opening the note,
unchanged — `docs/requirements/Ranking the items by value.md` extension 4a states it, and
this adds a key rather than reassigning one.

### 8. The columns line up — a defect, not a polish item

**Found by measuring, and it predates every proposal above.** `.pbl-est-currency` is one
element doing two jobs: it is the column's cell AND the pill, and it is sized to its own words
(`flex: 0 0 auto`, `min-width: 96px`, `max-width: 140px`). `.pbl-est-title` is the only item
in the row with any `flex-shrink`, so it absorbs whatever the chip takes — and every fixed
column between them slides. Across the eleven fixture rows:

| Row | Chip width | Value column's left edge |
| --- | --- | --- |
| nine of eleven | 96.0px | 201.0 |
| `Foreign stamp` — `Another model` | 97.8px | 199.2 |
| `Stale total` — `Needs re-estimation` | 125.8px | **171.2** |

So one row's numbers sit 29.8px left of the header naming them, and of every other row.
Giving currency a colour is what made it obvious; the misalignment was already shipped.

**The fix splits the cell from the chip.** The cell takes `flex: 0 0 140px` like every other
fixed column; a `.pbl-est-chip` span inside it hugs its own words. 140px is not a new
number — it is the `max-width` the chip already declared and the width `components.chip`
declares, so the widest word was always budgeted for; it was budgeted per ROW instead of per
COLUMN. `estimation.css`'s own argument for content sizing ("the words are prose, not
digits") is kept and applies to the chip, which is what it was ever about. The column's width
was never the chip's to decide.

Measured after: one left edge per column across the header and all eleven rows.

**One scoping defect the same measurement caught, in the new CSS rather than the old.**
`.pbl-est-total` and `.pbl-est-coverage` are worn by three different elements — a row cell, a
sortable header button, and the panel's decomposition summary — so the strip rule must be
scoped to `.pbl-est-row > …`. Unscoped, one rule restyled all three from one declaration.

### 9. The first row is selected, and there is no placeholder

The third refusal. A placeholder panel explaining what a click gives was built and looked at:
at full track height it is a large dashed empty box that earns nothing. Selecting the first
row instead puts the reader on a scored panel that teaches the view by being it — and it is
one line rather than a new element with its own strings and its own styles.

Selection writes nothing. A pick is a click on a point button, so an auto-selected row is not
a write surface any more than a clicked one is.

The zero-results case is untouched: `estimation.empty.noResults` already answers it, in the
table's own track.

### 10. DESIGN.md gains a fourth type size, and it is the narrowest one that works

The panel's total renders at `var(--font-ui-large)` — a size DESIGN.md's hierarchy did not
declare, used in exactly one place in the whole stylesheet
(`styles/estimationPanel.css`'s `.pbl-est-decomp .pbl-est-total`). The drift was already
shipped; what this pass does is decide which way to resolve it.

Resolved by **amending DESIGN.md**, not by conforming the code down. A detail panel that
computes one figure from many inputs is a shape this system now has, and shrinking that figure
to a heading's size would lose the hierarchy this whole pass exists to build. The new
**Answer** entry is deliberately narrow — *the one number a detail panel exists to state* —
and explicitly not a general emphasis size: a second use needs the same argument, which is
that the surface's whole purpose is the number. The **Title** entry beside it gains the
panel's item name, so "the one place this interface raises its voice" is restated rather than
left false.

Amended in `DESIGN.md`'s frontmatter and its Hierarchy prose. `.impeccable/design.json`
carries colours, components and narrative and has no typography block, so nothing there falls
out of step.

**Confirmed after decision 12 made the size render.** When this amendment was first written
the total was still drawing at 15px/500, so the entry described an intention rather than the
screen; with the header owning its own type the panel's total measures 20px at weight 600 and
the four-step ladder is real. The amendment stands on what was then verified, not on what was
assumed — which is the order this should have happened in.

### 11. What this pass found and did NOT fix

**The estimation table does not keep the Whole-Column Rule.** "A fixed end column is present
at full width or absent. It never shrinks, and it never partially occludes its neighbour" —
the tree implements this with `columnFit`; this table has nothing, and squeezes the title to
its 96px floor while keeping all six columns. It is a real gap against a named rule, and it
belongs with the narrow-width work that is out of scope below, because the fix wants a live
vault's actual pane widths rather than a threshold guessed in a harness.

Recorded here rather than in a comment, so the next reader finds a known gap instead of
discovering an unnamed one.

### 12. The type ladder, measured — and three rules this spec's own restructure broke

**Nothing here was found by looking; all of it was found by reading computed style.** A
screenshot showed a panel that felt slightly flat, which is not a finding. The harness's
`?measure` knob, extended to print `font-size`/`font-weight`/`color` per element, showed
five sizes where the stylesheet believed it was setting three:

| Element | Rendered | Cause |
| --- | --- | --- |
| table row title, row total | 15px | **no UI size declared at all** — the inherited reading size |
| panel total | 15px / 500 | `.pbl-est-decomp .pbl-est-total` stopped matching when the summary moved |
| panel title | 15px / 400 | `.pbl-est-panel > .pbl-est-title` is a CHILD selector; the title is now a grandchild |
| panel coverage | 15px | same cause as the total |
| decomposition terms | 15px | **no size declared** — 12px rubric sentences sat right beside them |

Three of the five share one root cause, and it is the lesson: **a rule that addresses the DOM
by position breaks when the DOM moves, and breaks silently.** The consequence was not
cosmetic — decision 10 amended DESIGN.md to declare an **Answer** size of
`var(--font-ui-large)`, and at the moment that amendment was written the size **rendered
nowhere**. The spec documented a token the markup had stopped using.

**The fix, at the narrowest correct level.** The header declares its own four type steps
instead of borrowing them from where its children happen to sit; the table declares
`var(--font-ui-small)` once on `.pbl-est-table` rather than five times on its cells; and the
decomposition declares `var(--font-ui-smaller)`, which it never had.

Measured after — and every step is now a declared token, with no orphan size:

| Step | Size | What wears it |
| --- | --- | --- |
| **Answer** | 20px semibold | the panel's total |
| **Title** | 15px semibold | the panel's item name |
| **Body** | 13px | row titles, every table number, the coverage qualifier, dimension labels, point buttons |
| **Label** | 12px | column headers, chips, rubric sentences, derived lines, terms, the toolbar count |

The table's move from 15px to 13px is the visible density change in this pass. It is not a
preference: `var(--font-ui-small)` is DESIGN.md's **Body** entry for "row titles, card
titles", the tree's own rows already use it, and the estimation table was the one list in the
plugin set two steps larger than the rest — under a header that declared 12px, so the step
inside one table was 3px where the rest of the interface reads at 1px.

### 13. Confidence is not a value dimension

Decision 4's **Value dimensions** heading grouped the confidence row with the eight weighted
dimensions, which is false: nothing computes the total from confidence — `panel.ts` draws it
between the dimensions and the `Effort and complexity` heading, so a heading placed above the
first dimension swept it in.

Fixed by moving the heading that already exists rather than adding a second: `Effort and
complexity` moves **above** the confidence row and is renamed to name all three fixed scales.
One heading replaces a wrong grouping; the panel reads *Value dimensions* / *Confidence,
effort and complexity* / *Why this scored what it scored*.

`src/i18n/en.ts`: `estimation.panel.effortComplexity` becomes
`estimation.panel.scales` — "Confidence, effort and complexity". A key rename rather than a
new key, since nothing else uses the old sentence.

## Where it lives

- `src/view/estimation/estimationView.ts` — the shell becomes a flex column (toolbar, then
  the grid) rather than the grid itself; `render()` selects the first row when `selectedPath`
  is null; `syncBusy` publishes to the toolbar as well as `aria-busy`.
- `src/view/estimation/toolbar.ts` — **new**. The ✨, the undo button, the count and the busy
  line. A file of its own because `estimationView.ts` is 214 of its 400 lines and the backlog
  view's own toolbar is a module for the same reason. `docs-check.mjs` rule 7 needs a register
  note naming it — see **Register** below.
- `src/view/estimation/renderTable.ts` — the two strips, the cell/chip split with its icon,
  the shell-less `none`, and `ArrowRight` into the panel.
- `src/view/estimation/panel.ts` — the sticky header block, the two headings, the one-line row
  shape, the radiogroups and the roving tabindex.
- `styles/estimation.css` — the shell, the widened panel track, the strips, the chip and its
  five currency classes. It is at 311 of its 400 lines, so the chip block may have to split
  out; `styles/estimationPanel.css` is the precedent for how (`estimation.css`'s own
  2026-08-17 split).
- `styles/estimationPanel.css` — the sticky header with its own four type declarations and
  its own block-start padding, `.pbl-est-dim-head`, the radiogroup, the decomposition's
  `--font-ui-smaller`, and the clear control's hide / reveal / `hover: none` triple, which
  must stay adjacent and in that order. **The three position-addressed rules
  (`.pbl-est-decomp .pbl-est-total`, `.pbl-est-decomp .pbl-est-coverage`,
  `.pbl-est-panel > .pbl-est-title`) are deleted, not left beside their replacements** — a
  rule that matches nothing is the thing the next reader trusts.
- **`styles/motion.css` gets nothing, and that is a correction to this spec's own earlier
  draft.** `index.css` imports `motion.css` at position 10 and `estimationPanel.css` at
  position 32. A media query adds no specificity, so a `transition: opacity 120ms` written in
  `estimationPanel.css` **beats** `motion.css`'s `transition: none` at equal specificity and
  `prefers-reduced-motion` would silently not apply. `.pbl-add` is safe only because
  `columns.css` is imported at position 6, *before* `motion.css` — an accident of order this
  partial does not share.

  So the reduced-motion override sits in `estimationPanel.css` immediately after the
  transition it undoes. That is DESIGN.md's own documented exception — *"unless it must sit
  beside the rule it overrides, which is the documented exception and the only one"* — and
  this is a case of it, with the import positions as the reason written in the partial. The
  alternative, moving `motion.css` later in the list, changes the cascade for every control
  already relying on it and is refused.
- `DESIGN.md` — the **Answer** typography entry and the restated **Title** entry (decision 10).
- `src/i18n/en.ts` — the new sentences: three toolbar labels, the count (a plural form, so
  `count.*`'s own shape), and the two panel headings — one of which is
  `estimation.panel.effortComplexity` **renamed** to `estimation.panel.scales` with its
  wording widened to name confidence too (decision 13). Nothing here is data: no key, no state
  value and no property name is added, so the *what breaks if two people with different
  Obsidian languages open the same vault* test answers "one sees different words".
- `test/harness/estimation.ts` — a **committed** `?measure` knob, which the scratch mock grew
  and which should outlive it. It prints two things into one element a `--dump-dom` can read:
  every column's own **box**, header against every row, and every named element's computed
  **type** — size, weight, colour.

  The argument for committing an instrument rather than a state, and it is now evidence
  rather than a prediction: **this knob found two whole classes of defect that `npm run
  check` cannot see at all.** The 29.8px column slide, because jsdom lays nothing out and
  `getBoundingClientRect` answers zeros. And five wrong type sizes — three of them selectors
  that had silently stopped matching — because the suite never loads `styles/`, so a rule
  that applies to nothing is invisible to every check this repository has. Both shipped. Both
  were found by reading numbers off a real browser.

  Its own check is `test/harness/harness.test.ts`, the same place the `?notes=` knob is
  checked for delivering the size it claims: an instrument that quietly measures the wrong
  thing is worse than none. What that check asserts is that the knob **reports a row per
  column and a row per probe**, not what the numbers are — the numbers are a browser's answer
  and asserting them here would be the screenshot suite ADR 0020 refuses.

## Tests

Every claim above that a check can reach, and the ones it cannot are named as such.

- `test/view/estimation/table.test.ts` — a strip's width comes from the model's output range
  and not from the population (two items, one model, then the same two with a third added: the
  first two strips do not move); no strip on confidence or effort; `none` draws the dash with
  no chip element; each currency word draws its own chip class; **`current` draws no colour
  class at all** — the check that keeps the Spent Colour Rule from being re-broken by somebody
  who thinks a green tick would be friendlier; and the two attention currencies each draw an
  icon, so Shape-Before-Colour is asserted rather than trusted.
- `test/view/estimation/panel.test.ts` — the header holds title, total, coverage, derived and
  the currency chip, in that order, total before coverage; each points container is a
  radiogroup with exactly one `tabindex="0"`; the clear control is not inside it; the rubric
  sentence still renders for a held value (the register rule, asserted where it can be
  broken).
- `test/view/estimation/keyboard.test.ts` — **new**. `ArrowRight` on a row moves focus into
  the panel; `Enter` still opens the note; arrows inside a radiogroup move and pick and hold
  at both ends.
- `test/view/estimation/toolbar.test.ts` — **new**. Undo is disabled with an empty slot and
  enabled after a write; both controls go disabled while a batch runs; the count states the
  model's own scored and item numbers.
- `test/view/estimation/states.test.ts` — the first row is selected on a fresh render, and the
  panel is on screen without a click; a zero-result base still draws
  `estimation.empty.noResults` and no panel.
- `test/view/rendering.test.ts` — the clear control joins the four selectors whose
  hide / reveal / `hover: none` ordering is already checked. This is the one new rule in the
  pass that an existing check already covers, and extending its list is the whole cost.
- `test/view/estimation/alignment.test.ts` — **new**, and the one test here that cannot assert
  what it is about. jsdom lays nothing out, so `getBoundingClientRect` answers zeros and the
  column edges are unmeasurable in the suite. What it CAN check is the structural cause: the
  currency cell holds a `.pbl-est-chip` child rather than the word itself, and carries no
  width-bearing class of its own — so a change that collapses the two back into one element
  fails a test. **The alignment itself is checked by the harness's `?measure` knob, by hand.**
  That is a narrower guarantee than "the columns line up", and the sentence stays narrow
  rather than promising what the check cannot reach.

  **Type is a different case, and the first draft of this section got it wrong.** The suite
  CAN read the stylesheet: `test/view/rendering.test.ts` assembles it with
  `assembleStyles()` and `ruleAt` decides where a rule sits in the cascade — that file exists
  precisely so "a rule that was deliberately REMOVED can be kept out". So the type work is
  checkable in two halves, and **decision 12's defect needed both**:

  - `ruleAt` asserts each new rule is present and each of the three dead ones is **absent**.
    It proves a rule exists; it cannot prove the rule MATCHES anything.
  - A DOM test asserts the structure those rules address — the header holds the title, the
    summary and the derived lines as its own children.

  Neither alone would have caught what shipped: the three dead rules were present and correct
  and matched nothing. The pair is the check. What stays hand-read with `?measure` is only the
  **computed** result in a real browser, since jsdom applies no stylesheet at all.
- `test/harness/harness.test.ts` — the estimation fixture still draws every currency word,
  since the five treatments are now the thing a screenshot is read for; and `?measure` still
  reports a box per column.

**What no test here reaches:** whether the attention orange and the dashed edge separate at a
glance under a community theme, whether the accent value strip survives a themed accent, and
whether 76px rows read as one line or as a cramped one on a real pane. The harness answers
Obsidian's DEFAULT colours only (ADR 0020). A live-vault smoke test is owed, and
`npm run test-build` is the handover.

## Register

The polish pass is a PBI, and the notes it changes are:

- A new PBI under `docs/requirements/The prioritized list.md` for the table's own half (the
  strips, the currency treatment, the cell/chip split, the toolbar) — the toolbar module needs
  a `## Where it lives` naming `src/view/estimation/toolbar.ts` or `npm run docs` fails.
- `docs/requirements/A rubric for every point.md` — its `## Where it lives` gains the row
  shape, the radiogroup and the revealed clear control, and the "never silent about an answer"
  rule gains the sentence saying the hover-only shortcut was refused.
- `docs/requirements/Taking a total apart.md` and
  `docs/requirements/Why this item scored what it scored.md` — the summary and the
  decomposition moved apart, so both notes' descriptions of where the total sits are now
  wrong.
- `docs/requirements/Ranking the items by value.md` — extension 4a gains `ArrowRight`.
- `docs/requirements/Styling rules are checks.md` — this pass adds two rules a check could
  reach and does not have one for: `current` carrying no colour class, and the chip family's
  radius. Named there rather than asserted here.
- `CHANGELOG.md` — an `[Unreleased]` entry, added by the pull request that earns it.

## Out of scope, stated so it is not drifted into

The value/effort matrix, the health dashboard, the framework presets, the weighting scenarios
and the rubric editor. All Open in the register, all real feature work with their own specs.
**Narrow-width stacking** is also out, and takes decision 11's Whole-Column gap with it: the
grid does not reflow, `@container` is unavailable per `styles/estimation.css`'s own note, and
a real breakpoint wants a live vault's actual pane widths rather than a guess made in a
harness.
