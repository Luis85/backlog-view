---
name: Product Backlog
description: A work-item tree, board and roadmap that reads as part of Obsidian rather than as a plugin installed into it.
colors:
  accent: "var(--interactive-accent)"
  accent-hsl: "var(--interactive-accent-hsl)"
  text-normal: "var(--text-normal)"
  text-muted: "var(--text-muted)"
  text-faint: "var(--text-faint)"
  text-accent: "var(--text-accent)"
  surface: "var(--background-primary)"
  surface-sunken: "var(--background-secondary)"
  border: "var(--background-modifier-border)"
  border-hover: "var(--background-modifier-border-hover)"
  hover: "var(--background-modifier-hover)"
  hover-active: "var(--background-modifier-active-hover)"
  done: "var(--color-green-rgb)"
  over-limit: "var(--text-error)"
  attention: "var(--color-orange-rgb)"
  today: "var(--color-red)"
  marker: "var(--color-cyan)"
  ladder-0: "var(--color-orange-rgb)"
  ladder-1: "var(--color-purple-rgb)"
  ladder-2: "var(--color-blue-rgb)"
  ladder-3: "var(--color-yellow-rgb)"
  extra-issue: "var(--color-pink-rgb)"
  extra-bug: "var(--color-red-rgb)"
  extra-milestone: "var(--color-cyan-rgb)"
  extra-idea: "var(--color-green-rgb)"
typography:
  answer:
    fontFamily: "inherit"
    fontSize: "var(--font-ui-large)"
    fontWeight: "var(--font-semibold)"
  title:
    fontFamily: "inherit"
    fontSize: "var(--font-ui-medium)"
    fontWeight: "var(--font-medium)"
  body:
    fontFamily: "inherit"
    fontSize: "var(--font-ui-small)"
    lineHeight: "1.4"
  label:
    fontFamily: "inherit"
    fontSize: "var(--font-ui-smaller)"
    fontWeight: "var(--font-medium)"
    lineHeight: "1.6"
rounded:
  sm: "var(--radius-s)"
  md: "var(--radius-m)"
  pill: "var(--radius-l)"
  hairline: "1px"
  bar: "3px"
spacing:
  xs: "var(--size-2-1)"
  sm: "var(--size-2-2)"
  md: "var(--size-4-1)"
  lg: "var(--size-4-2)"
  xl: "var(--size-4-3)"
  xxl: "var(--size-4-4)"
  section: "var(--size-4-8)"
components:
  row:
    textColor: "{colors.text-normal}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "var(--size-2-1) var(--size-4-1)"
    height: "30px"
  row-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text-accent}"
  row-touch:
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-normal}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "var(--size-4-2) var(--size-4-3)"
  card-done:
    textColor: "{colors.text-faint}"
  badge:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 var(--size-4-1)"
    width: "58px"
  chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 var(--size-4-1)"
    width: "140px"
  chip-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text-normal}"
  count-pill:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 var(--size-4-2)"
    width: "20px"
  tag:
    textColor: "{colors.text-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 var(--size-2-2)"
  board-column:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.md}"
    padding: "var(--size-4-2)"
    width: "260px"
  bucket:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.md}"
    padding: "var(--size-4-2)"
    width: "280px"
  bar:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    height: "14px"
---

# Design System: Product Backlog

## Overview

**Creative North Star: "The Native Instrument"**

This is a plugin that should be indistinguishable from a part of Obsidian someone shipped.
It contributes *structure* — rank, depth, columns, spans — and contributes no *surface*
whatsoever. Every colour, every size step, every radius and every font in the interface is
an Obsidian design token read at paint time, so an unfamiliar theme changes everything the
user sees and breaks nothing. There is no brand here to defend, and introducing one would
be the single most damaging change anyone could make to this system.

Precision comes from restraint. A component at rest is a 1px border and a label. Weight is
added only by state — hover, selection, focus, drag, over-limit — and each state adds
exactly one signal, never two. Controls that are not currently needed are not currently
visible: grips, add buttons and tag affordances fade in at 120ms when the pointer arrives,
and reserve their space so nothing reflows when they do. Depth is almost entirely absent;
what looks like layering is tonal, a lighter surface sitting inside a sunken container.

Colour is spent, not applied. Four hues carry the work-item ladder and four more carry the
types beside it — that is identity, and it is how you find your altitude in a tree three
hundred rows deep. Everywhere else colour means state and nothing else: accent for active,
green for finished, red for over the agreed limit, orange for attention, cyan for a marker
that is not work. A screen with no problems on it is monochrome apart from its badges.

**Key Characteristics:**

- Every value is an Obsidian variable; the system owns no palette, no font and no scale.
- Flat by default — one shadow exists in the entire stylesheet, on the one element that floats.
- Dashed means "present, but not asserted" — consistently, in eight different places.
- One signal per state. Done dims; it is not also struck through.
- Controls are quiet until addressed, and reachable without a pointer.

## Colors

The palette is borrowed in full. Every entry below is an Obsidian custom property, and its
rendered value belongs to whatever theme the user installed.

### Primary

- **Interactive Accent** (`var(--interactive-accent)`): the answer to "where am I, and where
  will this land". It draws the selection rail inset on a row, the 2px insertion line and
  its capping dot during a drag, the ring on a selected card or column, the focus outline on
  the tree, and every scheduled bar on the timeline. It appears at 0.08–0.25 alpha via
  `--interactive-accent-hsl` for the surfaces it tints rather than strokes — a drop target,
  a filter match highlight, a tag pill.

### Secondary

- **Done Green** (`var(--color-green-rgb)`): finished, everywhere the concept appears — the
  progress fill, a complete rollup's label, the state chip's Done variant, a done column's
  icon, a done bar. Never used for "good", "success" or emphasis.
- **Over-Limit Red** (`var(--text-error)`): exactly two jobs — a column past its WIP limit,
  and the destructive hover on a tag's remove button.
- **Attention Orange** (`var(--color-orange-rgb)`): a configuration warning in the toolbar,
  and the orphan marker on a row whose parent link is broken. Both are "look at this", not
  "this failed".
- **Marker Cyan** (`var(--color-cyan)`): milestone lines and labels. A date is not work, so
  it takes a colour no rung and no container uses.
- **Today Red** (`var(--color-red)`): the today line on the timeline, at 0.55 opacity. Reads
  as a rule drawn on the plan rather than as an error.

### Tertiary — the type ladder

Eight fixed hues, assigned once. See **The Ladder Rule** below.

- **Level 0–3** (`--color-orange-rgb`, `--color-purple-rgb`, `--color-blue-rgb`,
  `--color-yellow-rgb`): Epic, Feature, PBI, Task in ladder order. Rendered as
  `rgb(...)` text on a `rgba(..., 0.14)` field.
- **Issue pink**, **Bug red**, **Milestone cyan**, **Idea green**: the types beside
  the ladder, each clear of the four levels. A Bug reads as a problem, not as whatever came
  after Task. Green was pencilled in here for `Deliverable`, a type that was specified and
  never built; `Idea` shipped and took it. A hue held for something unbuilt is a hue nothing
  is wearing.

### Neutral

- **Text Normal** (`var(--text-normal)`): row and card titles, column headers.
- **Text Muted** (`var(--text-muted)`): everything secondary and everything not-yet-acted-on —
  chips, counts, badge default, context-row titles, the busy label.
- **Text Faint** (`var(--text-faint)`): done titles, parent breadcrumbs, placeholders, empty
  hints, stray markers, the drag grip at rest.
- **Surface** (`var(--background-primary)`) and **Sunken** (`var(--background-secondary)`):
  the whole depth model. Cards sit on Surface *inside* columns and buckets painted Sunken.
- **Border** (`var(--background-modifier-border)`) with **Border Hover**: the hairline that
  does most of this system's structural work — card edges, column edges, indent guides, the
  toolbar rule, timeline cell divisions.
- **Hover** (`var(--background-modifier-hover)`) and **Hover Active**: row and control
  feedback, and the field behind counts and badges.

### Named Rules

**The Borrowed Palette Rule.** No colour originates here. Every colour expression in
`styles/` reads an Obsidian variable — including the accent tints
(`hsla(var(--interactive-accent-hsl), …)`) and the semantic `--color-*-rgb` families.
*Audit test:* a hex, `rgb()`, `hsl()` or named colour literal in `styles/` is a finding.
Exactly one exists — the grey `var()` fallback on `.pbl-badge.pbl-implied` in
`styles/badges.css` — and no render path can reach it, which is why the register counts the
palette as done. Whether a fallback nothing renders is permitted is the question
[Styling rules are checks](docs/requirements/Styling%20rules%20are%20checks.md) has to
answer. **Nothing currently checks any of this.**

**The Ladder Rule.** A type's colour is identity, not decoration. It is assigned once, fixed
for the life of the ladder, and never reused for state, selection or emphasis. Adding a type
takes an unclaimed hue — never a rotation, never a slot after the last one. The ladder is
fixed at four, so `styles/badges.css` holds the whole of it and there is no end to fall off.

*Amended 2026-08-08:* **there is no unclaimed hue left.** Obsidian ships eight chromatic
`--color-*-rgb` families and the eight declared types now wear all of them. The rule stands
and is no longer satisfiable by following it — the ninth type has nowhere to go, and
"identity, never reused for state" is what makes a rotation the wrong escape. Recorded, with
the shapes that could answer it, in
[`docs/issues/The type palette has no unclaimed hue left.md`](docs/issues/The%20type%20palette%20has%20no%20unclaimed%20hue%20left.md).
Note what is NOT the problem: a badge hue matching a state hue is deliberate and already
shipped twice — Bug red beside over-limit red, Milestone cyan beside marker cyan — because
inside a badge colour means identity and the Spent Colour Rule below governs everywhere
else. Green on an unfinished `Idea` is that same intended overlap, not a completion signal.

**The Spent Colour Rule.** Outside the badges, colour must mean a state — accent (active or
targeted), green (done), red (over the limit or destructive), orange (attention), cyan
(marker). A colour introduced for any other reason is decoration and does not ship.

## Typography

**Display Font:** none. **Body Font:** none. **Label Font:** none.

The system declares no font family anywhere. The single `font-family` declaration in the
stylesheet is `inherit`, on the state and horizon chips, and its only job is to undo the
chrome a native `<button>` brings with it. Type comes from Obsidian, and so does its scale.

**Character:** three UI sizes doing all the work, differentiated by weight and colour rather
than by family or dramatic scale contrast. The result is dense and even — a backlog is read
as much as it is worked, and nothing on screen shouts.

### Hierarchy

- **Answer** (`var(--font-ui-large)`, `var(--font-semibold)`): the one number a detail panel
  exists to state — today the estimation panel's total, and nothing else. *Added 2026-08-20,
  documenting a size the stylesheet had already been using at `.pbl-est-decomp
  .pbl-est-total` while this hierarchy declared three; that position-addressed rule was
  since deleted, and the size is now declared on `.pbl-est-header .pbl-est-total`, the
  header that owns its own type.* It is deliberately
  the narrowest possible entry: a panel that computes one figure from many inputs is a shape
  this system now has, and shrinking that figure to a heading's size loses the hierarchy the
  panel is for. It is **not** a general emphasis size — a second use needs the same argument,
  which is that the surface's whole purpose is the number.
- **Title** (`var(--font-ui-medium)`, `var(--font-medium)`): empty-state headlines, and the
  detail panel's item name above its Answer. Where this interface raises its voice — for a
  headline when there is nothing to show, and for the name of the thing being scored.
- **Body** (`var(--font-ui-small)`): row titles, card titles, board column and roadmap
  bucket headers, toolbar buttons, the filter input, empty hints. The default reading size.
- **Label** (`var(--font-ui-smaller)`, line-height 1.6–1.7): badges, chips, counts, limits,
  parent breadcrumbs, match pills, meta cells, a TABLE's column headers, the busy indicator.
  Everything that annotates rather than names. *A table's column header is a Label and a
  board column's is Body — qualified 2026-08-21, because unqualified "column header"
  appeared in both entries and an ambiguous entry in a four-step ladder is how the next
  silent drift gets in.*

### Named Rules

**The No Font Rule.** The plugin never names a typeface. If a family declaration other than
`inherit` appears in `styles/`, the system has stopped being native.

**The Tabular Number Rule.** Any number that changes in place takes
`font-variant-numeric: tabular-nums` — the filtered count ("3 of 12") and the WIP limit do
today. A quantity that shifts its neighbours as it counts is a quantity nobody can read at a
glance.

## Layout

**The spatial model is one vertical flex column that clips**, with exactly one scroller
inside it. `.pbl-view` is `overflow: hidden`; the projections each hand their scrolling to
`.pbl-tree`, which scrolls vertically for the tree, horizontally for the board and the
horizon buckets, and neither way on the dated axis (where the timeline is its own scroll box).
A region the user cannot reach is the one outcome this must never produce.

**Spacing** is Obsidian's `--size-*` steps, used at six densities: `--size-2-1` for
intra-control gaps, `--size-4-1` for row internals, `--size-4-2` for card and column padding,
`--size-4-3` for gaps between columns and buckets, `--size-4-4`/`--size-4-8` for empty-state
breathing room. A row is `min-height: 30px`, rising to 40px under `(hover: none)`.

**Fixed columns anchored to the row's end** carry the state chip (116px), the horizon chip
(116px) and the rollup (84px), so values line up across rows instead of trailing each title.
They never shrink: the title truncates with an ellipsis and a tooltip, and a column that has
run out of room **drops out whole** rather than sliding out from under its neighbours.
Depth is `calc(var(--pbl-depth) * var(--pbl-indent, 24px))` of inline-start padding, with an
indent guide connecting each child group to its parent's chevron column.

**Board columns are 260px and never shrink or drop** — a workflow stage exists whether or not
the pane is narrow; the board scrolls sideways instead. **Horizon buckets do the opposite**:
`flex: 1 1 280px` with a load-bearing `min-width: 280px`, and their cards reflow into
`repeat(auto-fill, minmax(min(240px, 100%), 1fr))` so a wide pane is used rather than padded.
Only past the 280px floor does the row fall back to horizontal scroll.

**Padding never sits on an edge something is pinned to.** A sticky child pins at the
scroller's content edge, so whatever wants a gap owns it inside the box that pins — the
roadmap's pinned strips take theirs as an inline margin sized against the container query,
the bucket row takes an equal one as padding inside the scrolled frame, and the two are
deliberately the same value so they read as one gutter.

### Named Rules

**The Band Rule, and it has no exceptions.** On the dated axis the timeline takes what is
left (`flex: 1 1 auto`, `min-height: 180px`); **every other band declares a maximum and
scrolls itself** (`max-height: 30%`, `overflow-y: auto`). A cap without its own `overflow-y`
creates no scrollport, so an unbounded band in a short pane grows until it squeezes the
timeline out. A band added later declares both.

**The Whole-Column Rule.** A fixed end column is present at full width or absent. It never
shrinks, and it never partially occludes its neighbour.

## Elevation & Depth

**This system is flat, and its depth is tonal.** No `box-shadow` in the stylesheet reads as
elevation — nothing floats over other content, so nothing casts. It held one until the
root-drop strip was removed, and losing the strip is what made the rule absolute rather
than nearly so. Every `box-shadow` in the file is an `inset` or a 1px spread being used
as a **ring**, not a shadow: selection, focus, drop-target and the focus-level button's
active state all use `box-shadow: 0 0 0 1px var(--interactive-accent) [inset]` because a ring
does not move the element or reflow its neighbours.

Perceived depth comes from two tones and one hairline: cards painted
`var(--background-primary)` sitting inside columns and buckets painted
`var(--background-secondary)`, each separated by a 1px `var(--background-modifier-border)`.
A pinned timeline header or lead column asserts itself by painting an opaque
`var(--background-primary)` and drawing a border, never by casting a shadow over what scrolls
beneath it.

### Shadow Vocabulary

- **Ring** (`box-shadow: 0 0 0 1px var(--interactive-accent) inset`): selected card,
  selected column, drop-over target.
- **Rail** (`box-shadow: inset 2px 0 0 var(--interactive-accent)`): the selected tree row.
- **Cage** (`box-shadow: inset 0 0 0 2px var(--interactive-accent)`): drop-inside on a row,
  paired with a 0.1-alpha accent tint.

### Named Rules

**The One Shadow Rule.** A shadow means the element is physically above the content behind
it. If it is not floating, it gets a ring, a rail or a border — never a shadow. A second
`var(--shadow-*)` appearing in `styles/` needs to justify what is floating.

**The No-Reflow Feedback Rule.** No state may change an element's box. Rings are inset,
revealed controls reserve their space with `opacity` rather than `display`, and the drag
overlay is absolutely positioned — because a control that enters the box model on reveal
shifts the row out from under the pointer that was reaching for it. That shipped once.

## Shapes

Three radii, all Obsidian's: `var(--radius-s)` is the default for anything small and
rectangular (rows, badges, chips, chevrons, bars, drop ghosts), `var(--radius-m)` for
containers (cards, columns, buckets, the drop overlay), `var(--radius-l)` for anything that
should read as a pill (counts, tags, the tag-add button). Four literal radii exist for
geometry the token scale does not describe: `3px` on the 5px progress bar, `2px` on a filter
match, `1px` on the 2px insertion line, and `50%` on the 8px dot that caps it.

Borders are the primary form language: 1px, `var(--background-modifier-border)`, on cards,
columns, buckets, the toolbar, timeline cells and indent guides. Structure is drawn, not
filled.

Silhouettes carry meaning on the timeline. A bar is 14px tall with `var(--radius-s)` ends;
an **open end** replaces that end's radius with a fade to transparent, so an unbounded span
looks unbounded rather than merely long; an **inferred** span (a parent spanning its dated
children) is a dashed outline with no fill, because it is drawn from evidence and written
nowhere; a **milestone** is a 12px square rotated 45° — a diamond, so a marker is not a short
bar; and an item **outside** the visible window collapses to a 10px top-border tick.

### Named Rules

**The Dashed Line Rule.** A dashed border means *present, but not asserted* — and it means
that everywhere, without exception: a context row's card (in the Base's results only as
scaffolding), a board column or horizon bucket holding a value the configuration does not
name, an unset state or horizon chip, an implied type badge, an inferred timeline span, a
drop ghost, and the add-a-tag button. A solid
border asserts; a dashed one reports. Never use dashed for emphasis.

**The Shape-Before-Colour Rule.** Every state that matters must survive a monochrome
screenshot. Over-limit colours its numbers red *and* adds an icon. A stray column is dashed
*and* carries a marker. Done dims *and* the chip changes. Colour is the fastest signal, never
the only one.

## Components

### Rows (the tree)

- **Character:** quiet until addressed.
- **Shape:** 30px min-height, `var(--radius-s)`, no border, no background at rest.
- **States:** hover paints `--background-modifier-hover` and turns the title
  `var(--text-accent)`; selection paints the same field plus a 2px inset accent rail;
  keyboard focus adds a 1px accent outline *on the selected row* — the tree itself carries
  the ring only until a row is selected, because tabbing into an unselected tree used to show
  nothing at all.
- **Pending** (written, awaiting the Bases refresh): 0.45 opacity with a 900ms alternating
  pulse to 0.7.
- **Done:** the title goes `var(--text-faint)` and the badge drops to 0.6 opacity. **No
  strike-through** — that says the same thing twice, and says it by making a finished item
  harder to read.

### Cards (board, buckets, shelf)

- **Character:** the row's equivalent where there is no rank to indicate.
- **Shape:** `var(--radius-m)`, 1px border, `var(--background-primary)` on the sunken column.
- **States:** hover lifts the border to `--background-modifier-border-hover`; selection is a
  border change plus a 1px accent ring; the drag source drops to 0.5 opacity.
- **Context variant:** dashed border, `default` cursor, muted italic title. Readable, never
  writable.

### Badges

- **Shape:** `var(--radius-s)`, `min-width: 58px` so titles start at an even column,
  `max-width: 120px` so a long custom level cannot eat the row.
- **Colour:** `rgb(var(--pbl-badge-rgb))` text on the same hue at 0.14 alpha.
- **Implied variant:** transparent field, dashed 0.4-alpha border, 0.8 opacity.

### Chips (state and horizon)

- **One shape for two properties** — they sit in adjacent columns on the same row, and a
  second look would read as a second kind of thing.
- **Style:** real `<button>`s stripped of button chrome (`appearance: none`, `box-shadow:
  none`, `font-family: inherit`), `var(--background-secondary)` field, 1px border,
  `var(--radius-s)`, max 140px with ellipsis.
- **Unset:** dashed border, `var(--text-faint)`. **Done:** green text and a 0.35-alpha green
  border. **Static** (a note outside the filter): 0.75 opacity, `default` cursor, and no
  hover response at all — it is not a write surface.

### Counts and limits

- **Count pill:** `var(--radius-l)`, `--background-modifier-hover` field, min-width 20px,
  centred.
- **Filtered count** ("3 of 12") and **limit** ("3 / 2") take tabular numerals and muted
  colour, so a pair reads as one quantity in two parts rather than competing with the
  column's name.
- **Over the limit** colours the numbers `var(--text-error)` and adds a 14px icon beside
  them. It colours the *numbers*, never the column: a WIP limit is a signal, never a refusal.

### Icon buttons and revealed controls

- **Style:** transparent, borderless, no shadow; they are `<button>`s so they sit in the tab
  order.
- **Reveal:** `opacity: 0` → `1` on the parent's hover or the button's own `:focus-visible`,
  120ms ease-in-out. The space is always reserved.
- **Disabled:** 0.4 opacity and no hover response. The `disabled` attribute does the
  refusing; the style only says so.
- **Every revealed control carries its own `@media (hover: none) { opacity: 1 }` block
  immediately after the rule it overrides** — see the rule below.

### Tags

- **Pill:** `var(--radius-l)`, accent text on a 0.12-alpha accent field.
- **Overflow fades** rather than clipping hard, via a right-edge mask.
- **Remove** turns `var(--text-error)` on hover; **add** is a 16px dashed circle that turns
  accent.

### Timeline bars (signature component)

- 14px tall, `var(--radius-s)`, `--pbl-bar-color` defaulting to the accent and switching to
  green at 0.7 opacity when done. Grips are 6px, overhanging by 3px at each end.
- The four variants — open-start, open-end, inferred, outside-window — are described under
  **Shapes**. They are the system's clearest example of silhouette carrying meaning.

### Empty and loading states

- Centred column, 40px faint icon, `var(--font-ui-medium)` muted title, a hint capped at
  420px, and an action button when there is one.
- The board's advisory sits *beside* the columns under a top rule — never instead of them.
- A loading state exists because an empty pane before the first result set reads as a broken
  view.

### Named Rules

**The Reveal-Beside-Its-Rule Rule.** A media query adds no specificity, so a `hover: none`
override written above the `opacity: 0` it undoes loses the cascade and reveals nothing.
Every hover-revealed control therefore carries its own reveal **immediately after** its own
hide, where no later rule for the same selector can get between the pair. That shipped
broken once; `test/view/rendering.test.ts` now checks the ordering.

**The Import Order Is Behaviour Rule.** `styles/index.css` assembles the partials, and two
rules of equal specificity are decided by which came last. `cards.css` follows `board.css`
and `timeline.css` follows `roadmap.css` because the later of each pair overrides the
earlier. Moving a line in that list can change what the user sees while every partial still
parses.

## Do's and Don'ts

### Do

- **Do** reach for an Obsidian variable first, every time — `--text-*`, `--background-*`,
  `--interactive-accent`, `--size-*`, `--radius-*`, `--font-ui-*`, `--icon-*`. If no token
  fits, that is a finding worth stating in a comment, not a licence to invent a value.
- **Do** give each state exactly one signal, and make that signal survive a monochrome
  screenshot (shape or icon alongside colour).
- **Do** use a dashed border for anything present but not asserted, and only for that.
- **Do** put a hover-revealed control's `@media (hover: none)` reveal immediately after the
  `opacity: 0` it undoes.
- **Do** use logical properties — `inset-inline-start`, `padding-inline`, `margin-inline-end`,
  `text-align: end`. The tree will run right-to-left.
- **Do** give any new band on the dated axis both a maximum height and its own `overflow-y`.
- **Do** add a new partial under `styles/`, import it from `index.css` in a position you can
  justify, and say in its header why it sits there if the position is load-bearing.
- **Do** add a new type's colour as an unclaimed hue in `styles/badges.css`.

### Don't

- **Don't** write a colour literal. Not a hex, not `rgb()`, not `hsl()`, not a named colour.
  The one in the tree today is a `var()` fallback nothing can render, and it is the open
  question `Styling rules are checks` has to settle — not a precedent to follow.
- **Don't** introduce a font family. `inherit` is the only legal value.
- **Don't** add a `box-shadow` that is not `inset` or a 1px ring unless the element genuinely
  floats above other content. One does today.
- **Don't** let a state change an element's box — no `display` toggles on revealed controls,
  no borders that appear on hover, no padding that grows on selection.
- **Don't** say the same thing twice. Done dims; it is not also struck through, greyed *and*
  badged, or moved.
- **Don't** name a physical side (`left`, `right`, `margin-left`, `padding-right`,
  `border-left`) where a logical property exists **and the thing it clears, divides or
  draws against is not itself pinned physically**. That second clause is the whole rule: a
  clearance whose neighbour stays at a computed `left` has to stay physical too, or it
  mirrors away from what it clears. Margins, paddings and text alignment are clean as of
  2026-08-22 with one such licensed exception, and `test/view/direction.test.ts` keeps them
  so — including the four-value `padding` shorthand, whose side is a position in a value
  list and not a property name. It licenses a physical box value only in a block that pins a
  physical side itself, so a new one needs its `left:`/`right:` beside it or it fails.
  Bare placements, `border-left`/`border-right` and every gradient that names a side are
  outside the check, each classified in
  [Nothing pins a physical side](docs/requirements/Nothing%20pins%20a%20physical%20side.md);
  **nothing checks those**, so read that note before adding one.
- **Don't** write a raw pixel value without knowing which of three piles it lands in.
  [Obsidian variables, not values](docs/requirements/Obsidian%20variables,%20not%20values.md)
  fixes the classification: **a token** (`--size-*`, `--font-ui-*`) where one fits; **a bound
  `columnFit` sums** (the badge's max-width, the grip, the chevron, the title's min-width),
  which stays a number because a theme must not change an arithmetic TypeScript is doing;
  or **genuinely arbitrary** — hairlines and radii are exempt by default, since a border that
  scales with a spacing token is not a border. A value in the third pile carries a one-line
  reason. **Nothing currently checks this.**
- **Don't** duplicate a bound across the stylesheet and the code without a check.
  `ROW_LEAD_WIDTH` in `src/view/render/columns.ts` sums eight widths that live in
  `styles/tree.css` and `styles/columns.css`, verified today only by whoever remembers.
- **Don't** style a context row or card as writable. Dashed, muted, italic, `default` cursor,
  no hover response.
- **Don't** put a `hover: none` or `prefers-reduced-motion` rule anywhere but
  `styles/touch.css` / `styles/motion.css` — unless it must sit beside the rule it overrides,
  which is the documented exception and the only one.
- **Don't** exceed 400 lines in a partial. `npm run build` fails on it.
