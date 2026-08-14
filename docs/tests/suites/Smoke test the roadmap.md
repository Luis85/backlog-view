---
type: Test suite
order: 33
status: Open
created: 2026-08-02
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Smoke test the roadmap

The roadmap projection: both axes, the shelf, stated and inferred bars, and the new
milestone marks — the newest projection and the one carrying the most unverified
appearance, checked once against a real vault.

**Outcome** — **Run by the maintainer on 2026-08-02** in an `npm run test-build` vault
ahead of the `0.4.0` release, the first time any of the roadmap had been looked at:
nothing on the list needed adjusting. That is a run of the whole list and not a per-case
record — each `Test case` below still asks for its own points written down as pass or
fail, and each stays open until they are, so a stale check is visible rather than
assumed. [[Smoke test the writable timeline]] joined this suite in the 2026-08-11 test
catalog migration and was not part of that run.

## Use cases

- [[Roadmap axis picker and bucket drag]] — the picker's appear/disappear rule, bucket
  drag and drop, the shelf as the un-placing target, and the empty shelf mid-drag.
- [[Smoke test the writable timeline]] — the dated axis's own writes: schedule from the
  shelf, drag and resize a bar, auto-scroll, the sticky header and lead column, and every
  gesture jsdom computes no layout for.
- [[Roadmap dated axis month header]] — true month lengths and header-to-bar alignment.
- [[Roadmap inferred bar appearance]] — solid vs. dashed, the done green override, and
  whether an unclosed dashed edge reads as open. **Seen once, 2026-08-02; no per-point
  record yet.**
- [[Roadmap legend with two workflows]] — the second state vocabulary's own section, the
  three colour pairs four slots force on it, and the two greens. Layout and structure were
  measured in Chromium; the colour is the half no harness can answer. **Never checked.**
- The state-colour dialog ([[A colour per state]]) works and looks right: the palette
  button appears on the dated axis only, each swatch opens on the colour that state's bars
  are actually drawn in (jsdom resolves nothing, so every seed under test is the grey
  fallback), choosing one repaints the bars and the legend swatch together while the dialog
  is still open, and the reset puts it back. Two things the suite cannot reach at all:
  whether Obsidian's `ColorComponent.setValue` fires its own `onChange` — the reset sets the
  swatch before recording the clear so the answer cannot matter, but that ordering is a
  guard rather than a measurement — and whether the dialog stays usable at a workflow of
  eight or ten states. **Never checked.**
- [[Roadmap milestone appearance]] — the cyan badge, the diamond, the full-height line
  and its label, two milestones on one date, today's collision, label truncation, and a
  milestone past the window edge. **Seen once, 2026-08-02; no per-point record yet.**
- The grid furniture stays furniture under a real theme: gridlines, weekend banding
  and the row stripes read as background behind the bars, the milestone label stays
  legible over the header cells, the two header tiers stay aligned, bar labels hide
  while a drag is live, and compact rows actually shorten the row. **Never checked.**
- Everything the header names sits over the thing it names: each year over its own
  months, each month label over its own days, the milestone label over its own line,
  and the milestone diamond centred on its line. All of it is one arithmetic in TS and
  two `box-sizing: border-box` declarations in CSS, and jsdom can check neither — see
  `test/view/timelineBoxing.test.ts`, which refuses the declarations' deletion and can
  say nothing about the widths that result.
  **Layout measured in Chromium 2026-08-07 via `npm run harness`: lead 220px against the
  220 TS positions with, both tiers 1092px, `2027` and `Jan` both at 1076px, the today
  line at 488px, milestone line and label and diamond centre all 704px.** The Today
  label this measured no longer exists — [[State colour and a legend]] replaced it with
  a legend strip, **never checked in Chromium**.
- The dated axis's grid butts against the chrome above it — no blank strip between the
  toolbar or the legend and the header, where the lead column's border and the first
  gridline would otherwise simply stop. The horizon axis keeps its top gutter, so check
  both axes. **Layout measured in Chromium 2026-08-07: the scroller starts at the
  legend's own bottom edge.**
- The legend strip above the grid: one swatch per configured state, then today, then
  the milestone — legible over the header, and a bar's colour actually matches its own
  swatch. **Never checked.**
- The resources axis's absences, all four of them colour or crowding questions no check here
  can reach ([[An absence read fainter than the decoration behind it]]): whether the
  `.pbl-absence-wash` at 18% of `--text-muted` out-reads a themed vault's weekend banding, and
  whether it still reads as *shading* rather than as a second bar beneath the one it sits
  under; whether the hatch at `--text-muted` holds against a community theme's background and
  against a bar it overlaps; whether two glyphs in one lead — the dependency flag and the
  absence flag, which can both appear on one row — crowd the title at a narrow lead width; and
  whether the `Unavailable` swatch's finer hatch reads as hatch at 10px rather than as a
  half-filled square. The stylesheet checks behind these say which token each rule names and
  nothing about what it resolves to, and per ADR 0020 the harness settles layout and not
  colour. **Checked in a vault 2026-08-14 at 385 results, in light**: the hatch and the wash
  both out-read the weekend banding, which is the first question answered and the one the whole
  increment existed for. It also found the two defects in
  [[An absence read fainter than the decoration behind it]]'s own closing section — the wash
  under the bars rather than over them, and a header glyph competing with the Add absence
  button, and the `Unavailable` swatch reading as a ⊘ among five colour dots — none of which
  any check here could see. **Still unchecked**: the two glyphs in one lead at a narrow lead
  width (no row in that vault carried both), and everything in dark. The fixture is pointed at
  the first of those: `demoVault()`
  carries Dana's `Single sign-on` (2026-07-20 → 2026-08-15) running straight through her absence
  (2026-08-10 → 2026-08-14), plus Sam, whose row exists only because he is away.
- The band header's readout (`laneReadout`, added 2026-08-14) at the default lead width on
  a real roster: whether `2 items / 1 absence` crowds the resource name, and where the
  ellipsis falls — `.pbl-lane-count` refuses to shrink, so the name is what gives. **Never
  checked.**
- The long derived absence name (`absenceTitle`, added 2026-08-14) in an absence row's own
  lead, beside the dates the bar already states — whether the two together crowd each other
  at a narrow lead width. **Never checked.**
- Whether a screen reader reads the readout usefully: the header claims no role of its own
  and labels its rows by proximity alone, so what the readout adds to that announcement, if
  anything, is unverified. **Never checked.**
- The lead column's resize grip, which is where this feature keeps everything jsdom
  cannot reach: the 6px strip is findable at all (cursor and hover feedback), it shows a
  focus ring when tabbed to, a real touch drag resizes it rather than panning the
  scroller (`touch-action: none` is the only thing stopping that), and the gesture
  survives the pointer leaving the strip — pointer capture, which jsdom does not
  implement, so the suite dispatches straight at the grip and never needs it to work.
  Then the part only a screen reader can answer: what the separator actually announces
  as it moves, and whether a focusable separator inside the pane's `listbox` confuses
  the reader — the accepted deviation recorded in `src/view/CLAUDE.md`. **Never
  checked.**
- The four state-colour slots under a real theme, light and dark: each reads as distinct
  from the others and from the four colours that already mean something — the red, cyan
  and green of today, a milestone and done, and the ACCENT, which `.pbl-bar` falls back
  to for an unslotted item and the legend keys as `Other`; a done bar is unmistakably
  green whatever slot its own state occupies; and a swatch and its bars match at a
  glance rather than only by variable name. The accent is the case no check here can
  reach: `STATE_COLOR_SLOTS` reserves Obsidian's DEFAULT purple by dropping it as a
  slot, but the accent is a user setting, so a reader who has set theirs to one of the
  four slot colours reopens the collision against that slot — look with a non-default
  accent as well as the default one. The stylesheet check behind this says which
  variable each rule names and nothing about what those resolve to, and per ADR 0020
  the harness settles layout and not colour. **Never checked.**
- The row hover/zebra tint spans the opaque lead cell and the track as one band, not
  two, AND the lead stays opaque while tinted — the day track scrolls under it, so a
  translucent lead lets the grid show through the sticky column on every tinted row.
  That happened: tinting with `color-mix(hover, primary)` produced alpha 0.67, because
  `--background-modifier-hover` is itself translucent, and it took a reader scrolling to
  notice. The tint is a background-IMAGE layer over the opaque colour now, which
  `test/view/timelineBoxing.test.ts` refuses to see replaced. Per ADR 0020 the harness
  settles layout and not colour.
  **Layout checked 2026-08-07 in both schemes; opacity re-checked 2026-08-08 (lead
  rgb(255,255,255), and the column's pixels identical across a 420px scroll);
  appearance never checked.**
- Nothing shows through the sticky lead column at a row BOUNDARY, and a selected row's
  accent edges reach the column's left edge — the two symptoms of
  [[Full-height marks struck through the sticky lead column]], which needs the grid
  scrolled far enough for the today line to pass under the column before either is
  visible at all. **Fixed and re-checked 2026-08-08 in the harness at a 700px viewport,
  in dark; never checked in a vault, and never in light.**
- The row's own disclosure ([[Collapsing a bar's subtree]]): the chevron is findable at
  the size a lead column actually gives it, the leaf placeholder keeps every badge on one
  x, and a fold does not leave the grid's scroll position somewhere the reader did not
  ask for. **Never checked.**
- Then the part only a screen reader can answer, and the reason
  [[A disclosure nested in an option role]] is open: what a row with a disclosure
  actually announces. `option` has presentational children, so the nested button's role
  and `aria-expanded` may be flattened away — does the reader get "Show children" /
  "Hide children" from the row's name, is the button reachable and activatable at all,
  and does the row menu's identical entry read as the same act? **Never checked**, and
  the same question applies to the card disclosure on the board.
- The dependency arrow layer ([[Arrows between bars]]): each arrow actually reaches the
  two rows it names — jsdom draws no layout, so `renderDependencyArrows`'s Y is read off
  real row rects only in a real vault, never in the suite — the angle points the right
  way (backward when a conflict overlaps in time), the arrowhead sits at the dependent's
  end, a conflict's red reads as distinct from the today line's red and the state
  colours, and the row's own conflict mark (a left accent) is visible without hovering
  the arrow. Beside it, the shelf card's own dependency statement (1b, 2b): the
  "Waits for …" block sits legibly under the shelf reason rather than crowding it, a
  long or multi-name list wraps inside the card's own width instead of overflowing it,
  and the conflict styling on a shelved card reads as the same red the arrow layer uses.
  **Seen in the harness 2026-08-09, in both schemes, at 1360px** — the demo fixture now
  carries four `dependsOn` shapes on purpose (an ordinary arrow, a conflict, a broken
  entry, and a shelved 2b conflict), so the picture is reachable from `npm run harness`
  with the dated axis picked and the rows expanded. What that answered: both arrows draw
  and clip to the grid, the conflict arrow is red and points backward as it should, the
  row accent and the glyph both read, the glyph is red for a conflict and amber for a
  broken entry, and the shelf card states its shelf reason and its conflict as two
  separate lines. What it did NOT answer, and what a vault still owes: the colours (a
  theme replaces exactly these), whether the faint arrow survives a light theme with a
  busier palette, and how a screen reader reads the row. Two things the picture showed
  that no assertion had: a flagged row's title truncates to make room for the glyph
  (`Offline-first s… ⚠`), and an arrow crossing a long bar is drawn OVER it rather than
  behind it, unlike the milestone line. That second one was then made to match the
  milestone line, and the round trip after it is the part worth keeping: on 2026-08-09 a
  `z-index` lifted the arrows over the bars again, on a reading of "arrows on top" that
  meant on top of the date grid. One declaration cannot separate the two, since bars and
  gridlines are told apart only by document order — so the settled rule is a SANDWICH
  (above the grid furniture, beneath the bars) and it is met by having no z-index at all.
  Two wrong readings of one sentence, both caught by looking rather than by the suite.
- The dated axis's own date marks, found the same day: a milestone's diamond is centred on
  its day boundary while its full-height line was drawn FROM that boundary, so the line sat
  half its width to the right of the mark it belongs to — 1px at the default scale, plainly
  visible at 4× on a 12px diamond. Both full-height lines are centred now, which keeps the
  nudge that separates a milestone from today exactly one line width.
- [[Draw a dependency between bars]]'s gesture: the connector reveals on hover and stays
  under `(hover: none)`, illegal rows dim while the drag is held, the target under the
  pointer outlines, the preview line tracks the pointer smoothly, labels vanish and no
  card-move state is entered (`.pbl-linking`, never `.pbl-dragging`), and a completed
  or cancelled drag leaves nothing behind. Beside that, what a vault still owes, none of
  it answerable here: `wireLinkSource`'s `onGenerateDragPreview` mutates the content box
  and other rows' classes (dimming, the source mark), not only the dragged connector's
  own — which is the case pragmatic-drag-and-drop's own docs caution against, since the
  browser can snapshot the native drag preview at the end of that event, so whether
  Obsidian's actual drag ghost looks right — the connector's small circle, undistorted by
  a class change elsewhere on the page landing mid-snapshot — is unverifiable here. And
  everything about whether the affordance works at human scale: a 9px dot is actually
  hittable at 4px/day zoom on a trackpad and on a touch screen, where it is permanent
  rather than revealed; the reveal reads as an affordance rather than as noise on a grid
  of many rows; the dot does not collide with the bar label at any zoom or on a bar one
  day wide; the dimming of illegal targets survives a theme that replaces the colour
  tokens, and still reads as *refused* rather than as *disabled*; and the preview line's
  accent is distinguishable from the today line's red and from a conflict arrow's.
  The harness look was performed on 2026-08-09, later than the increment that owed it —
  it shipped claiming no browser was available, and the two defects that cost are
  recorded below rather than smoothed over, because both were the kind ADR 0020 says
  looking is *for*. What the picture showed that no assertion had: every connector
  rendered as a themed button blob (Obsidian's `button:not(.clickable-icon)` fills
  `background-color` and `box-shadow` at (0,1,1), which a bare class cannot outrank —
  the card-children disclosure's bug, a second time), and a milestone's connector sat
  14px below its diamond and overlapping it, because the dot is a child of a box rotated
  45 degrees and `left: 100%` is expressed in that rotated frame. Both were found by
  Codex review first and then MEASURED in the harness — `getBoundingClientRect` against
  the real app.css, before and after — rather than argued from specificity alone.
  What a vault still owes is everything above that a picture cannot settle: hittability
  at human scale, the theme-replaced dimming, the preview line's accent against the
  today line and a conflict arrow, and the drag-preview snapshot. **Those remain never
  checked.**
