---
type: PBI
parent: "[[A browser harness without Obsidian]]"
order: 70
status: Done
priority: P2
created: 2026-08-14
closed: 2026-08-14
files:
  - scripts/perf.mjs
  - test/harness/perf.ts
  - test/harness/mount.ts
  - test/harness/page.ts
  - test/harness/perfMode.test.ts
  - package.json
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Take the numbers where there is no screen

**As** whoever is changing the render path — from a session with no display, which is
most of them — **I want** one command that runs the harness's own stopwatch and prints
what it found, **so that** a performance claim costs a command rather than three
instruments improvised around a browser.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is changing what the view draws |
| **Trigger** | `npm run perf`, optionally `--against` a second built harness |
| **Preconditions** | Node, the dev dependencies, and a Chromium the script can find (`CHROME_PATH`, Playwright's, or one on the PATH). No display, no Obsidian, no vault, no browser-automation dependency |
| **Guarantee** | The numbers are `?perf`'s own, unchanged: the page times the calls and publishes what it found, and the runner only drives the page and does arithmetic across runs. Nothing asserts a time, here or anywhere — ADR 0020's four refusals all stand. |

**Main flow**

1. `scripts/perf.mjs` builds the harness, finds a Chromium, and loads
   `?notes=800&perf` with `--dump-dom` — the page's run happens inside the load event, so
   the numbers are in the DOM by the time it is serialized.
2. The page publishes the same rows the panel shows as JSON in one element
   (`PERF_DATA_ID`), so the runner parses rather than scrapes.
3. The runner prints each op's median across runs, its spread, and the sample that op
   actually drew.
4. `--against <dir>` alternates two built harnesses within one loop — A B A B — and
   prints both medians, both spreads and the delta.

**Extensions**

- **1a — no Chromium anywhere.** The script says so and names the two ways to supply one,
  rather than failing inside a browser invocation nobody can read.
- **1b — the viewport is left to the browser's default.** It was, and it is
  load-bearing: `content-visibility` skips what is off screen, so window size decides how
  much of a tree is rendered at all. `--window` states one and every table prints it,
  because a number nobody can reproduce is not a measurement.
- **3a — one run per side is compared.** That is how this register produced two retracted
  findings, so `--against` starts at three runs and prints both spreads: two medians whose
  spreads overlap have no delta worth reading, and a reader can only see that if both are
  on the page.
- **3b — one heading states the sample for every row.** It cannot. The tree draws rows,
  the four card projections draw cards, the board excludes Deliverables and the
  Deliverables board draws only those — so each row carries its own count, and
  "832 rows expanded" stopped standing over a table of seven different populations.
- **3c — the run measures a roadmap with no shelf.** It did, every time: the shelf opened
  collapsed, and a collapsed shelf renders its header and returns, so the roadmap rows
  described a projection missing the band this feature exists to draw. Fixed here by
  opening it for the run and putting back exactly the state found — a measurement mode
  that rearranges the reader's own view would be a knob with a side effect — and then made
  moot the same day by [[Drop the shelf's collapse option]], which left nothing to open.
  The instrument is honest about its sample either way; only one of the two answers needed
  code.
- **4a — the runner checks out the ref to compare against.** Refused: that would move the
  tree someone is working in. Building the other side is one command in a git worktree,
  and stays the human's.
- **4b — a question the panel does not answer.** The panel times whole calls; asking
  whether a scroll position survives a rebuild, or whether a handler forces layout, needs
  the view itself. `window.__pbl` exposes it so the probe is a paste into a console rather
  than an edit to the entry file and a rebuild — the thing thrown away afterwards should
  not have to be a commit.
- **4c — the dated axis cannot be reached by URL.** It could not: the axis is a toolbar
  menu, so neither a screenshot nor this runner could reach the timeline. `?axis=` picks it
  the way `?view=` picks the projection, with the same bargain — it writes the stored pick.

## Acceptance criteria

- `npm run perf` prints a table in an environment with no display and no Playwright.
- The runner adds no measurement of its own: every millisecond in its output came from
  `test/harness/perf.ts`.
- The published JSON carries exactly the panel's rows — checked in
  `test/harness/perfMode.test.ts`, so a column added for a human cannot change what a
  script reads.
- The run leaves the projection and the axis as it found them.
- No assertion anywhere in this work measures elapsed time, and `npm run check` gains no
  step.
- No new dependency: the browser is found, not installed, and the page is driven by
  `--dump-dom` rather than by an automation library.

## Where it lives

`scripts/perf.mjs` · `test/harness/perf.ts` · `test/harness/mount.ts` ·
`test/harness/page.ts` · `test/harness/perfMode.test.ts`
