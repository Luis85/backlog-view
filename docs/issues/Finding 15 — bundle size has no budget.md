---
type: Issue
parent: "[[Codebase health]]"
order: 119.6875
status: Done
area: tooling
priority: P3
created: 2026-08-03
source: Review of 0.4.0, finding 15 — docs/superpowers/plans/2026-08-03-codebase-quality-review.md
files:
  - scripts/esbuild.config.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Finding 15 — bundle size has no budget

## The finding

`npm run build` produces `main.js` and a minified `styles.css` with nothing asserting either stays within a size. The stylesheet gained a 400-line-per-partial gate; the bundle has no equivalent.

## Why it matters

The same shape as the CSS gate and about as small. What it needs first is a number, and setting one just above the current size is the honest default.

## What was done

Closed on 2026-08-29, riding along with the gate-hardening pass this note predicted it
would. `scripts/esbuild.config.mjs` measures both shipped files after the PRODUCTION
build alone and fails it over a ceiling — `main.js` at 480 KB against the 436.1 KB it
currently produces, and `dist/styles.css` at 96 KB against 70.7 KB.

Three things about the shape, each a decision rather than a default:

- **The production build alone.** The dev bundle carries an inline sourcemap and the
  root `styles.css` is the unminified assembly a dev vault reads, so measuring either
  would be measuring a file nobody downloads.
- **A ceiling with room, not a measurement.** The note above already said so, and the
  reason is the opposite of the coverage floors' — a floor pinned to a measurement fails
  on a legitimate change, and so does a ceiling. An ordinary increment must not have to
  edit this file.
- **Raised only as a decision.** The failure message says as much. A ceiling nudged up
  by whoever is unblocking CI is the same defect the coverage note describes from the
  other direction.

What it catches that nothing else can: a dependency reaching the bundle by accident.
Lint, the type checker and `npm audit` all see a legitimately imported package; only a
size says it costs 200 KB.

## Acceptance criteria

- ~~A number, set just above the current size.~~ Done — 480 KB and 96 KB.
- ~~The build fails over it.~~ Done — a non-zero exit from the production build, so
  `npm run check` and CI's own `npm run build` step both carry it.
