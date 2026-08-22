---
type: Test case
order: 10
parent: "[[Smoke test the estimation indicator]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-22
source: the indicator presets and open-note increment, 2026-08-22
files:
  - src/view/estimation/renderTable.ts
  - src/view/estimation/panel.ts
  - src/domain/weightedScore.ts
  - styles/estimation.css
  - styles/estimationPanel.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the indicator column in a live vault

**Covers** [[Ranking the items by value]].

## Why this exists

The seventh column, its sort and the panel line beside it were built against jsdom and
drawn in the harness. jsdom lays nothing out, and the harness stops at Obsidian's
**default** colours (ADR 0020). Three things this increment shipped are therefore
unverified by `npm run check` passing: what the extra 80px of row does at a real pane
width, whether a blocked cell's explanation reaches anyone who is not holding a mouse,
and whether a configured name survives contact with a 72px column.

**Preconditions** — `npm run test-build` has installed the plugin into
`.obsidian/plugins/product-backlog-view/` in this repository, the repository is open as a
vault with Restricted Mode off, and `docs/Product Backlog.base` is open on the estimation
view so the table has rows in several currency treatments. The shipped default indicator
(`adjustedValue` over `effort`) is active unless the operands box has been cleared, so the
column is present without configuring anything.

## How to check

- **The narrow-pane band.** The measurement below says the row now needs about 1020px of
  view where it needed about 940px before. Narrow the pane through that band and record
  what the `Currency` column actually does — reachable by scrolling, clipped, or drawn
  over its neighbour. This is an **observation to record, not a pass/fail**: the gap is
  accepted and owned by [[Keeping columns whole under a narrow pane]]. What that PBI needs
  is whether the band is survivable in a real split, with a sidebar and a ribbon taking
  width the harness window never takes.
- **A blocked cell's explanation, without a mouse.** A cell with no figure is left empty
  and carries its reason in `title`. Tab to the table and move through the rows with a
  screen reader running: is the reason announced, or is it reachable only by hovering?
  The four reasons say different things on purpose — *not answered*, *nothing in this
  model is called X*, *has to be above zero to divide by*, and *has no property bound to
  it yet* — and a reader who cannot reach them gets an empty cell and a dash. If it is
  unreachable, the fix is an accessible name or a description on the cell, not a tooltip
  delay.
- **A long configured name in a 72px column.** Set `Name` in the Indicator options to
  something longer than `RICE` — a real team's phrasing, or a translated word — and look
  at the header. The column is 72px and the header is a sort button whose label sits
  beside a direction glyph when active. Where does it truncate, and does the glyph
  survive? Nothing in this repository has looked.
- **The unnamed fallback.** Clear `Name` and confirm the header reads the generic word
  `Indicator` rather than the formula, and that the formula is the tooltip. A
  whitespace-only name must do the same — that was a defect once, and the resolver now
  trims it.
- **Clearing the operands box.** Empty `Operands` and confirm the column disappears
  entirely — header, cells and the panel line — and that the six remaining columns lay
  out as they did before this increment. This is the escape hatch for the narrow-pane
  band, so it matters that it is complete.
- **Sorting by it.** Click the `Indicator` header and confirm rows with no figure sort to
  the end in **both** directions while the valued rows reverse between them. Then clear
  the operands box while the table is sorted by the indicator and confirm the table falls
  back to Base order rather than sorting by a column that is not drawn — and that
  repopulating the box brings the pick back.
- **The panel's two lines.** Select a row with a confidence and an effort and confirm the
  panel shows the confidence-adjusted value AND the indicator as two separate lines. Then
  select a row with **no** confidence at all: the adjusted-value line should be gone and
  the indicator line should still be there, saying what blocked it. Those are two
  independent gates, and sharing one was a defect.
- **An unbound scale.** In a Base where no confidence property is bound, confirm a blocked
  indicator says the scale **has no property bound to it yet** and names **Confidence** —
  not "Adjusted value", which nothing can be bound to. Then bind the property, leave the
  note unanswered, and confirm the same operand is now reported as *not answered*. The
  pair is the point: the two states send a reader to two different places.

## What the harness answered ahead of the walk

Taken 2026-08-22 with the committed `?measure` knob in headless Chromium
(141.0.7390.37) at `--window-size` 1200, 1060, 1040, 1020, 1000, 960 and 900. A harness
observation (ADR 0020), not the walk.

Row geometry (`row0`), left to right, in CSS pixels, at any window at or below 1060 —
the title is already at its floor there and nothing moves below it:

| title | total | coverage | confidence | effort | **indicator** | currency | row right edge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 96 | 72 | 72 | 72 | 72 | **72** | 140 | **669** |

At 1200px the title takes 170px and the right edge is 743px.

**The measured minimum is 669px**, against the **588px** the six-column build recorded
under [[Smoke test the estimation view's UX polish in a live vault]] — a delta of 81px,
which is one 72px column plus one 8px gap. [[Keeping columns whole under a narrow pane]]
states 668px by arithmetic; the measurement agrees to within the 1px the harness rounds,
and the ~1020px view threshold derived from it holds.

Screenshotted at a 1000px window: the `Currency` header and its chips are past the right
edge, with a horizontal scroller under the table and one chip clipped at the boundary —
the same *scrolled, with the end column hidden* behaviour the six-column build showed
below 940px, now beginning about 80px earlier. **This is the accepted gap, observed one
column worse**, not a new defect.

**One thing the instrument itself does not cover.** The `?measure` knob's `NUM` probe
reports a number's box for `total`, `coverage`, `confidence` and `effort` and **not** for
`indicator` — the seventh column was added to the view without being added to the probe.
So the indicator's number is the one figure in the row whose vertical alignment against
its neighbours has been measured by nothing. Either extend the probe or check the
alignment by eye during the walk, and say which was done.

## What the harness already answers, so this note does not repeat it

The column is drawn, headed and sorted; a blocked cell is empty with the stylesheet's
dash; the panel draws both derived lines independently; and Obsidian's **default**
colours are correct in both schemes. A themed vault's colours, its accent, a real pane
width and anything Bases hands the view stay unanswerable there.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| — | the indicator presets and open-note increment (2026-08-22) | **Not run.** |

## Acceptance criteria

- Every item above checked in a live vault, in both light and dark themes.
- The narrow-pane band recorded as an observation and fed to
  [[Keeping columns whole under a narrow pane]], not scored pass/fail.
- The blocked-cell accessibility item answered either way; if the reason is
  mouse-only, that is a defect to file rather than a note to leave here.

---

## Outcome

Not yet run. **This is a checklist to re-run, not a record**: appearance and base
identity cannot be tested in this repository, so it stays open until someone has walked
it, and it reopens with the next change to the column, the panel's derived lines or the
blocked-reason vocabulary.
