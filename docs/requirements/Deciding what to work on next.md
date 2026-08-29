---
type: PBI
parent: "[[One page for what the tools already know]]"
order: 0
status: Open
priority: P3
created: 2026-08-18
source: user request
files:
  - scripts/health-collect.mjs
  - scripts/health-render.mjs
  - scripts/health-sections.mjs
  - scripts/health-charts.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Deciding what to work on next

**As** someone about to start an increment in this repository, **I want** one page that
says what is worth acting on, **so that** I choose from evidence rather than from whichever
file I happened to open.

The four tools that know already run. What none of them does is relate its findings to
another's, so the judgement — which of these matters most today — has never had a surface.

## Use case

| | |
| --- | --- |
| **Actor** | Maintainer, at a terminal, with a browser available and no Obsidian required |
| **Trigger** | `npm run health`, run deliberately before picking up work |
| **Preconditions** | Dependencies are installed. A coverage run is NOT a precondition — the report is designed to survive its absence, which is extension 2a |
| **Guarantee** | Every row names the tool that produced it and the figure that placed it in its band, and no figure from one tool is combined with a figure from another. This holds on every branch below, including those where a tool produced nothing: a row whose provenance cannot be shown is not rendered |

**Main flow**

1. The maintainer runs `npm run health`.
2. The collector runs fallow, reads the coverage file, asks ESLint for each file's counted
   line total, and reads the open notes in `docs/bugs` and `docs/issues`.
3. It writes `.health/report.json` and prints how many things there are to act on.
4. The renderer writes `.health/report.html` and prints its path.
5. The maintainer opens the page on its **Dashboard** view: a one-sentence answer, a strip
   of vital signs, then the ranked list.
6. They read down the list, ordered by band with the high band first, and within a band by
   each row's own figure.
7. They click a row, and their editor opens the named file at the named line.
8. Where a shape would answer faster than a figure, they read it off the dashboard's
   drawn views: imports between layers, complexity against coverage, and the two
   distributions.
9. Where they want the evidence rather than the verdict, they switch to the **Tables**
   view, which carries every table grouped under its own heading, narrows all of them at
   once with one filter, and groups the modules by layer on request.

**Extensions**

- **2a — no coverage run has happened.** The coverage figures are unavailable; the vital
  signs, the hotspots and every finding are not, and they must survive. Fallow is invoked
  against an empty istanbul map so it does not exit 2 on the missing file, and the coverage
  figures render DASHED — the idiom this product already uses in eight places for "present,
  but not asserted" — naming `npm run test:coverage`. Nothing renders as zero, because a
  zero here reads as a measurement.
- **2b — the `lines` figure can never be measured.** `coverage-final.json` carries
  statement, function and branch maps and no line map. Deriving lines from `statementMap`
  approximates istanbul's definition rather than reproducing the figure the threshold
  gates, so the page shows the floor and says the file cannot answer it. Permanent, not a
  gap: dashed even when coverage is present.
- **5a — a raw line count is not the count the cap enforces.** `max-lines` is configured
  with `skipBlankLines` and `skipComments`, and this repository comments heavily:
  `src/view/backlogView.ts` is 569 raw lines and lint counts 310 against a cap of 400.
  Fallow's `file_scores[].lines` is raw too. Only ESLint's own counter can answer, so that
  is what is asked — otherwise the most prominent rows on the page are false alarms about
  files the gate is happy with.
- **6a — nothing is worth acting on.** The list is replaced by one line saying so. This is
  the goal state and must read as deliberate rather than as a failure to load.
- **6b — a tool reports far more than is actionable.** A row exists only where a stated
  rule fires, never one per input. Fallow's `hotspots` array is every file it ranked and
  not every file that IS one — `hotspot_count` is 0 here across 104 entries — so
  `hotspot_top_pct_count`, fallow's own answer, bounds it. A file at half its cap is not
  near its cap. An open `Issue` is frequently a recorded decision rather than a task, as
  [[Codebase health]] says of its own. Without these three rules the list was 464 rows,
  which answers nothing.
- **7a — the reader is not in the editor the link names.** The link is a `vscode://` URL.
  The path is also written as plain text on the row, so the row stays usable where that
  scheme is not registered.
- **8a — a figure would say what a number cannot.** A drawing earns its place only where
  the SHAPE says something the rows do not. Imports between layers qualifies and is the
  only view here that can falsify a claim: `fan_in` and `fan_out` are counts and can never
  name what is at the other end of an edge, so the real graph is read from fallow's own
  `viz` output and aggregated. Complexity against coverage qualifies because neither
  number alone identifies a risky module and a table sorted by either one hides the
  pairing. Two distributions qualify. A trend line does not: the report has no history,
  and an axis with one point is a lie.
- **8b — the layer rule is already enforced, so the map can only ever confirm it.** That
  is the point rather than an objection. `eslint.config.mjs` fails the build on an upward
  import, so a violation cannot reach this page; what the drawing adds is the shape the
  rule produces and the weight of traffic between layers, and it would render an upward
  arc in the error colour the day the rule was relaxed.
- **9a — the filter matches nothing.** Every group hides itself, which would leave a
  filter box over an empty page reading as a broken load. A line names what was searched
  for instead. The same rule as 6a, one level down: an empty result says so.
- **9b — a group matches nothing but its neighbours do.** The group removes itself rather
  than leaving a heading over an empty table, and each surviving heading reports its own
  match count in place of its total, so the counts never describe rows that are hidden.
- **9c — the two views are one page, not two files.** A second file would have to travel
  with the first, which is the coupling that already broke the stylesheet — see the
  feature's landmines. The switch is a class on `body`, so exactly one view is in the
  document flow and nothing has to be kept in step.

## Acceptance criteria

- `npm run health` writes `.health/report.json` and `.health/report.html`, printing each
  path.
- Every row in the ranked list carries a band, a source name and a figure.
- The list sorts the high band before the medium band.
- With `coverage/` absent the run still succeeds, the report still carries the layer rollup
  and every fallow finding, the coverage figures are marked stale, and the page contains no
  `NaN`.
- The counted line total for `src/view/backlogView.ts` is ESLint's count, not the file's
  569 lines.
- With no rows to show, the page says so in a sentence rather than rendering an empty list.
- Every custom property the page reads resolves against `test/harness/obsidian.css`, in
  both `theme-light` and `theme-dark`.
- The page opens on the Dashboard view, and the Tables view is not in the document flow
  until it is asked for.
- The Tables view carries every table under its own heading, each heading reporting its
  own count.
- Typing in the filter narrows every table at once; a heading then reports how many of its
  rows match rather than how many it has; a group with no matches removes itself; and a
  filter matching nothing anywhere says so rather than leaving an empty page.
- Clearing the filter restores every row and every original count.
- Sorting a column still works inside the Tables view.
- The dashboard draws four figures: imports between layers, complexity against coverage,
  and the coverage and line-cap distributions. Each is drawn from data already collected,
  in Obsidian tokens, and repaints with the reader's scheme.
- The layer map states how many cross-layer edges there are and whether any points
  upward; an upward edge renders in the error colour.
- Grouping the modules by layer inserts one heading per layer with that layer's count,
  and composes with the filter and the sort rather than replacing them: headings are
  rebuilt from the rows currently visible, in their current order.
- The page says how old it is, computed when it is OPENED rather than when it was
  written, and names the commit it describes and whether that tree was dirty. It makes no
  claim about whether the tree has changed since.

## Where it lives

- `scripts/health-collect.mjs` — the collectors, and the ranking rules that decide which
  findings become rows. The layer graph is gathered here rather than derived later,
  because it needs a second fallow run: `viz --viz-format dot` is the only output
  carrying real edges.
- `scripts/health-render.mjs` — the shell, the two views, and every behaviour on the
  page: the tablist, the filter, the sorting, the grouping and the age.
- `scripts/health-sections.mjs` — the blocks, and nothing about the page that holds them.
- `scripts/health-charts.mjs` — the four drawn figures. SVG only, in tokens, so a theme
  change repaints them with the page.
- `test/health/healthCollect.test.ts` — the pure functions, against fixtures sampled from
  real tool output rather than invented.
