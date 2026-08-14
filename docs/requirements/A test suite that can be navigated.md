---
type: PBI
parent: "[[Test harness and coverage]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A test suite that can be navigated

**As** someone about to change a behaviour, **I want** to find the tests that describe it
in one guess, **so that** the suite works as documentation — which it only does if the
file you want is the file you would have named.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is changing the plugin |
| **Trigger** | Looking for, or adding, a test for one behaviour |
| **Preconditions** | None |
| **Guarantee** | Obsidian cannot run in this repository. The harness is the substitute, and what it *cannot* check is stated rather than assumed. |

**Main flow**

1. Tests are organised **one file per subject**, mirroring `src/` — `dragDrop`, `keyboard`,
   `tags`, `undo`, `columns`, one each.
2. Each file has its own size budget, so the suite cannot grow the one file that becomes
   the place tests hide.
3. A view test drives the **real** view through **real** DOM events: `dragstart` /
   `dragover` / `drop` are dispatched, not called as functions; menus are opened and read
   back; keys are pressed.
4. `npm run check` runs them under coverage thresholds that only ever go up.

**Extensions**

- **1a — a new obsidian API is used.** The runtime stand-in gains exactly that surface and
  no more.
- **2a — a file reaches its budget.** It is split by **subject**, so the split leaves two
  files someone would have guessed, not `rendering2`.
- **3a — jsdom does not implement what the test needs.** It is stubbed explicitly and
  narrowly: `getBoundingClientRect` returns zeros, so drop-zone tests stub it;
  `dataTransfer` is absent unless supplied; `ResizeObserver` does not exist, so the fit
  tests call the render path directly.
- **3b — the behaviour is appearance.** It cannot be tested here at all. It is written down
  as a checklist to run in a real vault instead — [[Smoke test the visual changes]] — and
  `npm run test-build` makes that a ten-minute pass rather than a project.

## Acceptance criteria

- One file per subject, each with its own size budget, so the suite cannot grow a file
  that becomes the place tests hide.
- The hardest paths to drive are driven anyway: drag and drop is dispatched as real
  `dragstart`/`dragover`/`drop`, not called as functions.
- What the harness cannot check is stated rather than assumed.
- The harness's own limits are documented where they will be hit — static `FakeVault`
  caches, `getValue()` returning null.

## Where it lives

`test/helpers/view.ts` (the shared harness) · `test/helpers/vault.ts` (`FakeVault`) ·
`test/helpers/obsidian-mock.ts` · `test/helpers/dom.ts` ·
`vitest.config.mts` (thresholds) · `eslint.config.mjs` (`test/**` line budget).
Done by: [[Split the view test suite]], [[Cover the drag and drop branches]].
