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

**Outcome** — The page in front of a visitor only ever moves forward: every deploy either
advances it to a more recent default-branch push whose build passed, or leaves it exactly
where it was. A broken build never replaces it with a half-built page, never touches the
plugin's own release process, and never blocks the push that caused it — so a run of
broken pushes leaves the page stale rather than the repository stuck, and two builds
finishing out of order can never step the page backward.

## Acceptance criteria

- A dedicated workflow file (not `release.yml` or the plugin's CI workflow) builds
  `site/` and deploys it to GitHub Pages, on push to the default branch, on manual
  dispatch, or on a rerun of either.
- The guard against rolling the page back is one check every run makes before
  publishing, regardless of how it started: the commit it is about to publish must be
  *newer than the commit currently live* — a later point in the default branch's history
  — never older and never the same. It is deliberately not a check against the branch's
  instantaneous tip, because a slower build for an earlier push can still finish after a
  later push has already landed; comparing against what is actually live is what lets
  that earlier push publish on its own merit instead of being suppressed by a push that
  arrived after it.
- A failing build fails only that workflow run; the previously published page stays live,
  and the plugin's own CI and release workflows are unaffected.
- No new secret beyond what GitHub Pages itself provides (`GITHUB_TOKEN`) — nothing to
  rotate, nothing to leak.
