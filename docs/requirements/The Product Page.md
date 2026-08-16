---
type: Epic
order: 68
status: Open
created: 2026-08-16
source: user request
area: marketing
started: ""
finished: ""
risk: ""
assignee: Sam
start: 2026-08-16
due: 2026-09-27
---

# The Product Page

A static site, built with Astro and hosted on GitHub Pages, that shows someone who has
never opened this repository what the plugin does — before they find `README.md`'s own
pitch and its `## Installation` section. It is not a feature of the plugin — nothing
under `src/` depends on it, and it ships no code the plugin loads — and it is not a
second README: it is reachable without opening the repository at all (a search result,
the GitHub Pages link on the repository's own About), and it argues with real
screenshots of the tree, the board and the roadmap where `README.md` draws one tree in
monospace.

## Why it exists

`README.md` already pitches the plugin and tells a visitor who found the repository how
to install it. What it does not give is a page reachable without finding the repository
first, or a screenshot in place of an ASCII tree — and the plugin's whole pitch is that
it turns notes into a backlog, which is a claim a screenshot argues better than a
paragraph does.

## Definition of done, for anything under this epic

- It builds from its own `site/` directory, with its own `package.json` and its own
  checks; nothing under `src/` depends on it, and nothing it needs is bundled into
  `main.js`.
- It deploys to GitHub Pages from its own GitHub Actions workflow, on a push to the
  default branch, without touching the plugin's own build or release workflow.
- `README.md` stays the one place installation is written step by step, and the
  changelog stays the one record of what shipped when; the site links to both rather
  than keeping a second copy that can drift from either. That guarantee covers only the
  duplicated material — the page's own pitch and its feature-tour screenshots describe
  the plugin independently, and nothing here keeps them in step with a rename, a
  removed feature or a redrawn screen; that is still open.
