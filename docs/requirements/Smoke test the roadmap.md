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
  and the row stripes read as background behind the bars, and the Today and milestone
  labels stay legible over the header cells. **Never checked.**
