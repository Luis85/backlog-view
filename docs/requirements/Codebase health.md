---
type: Epic
order: 20
status: Open
area: meta
created: 2026-07-31
---

# Codebase health

Open work on the plugin's own maintainability, correctness and verification, split
into distinct notes in this folder. Everything here came out of the review rounds on
[PR #14](https://github.com/Luis85/backlog-view/pull/14) and is deliberately *not*
included in it — each item is either too large to ride along, or needs a real Obsidian
vault to close.

Nothing here is a user-facing bug in shipped behaviour: the register is structure,
coverage, verification and documented limitations.

**As of 2026-08-01 every actionable finding is closed.** The test suite is split and
budgeted, the drag-and-drop coverage gap is closed, the invariants that could become
checks have, levels no longer derive from depth, both refactor seams are cut, the model's
build phases are types rather than prose, and undo — the one finding that was a missing
*feature* rather than debt — is in. Both live-vault verifications passed on their first
run, retiring two things this repository believed but had not seen; `npm run test-build`
is what made them cheap enough to do.

What remains is three notes with no acceptance criteria — recorded decisions and
limitations waiting on evidence rather than on effort. This epic is done; the next one
should be opened by new evidence, not by grooming this one.

**Second round, opened 2026-08-03 by the evidence the paragraph above asked for.** The
sentence before it stays as written: on the day it was written every actionable finding
*was* closed, and hedging it now would make this round unreadable as a second one rather
than as the first quietly reopening. What reopened the epic is a review of `0.4.0` from a
clean install — `docs/superpowers/plans/2026-08-03-codebase-quality-review.md` — against a
gate that passes all five steps, coverage at 97.77/93.44/99.08/99.12 and fallow
maintainability at 88.5. Nothing it found is a shipped defect either.

What it found is the same shape the first round did, one level further out: **properties
that are true today, stated in prose, with nothing that would notice them becoming
false.** The first round turned the rules that could be lint rules into lint rules. This
one asks the same question of what lint cannot reach — the stylesheet, the render path's
own cost claims, the guides that describe the code, and the behaviour only a device can
answer for. One of them was not merely unchecked but already false, which is the argument
for the whole round: `src/view/interactions/dragDrop.ts` scans the entire tree on every
drag end, under a guide that says no interaction scans the DOM.

## Reading this as a backlog

These notes carry the plugin's own frontmatter vocabulary, so the plugin can display
its own backlog. Point a Base at this folder:

```yaml
filters:
  and:
    - file.inFolder("docs/issues")
    - file.ext == "md"
views:
  - type: product-backlog
    name: Backlog
    order:
      - note.priority
      - note.area
```

`README.md` has no `type` and no `parent`, so the default **Ignore notes outside the
hierarchy** option keeps it out of the tree.
