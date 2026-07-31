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

Nothing here is a user-facing bug in shipped behaviour. Two items (`verify-base-identity-in-a-live-vault`,
`smoke-test-the-visual-changes`) are verification tasks that gate confidence in code
already merged; the rest are structure, coverage and documented limitations.

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
