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
| caps | ESLint's own `max-lines` counter — see below | — |
| debt | frontmatter of `docs/issues/*.md` and `docs/bugs/*.md` via `docs-markdown.mjs` | — |

Coverage absent is a reported state, not a guess and not a crash: the rest of the page
is still worth reading without it.

**A raw line count is the wrong instrument for the caps, and using one would put a
false alarm on the hero.** `max-lines` is configured with `skipBlankLines` and
`skipComments`, and this repository comments heavily: `src/view/backlogView.ts` is 569
raw lines and lint counts **310** of them against the 400 cap. Fallow's
`file_scores[].lines` is a raw count too (570 for the same file), so it cannot answer
this either. The only instrument that sees what the gate sees is ESLint itself, so the
collector runs ESLint's Node API over the three trees with one throwaway config —
`max-lines` set to `max: 0`, so every file reports, and the count is read out of the
message — and never the project config, which is type-aware and slow. Measured
2026-08-18: 399 ms for two files with `@typescript-eslint/parser` and no type
information. Because it is lint's own counter, the number on the page cannot drift from
the number the gate enforces.

### Page sections

1. **Vital signs** — fallow's `vital_signs` as one thin strip of figures, not gauges
   (maintainability, average and p90 cyclomatic, dead-code %, duplication %, p95
   fan-in), plus each coverage figure against its threshold with the margin. The
   unit-size risk profile is the one bar on the page — four proportions are a shape,
   not a number — drawn as inline SVG. A figure inside its limit is grey; see
   **Visual design**.
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
beside the existing `.harness/`. The page carries its own layout CSS inline, plus about
fifteen lines of vanilla JavaScript for the sortable table, and links one stylesheet —
see **Visual design** below. No CDN, no chart library, no build step. Following
`harness.mjs`, the script prints the path rather than opening a browser.

## Visual design

Mode is **Operate**: one person, or an agent, deciding what to work on next.
Scanability and a straight answer outrank expression.

**The world is borrowed, like everything else here.** The page carries
`test/harness/obsidian.css` — Obsidian's real `app.css`, already vendored for the
harness — which supplies the whole token set and `color-scheme` for both schemes. So
the report reads in the product's own visual language and owns no palette, exactly as
`DESIGN.md`'s Borrowed Palette Rule requires of everything else.

**Inlined, not linked, and that was decided the hard way.** This section said the
opposite until the page met a real browser: a `<link>` to a sibling `file://`
stylesheet is refused with *"'file:' URLs are treated as unique security origins"*, and
the page renders with no tokens at all. Three headless checks had already cleared it —
Edge with `--allow-file-access-from-files`, Edge without it, and `--headless=new` —
so **headless cannot see this class of defect at any flag**, and the verification for
this page is *open it*, not *probe it*. Inlining also makes the page one file with no
subresources whatsoever, which is what "self-contained" was supposed to mean.

**But nothing may lean on that stylesheet for layout.** It is *reduced* to the rules
the harness exercises, so an element the plugin's markup never uses has whatever
survived reduction, which may be nothing. A card-children disclosure shipped looking
right in the harness and wrong in a vault on 2026-08-08 for exactly this reason. Every
box, every table and every disclosure on this page writes its own layout; only colour,
type scale, spacing steps and radii come from the tokens.

**And inlining brings the application shell along with the colours**, which is the
other half of that rule and was missed. Obsidian's `body` does not scroll, cannot be
selected, and is `contain: strict` — correct for a window, wrong for a document. Four
declarations are taken back in the page's own `body` rule. `contain: strict` is the one
no symptom names: size containment makes the body's height independent of its contents,
so the page collapsed to 64px holding 25 rows and reported itself as *not scrollable*
rather than as clipped. `app.css` undoes the same four in its own `@media print` block,
which is what confirms the set. Exactly eleven of its rules can match a page carrying
no Obsidian classes — ten on `body`, one on `a`.

### Health is the absence of colour

`DESIGN.md`: *"A screen with no problems on it is monochrome apart from its badges."*
That is the whole design, and it inverts the usual dashboard on purpose. **There are no
green gauges** — green means *done* in this system and is explicitly never "good",
"success" or emphasis. A clean codebase renders grey, and every spot of colour on the
page is a thing to act on.

The three bands of the ranking take existing state hues; no hue is invented:

| Band | Token | Why that one |
| --- | --- | --- |
| high | `--text-error` | a file over its line cap is over an agreed limit — the same meaning as a column over its WIP limit, on a different subject |
| medium | `--color-orange-rgb` | `DESIGN.md` defines orange as "look at this", not "this failed" — a cooling hotspot exactly |
| low | `--text-muted` | reported, not urgent |

The eight ladder hues are **not used**. They are work-item identity, and a module is
not a work item.

**One amendment to record rather than slip in:** `DESIGN.md` says Over-Limit Red has
"exactly two jobs". This makes three. The concept is unchanged — a stated limit,
exceeded — but the sentence in `DESIGN.md` is now false and should be widened when this
ships.

Two further idioms are inherited whole. **Dashed means present but not asserted**, in
eight places already — so absent coverage renders the coverage figures dashed rather
than hidden or zeroed. **One signal per state** — a high-band row is red *or* heavier,
never both.

### Layout

Single column. The header states the answer as one literal sentence — "3 things to act
on, 154 modules clean" — then vital signs as a thin strip of inline figures, then the
ranked list as the hero, visible without scrolling.

Sections 4, 5 and 6 are native `<details>`, closed by default. 157 module rows, 104
hotspots and 26 type leaks must not compete with the three rows that matter, and a
platform disclosure costs no JavaScript. The fifteen lines of script sort the modules
table and do nothing else.

`font-variant-numeric: tabular-nums` on every column of figures. Each row's `file:line`
is a `vscode://file/<abs>:<line>` link, which turns the list from a report into a
worklist; it hardcodes an editor, which is acceptable in a gitignored local artifact and
is one attribute to change.

### States that must read well

- **Nothing to act on.** The goal state, and it must look deliberate rather than broken.
- **Coverage absent** — figures dashed, `npm run test:coverage` named.
- **No git history** — `hotspots` is empty; the section says so rather than rendering a
  void.
- **`schema_version` ≠ 7** — the page says fallow's shape changed and the report may be
  reading it wrong.

### Anti-goals

- **No mobile design.** `PRODUCT.md` records desktop-first with mobile unverified, and
  this is a laptop tool. It must not break at a narrow width; it gets no layout work
  there.
- **No sparklines, no trend axes.** There is no history, and an axis with one point is
  a lie.
- No print stylesheet. No independent palette. No green for good.

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
