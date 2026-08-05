# A browser harness without Obsidian — render the real view, look at it, drive it

**Date** 2026-08-05
**Delivers** one new Feature under `[[Codebase health]]` with three PBIs, plus one ADR
recording what this deliberately is *not*.

## Why this increment

Obsidian cannot run in this repository (ADR 0006), so everything appearance-shaped ships
on a hand check in a live vault — `npm run test-build`, open the repo as a vault, look.
That check works, and it has one property that matters here: **it needs a human at a
GUI.** An agent working in a coding session cannot run it, cannot see a layout it just
changed, and cannot tell a rendering regression from a passing suite. The jsdom tests
assert structure through `querySelector`; nothing in this repository has ever *drawn* the
view.

The pieces to close that gap are already in the tree and were built for another purpose:
`test/helpers/obsidian-mock.ts` is a runtime stand-in for the module, `FakeVault` is a
whole vault in memory, `makeView` mounts the real `ProductBacklogView`, and `styles.css`
is already assembled from `styles/` as a build artifact. A browser is the one thing not
wired up — and Chromium is what an agentic session has.

ADR 0006 anticipated exactly this in its **Revisit when**: *"a visual-regression path
exists that does not need the app."* This is that path, with one honest subtraction: it
is not a visual-*regression* path, because nothing asserts what it draws.

## Scope

**In:**
- A gitignored, buildable HTML page that mounts the real view against a fixture vault,
  with the real assembled stylesheet, openable at a `file://` URL in any browser.
- All three projections, switched through the view's own toolbar — not through page
  chrome, so what is exercised is the real control.
- A fixture backlog big and varied enough that all three projections have something to
  show: a hierarchy several levels deep, states spread across the workflow, dates for the
  timeline, horizons for the buckets, an item that lands on the shelf, and a context row.
- A trailing re-render after writes, so a drag performed in the browser is a drag whose
  result is visible.
- A stub of the Obsidian CSS variables the stylesheet reads, **checked against the
  stylesheet** so it cannot silently go missing a variable.
- A vitest test that mounts the harness and asserts each projection renders content, so
  the harness cannot rot into an unbuildable file nobody notices.
- The recipe in `test/CLAUDE.md`, where an agent working in `test/` will load it.

**Out, deliberately:**
- **Screenshot or visual-regression assertions.** No committed baseline images, no
  Playwright driver script, no image diffing. See ADR 0020.
- **A Playwright (or any) new dependency.** The harness produces a static page; how a
  session looks at it belongs to the session, not to `package.json`.
- **A sixth step in `npm run check`.** ADR 0007 makes that gate the whole gate, and a
  harness build is not a check. The vitest test is how the harness stays alive inside the
  five steps that already run.
- **Replacing the live-vault appearance sweep.** The theme stub approximates Obsidian's
  variables; it is not Obsidian's theme. `[[Verifications a device has to answer]]` and
  every `## How to check` note stand unchanged.
- **Serving over HTTP.** The bundle is an IIFE and the page loads no modules, so
  `file://` works and a dev server would be a process to manage for nothing.

## Architecture

Everything lands **outside `src/`**. Nothing here ships in the plugin, so it is subject to
`test/**`'s lint budget rather than the Obsidian ruleset, and outside `docs-check.mjs`
rule 7 — which is correct, not a dodge: rule 7 exists so every *shipped* module is
specified somewhere, and the harness is specified here and in its Feature note anyway.

### 1. The fixture — `test/helpers/fixtures.ts`

`demoVault()` returns a `FakeVault` holding a backlog worth looking at, and
`demoOptions()` the view options that configure all three projections at once (state
property and values, horizon property and buckets, the two date properties). The existing
per-suite fixtures (`fixture()`, `boardVault()`, the roadmap helpers) are deliberately
tiny — four notes, one concern each — because a test that asserts on three rows should
not be reading past thirty. They stay as they are; this is a fourth fixture with a
different job, not a replacement, and no existing suite is rewritten onto it.

What it must contain, and why each is load-bearing:

| Content | Which projection needs it |
| --- | --- |
| Epic → Feature → PBI → Task, several branches | the tree at depth, and swimlane grouping |
| Items in every configured state, plus stateless ones | every board column including the no-state one |
| Start and end dates on some items, absent on others | the dated axis, and the shelf that catches what has none |
| Horizon values on some items | the bucket axis, and the shelf again |
| An item outside the result set, parenting one inside | a context row on screen |
| A milestone | the milestone line across the plan |

### 2. The mount — `test/harness/mount.ts`

One exported function, `mountHarness(root)`, doing what `makeView` does minus vitest:
construct `ProductBacklogView`, hand it `app`, `config` and `data` after construction (a
Bases view is handed its `app` *after* construction — ADR 0006's first consequence), call
`onDataUpdated`.

Two things it adds over `makeView`:

- **A base-file leaf**, so the view can identify which base it is and the collapse store
  has an identity to key on. Without it the projection toggle would not survive a reload.
- **A trailing re-render.** `FakeVault.afterWrite` fires as each write lands, *inside* a
  batch — re-rendering there would rebuild the model mid-batch. So the hook schedules a
  timer and resets it on every write; the render happens once the batch stops writing.
  The delay is the cost of not correlating with a batch boundary the fake vault does not
  expose, and it is stated in the code rather than tuned.

`test/harness/page.ts` is the esbuild entry and is two lines — `mountHarness(document.body)`
— so that everything real is reachable from a test that never touches `document.body`.

### 3. The theme stub — `test/harness/theme.css`

`styles/` reads 44 variables it does not define: Obsidian's. Colours, spacing steps, font
sizes, radii, icon sizes. Without them the page renders with every custom property
resolving to nothing — which does not fail, it just draws wrong, quietly.

So the stub defines all 44, in a `:root` block, at values close to Obsidian's defaults.
It is honest about being an approximation: **the harness is faithful about layout,
structure and interaction, and approximate about colour.** That sentence is written into
the Feature note as the boundary of what the harness may be trusted for.

The stub going stale is the failure mode with teeth: add a `var(--text-muted)` to a
partial and the harness silently draws a colourless label from then on. So the set is
measured by an instrument rather than by memory — see the check below.

### 4. The build — `harness.mjs`, `npm run harness`

A root script beside `test-build.mjs`, which it is modelled on. It:

1. bundles `test/harness/page.ts` with esbuild — `format: 'iife'`, `bundle: true`,
   `alias: { obsidian: test/helpers/obsidian-mock.ts, vitest: test/harness/vitest-stub.ts }`;
2. writes `assembleStyles()` and `theme.css` beside it;
3. writes an `index.html` linking both and the bundle;
4. prints the `file://` path.

The `vitest` alias exists because `test/helpers/view.ts` imports `beforeEach`/`vi` for
`useViewHarness`, which the harness never calls — the stub is three no-op exports, and
aliasing is a smaller diff than splitting that helper in two.

Output goes to `.harness/`, gitignored, dot-prefixed like `.obsidian/` for the same
reason: a build artifact that must never appear in a diff.

### 5. The checks

`test/harness/harness.test.ts`, two of them:

- **The harness renders.** Mount it into a detached element under jsdom, switch through
  all three projections via the toolbar buttons, and assert each draws content — rows,
  columns with cards, an axis with something on it. This is what stops the harness from
  becoming an unbuildable file discovered only when someone tries to use it, and it costs
  no new gate step because vitest already runs.
- **The theme stub covers the stylesheet.** Read every file in `styles/`, extract every
  `var(--x)` whose name is not `--pbl*` (those are the plugin's own, set in code), and
  assert `theme.css` defines each. The instrument is a regex over the partials, so it sees
  what the assembler sees; the rule it enforces is stated at the missing thing, not as a
  list of variables someone remembered.

## Register work

- **Feature** `docs/requirements/A browser harness without Obsidian.md` — parent
  `[[Codebase health]]`, order 80.
- **PBIs**, all under it:
  - `The page that mounts the real view` — the build, the mount, the projections.
  - `A fixture backlog worth looking at` — the shared fixture and what it must cover.
  - `The theme stub is checked against the stylesheet` — the instrument.
- **ADR 0020** — what the harness is not: no baselines, no dependency, no sixth gate step,
  and why each refusal. ADR 0006 is **not** superseded and gets no supersede link: jsdom
  remains the substitute for Obsidian in *tests*: this draws, it does not assert. 0020
  cites 0006's Revisit-when as its context.
- `test/CLAUDE.md` gains the recipe and the honest limit.

## Risks

- **The theme stub reads as Obsidian and is not.** Mitigated by saying so in the Feature
  note, in `test/CLAUDE.md` and in the ADR, and by keeping every live-vault verification
  open. It cannot be mitigated by better values — only by not overclaiming.
- **The harness becomes a place to assert things.** The next contributor who wants a
  screenshot test will find a page already rendering and one dependency away from a
  baseline suite. That is what ADR 0020 exists to answer in advance.
- **Fixture drift.** A fixture nobody asserts against decays into a fixture that renders
  nothing. The render test is the floor: if a projection stops drawing content, it fails.
