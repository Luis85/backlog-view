---
type: PBI
parent: "[[A browser harness without Obsidian]]"
order: 10
status: Done
priority: P1
created: 2026-08-05
closed: 2026-08-05
files:
  - scripts/harness.mjs
  - test/harness/mount.ts
  - test/harness/page.ts
  - test/harness/chrome.ts
  - test/harness/harness.test.ts
  - test/helpers/vault.ts
  - eslint.config.mjs
  - .fallowrc.json
  - package.json
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The page that mounts the real view

**As** whoever is changing the view — a contributor without Obsidian open, or an agent in
a coding session — **I want** one command that builds a page rendering the real view,
**so that** I can look at what I just changed instead of inferring it from a passing
suite.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is changing the view |
| **Trigger** | `npm run harness` |
| **Preconditions** | Node and the repository's dev dependencies. No Obsidian, no vault, no browser automation, no network |
| **Guarantee** | What is drawn is the real `ProductBacklogView` over the real assembled stylesheet. Nothing in the page is a copy of the view's markup, so a page that renders correctly against a broken view is not a state this can reach. |

**Main flow**

1. The script bundles `test/harness/page.ts` with esbuild, resolving `obsidian` to the
   same module mock `vitest.config.mts` points the suite at.
2. It writes the stylesheet through `assembleStyles()` — the same function the plugin
   build and the vault install use, so the CSS on screen is the partials being edited.
3. It writes the theme stub beside it and an `index.html` linking both.
4. It prints a `file://` URL. Opening it renders the tree; the toolbar switches to the
   board and the roadmap; drags, menus and keyboard moves are the real ones.

**Extensions**

- **1a — the bundle needs a module loader.** It does not: the output is an IIFE. A page
  opened over `file://` cannot load ES modules — every file is its own opaque origin — and
  choosing the format that needs no server is what keeps a dev server out of this feature.
- **2a — the stylesheet is read from the built `styles.css`.** Refused. That file is a
  build artifact that may not exist and may be stale; going through the assembler means
  the harness cannot show a version of the CSS nobody is editing.
- **4a — looking at a projection needs a click.** A click needs something to drive the
  browser, which is the automation dependency this feature exists without. So
  `?view=board` and `?view=roadmap` open straight into a projection and a headless
  screenshot of a URL is the whole recipe. The toolbar remains the real control and is
  what the mount test exercises; the parameter is a way in, not a second way to switch.
- **4b — a write lands and the screen does not change.** It would, without this: the
  harness renders once and no Bases update follows a write, which is the same limit
  `test/CLAUDE.md` records for the suite. The mount re-renders after the writes stop —
  on a timer, because `FakeVault.afterWrite` fires *inside* a batch and rendering there
  would rebuild the model mid-batch.
- **4c — the page is treated as a test.** That is [ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md),
  which refuses it in advance: no baselines, no diffing, no gate step.
- **4d — a right-click produces nothing, and `New Epic` opens nothing.** They would,
  without this: the module mock RECORDS a `Menu` and a `Modal` — `lastShown`,
  `lastOpened` — and draws neither, which is everything a test needs and nothing a person
  can see. So the harness draws them itself, patching the mock from its own side rather
  than teaching the mock to append nodes, since 68 test files assert through those two
  statics and empty `document.body` between tests. The entries and the actions are the
  view's; the widget is a stand-in, and worth even less than the rest of the harness's
  appearance.
- **4e — a note is CREATED and the screen does not change.** `createBacklogItem` goes
  through `vault.create`, and the fake vault only notified from `processFrontMatter` — so
  "after a write" quietly meant "after a frontmatter write", and the one change that adds
  a row was the one nothing was told about. The notification moved to the mutation
  instead of to the caller: creation notifies like every other vault change, which is a
  fix for anything watching rather than for this page.

## Acceptance criteria

- One command, no arguments, no setup: `npm run harness`.
- The bundle resolves `obsidian` to the existing mock rather than to a second one.
- Output lands in a gitignored directory and never appears in a diff — lint, fallow and
  the docs gate all leave it alone.
- Every interaction the page advertises actually happens on it: a menu appears where the
  pointer is and runs what is clicked, a dialog appears and its note lands, and the view
  re-renders once the writes stop — each driven by a test through the events a person
  would send.
- The entry file is two statements over `mountHarness`, so everything real is reachable
  from a test that never touches `document.body`.
- `test/harness/harness.test.ts` mounts it and asserts each projection draws content, so
  a harness that stopped building fails in the suite rather than the next time someone
  looks.
- No new dependency, and no sixth step in `npm run check`.

## Where it lives

`harness.mjs` · `test/harness/page.ts` · `test/harness/mount.ts` ·
`test/harness/chrome.ts` · `test/harness/harness.test.ts`
