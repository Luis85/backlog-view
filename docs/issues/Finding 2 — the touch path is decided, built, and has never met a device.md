---
type: Issue
parent: "[[Codebase health]]"
order: 110
status: Open
area: verification
priority: P1
created: 2026-08-03
source: Review of 0.4.0, finding 2 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 2 — the touch path is decided, built, and has never met a device

## The finding

`manifest.json` sets `isDesktopOnly: false` as a considered position. Every direct manipulation the plugin offers is native drag, so on a phone the context menu is not a convenience — it is the whole interface.

## Why it matters

None of it has been run on a device and jsdom cannot answer any of it. If the menu fallback fails, the entire touch design rests on something absent.

## Where it is tracked

[[Smoke test the touch paths on a phone]], `P1`, blocked on hardware rather than on effort.

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
