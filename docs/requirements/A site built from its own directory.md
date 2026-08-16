---
type: Feature
parent: "[[The Product Page]]"
order: 20
status: Open
created: 2026-08-16
area: tooling
started: ""
finished: ""
horizon: ""
risk: ""
assignee: ""
start: ""
due: ""
---

# A site built from its own directory

The site is an ordinary Astro project under `site/` — its own `package.json`, its own
lockfile — reachable by nothing under `src/` and reaching nothing under it either.
`npm run check` never touches it, and a broken `site/` build never blocks a plugin
release.

**Outcome** — The plugin's own build, lint, tests and coverage gates are exactly as fast
and exactly as strict as they are today; the site is built and checked by its own
commands, from its own directory.

## Acceptance criteria

- `site/` carries its own `package.json` and lockfile, independent of the plugin's and
  its pinned TypeScript/`@types/node` ranges.
- The plugin's `npm run build`, `npm run lint`, `npm test` and `npm run docs` never read
  or fail on anything under `site/`.
- The site's own build produces static output only — no code from `site/` is imported by
  `src/`, and nothing from `src/` is imported by `site/`.
- Screenshots are checked-in images, not a live-rendered demo — the site never imports or
  mounts the real view.
