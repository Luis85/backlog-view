# Absences readable on the roadmap — design

**Date** 2026-08-14 · **Feature** [[Resource absences]] on the resources axis of the roadmap

## The report

On the roadmap's resources axis, absences are hard to see. Confirmed from a light-mode
screenshot at 382 results: the hatched stretches for "dooo", "Away" and "gjk" are fainter
than the weekend shading behind them.

Three distinct causes, and only the first is a colour problem.

1. **Contrast.** `.pbl-absence` (`styles/lanes.css`) draws its hatch and its border from
   `--background-modifier-border` — the same token `.pbl-grid-line` uses and the same
   palette `.pbl-weekend-layer` draws from. The mark is built out of the entry that means
   "quiet decoration", so it cannot out-read the decoration it sits on. It is also 12px
   where a bar is 14px.
2. **No key.** The legend draws Open / Active / Done / Today / Milestone
   (`src/view/render/legend.ts`, keyed off `DrawnColors`). Nothing keys the hatch, so a
   reader who has not used the feature cannot learn what it is.
3. **The placement.** `laneEntries` gives each absence its own line at the top of the
   band, so an absence and the bar it crosses are never on the same line. The feature's
   own user story is "a row I am about to drop work into already shows the days nobody
   should be scheduled across", and the current drawing makes exactly that collision the
   hardest thing to see.

Two smaller findings, both folded in:

- A band header's count is result bars only, so a resource whose only content is an
  absence renders "0" beside a row that plainly has something in it.
- Nothing marks a bar that crosses an absence.

## What was decided, and what was refused

The fork was a stronger mark, a full-height wash across the band's work rows, or both.
**Both**, in the per-row shape below.

A **band-height** wash was refused on cost, not taste: a band has no container element —
every row of this grid is a sibling positioned against one shared day grid — so a band's
top and height are knowable only by measuring after the render, which is the layout read
`src/view/CLAUDE.md` forbids and the reason `TimelineDrawing.laneElement` reports per
element rather than wiring a band. A **per-work-row** wash needs no measurement at all:
each row already has a track and `barGeometry` already answers where the stretch falls
in it.

**Dropping the absence's own line** in favour of the wash alone was refused too: that
line is the surface carrying the title, the dates and the Edit/Delete menu, so a
resource whose only content is an absence (extension 4b — `Sam` in `demoVault()`) would
get a row with nothing in it to act on.

**Extension 4a is not changed.** "Both draw, stacked; the row's own height grows rather
than either one moving to avoid the other" stays true — nothing moves to avoid anything,
and the named line still stacks. The wash is an addition beside it, recorded as a new
extension rather than a revision of that one.

Not re-derived, because the register settles them: an absence is never a `BacklogItem`;
it draws in one row and nowhere else; both dates are required; a bar behaves identically
on both grid axes, so an inferred bar is a drag source on neither; the resources axis
shares `gestureAt`, `previewer`, `submitGesture`, `edgeClasses`, `timelineRows` and
`renderChevron` with the dated axis rather than restating them.

## 1. The mark

`.pbl-absence` in `styles/lanes.css` draws its hatch stripes and its border from
`--text-muted` rather than `--background-modifier-border`, and its height goes 12px →
14px, matching `.pbl-bar`.

The rule to state at the declaration, because that is where someone about to undo it will
be standing: **an absence is content, so its mark is drawn from a TEXT token, never from a
`--background-modifier-*` one.** That second palette is what `.pbl-grid-line` and
`.pbl-weekend-layer` are made of, so a mark built from it can never out-read the
decoration behind it — which is this defect stated as a property rather than as a symptom.

What still tells work from the absence of work is hatch-not-fill, `.pbl-bar-inferred`'s own
argument, and that survives at equal height. The 12px was saying "lesser" as well as
"different", and only one of those was intended.

`.pbl-absence-row .pbl-absence` loses its half of the `opacity: 0.8` rule
(`styles/lanes.css`) — it was dimming by a fifth the very mark this change strengthens.
The `.pbl-absence-row .pbl-timeline-lead > *` half stays, so the row's icon and title
remain muted like a context row's, and `timelineBoxing.test.ts`'s "never dims a row that
carries the sticky lead column" keeps the non-vacuous assertion it names that selector for.

## 2. The key

`DrawnColors` (`src/view/host.ts`) gains `absence: boolean`, set in `drawEntries`'
absence branch (`src/view/render/timeline.ts`), and `renderLegend` adds an
`Unavailable` swatch on it, after the Today and Milestone swatches.

Reported from the RENDER rather than derived from `model`, which is the legend's own
recorded rule and not a preference here: a collapsed band draws no absence
(`laneEntries` skips the whole band), so a predicate over `roadmap.lanes` would key a
mark nothing on screen makes — the same mistake the done and milestone swatches each made
once.

It is not a colour override the way the other three fields are, and its doc comment says
so: what `DrawnColors` reports is *which marks this pass drew that the key has to
explain*, and an absence is one.

`.pbl-legend-absence` in `styles/legend.css` carries the hatch at a finer period — 2px on
4px against the mark's 4px on 8px — because one 4px stripe inside a 10px square reads as
half-filled rather than as hatch. It names the same colour token the mark does, and that
pairing is asserted: the swatch and the mark must name one token, which is the check the
three existing swatch/mark pairs already have in a palette-colour form this one cannot use
(the hatch names no `--color-*` entry).

The strip stays `aria-hidden` with no tab stop, which stays correct for the reason the
legend's preamble gives: every fact a swatch stands for is reachable without it. For this
swatch that is the absence row's own `aria-label` (`<title> — unavailable <dates>`).

## 3. The wash

One `.pbl-absence-wash` div per absence, inside each **work row's own day track** in the
band, `top: 0; bottom: 0`, `left`/`width` from `barGeometry` against the same window the
mark is positioned against — so the shading and the stretch cannot disagree about which
day is which.

Where it is drawn from: `drawEntries` already holds the current `lane` for the band it is
walking, and `mounts.tracks` already holds each bar row's track by path. The wash is
prepended into that track by a `renderAbsenceWash` in `src/view/render/lanes.ts`, beside
`renderLaneAbsence` — the module that owns what a band's lines are.

Prepended by the DOM's own `track.prepend(el)`, **never by `createDiv({ prepend: true })`**.
Obsidian's `DomElementInfo` does carry that option and `test/helpers/dom.ts` does not
implement it, so the option would append in the suite and prepend in a vault — the two
would disagree about which element paints on top, and the test asserting the wash sits
under the bar would fail in jsdom while the vault was right. Exactly the faithful-fake
hazard `test/CLAUDE.md` records for `createSvg`, reached from the kinder direction. The
native call has no fake surface at all.

**`pointer-events: none`, and that is load-bearing rather than housekeeping.** Each
element of a band is itself the drop target on this axis (`TimelineDrawing.laneElement`),
so a child of a row intercepting events is exactly the shape of
`docs/bugs/An absence stretch is a dead spot in its own band.md`, reached from the other
side.

**No `z-index` anywhere.** It goes beneath the bar by being prepended into the track —
document order, which is `styles/dependencyArrows.css`'s own sandwich argument. Lifting
the bar over it with a `z-index` instead is the trap that file records: the track is
`position: relative` with `z-index: auto` and so establishes no stacking context, so a
`z-index` on `.pbl-bar` would compete with the sticky lead column at 2.

Where it is NOT drawn, each for its own reason:

- **The absence's own row** — it draws the mark itself.
- **The band's header** — it is chrome, and its empty track is what carries the band
  across the day area; shading days there would make the header a positional statement.
- **A context row in the band** — by recorded decision it makes no positional claim at
  all (`deriveBars` routes it away before any span is computed), and shading days inside
  it would be the one positional statement on the row that makes none.
- **The dated axis** — `lane` is null there, the same single field every other difference
  between the two grid axes is read from.

The tint is `color-mix(in srgb, var(--text-muted) 18%, transparent)`: distinct from the
weekend layer's `--background-modifier-hover` and stronger than it, translucent so the
gridlines and the weekend banding compose through it the way the zebra tint already does.
**The 18% is the one value no check in this repository can settle** — jsdom paints
nothing and the harness draws Obsidian's default colours only. It is the tuning knob;
the live-vault check below is what sets it.

## 4. The clash mark

`crossedAbsences(span, absences)` in `src/domain/absences.ts` — pure, and the one place
this question is answered.

Overlap is judged on **the days the bar draws**: `start ?? target` … `target ?? start`,
which is `barGeometry`'s own borrowing. So a one-ended bar is judged at the single day it
actually renders rather than treated as unbounded in the direction it has no date for —
which matters because a backlog stating targets and no starts is the ordinary case, not an
edge one (`styles/timeline.css` says so at `.pbl-bar-inferred.pbl-bar-open-start`).
Inclusive at the boundary: a bar ending on the absence's first day crosses it.

Computed from DATES, never from geometry, so a clash lying outside the drawn window still
marks its row. That is `dependencyArrows`' rule read again — the row is where the fact
lives, and a window-derived mark would silently narrow it to wherever the reader happens
to be scrolled.

On the row, the dependency-conflict SHAPE reused rather than reinvented:

- a `user-x` glyph in the lead, beside the dependency flag and pinned the same way, so a
  column of them is scannable and neither costs the title its width;
- a `.pbl-sr-only` sentence naming each crossed absence and its dates.

The sentence is what makes the wash pass WCAG 1.4.1 — without it the collision is told in
colour alone, and told to a screen reader not at all. The glyph carries the same words as
its own tooltip (on the glyph, not on the lead, which already tooltips the title), so a
pointer reader gets what the span gives a screen reader.

**No row-level class.** The dependency case has `.pbl-row-conflict` because a broken entry
draws nothing else at all; here the wash is already the visible signal on that very row.
Add one when someone can say what a second accent buys.

## 5. The header's "0"

The count stays result bars only — the recorded rule, shared with the bucket axis, and
`resourceAbsences.test.ts`'s "counts for nothing on the header" keeps asserting exactly
what it asserts today.

What changes is that the header stops looking empty: a `user-x` glyph after the count when
the band has any absence, tooltip "1 absence" or "N absences".

`aria-hidden`, and that is honest rather than a gap: the absence's own row below already
carries `<title> — unavailable <dates>` as its accessible name and the same
`Assigned to <name>` description every line of the band gets, so the glyph is a second
route for a sighted reader rather than the only route to the fact.

## The checks, and what each reaches

Stylesheet text checks, in `test/view/timelineBoxing.test.ts` beside the three that
already state this pattern — or in a file of their own if the `test/**` 450-line budget
bites. Each states its own reach: it sees a declaration in a rule, it cannot see a later
rule overriding it, and it cannot tell you what anything looks like.

- `.pbl-absence` names no `--background-modifier-*` token, **and does name a colour
  token** — the second half is the instrument's own check, since a pattern matching
  nothing would satisfy the first for any stylesheet at all.
- `.pbl-absence-wash` declares `pointer-events: none`.
- `.pbl-legend-absence` and `.pbl-absence` name the same colour token.
- `.pbl-absence`'s height equals `.pbl-bar`'s, refusing the mark shrinking back below the
  work it sits beside.

View tests (`test/view/resourceAbsences.test.ts`, the file that owns this subject):

- the wash draws in each work row of the band, positioned by the same day arithmetic the
  mark is, and not on the absence row, not on a context row, not on the dated axis;
- `Unavailable` is keyed exactly when an absence drew — and **not** when the band is
  collapsed, which is the drawn-versus-model distinction stated as a test rather than as
  a comment;
- the clash glyph and sentence appear on the crossing row only, including for a bar whose
  clash lies outside the drawn window;
- the header glyph appears when the band has absences and not otherwise, with the count
  unchanged.

Node test (`test/domain/absences.test.ts`): `crossedAbsences` — inclusive at the boundary
day, a one-ended bar judged at the day it draws, disjoint spans clear, an empty absence
list clear.

`npm run check` must pass, all five steps. Coverage thresholds only rise, and the figure
recorded is what the FINISHED increment measures — never one taken mid-flight (the
comment above them in `vitest.config.mts`).

## The register

- One `Bug` note under `[[Resource absences]]`, `order: 40` after the three siblings,
  since every piece here traces to the one report. Its "What happened / Why / The fix"
  shape is the one the three siblings use.
- `## Where it lives` on `docs/requirements/Resource absences.md`: the mark's token rule,
  the wash and where it is drawn from, the clash predicate, and the new extension beside
  4a. Its `files:` list gains what the increment touches.
- `## Where it lives` on `docs/requirements/Showing a resources axis on the roadmap.md`:
  the legend is that PBI's file, and the swatch is a fourth thing the render reports.
- `CHANGELOG.md` `[Unreleased]`.
- New rows in `docs/tests/suites/Smoke test the roadmap.md` for the live-vault checks
  below.

## What a live vault still owes

jsdom paints nothing, and the harness draws Obsidian's DEFAULT colours only — a themed
vault replaces exactly the tokens this change turns on. So none of the following is
answered here, and none of it is answered by `npm run harness` either except where said:

- whether 18% of `--text-muted` actually out-reads a themed vault's weekend shading, and
  whether it still reads as shading rather than as a second bar under the one it sits
  beneath;
- whether the hatch at `--text-muted` holds against a community theme's background and
  against a bar it overlaps — the check
  `docs/requirements/Resource absences.md` already owed, now with a different token in it;
- whether two glyphs in one lead crowd the title at a narrow lead width;
- whether the `Unavailable` swatch's finer hatch reads as hatch at 10px.

The harness answers the first three at default colours, and the fixture is already
pointed at the case: `demoVault()` carries Dana's `Single sign-on` (2026-07-20 →
2026-08-15) running straight through her absence (2026-08-10 → 2026-08-14), plus Sam,
whose row exists only because he is away.
