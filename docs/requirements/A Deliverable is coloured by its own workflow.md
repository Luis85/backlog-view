---
type: PBI
parent: "[[A Deliverables board]]"
order: 20
status: Done
priority: P2
created: 2026-08-08
source: user request
files:
  - src/domain/board.ts
  - src/domain/settings.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/render/roadmap.ts
  - src/view/render/timeline.ts
  - src/view/render/legend.ts
  - src/view/render/rows.ts
  - src/view/render/cardChildren.ts
  - styles/legend.css
  - styles/timeline.css
---

# A Deliverable is coloured by its own workflow

**As** someone reading the dated axis in a vault that tracks Deliverables separately,
**I want** a Deliverable's bar coloured by the state its own workflow holds, **so that**
the colour on the grid names a fact about the item rather than a leftover value on the
same note — and the legend tells me which vocabulary I am reading.

[[State colour and a legend]] built the whole feature over ONE vocabulary, which was the
only one that existed then. [[A board scoped to Deliverables]] introduced a second, and
the rule it states for the KEY (`stateKeyFor`) and the VALUE (`ownWorkflowReading`) —
an item's workflow follows its TYPE — had not reached the timeline. So a Deliverable's
bar took its slot from `item.stateValue`: a colour naming a state the Deliverable
workflow does not track, unchanged by moving the card on the Deliverables board, and
changed by editing a requirements state nothing on that board shows.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the roadmap's dated axis in a base that configures a Deliverable state property |
| **Preconditions** | The Deliverable settings DECLARE a workflow of their own — its own property, its own states, or its own done values. A key alone is not the test and neither is a key alone the absence of one: `resolveSettings` keeps a populated list whatever the key does, so one property can be read through two vocabularies |
| **Guarantee** | Every colour a bar draws is keyed by exactly one swatch, and every swatch keys a colour something on the grid draws — the rule [[State colour and a legend]] already states, now holding across two vocabularies rather than one |

**Main flow**

1. The roadmap's dated axis builds its palettes once (`statePalettes`) and hands the
   same list to the bars and to the legend.
2. Each bar is keyed by the palette its item's own type selects (`paletteFor`), at the
   slot that palette's own vocabulary gives its own state value (`paletteSlot`).
3. A bar whose state is done by ITS palette's own done list takes the green override,
   the same rule as before applied to the right list.
4. The legend draws one section per palette, each headed by the workflow's name and
   carrying that workflow's own swatches.

**Extensions**

- **1a — only one workflow can draw.** `statePalettes` returns that one alone, unlabelled
  and at offset 0, WHICHEVER of the two it is: there is nothing to tell it apart from, and
  no earlier vocabulary for its slots to continue from. That covers the Deliverable
  workflow falling back to `stateKey` and, found in review, the base that configures the
  Deliverable property and leaves the requirements one unset — a case the first version got
  wrong by asking "is there a second key?" instead of "which workflows can draw?". Drawing
  is the RESOLVED key: a Deliverable workflow falling back reads the requirements property,
  which is a real property. Without any key, `domain/model.ts` sets that workflow's every
  state value to null, so its vocabulary can key nothing and must not appear.
- **1c — the key falls back but the list is overridden.** TWO palettes over one property.
  `resolveSettings` keeps a populated `deliverableStates`/`deliverableDoneValues` whatever
  the key does — the lists follow the key only while they are EMPTY — so a Deliverable
  reads the shared property against its own vocabulary. Splitting on the key alone drew
  those states nowhere and coloured such a bar with the plain accent.
- **1d — nothing declared at all.** ONE palette. The question is what the settings
  DECLARE, not whether the two computed lists differ: with no list configured each
  workflow falls back to the states its own results were observed to hold, and those
  populations are disjoint by construction (`requirementsWorkflow` excludes Deliverables),
  so comparing the computed lists split one workflow in two and drew `Done` twice in one
  strip.
- **1b — neither workflow has a key.** An empty list, so `paletteFor` answers undefined and
  the bar draws its plain accent: no palette, rather than a palette of nothing that would
  key silently. The legend renders Today alone, exactly as it did before this change.
- **2a — slots CONTINUE across the palettes rather than restarting.** Restarting would
  paint a Deliverable's first state the same colour as a PBI's first state, and the whole
  point of asking the item's own workflow is that those are different facts. The four
  slots still wrap, so a long enough pair repeats — the same honest limit one vocabulary
  longer than the palette already had.
- **3a — a done value neither list declares.** The fallback green swatch is unchanged:
  keyed on `drawn.done`, the render's own report, and named by the first done value any
  drawn palette declares. One swatch for both workflows — green means finished on either,
  and the grid draws one green.

## Acceptance criteria

- A Deliverable's bar carries the slot class its own workflow's vocabulary gives its own
  state value, and a non-Deliverable's carries the requirements workflow's.
  **Checked by** `test/view/legend.test.ts` — "keys a Deliverable’s bar by its OWN state, in its own palette’s slot"
- A Deliverable finished by `deliverableDoneValues` takes the green done override even
  where its requirements state is unfinished, and vice versa.
  **Checked by** `test/view/legend.test.ts` — "takes the green done override from the Deliverable workflow’s own done list"
- The hidden words a timeline row carries name the same state the colour keys — the
  Deliverable workflow's value for a Deliverable.
  **Checked by** `test/view/legend.test.ts` — "says a Deliverable’s own state in words, not the requirements one"
- With both workflows configured the legend heads each section with its workflow's name
  and draws both vocabularies in slot order.
  **Checked by** `test/view/legend.test.ts` — "names each workflow and keys both vocabularies, in slot order"
- With one workflow configured it draws no heading at all.
  **Checked by** `test/view/legend.test.ts` — "names nothing where one workflow tracks everything"
- A base configuring ONLY the Deliverable property draws that vocabulary unlabelled and
  from slot 0.
  **Checked by** `test/view/legend.test.ts` — "leaves a LONE Deliverable workflow unlabelled and at slot 0"
- A base configuring neither gets no palette at all.
  **Checked by** `test/domain/statePalettes.test.ts` — "is NO palette where neither workflow has a key"
- The split is on the RAW `deliverableStateKey`, so a falling-back workflow stays one
  palette rather than keying one vocabulary twice.
  **Checked by** `test/domain/statePalettes.test.ts` — "splits on the RAW deliverable key, so a falling-back workflow is still one workflow"
- Slots continue across palettes and wrap modulo the slot count.
  **Checked by** `test/domain/statePalettes.test.ts` — "wraps the OFFSET too, so a second workflow keeps running through the palette"
- Done-ness is asked of the palette's own list, never `settings.doneValues`.
  **Checked by** `test/domain/statePalettes.test.ts` — "asks the palette’s OWN done list, not the requirements one"
- A falling-back key with an overridden value list is two palettes.
  **Checked by** `test/domain/statePalettes.test.ts` — "is TWO palettes where the key falls back but the value list is overridden"
- A base declaring nothing is one palette, whatever the two observed lists happen to hold.
  **Checked by** `test/domain/statePalettes.test.ts` — "is ONE palette where nothing is declared and both lists are merely observed"
- Every surface that draws an item as FINISHED asks its own workflow — the tree row, the
  card's child list, and every card on every projection, buckets and shelf included.
  **Checked by** `test/view/deliverablesBoard.test.ts` — "styles a TREE row by the item’s own workflow too, both directions"
  **Checked by** `test/view/cardChildren.test.ts` — "styles a done child by ITS OWN workflow, not the requirements one"
  **Checked by** `test/view/roadmap.test.ts` — "styles a bucket card and a shelf card by the Deliverable workflow, both directions"

## Where it lives

`StatePalette`, `statePalettes`, `paletteFor`, `paletteSlot` and `paletteDone` are
`src/domain/board.ts`, beside `requirementsWorkflow` and `deliverablesWorkflow` — the two
workflows they are built from — and beside `stateKeyFor` and `ownWorkflowReading`, whose
"an item's workflow follows its TYPE" rule they apply to colour. `paletteSlot` REPLACES
`stateColorSlot`, which lived in `src/domain/settings.ts` and could only ever answer for
one vocabulary; `STATE_COLOR_SLOTS` stays there, since the count of reserved colours is a
fact about the palette rather than about a workflow.

`ownWorkflowReading` is asked wherever something is drawn as finished: `renderRow`
(`src/view/render/rows.ts`) for the tree row's `pbl-done`, `renderChildEntry`
(`src/view/render/cardChildren.ts`) for a listed child's, and **inside `createCard`**
(`src/view/render/board.ts`) for every card, on every projection that draws one.

That last one took two passes, and the first is worth recording because this note claimed
otherwise. `createCard` had a `done` PARAMETER, defaulting to `item.done`, with a per-board
override — so the Deliverables board and the timeline passed the right workflow while the
horizon buckets, the shelf and the context strip took the default and styled a Deliverable
by a workflow that does not track it. Fixing the two reported call sites and writing "fixed
at every surface" here was the same defect one level up: a category invariant satisfied at
the places someone thought of. The parameter and its override are gone — the question is
asked once, in the one function every card goes through, so a projection added later cannot
answer it differently by omission.

`renderBarRow` in `src/view/render/timeline.ts` reads the item's own workflow ONCE and
threads it through all four things on the row that key a colour or say one in words: the
`pbl-done` class the green override hangs on, the slot class, `stateNote`'s hidden words,
and the `DrawnColors` report the legend is built from. Three of them agreeing and the
fourth not is the shape every past bug in this feature had.

`renderRoadmap` (`src/view/render/roadmap.ts`) builds the palettes and carries them out on
`RoadmapSnapshot.palettes` (`src/view/host.ts`), which is where `src/view/backlogView.ts`
reads them for `renderLegend` — the same reason `drawn` is carried rather than recomputed:
the legend exists only to explain the colours on the grid, so it keys the very list the
grid used. `renderLegend` (`src/view/render/legend.ts`) gates nothing itself: `statePalettes` already
returns only the workflows that can key something, so the legend renders what it is handed
— the same question asked once. `renderStateSwatches` beside it is the part that grows with
the number of workflows, split out when two of them took the whole strip's complexity
budget. `.pbl-legend-group` in
`styles/legend.css` is the section heading; `styles/timeline.css`'s slot rules are
unchanged, since what a slot paints was never the question.

## Evidence

Reported by the user while reviewing the Deliverables increment: the timeline's colours
did not follow the Deliverables board's own states. Confirmed in the code — `renderBarRow`
called `stateColorSlot(settings, model.observedStates, item.stateValue)`, none of whose
three arguments knows a second workflow exists.

The appearance of the two-section legend — the heading's weight against the strip's muted
colour, and whether a second vocabulary crowds a narrow pane — is a live-vault check this
harness cannot make (ADR 0020). See [[Smoke test the roadmap]].
