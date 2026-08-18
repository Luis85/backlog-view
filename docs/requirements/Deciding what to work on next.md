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
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
5. The maintainer opens the page: a one-sentence answer, a strip of vital signs, then the
   ranked list.
6. They read down the list, ordered by band with the high band first, and within a band by
   each row's own figure.
7. They click a row, and their editor opens the named file at the named line.

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
- The four detail sections are closed when the page opens.

## Where it lives

- `scripts/health-collect.mjs` — the four collectors, and the ranking rules that decide
  which findings become rows.
- `scripts/health-render.mjs` — the page, and the only module that knows markup.
- `test/health/healthCollect.test.ts` — the pure functions, against fixtures sampled from
  real tool output rather than invented.
