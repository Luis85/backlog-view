---
type: Feature
parent: "[[The Product Page]]"
order: 30
status: Open
created: 2026-08-16
area: tooling
started: ""
finished: ""
horizon: ""
risk: ""
assignee: ""
start: 2026-08-16
due: 2026-09-13
---

# Publishing to GitHub Pages

A GitHub Actions workflow, separate from the plugin's own build and release workflows,
builds `site/` and publishes its output to GitHub Pages whenever the default branch
changes.

**Outcome** — The page in front of a visitor always reflects the most recent
default-branch push whose build passed. A broken build never replaces it with a
half-built page, never touches the plugin's own release process — and never blocks the
push that caused it, so a run of broken pushes leaves the page stale rather than the
repository stuck.

## Acceptance criteria

- A dedicated workflow file (not `release.yml` or the plugin's CI workflow) builds
  `site/` and deploys it to GitHub Pages, on push to the default branch and by manual
  dispatch.
- A failing build fails only that workflow run; the previously published page stays live,
  and the plugin's own CI and release workflows are unaffected.
- No new secret beyond what GitHub Pages itself provides (`GITHUB_TOKEN`) — nothing to
  rotate, nothing to leak.
