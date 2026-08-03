---
type: Issue
parent: "[[Codebase health]]"
order: 260
status: Open
area: platform
priority: P3
created: 2026-08-03
source: Review of 0.4.0, finding 17 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
---

# Finding 17 — obsidian version drift has no owner

## The finding

`manifest.json` sets `minAppVersion` 1.10.2 against the young Bases custom-view API, and the typings trail the app in places. ADR 0019 put dependencies on a clock; the host app is on none.

## Why it matters

Nothing notices when Obsidian changes something the view rests on, and the live-vault sweep only catches it if someone runs it.

## Where it is tracked

Probably no code, and that is the finding. The open question is whether the sweep gains a second conditional trigger on an Obsidian upgrade, the way [[Verify base identity in a live vault]] already has one — which would cost nothing and belongs in [[A cadence for the checks CI cannot run]].

## Acceptance criteria

None; this note records a review finding and points at the work. The criteria that can
be met live on the notes named above.
