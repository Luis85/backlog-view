---
type: PBI
parent: "[[Theming and styling]]"
order: 15
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Nothing pins a physical side

The stylesheet stops naming *left* and *right* — as a property, and as a value — so the
rule [[Styling rules are checks]] adds has a file it can pass on.

**As** someone adding a style, **I want** the direction-dependent constructs gone before
the rule that forbids them arrives, **so that** the check lands on a clean file instead of
opening with a list of violations nobody wants to be the one to fix.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin's appearance |
| **Trigger** | Any rule added to the stylesheet sources |
| **Preconditions** | [[One stylesheet per concern]] has landed, so a construct is addressed by partial and selector rather than by a line in a two-thousand-line file |
| **Guarantee** | Nothing in the left-to-right rendering moves. This PBI changes how a side is *named*, never which side it is — a visual change here is a bug in the swap, not a decision. |

**Main flow**

1. The direction-dependent constructs are **derived** from the stylesheet sources by a
   sweep over the categories, never recalled from a previous reading of the file.
2. A physical property with a logical twin becomes the twin.
3. A construct whose *value* names a side — a shadow's x-offset, a mask, a gradient — is
   rebuilt so the value names none.
4. Anything that cannot be mirrored mechanically is recorded as a decision to be taken,
   not swapped on the way past.
5. `npm run check` passes and the left-to-right rendering is unchanged.

**Extensions**

- **1a — the sweep is the list already in a note.** That is the failure
  [[Layout survives translated text]] has now recorded four times, and its fourth instance
  is the one this PBI exists downstream of: an inventory that was *right when written* and
  was overtaken by the roadmap and the timeline arriving in the file underneath it. So the
  categories are what carry over between rounds, and the members are re-derived each time.
  Its step 0 applies unchanged — verify the search finds what you think it finds.
- **1b — the sweep is scoped to CSS and the note claims direction is done.** It is not:
  an icon name and an arrow key are direction cues the stylesheet cannot reach.
  [[Layout survives translated text]] owns both, and this PBI says so rather than reading
  as the whole of direction.
- **2a — `margin-left: auto` reads as a spacer rather than a side.** It is a spacer *and*
  a side: it pushes to the physical right, so a count that sits at the end of a column
  header sits at the wrong end when the header runs the other way. The idiom being
  familiar is what keeps it out of an audit looking for direction.
- **3a — the selection accent becomes a border.** A border changes the box, and every
  column width in the tree is summed against bounds `columnFit` holds in TypeScript
  ([[One bound, not two]]). Whatever replaces the inset shadow has to occupy no space —
  which is a real design question, not a substitution.
- **3b — the mask keeps its side and gains a right-to-left override.** A second rule
  selected on direction is still a direction-dependent value, twice; it would also pass a
  property-name check, which is the hole [[Styling rules are checks]] is written to close.
- **4a — the timeline is mirrored because everything else was.** Time is not text. Whether
  a right-to-left reader expects the earliest month on the right is a product decision, and
  the bars, the today line and the milestone lines are positioned from offsets
  `src/view/render/timeline.ts` computes and publishes as custom properties — so swapping
  the CSS alone moves the bug rather than fixing it. This PBI records the question; it does
  not answer it.
- **5a — "unchanged" is taken on trust.** The jsdom harness renders nothing, so what CI can
  confirm is that the sources still assemble and the cascade pins in
  `test/view/rendering.test.ts` still hold. That the view *looks* the same is a live-vault
  check, and it joins the sweep [[Smoke test the visual changes]] already owns rather than
  being asserted here.

## What the sweep returns

Grouped by what makes each one direction-dependent, because the group decides the fix and
the members change as the file grows. Addressed by partial and selector, never by line —
this note's sibling was re-cited for exactly that reason.

**A physical property with a logical twin.** A mechanical swap, no visual change in
left-to-right:

| Where | Construct |
| --- | --- |
| `styles/toolbar.css`, `.pbl-filter` | `margin-left` |
| `styles/board.css`, `.pbl-board-col-count` / `.pbl-bucket-count` / `.pbl-shelf-count` | `margin-left: auto` |
| `styles/timeline.css`, `.pbl-timeline-lead` | `border-right` |
| `styles/timeline.css`, `.pbl-timeline-month` | `border-left` |

**A value that names a side, with no logical twin to swap to.** Each needs a construct,
not a substitution:

| Where | Construct |
| --- | --- |
| `styles/tree.css`, `.pbl-row.pbl-selected` | the selection accent's `box-shadow` x-offset |
| `styles/tags.css`, `.pbl-tag-list` | the overflow mask's `linear-gradient(to right, …)` |
| `styles/timeline.css`, `.pbl-bar-open-start` / `.pbl-bar-open-end` and their pair | the open-end gradients, coupled to the corner radii that open the same side |
| `styles/timeline.css`, `.pbl-bar-inferred.pbl-bar-open-start` / `.pbl-bar-open-end` | `border-left` / `border-right: none`, which open the same side as the gradient above and must move with it |

**Physical positioning whose value is computed elsewhere.** The category the earlier
inventory could not have held, because it arrived with the roadmap — and the one construct
of this shape that is already ANSWERED rather than recorded is the property columns' resize
grip (2026-08-14, [[Resizable property columns]]): pinned with `inset-inline-start`, dragged
by a physical `clientX`, and mirrored by a sign read off the header cell's own computed
direction. It is here as the worked example of what this group costs, not as a fourth
group — one control's gesture is a smaller question than a grid whose every offset
TypeScript publishes:

| Where | Construct |
| --- | --- |
| `styles/timeline.css`, `.pbl-bar` / the today line / the milestone line and its label | `left: var(--pbl-…-left)`, set by `src/view/render/timeline.ts` |
| `styles/timeline.css`, `.pbl-timeline-lead` and `styles/roadmap.css`'s pinned strips | `position: sticky; left: 0` |

The third group is why this PBI stops at recording a decision. Renaming `left` to
`inset-inline-start` there changes which edge the offset counts from while TypeScript goes
on counting from the physical left, so the mechanical half of the fix is the half that
breaks it.

## Acceptance criteria

- Every construct in the first group uses its logical twin, and nothing in the
  left-to-right rendering moves — the cascade pins in `test/view/rendering.test.ts` and the
  column-fit behaviour are unchanged, which is what this repository can check.
- Every construct in the second group names no side in its value. A rule selected on
  direction does not satisfy this: it is the same construct written twice and passes a
  property-name check, which is precisely what [[Styling rules are checks]] must not rely
  on.
- The third group is **recorded, not swapped**, with the question stated: whether the
  timeline mirrors at all is a product decision, and its offsets are computed in
  TypeScript. A PBI that renamed those properties would report itself done having moved
  the defect one layer.
- The groups are re-derived by a sweep at the start of the work rather than taken from the
  tables above, and any group the sweep returns that this note does not name is added to
  it. The tables are the shape of the answer; the file is the answer.
- `npm run check` passes. Whether the view still *looks* right is a live-vault check and
  says so, rather than being claimed from a green build.

## Where it lives

The stylesheet partials `styles/toolbar.css`, `styles/board.css`, `styles/tree.css`,
`styles/tags.css`, `styles/timeline.css` and `styles/roadmap.css` carry the constructs;
`styles-assemble.mjs` is what turns them back into the shipped file. The timeline's
offsets are computed outside the stylesheet, which is the reason the third group is a
question rather than an edit.
