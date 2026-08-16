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

A static site, built with Astro and hosted on GitHub Pages, that tells someone who has
never opened this repository what the plugin does and shows it doing it. It is not a
feature of the plugin — nothing under `src/` depends on it, and it ships no code the
plugin loads — and it is not `README.md`, which is written for a contributor reading the
repository rather than a visitor deciding whether to install a plugin.

## Why it exists

Obsidian's community plugin browser gives a name, a short description and a link back
here. `README.md` gives a contributor the architecture and the build steps. Neither one
earns a "try this" from someone who has never seen the tree drag, the board move a card
or the roadmap draw a bar — the plugin's whole pitch is that it turns notes into a
backlog, and that is a claim a screenshot argues better than a paragraph does.

## Definition of done, for anything under this epic

- It builds from its own `site/` directory, with its own `package.json` and its own
  checks; nothing under `src/` depends on it, and nothing it needs is bundled into
  `main.js`.
- It deploys to GitHub Pages from its own GitHub Actions workflow, on a push to the
  default branch, without touching the plugin's own build or release workflow.
- It states what the plugin does today and how to install it, and links out to the
  changelog and the repository rather than restating them — so a shipped feature or a
  version bump can never leave the page describing a plugin that no longer exists.
