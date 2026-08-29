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
priority: ""
iteration: ""
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

**Re-derived 2026-08-22 over the whole of `styles/`, with comments blanked before the
match.** Blanking is not housekeeping: a comment explaining why an offset stayed physical
legitimately names `margin-left`, and the run before it counted three of those as
violations. The instrument is one line scan per category, and it was checked against the
category it must return NOTHING for — `--direction`, `.mod-rtl`, `:dir()` and `[dir=]`
are absent from every partial, which is the same answer 2026-08-18 reached by hand.

**The first group is clear, and one member of it was a shape no reading of this note could
have named.** `margin`/`padding` on a named physical side and `text-align: left|right` are
now zero across the file except for one declaration the third group licenses, below — 13
declarations swapped, out of the **17** the sweep returned rather than the 16 the
2026-08-18 count predicted. The seventeenth is why the count was short:
`.pbl-card-kid`'s indent (`styles/cardChildren.css`) was written as a **four-value
`padding` shorthand**. A property-name sweep cannot see it: the string `padding-left` never
appears, and the side is the fourth position of a value list. Three-value shorthands are
matched by the same scan and are NOT members — `top / inline / bottom` is symmetric on the
inline axis and names no side. Logical declarations went from 23 `inline-start` and 10
`inline-end` to 59 logical constructs in all.

**Four of the seventeen were swapped and then put back, and that is the finding worth
keeping from this round.** Codex review on PR #196 caught `.pbl-bar-label-after`: its 18px
is a CLEARANCE for the dependency connector, and both the label (`left: var(--pbl-label-left)`,
computed in `barLabel.ts`) and the connector (`left: 100%`) stay physical — so a logical
clearance mirrors away from the very thing it clears and puts the dot back on the first
letter of the title, which is the bug the comment beside it records from the browser
harness. The same shape held for `.pbl-timeline-lead`'s divider (physical because the
column is `sticky; left: 0`), `.pbl-timeline-cell`'s (it must line up with `.pbl-grid-line`)
and `.pbl-grid-line`'s own (the border IS the line, on a zero-width box at a computed
physical `left`). The inconsistency was inside one diff: the two `border-*: none` on the bar
ends were held back on exactly this argument while these four were swapped past it. **The
rule the round produced: a declaration that clears, divides or draws against a physically
placed thing stays physical, because the pair has to move whole.** Its converse is what
keeps the two flag margins logical — `.pbl-timeline-dependency-flag` and `.pbl-away-flag`
sit in the lead's TEXT flow and go to whichever end it ends at, while the grip they clear is
pinned; where the text runs the other way they are no longer near it, so there is nothing
left to clear.

| Where | Construct | Became |
| --- | --- | --- |
| `styles/board.css`, `.pbl-board-col-count` / `.pbl-bucket-count` / `.pbl-shelf-count`, and the collapsed header's reset | `margin-left` | `margin-inline-start` |
| `styles/roadmap.css`, `.pbl-bucket-collapsed .pbl-bucket-count` | `margin-left: 0` | `margin-inline-start: 0` |
| `styles/dependencyArrows.css`, `.pbl-timeline-dependency-flag` | `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `styles/lanes.css`, `.pbl-away-flag` and `.pbl-days-lost` | `margin-left` / `margin-right` | the same pair |
| `styles/busy.css`, `.pbl-busy-done` | `text-align: right` | `text-align: end` |
| `styles/cardChildren.css`, `button.pbl-card-kid` | `text-align: left`, and the four-value `padding` | `text-align: start`, `padding-block` + `padding-inline` |


**Two rows of these tables were stale when they were checked on 2026-08-18**, which is the
hazard a table of selectors carries and the reason to re-derive rather than read: `.pbl-filter`
went with the quick filter in 0.9.1, and `.pbl-timeline-month` was replaced by the tiered
header (`.pbl-timeline-super` / `.pbl-timeline-tiers`).

**A value that names a side, with no logical twin to swap to.** Each needs a construct,
not a substitution. This group GREW on re-derivation, and the growth is the finding: the
selection accent is an idiom used at **three** selectors, not the one row this table
carried, so whatever replaces it replaces three:

| Where | Construct |
| --- | --- |
| `styles/tree.css`, `.pbl-row.pbl-selected` · `styles/estimation.css`, `.pbl-est-row.pbl-selected` · `styles/dependencyArrows.css`, `.pbl-timeline-row.pbl-row-conflict .pbl-timeline-lead` | the accent's `box-shadow: inset 2px 0 0` x-offset, one decision at three sites |
| `styles/tags.css`, `.pbl-tag-list` | the overflow mask's `linear-gradient(to right, …)` |
| `styles/estimation.css`, the value/coverage progress strip | `linear-gradient(to right, …)` filled to `--pbl-progress`, so it fills from the wrong end when the row does |
| `styles/timeline.css`, `.pbl-bar-open-start` / `.pbl-bar-open-end` and their pair | the open-end gradients, coupled to the corner radii that open the same side |
| `styles/timeline.css`, `.pbl-bar-inferred.pbl-bar-open-start` / `.pbl-bar-open-end` | `border-left` / `border-right: none`, which open the same side as the gradient above and must move with it — **the only physical box declarations left in the file**, held back deliberately rather than missed |

CSS has no logical keyword for a gradient's direction, so every gradient row above is a
construct to be designed and not a rename — and a second rule selected on direction is
refused by this note's own acceptance criteria. `transform: translateX(-50%)` is matched by
a naive sweep at three sites and is NOT a member: a −50% self-offset centres, so it is
symmetric and mirrors to itself. Recorded so the next sweep does not re-open it.

**Physical positioning whose value is computed elsewhere.** The category the earlier
inventory could not have held, because it arrived with the roadmap — and the one construct
of this shape that is already ANSWERED rather than recorded is the property columns' resize
grip (2026-08-14, [[Resizable property columns]]): pinned with `inset-inline-start`, dragged
by a physical `clientX`, and mirrored by a sign read off the header cell's own computed
direction. It is here as the worked example of what this group costs, not as a fourth
group — one control's gesture is a smaller question than a grid whose every offset
TypeScript publishes. **25** bare `left:`/`right:` placements remain, one more than the 24
counted on 2026-08-18:

| Where | Construct |
| --- | --- |
| `styles/timeline.css`, `.pbl-bar` / the today line / the milestone line and its label | `left: var(--pbl-…-left)`, set by `src/view/render/timeline.ts` |
| `styles/timelineFurniture.css`, `.pbl-grid-line` and the weekend banding | `left: var(--pbl-grid-left)` and a `linear-gradient(to right, …)` measured from the same physical origin |
| `styles/timeline.css`, `.pbl-timeline-lead` and `styles/roadmap.css`'s pinned strips | `position: sticky; left: 0` |
| `styles/timelineLeadResize.css`, `.pbl-timeline-lead-grip` | `right: -3px`, the pointer target the swapped `margin-inline-end` above clears |
| `styles/timelineFurniture.css`, `.pbl-bar-label-after` | `padding-left: 18px`, the connector's clearance — **the one physical margin or padding left in the plugin**, and the reason the check below is a rule and not a clean sweep |
| `styles/timeline.css`, `.pbl-timeline-lead` and `.pbl-timeline-cell`; `styles/timelineFurniture.css`, `.pbl-grid-line` | `border-right` / `border-left`, each drawn on an edge of a box the two rows above place physically |

The third group is why this PBI stops at recording a decision. Renaming `left` to
`inset-inline-start` there changes which edge the offset counts from while TypeScript goes
on counting from the physical left, so the mechanical half of the fix is the half that
breaks it. Everything the first group swapped inside the timeline grid is safe for the same
reason in reverse: in left-to-right the two spellings resolve identically, so a logical
border beside a physical offset moves nothing today and leaves the coupling to be decided
whole.

## Acceptance criteria

- **Met 2026-08-22.** Every construct in the first group uses its logical twin, and nothing
  in the left-to-right rendering moves — the cascade pins in `test/view/rendering.test.ts`
  and the column-fit behaviour are unchanged, which is what this repository can check.
  `test/view/direction.test.ts` is what keeps it met: it asserts the categories at the
  forbidden thing rather than by listing the rules that used to carry one, over the
  assembled sheet with comments blanked. **The one licensed physical padding is licensed by
  a RULE, not by a name on a list** — a physical margin or padding is legal only in a block
  that pins a physical side itself, which is exactly the coupling above and cannot go stale
  when a partial is added. A second test asserts the licence's own premise, so
  `.pbl-bar-label-after` going logical on one line and not the other fails rather than
  passing quietly. **The licence reaches the box properties and NOT text alignment**, and
  that had to be corrected in review on PR #196: one helper applied it to both categories,
  so `left: 0; text-align: left` passed a test whose own comment said no exemption was
  coherent — a comment stating a rule the code beside it did not check, which is the failure
  [[A comment that states a rule is not a check]] records. No placement can make
  `text-align: left` right, because alignment follows the text and not the box.
  **A second round on the same file found the shorthand scan reading only the FIRST
  `margin`/`padding` in a block**, so `margin: 0; padding: 1px 2px 3px 4px;` passed on the
  symmetric margin while the four-value padding went unread — and that is the exact order
  `.pbl-card-kid` writes them in, which means the one rule this whole category exists for
  was a `margin: 0` away from being invisible to its own check. A third round found the
  VALUE count collapsing `\([^)]*\)`, which stops at the first `)` — so
  `padding: calc(var(--gap) + 1px) 2px 3px 4px` counted six tokens and a four-sided
  declaration went unreported; it counts balanced parentheses now. All three rounds are the
  same instrument failure this note's extension 1a already warns about, one layer down: a
  scan that reads one member of a set, or one spelling of a thing, and reports on all of
  them. A fourth found the mirror of the second: the licence withheld from the four-value
  shorthand, so `left: 0; padding: 1px 2px 3px 4px` was reported although the test's own
  name licensed it — the same licence applied where it should not be, and then withheld
  where it should. Both helpers take a PREDICATE now, so the licence has one definition and
  every spelling of a box property reaches it by name. A fifth read the licence's own
  premise off the PROPERTY rather than the value, so `left: auto` — which declines to
  anchor that side — licensed a physical padding beside it; the value decides now, and the
  CSS-wide keywords are refused with `auto`.
  **Five more rounds followed, and every one was a SPELLING the patterns did not know**: a
  rule's final declaration dropping its optional semicolon, `!important` counted as a fifth
  value, CSS's case-insensitivity (`Margin-Left`, `text-align: RIGHT`), whitespace before a
  colon, and a `var()` fallback's tokens. All five latent — no rule in `styles/` writes any
  of those shapes today — and all five therefore invisible to the sweep as well as to the
  check. The case fix is the one worth reading: it normalises the TEXT once rather than
  putting a flag on each pattern, because a flag holds for the patterns carrying it and not
  for the next predicate somebody adds, which is this series in one sentence.
  **Ten rounds on one check is the finding**, and the count is measured rather than
  remembered — eleven review threads on PR #196, one against the stylesheet and ten against
  this test. What they say together is that the check is a hand-rolled CSS parser, and each
  round has been a spelling it did not know. The two honest upgrades are a real parser over
  the assembled sheet, or the computed-value check below; an eleventh patch is neither, and
  is what this paragraph exists to refuse.
  **One half of the tenth round is refused outright and stays refused**: a shorthand whose
  sides arrive by SUBSTITUTION is unreachable from the text. `padding: var(--x) var(--y)`
  is four-sided iff `--x` holds two lengths, and what a custom property holds is not in the
  file — Obsidian declares the `--size-*` scale, a theme redeclares it, `setCssProps`
  writes others at runtime. Rejecting every unresolved `var()` shorthand instead was
  measured before it was refused: it flags all 44 in the stylesheet, each a legitimate
  symmetric padding, which is the exemption list [[Styling rules are checks]] exists to
  avoid. The limit is written into the test's header and a planted case asserts the floor,
  so it stays a STATED limit rather than a silent one.
  **The eleventh round is the first REFUSED on the rule above, and it is the worked
  example of why the rule exists.** An inset does nothing on a `position: static` element,
  so `left: 0` there licenses a physical padding that nothing pins — true, and unreachable:
  `position` is not in the licensed block. `.pbl-bar-label` carries `position: absolute`
  and `.pbl-bar-label-after` carries the licensed `padding-left`, so requiring the two in
  ONE block revokes the licence from the single rule the licence exists for. Whether an
  inset takes effect is a question about the CASCADE over an element, and this instrument
  reads text a rule at a time. Same shape as the substitution refusal above it, and the
  same answer: it belongs to the computed-value check, not to a twelfth pattern.
  **The warning applies to the CHECK and not only to the sweep**, which is the
  sentence this note did not have, and each round is one the check itself could not have
  told anybody about — every one passed green.
  Deliberately narrower than this PBI: `border-left`/`border-right` and
  every bare `left:`/`right:` are outside it, since a rule over those would open with the
  exemption list [[Styling rules are checks]] exists to avoid. Watched failing in both
  directions — a planted margin in an unpinned block, and the licence's offset turned
  logical — before it was watched passing.
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

The first group's swap also reached `styles/busy.css`, `styles/cardChildren.css`,
`styles/dependencyArrows.css` and `styles/lanes.css`, which is what a partial-per-concern
file costs a sweep and the reason the members are re-derived rather than read.
`test/view/direction.test.ts` holds what it emptied and the rule licensing what it did not.

**Still owed, and this PBI stays Open for it:** the second group is untouched — the
selection accent at three selectors, the tag mask, the estimation progress strip and the
timeline bars' open ends with their coupled radii. CSS has no logical gradient direction,
so each is a construct to design; the accent is the one whose replacement has to occupy no
space, which extension 3a already states as a design question rather than a substitution.
That nothing MOVED in the left-to-right rendering is a live-vault check this repository
cannot run: it joins the sweep [[Smoke test the visual changes]] owns.
