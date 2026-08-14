---
type: Test case
order: 50
parent: "[[Smoke test the roadmap]]"
status: Done
priority: P2
area: verification
cadence: release
created: 2026-08-08
source: built in [[A Deliverable is coloured by its own workflow]]; the colour half is the part no harness can answer
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Roadmap legend with two workflows

A verification to run.

## Why this exists

[[A Deliverable is coloured by its own workflow]] gave the dated axis a second state
vocabulary and the legend a section per workflow. Everything structural about it is
tested, and the LAYOUT was measured in Chromium through `npm run harness` — which found
one real defect (the strip wrapped mid-group, leaving swatches with no heading) and
confirmed the heading reads as a heading, since weight is something the harness is
faithful about.

What no harness can answer is the **colour**, because a themed vault replaces exactly the
values `test/harness/theme.css` approximates (ADR 0020). And the colour is where this
feature's whole risk now sits: four palette slots have to carry two vocabularies at once.

## What the vault has to be told first

The register's own base cannot show this as it stands: `docs/Product Backlog.base` sets
`deliverableStateValues` to the same list as `stateValues` and names **no**
`deliverableStateProperty`, which is one workflow by the rule `statePalettes` applies —
correctly, so there is nothing to fix there. Producing a second one is a deliberate act:

1. In the view options, set **Deliverable state property** to a property the notes below
   carry (`docStatus` is the name used throughout the tests).
2. Set **Deliverable states** to a list that differs from the requirements one — e.g.
   `Concept, Draft, In review, Published` — and **Deliverable done values** to `Published`.
3. Two or three `Deliverable` notes carrying a `docStatus` and a `start`/`due` pair, so
   they draw. They belong in `docs/deliverables/`, under an `Epic`, a `Feature` or a
   `PBI` — the register admits the type and documents the folder as of this increment.
   The gate wants what it wants of any note there: `type`, `order`, `status`, a `parent`
   link, and a unique basename.

**This step used to say the opposite**, and anyone re-running the check before that
increment was told to make scratch notes outside `docs/` because `docs-check.mjs` refused
the type — true when it was written, false now, and found by review while the note itself
was being closed. Worth leaving visible rather than quietly overwriting: a `cadence:
release` note is a checklist to re-run, so its *setup* rots exactly like code and nothing
gates it. The register's paths and links are checked; its instructions are prose.

What survives of the old finding, in a narrower form: the register can now hold the notes
but still does not demonstrate this configuration, because `docs/Product Backlog.base`
names no `deliverableStateProperty` and register notes carry `status` rather than a
second workflow's key. Both halves of step 1 and 2 are still a deliberate act — the
difference is that they are now an act performed on `docs/` rather than beside it.

**Preconditions** — as above, plus a community theme installed and selectable, and the
two-workflow setup above (Deliverable state property, Deliverable states/done values, and a
few `Deliverable` notes), since this case is about the colour that only a themed vault shows.

## How to check

Switch to the roadmap's dated axis, with both workflows configured as above.

- **Two labelled sections.** The strip reads `Work` then the requirements states, then
  `Deliverables` then its own, then `Today`. The headings are heavier and less muted than
  the swatch labels — check they still read as headings under YOUR theme, which is what
  the harness cannot say.
- **Three colour pairs, and whether they are a problem.** With five requirements states
  and four Deliverable ones, the slots run 0,1,2,3 then 1,2,3 — so the second, third and
  fourth of each vocabulary share a colour with their opposite number. Measured in the
  harness: `Ready`/`Concept`, `Active`/`Draft`, `Review`/`In review`. This is the
  documented limit of a four-slot palette and not a defect, but nobody has looked at
  whether a reader is actually misled by it. **Write down which pairs you had to look
  twice at.**
- **Both done values draw the same green.** `Done` and `Published` are both the done
  override, in different sections. Decide whether that reads as "finished means green in
  either workflow" or as two entries a key cannot tell apart.
- **A bar matches its own swatch.** Pick one Deliverable and one non-Deliverable, and
  confirm each bar's colour is the one its own section keys — this is the whole feature,
  and the jsdom test can only say the class matches.
- **The narrow pane.** Drag the pane down to roughly half width until the strip wraps.
  Each heading must stay with its own swatches: the break falls between `Work` and
  `Deliverables`, never inside one. This is the defect the harness found and
  `.pbl-legend-section` fixes — confirm the fix survives a real theme's font metrics.
- **One workflow only.** Clear the Deliverable state property. The strip loses both
  headings and draws one unlabelled vocabulary, exactly as it did before this feature
  existed. Nothing should look different from the pre-`0.4.x` legend.
- **Only the Deliverable workflow.** Clear the requirements state property instead and
  keep the Deliverable one. The vocabulary draws unlabelled from slot 0, and `Other`
  appears beside it — because every non-Deliverable bar now draws the plain accent, its
  own workflow having no key. Confirmed correct in the harness; what is unchecked is
  whether `Other` beside a named vocabulary reads as an explanation or as a loose end.

## What a run has to record

Each point above, pass or fail, in this note. A run that reports "looked fine" leaves the
colour-pair question exactly as open as it is now — that one wants a sentence, not a tick.

## Runs

**2026-08-08.** Reported as passing with nothing flagged. That settles the six bullets
that are genuinely yes/no — the two labelled sections and their weight, both done values
drawing the same green, a bar matching its own swatch, the narrow pane breaking between
sections rather than inside one, and both single-workflow configurations. Those were the
feature's structural risk and they are answered under a real theme now, which is what no
harness could do.

**The colour pairs, asked separately and answered.** `Ready`/`Concept`, `Active`/`Draft`
and `Review`/`In review` each share a palette slot, and the runner reported that none of
the three made them look twice: the section headings carry enough context that a repeated
colour never reads as the wrong workflow. That is the judgement this note existed to
collect, and it had to be asked for on its own — a run reporting no defects says nothing
about it, since the pairs are expected rather than broken.

So the four-slot limit is **accepted rather than merely documented**, and a redesign of
`STATE_COLOR_SLOTS` is not owed. What would reopen it: a vocabulary long enough to wrap a
slot twice within ONE workflow, where no heading separates the repeat.

Closed.
