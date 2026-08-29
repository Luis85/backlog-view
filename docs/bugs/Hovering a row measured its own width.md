---
type: Bug
parent: "[[The render path states its costs as checks]]"
order: 40
status: Done
area: performance
priority: P1
created: 2026-08-10
closed: 2026-08-10
source: Reported from a vault at ~800 notes; reproduced and measured in the browser harness
files:
  - src/view/render/rows.ts
  - src/view/resize.ts
  - src/view/CLAUDE.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Hovering a row measured its own width

## What happened

With every row expanded in an ~800-note vault, moving the pointer over the tree was
laggy. The console showed `[Violation] Forced reflow while executing JavaScript took
31376ms`.

**Two handlers in one file did this**, and the second is the more instructive: the fix to
the first shipped with a check that hovered only the element it had just fixed.

`renderRowLead` wired `mouseover` on every row title, and the handler began:

```ts
if (title.scrollWidth > title.clientWidth) setTooltip(title, item.title);
```

Narrow panes truncate titles, so the tooltip surfaces the full text — a real feature, paid
for the wrong way. **A layout read inside a pointer event forces the browser to flush
pending style and layout synchronously**, and hovering is precisely what leaves style
pending: `.pbl-row:hover` changes the title's colour and the grip's opacity, so the read
could never reuse a clean layout. Every hover re-laid-out the whole tree.

`renderBadge` wired the same event on every type badge, reading `.pbl-badge-text`'s widths
to decide whether the level name the lead's width budget caps needed spelling out. Same
read, same file, same cost — and it survived the title's fix untouched, because the spy
that came with that fix dispatched one `mouseover` at one `.pbl-title`. A category rule
checked at one of its instances is not checked. (Found by review, on the commit that
introduced the rule.)

It is `mouseover`, not `mouseenter` — it bubbles from child elements and re-fires as the
pointer moves within one title, so a single deliberate hover is several of these.

Measured in the harness, folder layout, 100 hovers with the style invalidation a real
hover causes:

| | 32 rows | 832 rows |
| --- | --- | --- |
| with the read | 64.3 ms | **6568 ms** (65.7 ms per hover) |
| without it | 0.7 ms | **13 ms** (0.13 ms per hover) |

**505× at 832 rows**, and it scales with the tree, which is why it is invisible on any
fixture in this repository and obvious in a real backlog.

## The measurement that nearly missed it

The first attempt reported **0.4 ms for 100 hovers** — no defect at all. Dispatching a
synthetic `MouseEvent` does not move the real pointer, so `:hover` never matches, nothing
invalidates style, and the layout read is free after the first one. The experiment had
removed the very thing that makes the read expensive.

The number only appeared once the probe toggled a class that restyles the titles between
dispatches, modelling what real hovering does. That model is a stand-in and should be
labelled as one wherever it is used again: a synthetic pointer cannot reproduce a real
one here.

## Fix

**Both tooltips are set unconditionally at render, and nothing measures anything.** The
title carries its own text; the badge carries the level name, plus the implied-type
explanation when it is dashed. A tooltip repeating a title that already fits is the whole
price, and it is small.

That is the SECOND fix. The first moved both measurements into one batched pass at the end
of the render — every read, then every write — which removed the per-hover cost and was
wrong anyway:

- It forced the whole tree to lay out once per render, since measuring 832 titles means
  laying out 832 rows.
- It made `content-visibility: auto` unusable. That property lets the browser skip layout
  for off-screen rows and takes this view's forced layout from **447ms to 45ms**; a pass
  that measures every row defeats it one row at a time — measured at **5320ms against
  12ms** with the property on.
- It needed a call site per projection and per invalidation source (resize, `css-change`),
  each of which was a separate review finding, and a write guard so `setTooltip` did not
  attach Obsidian's hover handling on every pass.

Deleting it took all of that with it. Measured at 832 rows: the render is **718ms** with
the pass gone, and **244ms** with `content-visibility` on top — against 692ms before any
of this, when the cost was merely hidden in a handler nobody had timed.

The handler keeps its `hover-link` trigger, which reads nothing.

## What is checked, and what is not

`test/view/renderCost.test.ts` spies the `scrollWidth` and `clientWidth` **getters on
`Element.prototype`** and asserts neither is touched while a `mouseover` is dispatched at
**every descendant of a row**, not at the title alone. On the prototype rather than the
element, on the getters rather than a handler, and swept over the row rather than aimed at
a place — which is precisely what the first version of this check got wrong, and what
[[The drag cleanup scans the whole tree]] already said: a category invariant is checked at
the forbidden thing, not by visiting the examples the author had in mind. It was watched
failing with the badge's read restored.

What it cannot see is a layout read reached through an API it does not name
(`getBoundingClientRect`, `offsetTop`), or one on a path it does not drive — `dragover`,
`keydown`, the card projections.

**A sweep of those found reads that are staying**, and `src/view/CLAUDE.md`'s sentence was
narrowed to admit them rather than left promising more than the code delivers: `zoneFor`
in `interactions/dragDrop.ts`, the timeline's `dayAt` mapping and the link drag all call
`getBoundingClientRect` inside the gesture. A drag's geometry is a property of the POINTER
rather than of the render, so there is no batched form of it — "where is the cursor now"
cannot be precomputed. Whether those reads are costly at eight hundred rows is
**unmeasured**: `dragover` fires continuously and each read follows a `pbl-drop-over` class
change, which is the same shape as the defect this note records. Nobody has reported it,
and this note does not claim it is fine — only that it is a different question, and open.

The tooltips themselves are checked as the guarantee they now are, unconditional and
measured by nothing: `test/view/state.test.ts` asserts a row's title tooltip carries that
title whether or not it is clipped, and `test/view/columns.test.ts` asserts the badge's
carries the level name — plus the implied-type explanation when the badge is dashed, and
nothing else when it is not.

**Not checked here:** that either tooltip appears in a vault at all. `setTooltip` is
Obsidian's, the mock only records the value it was handed, and this is the one part of the
change a user actually sees. Live-vault check owed.

## Lesson

**The cheapest measurement is the one nobody takes.** The first instinct here — and the
first fix — was to keep the question and move it somewhere cheaper: same two property
reads, out of the pointer event and into a batched pass. That removed the 65.7ms hover and
was still wrong. Measuring 832 titles means laying out 832 rows, so the cost moved from
"every hover" to "every render", and it locked out `content-visibility: auto` entirely,
because a row the browser is skipping must be laid out to be measured.

What actually fixed it was asking whether the question was worth its answer. It was not:
the whole benefit of measuring was to withhold a tooltip from a title that already fits,
and a redundant tooltip is a smaller cost than a layout. Deleting the measurement took the
pass, its call site per projection, its invalidation source per event, and its write guard
with it — five review findings' worth of machinery, all of it in service of an optimisation
nobody had priced.

Two things generalise. **A layout read is not expensive because of what it computes but
because of what it forces**, so the question to ask of a handler is never "is this
expensive?" but "what is pending when this runs?". And **when a measurement turns out to be
costly, price the thing it was buying before finding it a cheaper home** — the second fix
here was reached only after the first had been reviewed five times.
