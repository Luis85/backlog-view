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
---

# Hovering a row measured its own width

## What happened

With every row expanded in an ~800-note vault, moving the pointer over the tree was
laggy. The console showed `[Violation] Forced reflow while executing JavaScript took
31376ms`.

`renderRowLead` wired `mouseover` on every row title, and the handler began:

```ts
if (title.scrollWidth > title.clientWidth) setTooltip(title, item.title);
```

Narrow panes truncate titles, so the tooltip surfaces the full text — a real feature, paid
for the wrong way. **A layout read inside a pointer event forces the browser to flush
pending style and layout synchronously**, and hovering is precisely what leaves style
pending: `.pbl-row:hover` changes the title's colour and the grip's opacity, so the read
could never reuse a clean layout. Every hover re-laid-out the whole tree.

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

The measurement leaves the handler and becomes one batched pass, `syncTitleTooltips`:
every `scrollWidth`/`clientWidth` read first, then every `setTooltip` write. Interleaving
them would force a layout per row and be worse than what it replaced — it would pay for
every row rather than only hovered ones.

It is called from `ResizePolicy`, which owns *when* to re-measure — from `refit`, which
already means *re-measure the pane and apply what that implies*, so the render's fit pass
and the resize observer both get it without a branch each; and from `cssChanged`, because
a theme, a snippet or a late-loading font changes rendered text without moving the tree's
box, so no observer fires and no render follows. The toolbar's own ladder was already on
that event for exactly this reason, and title truncation is the second thing on the page
that measures rendered text. Missing it would have left a title that just became truncated
with no tooltip and one that stopped truncating with a stale one — the one regression the
hover-time check could not suffer, since it re-read the dimensions every time.

The handler keeps its `hover-link` trigger, which reads nothing.

## What is checked, and what is not

`test/view/renderCost.test.ts` spies the `scrollWidth` and `clientWidth` **getters on
`Element.prototype`** and asserts neither is touched while a title is hovered. On the
prototype rather than on the element, and on the getters rather than on this handler, so
it holds for a hover handler written tomorrow — the category rule from
[[The drag cleanup scans the whole tree]], applied at the forbidden thing.

What it cannot see is a layout read reached through an API it does not name
(`getBoundingClientRect`, `offsetTop`). `src/view/CLAUDE.md` states the rule for all of
them; the spy checks the two that were actually violated.

The feature's own test stayed where it was, in `test/view/state.test.ts`, and moved to the
new path — a truncated title still carries its full text — with a second beside it for the
`css-change` path, driving a font change that makes a title start truncating. All three
were watched failing against the code they check.

**Not checked here:** that the tooltip still *appears* in a vault, and that clearing one
with `setTooltip(el, '')` actually removes it — the Obsidian typings do not say, and the
mock only records the value. Live-vault check owed.

## Lesson

**A feature can be correct, cheap-looking and still be paid for in the worst possible
place.** Nothing about this code was wrong except *when* it ran: the same two property
reads, moved out of the pointer event and batched, cost 0.13 ms instead of 65.7 ms. The
question to ask of a handler is not "is this expensive?" but "what does this force, and
what is pending when it runs?"
