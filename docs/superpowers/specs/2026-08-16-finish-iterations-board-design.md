# Finish the Iterations board — increment design

**Date** 2026-08-16 · **Approved by** the user, section by section, in the brainstorm that
produced this file. Two harness mock screenshots (bar mode, line mode) drove the last
three decisions; the mock entry stays uncommitted per `CLAUDE.md`.

## Scope

The increment closes the [[An Iterations board]] feature whole:

1. Build [[An iteration draws as a bar or a line]] — the one unbuilt PBI.
2. Verify [[An iteration's timeframe schedules its items]] against its acceptance
   criteria (it reads as fully built: `computeIterationWrites`, the `touchedKeys` row,
   the create path, `test/domain/iterationDates.test.ts`) and close it.
3. Close the feature, with the register edits that follow (`docs/README.md`'s trees
   paragraph still calls iterations design-only).

A `CHANGELOG.md` `[Unreleased]` entry rides the same pull request. Alternatives
considered and refused: labels-only (leaves the feature open), and pulling in
[[Milestones in one row on the dated axis]] (a roadmap-epic note; blurs two epics'
bookkeeping).

## Baseline correction, first

`inPlan` (`src/domain/model.ts`) has excluded `Iteration` from every projection since
PR #154 (commit `b08097e`), with a sweep test asserting it. The PBI's section "The type
is declared before this lands, and three labels are wrong meanwhile" predates that
exclusion and is stale: nothing draws an iteration today, so the three mislabeled
surfaces are not wrong *today* — they become wrong the moment this increment lifts the
exclusion. Consequences:

- The PBI note gets a dated correction to that section as part of this work.
- The label fixes land in the same change as the lift, not as a standalone defect fix.
- The sweep test changes shape: an `Iteration` draws in the roadmap's marker row — and,
  unplaceable, on the grid axes' shelf, which extension 3b requires — and nowhere else:
  the tree, the boards, the resource rows, and the whole horizons axis (buckets and its
  shelf alike) still never draw one.

**The marker row is one row on both grid axes** (dated and resources — `markerLane` is
shared), and an iteration draws in it wherever it draws, one code path. The PBI's
precondition names "the dated axis"; this design reads that as "a grid axis", because a
special case excluding iterations from the resources axis's marker row would be a second
rule over one row. Flagged here so the review can veto it.

## The three labels, content-aware

Decided: name what is drawn, never a fixed word.

- **Lane caption** — "Milestones", "Iterations", or "Milestones · Iterations", derived at
  render from the marker row's own bars. The lane's `name` stays the constant
  `'Milestones'`: it is identity (fold key, roster refusal), downstream code asks the
  `markers` boolean, and the caption becomes presentation. Truncation at the default lead
  width ("Milestones · It…") is **accepted** — the lead is resizable by its grip.
- **Legend** — a `drawn.iteration` flag beside `drawn.milestone`; one cyan swatch (both
  markers ship cyan) captioned by the same three-way derivation: "Milestone",
  "Iteration", or "Milestone · Iteration". In bar mode a sprint bar is a plain accent
  bar, so the cyan swatch keeps naming only what is cyan.
- **`spanText`** — announces the item's own type name, never the literal `Milestone`.
  Asserted on the string a screen reader receives.

## The predicate and the option

As the PBI specifies, unchanged by the mock:

- `drawsAsPoint` joins `src/domain/itemTypes.ts` beside `isMarkerType`, which keeps its
  structural meaning and every caller. `Milestone` is always a point; `Iteration` is a
  point exactly while `iterationBars` is off.
- `iterationBars` is a view option in the `Iterations` group, resolved in
  `src/domain/settings.ts`, saved on the view, default off — a line claims one date, a
  bar claims two, and an unasked vault gets the weaker claim.
- `placementEnds` narrows by the predicate. Both `src/domain/bars.ts` call sites ask it:
  `placeItem` (point or span) and `barHolds`, whose `isMarkerType` body-hold branch is
  the easy-to-miss third question — without that change the bar draws and nothing can
  resize it. The `optionalKeyFor` intersection is untouched: the type decides drawable,
  the configuration decides writable, a grip needs both.
- Drawing asks it in `src/view/render/timeline.ts` and
  `src/view/render/milestoneLines.ts` (bar mode: ordinary bar, no boundary line, no
  header label). Writers ask the same predicate through the settings they already
  receive (`timelineDrag.ts`, `plan.ts`), so a drag can never write an end the option
  refuses. Changing the option rewrites nothing on any note.

## What the mock decided

- **A bar-mode iteration draws anonymous** — no in-bar title, no beside-label. The
  beside-label collides with the next sprint's bar (two bars share the one track, which
  bar rows never do), and the in-bar title truncates at Months zoom. The name lives in
  the tooltip and the screen-reader sentence, exactly as a diamond's does.
- **Overlapping sprint bars overdraw** in the shared row. Recorded as a limitation —
  same family as [[Nearby milestone labels cover each other]] — not built around.
  Same-day marks already stack by `--pbl-sublane`; nothing new stacks partial overlaps.
- **Line mode multiplies the header-label pileup** near clustered dates. That issue's
  impact grows; its fix stays its own.

## Testing

- `test/domain/bars.test.ts` — placement and holds in both modes: point default, span
  with the option on, reversed-span shelving, open-ended single-date bar, no-target
  shelving in line mode, grips per configured key.
- `test/view/roadmap.test.ts` — drawing per mode, the content-aware caption and legend,
  the announced sentence, and "no surface calls an `Iteration` a milestone" at all three
  surfaces.
- The projection sweep from `b08097e` re-shaped: the marker row and the grid axes' shelf
  admit an iteration, everything else still refuses.
- PBI 1: criteria checked against the existing suite; new tests only where a criterion
  turns out unasserted.

## Done means

`npm run check` green (build, lint, coverage-thresholded tests, fallow, docs register);
both PBIs and the feature `Done` in the register; changelog entry present; the
live-vault look still owed and said so (harness colours are Obsidian defaults only).
