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
  rather than failing inside a browser invocation nobody can read. It said it on WINDOWS
  too, with a browser installed by either route: Playwright's builds there are `chrome-win`
  and `.exe`, under a cache root neither of the two the search knew, and a PATH lookup for
  `chromium` needs the extension — and macOS caches under `~/Library/Caches/ms-playwright`,
  whose LEAF was in the list from the start while its ROOT was not, which is how a list like
  this hides a gap: the entry looks covered because its other half is there. All of it is in
  the lists now and none of it is verified — this container is the only platform the search
  has been run on, and CI does not run this script.
- **1b — the viewport is left to the browser's default.** It was, and it is
  load-bearing: `content-visibility` skips what is off screen, so window size decides how
  much of a tree is rendered at all. `--window` states one and every table prints it,
  because a number nobody can reproduce is not a measurement. It is also CHECKED, for the
  same reason: Chromium's switch is `w,h` and it ignores what it cannot parse, so
  `--window=1200x900` — the spelling a person is most likely to type — measured the default
  800x600 under a heading printing 1200x900. The one number this feature's own subject
  depends on, reported as something it was not. What reaches the browser is then the PARSED
  pair rather than the string typed: `1e3,900` and `1200.0,900` are whole numbers to
  JavaScript and unparseable to Chromium, so normalizing is what makes the heading and the
  viewport the same fact for every spelling that gets through. (Codex, PR #137.)
- **3a — one run per side is compared.** That is how this register produced two retracted
  findings, so `--against` starts at three runs and prints both spreads: two medians whose
  spreads overlap have no delta worth reading, and a reader can only see that if both are
  on the page. Its `median` averaged nothing and took the upper middle of an even sample
  until review caught it — `--runs=4` is this file's own documented form, so every number
  the change that introduced this tool had published was biased on both sides.
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
- **3d — the two builds draw different populations.** Then the delta is between unlike
  workloads and reads exactly like a speedup: a baseline from before a change that hides or
  adds cards measures fewer of them. Both sides' counts are printed and a mismatch is called
  out by name under the table. Loud rather than refused — "did this change cost anything" is
  a legitimate question to ask of two such builds, and only the person running it knows which
  question this run is. (Codex, PR #137, on a comparison this branch really did make.)
- **3e — one build times an op the other does not**, because a row was added or renamed
  between them. The baseline's median came out `NaN` and its delta `NaN%` with nothing
  said, and an op only the BASELINE had was dropped from the table altogether — so a
  comparison missing half its rows read as a complete one. Both directions are named under
  the table now, and a column with nothing to compare against prints an em dash rather than
  a number no reading of which is right.
- **3f — a workload selector the page did not honour.** `--fixture=edegs` mounts the demo,
  `--axis=date` picks no axis, `--view=bard` opens the tree: the page absorbs each silently,
  and a heading built from the query string then labelled the table with a workload nobody
  ran. The runner prints what the page says it MOUNTED — the page publishes it beside the
  numbers — and names any flag the two disagree on. The vocabularies stay where they are
  enforced rather than being copied into the runner to go stale, which is the same rule the
  register applies to any table that enumerates code. The BASELINE's resolved workload is
  read the same way and compared: two builds can absorb one flag differently — the newer
  knows an axis the older ignores — and then equal `drew` counts prove nothing, since they
  can be equal across two different projections. A baseline too old to report it at all is
  named as that rather than assumed to agree. (Codex, PR #137.)

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
