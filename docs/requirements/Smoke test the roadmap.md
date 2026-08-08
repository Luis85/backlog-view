---
type: Feature
parent: "[[Feature Test]]"
order: 30
status: Open
created: 2026-08-02
source: user request
---

# Smoke test the roadmap

The roadmap projection: both axes, the shelf, stated and inferred bars, and the new
milestone marks — the newest projection and the one carrying the most unverified
appearance, checked once against a real vault.

**Outcome** — **Run by the maintainer on 2026-08-02** in an `npm run test-build` vault
ahead of the `0.4.0` release, the first time any of the roadmap had been looked at:
nothing on the list needed adjusting. That is a run of the whole list and not a per-case
record — each `Issue` below still asks for its own points written down as pass or fail,
and each stays open until they are, so a stale check is visible rather than assumed.

## Use cases

- [[Roadmap axis picker and bucket drag]] — the picker's appear/disappear rule, bucket
  drag and drop, the shelf as the un-placing target, and the empty shelf mid-drag.
- [[Roadmap dated axis month header]] — true month lengths and header-to-bar alignment.
- [[Roadmap inferred bar appearance]] — solid vs. dashed, the done green override, and
  whether an unclosed dashed edge reads as open. **Seen once, 2026-08-02; no per-point
  record yet.**
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
