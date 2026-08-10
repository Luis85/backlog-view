# Harness performance mode — design

Date: 2026-08-10

## The report

A vault of roughly 800 notes, filing its hierarchy in subfolders rather than in `parent`
links, feels sluggish. Nothing here can reproduce that: every fixture in the suite is
between four and forty notes, and the browser harness mounts the largest of them.

## What this is, and what it is not

`npm run harness` bundles the real `ProductBacklogView` into a static page. This adds a
**size knob** and a **stopwatch** to that page. It is an instrument to read, not a check
that fails.

That distinction is the whole reason this is allowed to exist. The register refused a
timing check twice, on the same ground both times — [[The render path states its costs as
checks]] and [[The model build states its cost as a check]] each say *no check in this
feature asserts on elapsed time*, because a benchmark in jsdom measures jsdom and a
threshold on a loaded CI runner gets deleted rather than investigated. Nothing here
reopens that: no assertion in this work reads a clock, and ADR 0020 keeps its four
refusals intact — no baselines, no browser-automation dependency, no sixth step in
`npm run check`, and no live-vault verification replaced.

What it cannot see is the other half of the honesty. The page has no Bases query pass, no
`metadataCache`, no vault I/O and no theme. If the sluggishness lives in any of those, this
instrument reports a fast page and is right to. That sentence is printed on the panel
itself, so a number cannot be lifted off a screenshot and quoted as what the plugin costs
in a vault.

## Instrument first

`FakeVault.getFirstLinkpathDest` scans every file in the vault on every call. Resolution
is one call per `parent` link, so a flat-layout fixture of 800 notes spends on the order of
640,000 iterations inside the *fake* — a hotspot that exists nowhere in a real vault, where
Obsidian resolves a link through an index.

Measuring before fixing that would produce a number about the test helper and read as a
number about the plugin. This codebase already has the rule, in `CLAUDE.md`: *measure a set
with an instrument that can see all of it, and test the instrument first.*

So the fake gains a basename index, with the precedence stated rather than emergent: exact
path, then path with `.md` appended, then basename. The scan it replaces returned the first
file matching *any* of the three, which let an earlier-inserted basename match beat a later
exact-path one — an ordering nothing relies on and real Obsidian does not have. The
existing suite is the check that the change moved no behaviour.

## The size knob

`demoVault(layout, extra = 0)` keeps every curated note and then generates `extra` more
through the same `adder` closure the fixture already uses, so the folder layout files them
the way it files everything else.

The generated shape is a backlog's, not a list's: one Epic per 25 items, Features beneath
it, PBIs beneath those, Tasks beneath those. Each generated note draws its `status`,
`horizon` and dates by rotation from the vocabularies `demoOptions()` already declares —
otherwise 800 untriaged notes land on the shelf and in the no-state column, and the board
and roadmap are measured drawing nothing.

Titles are prefixed so they cannot collide with the curated rows that existing harness
tests assert on by title. `demoResults` needs no change: it excludes one note by basename,
and that note is still there.

`extra` defaults to `0`, so a harness URL that does not ask for a size gets the page it
gets today.

## The stopwatch

`test/harness/perf.ts`, active only when the URL carries `?perf`. Four rows:

| row | what is called | why |
| --- | --- | --- |
| mount | the initial `onDataUpdated()` | one sample; it happens once |
| update | `view.onDataUpdated()` | build **and** render — the cost paid after every write batch |
| render | `view.render()` | render alone |
| projection | `view.setProjection(p)`, per projection | a full re-render of each of the four |

> **Correction, 2026-08-10 — this section originally said the build is `update − render`.**
> It is not, and following that instruction reproduces a wrong answer rather than a
> measurement. The two medians are sampled at different points in one run and each swings
> by 100 ms or more, so their difference ranged from ~30 ms to ~700 ms across runs for a
> quantity direct instrumentation puts at ~10 ms. It produced a filed finding blaming the
> model build for the render's cost, retracted the same day.
>
> The reasoning that led here was sound about seams and wrong about resolution: avoiding a
> hook the view does not need was right, and concluding that two public calls could
> therefore substitute for one was not. **To time a phase, instrument the phase** — a
> temporary patch, read once and thrown away, which is what actually answered it. The pair
> above still bounds a data update against its own render; it does not decompose one.
> See [[The render is the whole cost of a data update]].

Each row is sampled five times; the panel reports the median and the worst, because a
single browser sample at 800 rows swings enough on a stray GC pause that a lone number
invites a re-run. Each sample reads the height of what was DRAWN before stopping the clock (`drawnHeight`
in `mount.ts`), so the browser's layout for it lands inside the measurement rather than
after it, and so the number reported alongside says something.

> **Correction, 2026-08-10, twice.** This first said `document.body.offsetHeight`, which
> the implementation never used; it then said the scroller's `scrollHeight`, which is
> what the implementation used and is still wrong. No `scrollHeight` answers this
> question: the container's is clamped to the pane, and `.pbl-tree` is a flex child that
> FILLS the pane — an element's `scrollHeight` can never be smaller than its
> `clientHeight`, so both report the viewport whenever the content is shorter than the
> pane. On the edge-case fixture the column read ~1000px for four rows.
>
> `drawnHeight` takes the last child's bottom against the scroller's own top plus its
> scroll offset, which is the content height in both directions: 199px for those four
> rows, 33319px for 832. Every version forces the same layout — that is the reason the
> read is inside the sample — so only the reported number ever changed.

The results go two places: a fixed `.pbl-harness-perf` panel, so nothing has to be opened
to read them, and `console.table`, so they can be pasted into a note. `.pbl-harness-*` is
already the namespace the harness owns for its own furniture, and `themeStub.test.ts`
already knows it.

## Checks

Nothing new enters `npm run check` and no new assertion reads a clock.

`harness.test.ts` gains one test: mounting with `extra` set draws that many more rows, in
both layouts. Without it the knob could silently produce a forty-row page while the panel
reports confidently on eight hundred — the instrument lying about its own sample size,
which is the failure this spec's own **Instrument first** section is about.

The fake vault's index is covered by the suite that already exists.

## Out of scope

Interaction timings — expand/collapse, and drag. Expand/collapse is a real cost
(`refreshSubtree`) but was not asked for; a drag needs a synthesised gesture, which is more
harness than a first look at where the time goes deserves. Add them when these four rows
point that way.

Fixing whatever the numbers turn out to blame. This is the instrument; what it finds is
its own work, filed against what it shows.
