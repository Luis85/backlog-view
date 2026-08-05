# Tests — harness guide

Obsidian cannot run here, so the jsdom harness below is the substitute; say so honestly
when a change still needs a live-vault smoke test — and when the question is what a
change *looks* like, build the browser harness and look, rather than guessing from
markup assertions (see **Looking at it**, at the end). The two test rules that bind while you
are editing `src/` — the `test/**` lint budget and "an invariant asserted in a comment gets
a watched-failing test" — stay in [`../CLAUDE.md`](../CLAUDE.md).

- `test/helpers/obsidian-mock.ts` — runtime stand-in for the `obsidian` module (aliased in
  `vitest.config.mts`). Extend it when new obsidian API surface is used; keep it minimal.
- `test/helpers/dom.ts` — installs Obsidian's DOM prototype extensions (`createEl`,
  `addClass`, `setCssProps`, …) for jsdom files. Call `installObsidianDom()` at module top.
- `test/helpers/vault.ts` — `FakeVault` (metadata cache, vault, `processFrontMatter`, workspace
  recorder) and `FakeViewConfig` (records `set()` calls). Assert writes via
  `vault.fm(path)` / `vault.writeLog`; assert navigation via `vault.opened`.
- `test/helpers/view.ts` — the view harness every `test/view/*.test.ts` file shares:
  `makeView`, `refresh`, `fixture`, the row/tree accessors, `drag`, `key`, `stubRect`,
  `flush`, `submitPrompt`, and `useViewHarness()` for the per-test reset. Call
  `useViewHarness()` at the top of the file; the helper installs no hooks by itself.
- `test/helpers/register.ts` — a whole miniature repository (`docs/`, `src/`, `test/`)
  written to a throwaway directory and handed to the REAL `docs-check.mjs` as a subprocess.
  The gate is a script — top-level await, paths relative to the working directory,
  `process.exit` for its verdict — so it is run the way CI runs it rather than refactored
  into something importable; a seam built for the test is the thing that would get tested.
  `baseRegister()` is one valid tree and every case is a single delta against it, so a
  failure names a rule rather than a document.
- View tests (`test/view/*.test.ts`, one file per subject) drive REAL interactions: dispatch
  `dragstart`/`dragover`/`drop` (stub `getBoundingClientRect` for drop zones — jsdom returns
  zeros, and `dataTransfer` is absent unless the test supplies one), `keydown`, `click`,
  `contextmenu` (grab the menu via `Menu.lastShown`). Async writes need `await flush()`.
- Known harness limits: nothing refreshes on its own — a write updates the vault and no
  `onDataUpdated` follows, so a test that wants to see the result RE-RENDERED calls
  `refresh(view, vault)` (or sets `vault.afterWrite`, which is how a Bases update is
  interleaved with a batch). The model it rebuilds does see the write: `addFile` gives
  the metadata cache the same frontmatter object `processFrontMatter` mutates — verified
  2026-08-02, after this line claimed for months that the caches were static and cost a
  legitimate test that was deleted rather than driven. A note added with NO frontmatter
  is the real exception: the cache never gets an object for it, so writes to it stay
  invisible to the model. `entry.getValue()` returns null, so property chips render empty
  in tests.

## Looking at it

`npm run harness` bundles the REAL view into a static page — no Obsidian, no server, no
browser-automation dependency — and prints a `file://` URL. `?view=board` and
`?view=roadmap` open straight into a projection and `?theme=light` into the light scheme,
so a headless screenshot of a URL needs nothing to click; a corner toggle switches the
scheme by hand, and it is the harness's furniture rather than the view's. The toolbar switches projections, and the drags, menu entries and
keyboard moves are the view's own — but the menu and dialog WIDGETS are drawn by
`test/harness/chrome.ts`, because the module mock records a `Menu`/`Modal` and renders
nothing. What they contain and what they do is the view's; what they look like is not
Obsidian's.

- `test/harness/mount.ts` — mounts `ProductBacklogView` against `demoVault()`, re-rendering
  once a batch of writes stops. `test/harness/page.ts` is the bundle entry and is two
  statements, so everything real is reachable from a test.
- `test/helpers/fixtures.ts` — the demo backlog and the view options that configure all
  three projections at once. A fourth fixture, not a replacement: the per-suite ones stay
  four notes each on purpose.
- `test/harness/chrome.ts` — patches the mock's `Menu` and `Modal` to appear, from the
  harness rather than in the mock, so the 68 files asserting through `lastShown` /
  `lastOpened` measure exactly what they did before.
- `test/harness/icons.ts` — draws the real lucide glyph for each `setIcon` name, through
  `setIconRenderer`, the one hook the mock exposes; by default the mock still only
  records `data-icon`, so the suite is untouched. An unresolvable name is marked rather
  than skipped, because a blank control in the tool built for looking is the one failure
  nobody would see.
- Its own checks live in `test/harness/harness.test.ts` — it still mounts, the theme
  stub still covers every `var(--x)` the partials read, and every icon name the view asks
  for across all three projections still resolves.

**What it is faithful about:** markup, layout, the real assembled stylesheet, every
interaction, and icon SHAPES — lucide's own, sized through the `.svg-icon` class the
partials style. **What it is not:** colour — `test/harness/theme.css` builds on Obsidian's
documented base scale and palette in both schemes, which is close enough to judge contrast
and hierarchy by and not close enough to read a colour off, since a themed vault replaces
exactly those values. It therefore replaces NO live-vault verification,
and asserting appearance from it is refused in
[ADR 0020](../docs/adrs/0020-the-browser-harness-draws-it-does-not-assert.md): no
baselines, no screenshot suite, no sixth step in `npm run check`.
