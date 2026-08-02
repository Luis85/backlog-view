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

**Outcome** — Every case below has been looked at, with the result written into its own
`Issue`'s Acceptance criteria, so a stale check is visible rather than assumed. Two cases
carry an explicit warning that they have never been run at all — see
[[Roadmap inferred bar appearance]] and [[Roadmap milestone appearance]].

## Use cases

- [[Roadmap axis picker and bucket drag]] — the picker's appear/disappear rule, bucket
  drag and drop, the shelf as the un-placing target, and the empty shelf mid-drag.
- [[Roadmap dated axis month header]] — true month lengths and header-to-bar alignment.
- [[Roadmap inferred bar appearance]] — solid vs. dashed, the done green override, and
  whether an unclosed dashed edge reads as open. **Never checked.**
- [[Roadmap milestone appearance]] — the cyan badge, the diamond, the full-height line
  and its label, two milestones on one date, today's collision, label truncation, and a
  milestone past the window edge. **Never checked.**
