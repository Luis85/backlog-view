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
start: 2026-08-15
due: 2026-08-15
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
  viewport the same fact for every spelling that gets through. And the check is a RANGE
  rather than `Number.isInteger`, which is the same defect at the other end of the number
  line: `1e100` is a whole number to JavaScript that normalizes to the token `1e+100`, and
  `9007199254740991` is one Chromium cannot hold — both were accepted, both left the
  browser on its own default, and both were printed as the viewport measured. The bound is
  what Chromium can PARSE and not what it can allocate: at the int32 ceiling the browser
  takes the switch and then dies making the surface, which is a failed run with no table.
  That is the honest outcome, and the reason no tighter cap is invented — a size nobody can
  measure at fails loudly, while a size silently replaced by the default is the defect.
  (Codex, PR #137.)
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
- **3c — the run measures a roadmap with no shelf.** It did, every time: the shelf opens
  collapsed and a collapsed shelf renders its header and returns, so the roadmap rows
  described a projection missing the band this feature exists to draw. The run opens it and
  puts back exactly the state it found — a measurement mode that rearranged the reader's
  own view would be a knob with a side effect.
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
- **3f — a workload selector the page did not honour.** `--fixture=edegs` mounts the demo
  and `--axis=date` picks no axis: the page absorbs each silently,
  and a heading built from the query string then labelled the table with a workload nobody
  ran. The runner prints what the page says it MOUNTED — the page publishes it beside the
  numbers — and names any flag the two disagree on. The vocabularies stay where they are
  enforced rather than being copied into the runner to go stale, which is the same rule the
  register applies to any table that enumerates code. The POPULATION is the same question
  once more, and took two passes: the edge-case fixture ignores the size knob deliberately,
  so `--fixture=edges` headed the table with the 800 that was asked for — and reporting the
  generated extras instead still said "0 notes" over four curated cases it really drew. What
  is printed is the number of RESULTS the view was handed, counted off the array it was
  given. The BASELINE's resolved workload is
  read the same way and compared: two builds can absorb one flag differently — the newer
  knows an axis the older ignores — and then equal `drew` counts prove nothing, since they
  can be equal across two different projections. The POPULATION is compared with it, not
  just the fixture's name: two builds can mount different populations under one name, and
  `drew` does not cover that either, since it counts what was RENDERED and a hidden result
  or a child inside an existing card moves no count. And a COUNT is not the workload either:
  the same number of results can be a different hierarchy, different fields or a different
  generated shape, so the page publishes a cheap fingerprint of what it was handed and that
  is compared too — the question is "did the workload change", never "what was it". The
  CONFIGURATION is in that fingerprint beside the notes, one round later and for the same
  reason: the visible property order, the workflow states, the horizons and the scale all
  change what a card or a bucket draws while every note stays as it was. So is every note
  in the VAULT rather than only the results: the fixture's context row is excluded from what
  the Base returns and the model loads it anyway, so a change to it changed the work with
  nothing in a results-only hash to show for it.

  What the fingerprint deliberately leaves out is the RESOLVED settings — the ladder and
  every other default `domain/` supplies where the options are silent. Those are the code
  under measurement: a run comparing a build that changed a default is a run asking what
  that change cost, and answering it with "unlike workloads" would refuse the question this
  tool exists to answer. The line is INPUTS, not behaviour. A baseline too old to report any of it
  is named as that — "not reported" — rather than assumed to agree. (Codex, PR #137.)

- **3g — a flag that selects nothing the table measures.** `--view` was one: the run
  switches to the tree, times `update` and `render only` there, then times a switch to every
  projection in turn — so the projection a page opened on changed no number while heading
  the table as though it had. Removed from the runner rather than made to select, since
  `?view=` exists for LOOKING and the table already covers every projection. `--axis` stays,
  because the roadmap row really does draw whichever axis is active. (Codex, PR #137.)
- **3h — the flag is misspelled.** Refused, naming it and listing what is known. A typo
  was stored under its own key and ignored, so the run went ahead and printed a plausible
  table for a command nobody meant: `--rums=4` measured once under a heading saying
  `1 run`, and `--no-buid` REBUILT `.harness` over a build deliberately put there — the
  one thing `--no-build` exists to prevent. It is the last door this failure came through:
  every check above validates a value that already reached the right key, and none of them
  fires when the key itself is wrong. The known set is a hand-written list, which this
  register warns about — accepted because `args` is a plain object and "which keys does
  this file read" cannot be asked of it, while a Proxy recording reads would only refuse
  after the work it should have prevented. (Codex, PR #137.)
- **3i — the comparison names nothing.** Refused. `--against=` left an empty string and a
  bare `--against` left `'true'`, and every test of it is a truthiness test — so both
  turned comparison mode OFF and printed an ordinary one-build table, which is the run
  nobody asked for with nothing saying so. A merely WRONG path is not in this: it already
  fails loudly, because the page it loads publishes no perf data and the run exits 1. The
  distinction is the whole reason only two spellings are named. (Codex, PR #137.)
- **3j — the delta is computed from the printed columns.** It was, and printing is lossy:
  both medians are rounded to one decimal for the reader, so on a small workload —
  `--notes=0`, `--fixture=edges` — 0.04 against 0.06 became 0 and 0.1 and reported
  `Infinity%`, while closer pairs reported 0% over a real difference. The raw medians are
  kept beside the rounded ones and the arithmetic uses those; a real run at `--notes=0`
  now shows `3.9` against `3.9` with a `-3%` delta, which is the honest reading of two
  numbers that differ below the printed precision. A zero baseline still takes the em
  dash, since a percentage of nothing is not a quantity. **Round for the reader, never
  for the arithmetic.** (Codex, PR #137.)
- **3k — a flag is given an empty value, or a negation is given one at all.** Both refused,
  and the first as a CLASS rather than per flag. Every flag read `--flag=` as its own kind
  of silence — `Number('')` is 0, so `--notes=` passed the whole-number guard because zero
  is legitimately askable and the run measured the curated fixture alone; `--against=` and
  `--fixture=` are falsy and simply dropped out. None is a value anybody could have meant,
  so one check over every parsed key refuses them before a single flag is read; doing it
  per flag is what produced this finding twice. The second is `--no-build`, read by
  PRESENCE: `--no-build=false` — a caller explicitly asking for the build they were about
  to skip — skipped it anyway, and so did `--no-build=flase`, silently measuring a stale
  `.harness`. **Presence stops being a boolean the moment `--k=v` is legal syntax**, so
  both build flags answer true, false or a refusal. (Codex, PR #137.)
- **3l — the spread is rounded coarser than the thing it qualifies.** It was: whole
  milliseconds, beside a median printed to one decimal. Fine at 300 ms and destructive
  below 1, where a real 0.1–0.4 prints as `0–0` — the one column a reader consults to
  decide whether a delta is noise, reporting that there is none. Shown on a real
  `--notes=0` run: `switch to deliverables` reads `3.8–4.1` where it used to read `4–4`.
  Small workloads are offered and documented, so this is a case the tool serves rather
  than an edge it meets. One decimal throughout rather than a precision scaled to
  magnitude, because the spread is read AGAINST the median and two columns rounded
  differently cannot be compared by eye. The published tables above are unaffected —
  hundreds of milliseconds, where the first decimal changes no reading. (Codex, PR #137.)
- **3m — the axis is named but the GRID it drew is not.** It was not, and the axis alone
  does not pin the workload on either grid axis: the window is derived from the reader's
  own calendar date, so the same build measured on two dates — or one `--against` run
  crossing midnight — draws a different span and clamps differently while every other
  field compares equal. The drawn window is published as `grid` and joins the workload
  comparison and the heading. **Published rather than FROZEN**, of the two available
  fixes: the reader's date is an INPUT the view injects (`render/projections.ts`; nothing
  in `domain/` reads a clock), so pinning it for benchmark runs would measure something
  the plugin does not do. And it is the window rather than the date, because the window is
  what the render produced and what actually varies — a zoom, a lead width or one note's
  dates move it too. Named `grid` because `--window` in the runner is the VIEWPORT.
  (Codex, PR #137.)
- **3n — the workload is checked once, on run 1.** It was, on each side: `ran` is the
  FIRST result's, so a multi-run comparison crossing midnight after its first pair drew a
  different grid from then on, pooled every timing into one median, and headed the table
  with the span the run started on. Trusting each build to be constant within itself while
  checking the two against each other is the same assumption the rest of this block exists
  to refuse, one level in. Every run's `ran` is now compared against its own side's first
  and the first run that MOVED is named, with what moved. Against run 1 rather than
  pairwise, because the drift is chronological: n comparisons say it where n² repeat it.
  Loud rather than a refusal, like every warning above it. Watched firing on both sides,
  against a bundle patched to report a grid that moves per page load — which is what
  crossing midnight does and what nothing in this repository's history can supply.
  (Codex, PR #137.)
- **3o — the fingerprint hashes the notes but not what the BASE answers.** It did:
  `renderValue` draws `entry.getValue()`, not the frontmatter, so a Base supplying a
  different computed or plain value draws a different cell over notes that never moved —
  and the hash, built from paths, frontmatter, options and result order, matched. Each
  result's answer for each visible property joins it. **It hashes a run of nulls today**,
  because nothing populates `FakeVault.entryValues`, so it catches no comparison that can
  be made right now; it is in because the fingerprint's promise is "the inputs the view was
  handed", and an input left out of it opens silently the day a fixture supplies one.
  Watched discriminating against a bundle patched to answer one property with a value:
  `contents: 4b50cb82 here, bbb62542 in the baseline`, over an identical vault.
  (Codex, PR #137.)
- **3p — the fingerprint's serializer only understood objects.** `stableJson` was written
  for the options object and reused for the entry values 3o had just added: `Object.keys(1)`
  and `Object.keys(true)` are empty, so every truthy primitive collapsed to `[]`, and a
  `!value` guard put `0`, `false`, `''` and `null` together at `''`. A Base answering `1`
  where another answers `2` fingerprinted identically — the exact comparison the hash exists
  to refuse, reintroduced by the commit that widened what it covers. Non-objects serialize
  as themselves now, and the key ordering recurses rather than stopping at the top level.
  **Watched both ways**, since one direction alone proves nothing here: under the old
  serializer `1`, `2` and `true` all hashed `8e94c74e` and `0` collided with `null` at
  `4b50cb82`; under the new one all five values are distinct. (Codex, PR #137.)
- **3q — a count is a whole number that cannot be counted to.** `Number.isInteger` says yes
  to `1e100` and to `9007199254740993`, so `--runs=1e100` passed the guard 3a added and
  then never came back: the loop reaches 2^53, `run++` stops advancing the counter, and the
  run hangs rather than taking a long time. `--notes` handed the same value to the page's
  own generation loop. The guard is `isSafeInteger` now, which is where `Infinity` was
  already being refused rather than a new rule. It draws the line at COUNTABLE and not at
  large: a big representable number is a slow run somebody asked for, and nothing here
  refuses one. (Codex, PR #137.)
- **3q — the heading names the executable, not the BUILD.** It said `headless_shell`,
  which is every Chromium Playwright has ever shipped. A browser version is a real term in
  these numbers — what `content-visibility` skips and what a layout costs are the browser's
  own — so two tables captured a month apart could differ entirely from that and read as
  identical runs. It is asked of the binary once, before anything is timed, and it is
  deliberately NOT in the workload comparison: `--against` alternates two harnesses inside
  one process with one resolved browser, so the two sides cannot differ. What this fixes is
  a table read beside one from another machine. First line only, and a blank or failed
  answer falls back to the executable name — the heading is one row, and this runs against
  whatever `CHROME_PATH` names. (Codex, PR #137.)
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
- The run leaves the projection, the axis and the shelf collapse as it found them.
- No assertion anywhere in this work measures elapsed time, and `npm run check` gains no
  step.
- No new dependency: the browser is found, not installed, and the page is driven by
  `--dump-dom` rather than by an automation library.

## Where it lives

`scripts/perf.mjs` · `test/harness/perf.ts` · `test/harness/mount.ts` ·
`test/harness/page.ts` · `test/harness/perfMode.test.ts`
