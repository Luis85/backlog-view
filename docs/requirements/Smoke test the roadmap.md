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
  legible over the header cells, the two header tiers stay aligned, the scrolled-lead
  shadow appears once the grid scrolls, bar labels hide while a drag is live, and
  compact rows actually shorten the row. **Never checked.**
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
- The row hover/zebra tint spans the opaque lead cell and the track as one band, not
  two — checked in Chromium via `npm run harness`, in both schemes. Per ADR 0020 the
  harness is faithful about layout and not about colour, so that run settles that the
  band spans lead and track together and says nothing about what the tint looks like.
  **Layout checked 2026-08-07, in both schemes; appearance never checked.**
