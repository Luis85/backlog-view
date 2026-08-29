---
type: PBI
parent: "[[One page for what the tools already know]]"
order: 10
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

# Reading the findings without running the tools

**As** an agent session working in this repository, **I want** the findings as one
structured file, **so that** I can answer "where is the debt" by reading rather than by
running four tools and parsing four output formats.

This is why the JSON is a boundary rather than a by-product of rendering. A page an agent
has to scrape is a page whose wording is an interface.

## Use case

| | |
| --- | --- |
| **Actor** | An agent session, or any script that wants the numbers |
| **Trigger** | A question about the codebase's state, asked while `.health/report.json` already exists |
| **Preconditions** | The file is present. Nothing else — reading it runs no tool |
| **Guarantee** | The JSON is exactly what the page was rendered from, so a claim taken from it and a claim read off the page can never disagree. The renderer derives no finding of its own: where it needs to know something about a path it imports the collector's function rather than restating the rule |

**Main flow**

1. The agent reads `.health/report.json`.
2. It reads `generated` to see how old the answer is.
3. It reads `actions` for the ranked list, `layers` for the per-layer rollup, and `caps`,
   `coverage`, `debt` and `fallow` for the figures beneath them.
4. It answers the question, citing the tool named on each row.

**Extensions**

- **1a — the file does not exist.** Nothing fabricates it and nothing silently runs the
  tools. The agent runs `npm run health` itself, which is a deliberate act with a cost, or
  says the answer is unavailable. A report generated as a side effect of being asked about
  would describe a tree the asker has already changed.
- **2a — the report is older than the working tree.** `generated` is an ISO timestamp and
  nothing else claims freshness. A stale report is legitimate to read as long as its age is
  read with it, which is why the timestamp is a field rather than a rendering detail.
- **3a — fallow's output shape has changed.** `fallow.schemaVersion` is carried through
  verbatim. It is 7 today, the page says so when it is not, and a consumer that cares must
  check it — every other field's shape is fallow's to change.
- **3b — a section is empty because a tool had nothing to say.** An empty `actions` is the
  goal state, not an error. An empty `hotspots` means no git history rather than no churn.
  `coverage.present` is `false` rather than `coverage` being absent, so a consumer can tell
  "not measured" from "measured as zero" without guessing.

## Acceptance criteria

- `.health/report.json` carries `generated`, `root`, `commit`, `fallow`, `coverage`,
  `caps`, `debt`, `layers`, `graph` and `actions`.
- `graph` holds one entry per layer pair that actually imports, with a count — the real
  edges, not a restatement of `fan_in`.
- `commit` names the head the report describes and whether that tree was dirty, or holds
  nulls outside a git checkout rather than being absent.
- `coverage.present` is `false`, with a `reason` naming `npm run test:coverage`, when the
  coverage file is absent — the key is never simply missing.
- `fallow.schemaVersion` is present, and is the value fallow reported.
- Every entry in `actions` carries `band`, `title`, `where`, `why` and `source`.
- `layers` names all seven of `domain`, `storage`, `view`, `commands`, `ui`, `i18n` and
  `main`, with `main.ts` its own entry rather than folded into `view`.
- Reading the JSON runs no tool and writes no file.
- Importing `scripts/health-collect.mjs` for its pure functions does not run the
  collectors. The entry guard is what makes the test cheap; without it every test run
  would shell fallow and ESLint.

## Where it lives

- `scripts/health-collect.mjs` — writes the file, and guards its own CLI entry so the
  module can be imported safely.
- `scripts/health-render.mjs` and `scripts/health-sections.mjs` — consume it, and import
  `layerOf` from the collector rather than restating the layer map.
- `scripts/health-charts.mjs` — reads `graph`, `caps` and `coverage` from the same JSON
  and derives nothing the collector did not already write, which is what keeps a figure
  on the page and a figure in the file from disagreeing.
- `test/health/healthCollect.test.ts` — the pure functions they all depend on.
