# A codebase health report

**Date** 2026-08-18 · **Status** design approved, plan not yet written

## What this is

`npm run health` — a script that aggregates the tools this repository already runs
into one self-contained HTML page, plus the JSON that page is rendered from, so a
human can see where the technical debt is and an agent can read the same data without
re-running four tools.

## Why it is not already solved

Three of the four sources already exist and none of them answers the question:

- `fallow viz` draws an interactive map of all 354 files in 2 seconds, but it maps
  imports, not health.
- `fallow --format json` emits everything — `vital_signs`, 120 `file_scores`, 104
  `hotspots` with suggested `actions`, dupes, and ~50 check counters — but as JSON.
- `coverage/lcov-report/` shows coverage per file and nothing else.
- `docs/issues` and `docs/bugs` hold the human-written debt and are only readable
  note by note.

Nothing puts them on one page, and nothing relates them — the file that is a churn
hotspot, near its line cap, and thinly covered is three separate facts today.

## Decisions

**Audience** — the repository owner and agent sessions, on demand. No CI job, no
committed artifact, no baseline, no trend lines. A snapshot.

**Scope** — everything fallow emits, plus coverage detail, plus the `docs/` debt
register, plus the caps only this repository has (400-line `src/**/*.ts`, 450-line
`test/**/*.ts`, 400-line `styles/*.css`).

**No composite score.** `docs/requirements/A health score that can be argued with`
states the register's position: *"A score that cannot be taken apart is the single
opaque number this register keeps refusing."* That note is about scoring a user's
backlog, but the stance applies here. The report ranks work; it does not grade the
codebase. Where a row is ranked, it names the tool and the number that ranked it.

**Not part of `npm run check`.** It is a report, not a gate, and it shells `fallow` a
second time — roughly four seconds added to the gate for no gate value. Gates that are
also reports get skipped.

**Reading the coverage thresholds.** `await import('./vitest.config.mts')` — Node's
native type stripping returns the config object directly. Verified 2026-08-18:
`{statements: 98.52, branches: 94.83, functions: 99.81, lines: 99.6}`. This replaces
`loadConfigFromFile`, which was the first choice and does not work: `vite` is not
hoisted (it lives in `vitest/node_modules`), so it is not resolvable from the
repository root, and reaching into a transitive dependency's private tree is fragile.
The import needs Node ≥ 22.18; local is 24 and CI is 22.x, and `engines` permits older
22.x where it fails loudly rather than silently.

## Architecture

Two files in `scripts/`, mirroring the existing `docs-check.mjs` / `docs-markdown.mjs`
split — collection and rendering do not know about each other:

```
scripts/health-collect.mjs   four collectors → .health/report.json
scripts/health-render.mjs    .health/report.json → .health/report.html
```

`npm run health` runs them in sequence. The JSON is a boundary, not a by-product: it is
what an agent reads, and the renderer is the only module that knows HTML exists.

Naming both in `package.json` makes both fallow entry points — fallow already counts 7
entry points from `package.json` — so neither reports as an unused file.

### Collectors

| Source | How | On failure |
| --- | --- | --- |
| fallow | `execFile('npx', ['fallow', '--format', 'json', '--quiet'])` | non-zero exit → abort with the stderr |
| coverage | read `coverage/coverage-final.json`; thresholds from the config import | absent → page renders with coverage marked stale and names `npm run test:coverage` |
| caps | count lines in the three trees, compare to each tree's cap | — |
| debt | frontmatter of `docs/issues/*.md` and `docs/bugs/*.md` via `docs-markdown.mjs` | — |

Coverage absent is a reported state, not a guess and not a crash: the rest of the page
is still worth reading without it.

### Page sections

1. **Vital signs** — fallow's `vital_signs` as gauges (maintainability, average and p90
   cyclomatic, dead-code %, duplication %, unit-size risk profile, p95 fan-in), plus
   each coverage figure against its threshold with the margin.
2. **Act on this** — one ranked list. Rows come from fallow's own `hotspots[].actions`,
   from files nearest their cap, from the lowest-covered modules, and from open bugs.
   Every row names what, where, why (the number) and which tool said so. No invented
   composite — see **Ranking** below.
3. **Architecture** — the per-layer rollup nothing currently shows: files, lines,
   coverage, complexity and fan-in/fan-out for `domain`, `storage`, `view`, `commands`,
   `ui`, `i18n` and `main.ts`; boundary violations; a link out to `fallow viz`.
4. **Modules** — one sortable row per `src/` file: lines against its cap, coverage,
   maintainability index, cyclomatic, fan-in/out, hotspot score and trend.
5. **Debt** — open `docs/issues` and `docs/bugs` notes, with status, linked.
6. **All findings** — every non-zero fallow finding in full (today: 26
   `private_type_leaks`, 3 `dev_dependencies_in_production`, 1 clone group), with the
   ~45 zero counters collapsed to one "all clear" line, so it is visible that they ran.

### Ranking

Section 2 sorts by a band, and each band is assigned by a rule stated on the row —
which is what keeps it decomposable rather than a score in disguise. A row carries its
band, its rule and its number, so the reader can disagree with the rule rather than
with a total.

| Band | Assigned when |
| --- | --- |
| high | an open note in `docs/bugs`; a file within 20 lines of its cap; a hotspot whose `trend` is heating |
| medium | a hotspot whose `trend` is cooling; a module below 90% statement coverage; an open note in `docs/issues` |
| low | everything else fallow reported and did not gate on |

Within a band, rows sort by their own source's number, descending — hotspot score,
lines over the cap, coverage shortfall. Numbers from different sources are never
added together.

### Output

`.health/report.json` and `.health/report.html`, in a gitignored `.health/` directory
beside the existing `.harness/`. The page is self-contained: inline CSS, inline SVG for
the bars, about fifteen lines of vanilla JavaScript for the sortable table. No CDN, no
chart library, no build step. Following `harness.mjs`, the script prints the path
rather than opening a browser.

## The check

`test/health/healthCollect.test.ts` — a new directory, matching `test/docs/` and
`test/release/`. It drives three pure functions exported from `health-collect.mjs`
against a fixture fallow payload, never a live `fallow` run, which is slow and
machine-dependent:

- `layerOf(path)` — the seven-way mapping, including `main.ts` and the `i18n` / `ui`
  leaves
- `headroom(path, lines)` — that each of the three trees gets its own cap
- `rank(sources)` — that a hotspot action, a near-cap file and an open bug all reach one
  list with their source named

The renderer gets no test. It is markup; an HTML snapshot would fail on every wording
change and catch nothing.

## Register note

A PBI under the `Codebase health` Epic (`docs/requirements/Codebase health.md`,
order 67.5), added with the `adding-backlog-items` skill so the hierarchy and sibling
order are right. Not required by any gate — `docs-check.mjs` rule 7 covers `src/` only —
but this repository tracks its work in its own schema and this is a new capability.

## Out of scope

- Trends, baselines, history, committed snapshots.
- A CI job or a PR health delta.
- Any gate. Nothing here can fail a build.
- Redrawing what `fallow viz` and `coverage/lcov-report/` already draw; the page links
  to both.
- A single health number.

## Known risks

- **Node floor.** The config import fails on Node 22.0–22.17, which `engines` permits.
  It fails loudly. Not worth a fallback.
- **Fallow sees coverage partially.** Its own run matched 1490 of 7570 istanbul
  entries, so the report's coverage figures come from `coverage-final.json` directly
  rather than from fallow's view of it.
- **Fixture drift.** The test's fallow payload is a fixture; a fallow schema bump
  (`schema_version` is 7 today) changes the real shape without failing the test. The
  collector reads `schema_version` and says so on the page when it is not 7.
