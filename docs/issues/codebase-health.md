---
type: Epic
status: Open
order: 10
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
