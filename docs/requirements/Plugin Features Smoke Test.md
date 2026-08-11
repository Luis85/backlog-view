---
type: Epic
order: 66.875
status: Done
created: 2026-08-02
closed: 2026-08-11
source: user request
horizon: Later
area: quality
---

# Plugin Features Smoke Test

**Closed by the test catalog (2026-08-11).** Its three children — [[Smoke test the tree]],
[[Smoke test the board]] and [[Smoke test the roadmap]] — are `Test suite` notes now, roots
of the catalog rather than a branch of the plan. That is [[Tests stay out of the plan]]
applied to the one Epic that was holding tests, and it is why this note is closed rather
than re-parented: an Epic whose whole purpose was to group smoke tests has no purpose once
they group themselves.

**A smoke test this repository can actually run.** Obsidian does not run in CI and jsdom
asserts classes rather than pixels, so a whole class of defect — appearance, base
identity, what a drag feels like — is invisible to `npm run check` and visible in about
ninety seconds in a vault. This epic is the checklist for those ninety seconds, kept as
notes rather than as a document because `docs/` is a backlog in this plugin's own schema:
running the smoke test and reading the checklist are the same act.

**Outcome** — Anyone can run `npm run test-build`, open this repository as a vault, open
`docs/Product Backlog.base`, and walk one list per projection until every case has been
looked at. Closed items stay: this is a checklist to re-run, not history.

## How to run it

```bash
npm run test-build   # bundles into .obsidian/plugins/<id>/ in the repository root
```

Then open this repository as a vault and open `docs/Product Backlog.base`. The plugin is
displaying its own register, which is what makes every case below a real one rather than
a fixture somebody wrote to pass.

## Use cases

- [[Smoke test the tree]] — rows, columns, drag, keyboard, the menu.
- [[Smoke test the board]] — columns, cards, state writes.
- [[Smoke test the roadmap]] — both axes, the shelf, bars, diamonds and lines.
