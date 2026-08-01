---
adr: 6
title: jsdom is the substitute for Obsidian
status: Accepted
date: 2026-07-30
area: testing
---

# ADR 0006 — jsdom is the substitute for Obsidian

## Context

Obsidian cannot run in this repository. It is an Electron application, the `obsidian` npm
package is **types only**, and the Bases view API this plugin is built on
([ADR 0001](0001-build-on-the-bases-custom-view-api.md)) exists only inside the app.

Meanwhile the interesting behaviour is precisely the part that touches the DOM: drop-zone
maths against real geometry, hover-expand during a drag, keyboard navigation of a tree
widget, menus, the responsive column fit. Testing only the pure layer would leave the
half most likely to break untested.

## Decision

**Drive the real view through real DOM events in jsdom**, against fakes for the two things
jsdom is not:

- `test/helpers/obsidian-mock.ts` — a runtime stand-in for the `obsidian` module, aliased
  in `vitest.config.ts`. Kept minimal: it grows exactly the surface a new test needs.
- `test/helpers/vault.ts` — `FakeVault`: metadata cache, vault, `processFrontMatter`, and
  a recorder for writes and navigation.
- `test/helpers/view.ts` — the harness every view test shares.

Tests dispatch `dragstart` / `dragover` / `drop`, `keydown`, `click`, `contextmenu`. They
do not call handlers as functions.

**And: appearance is not tested at all.** It is checked by hand in a real vault, from a
written checklist, and that fact is said out loud rather than papered over.
`npm run test-build` bundles into `.obsidian/plugins/` in this repository so the repo
itself opens as a vault with the plugin installed — and `docs/` is already a backlog with
a `.base` file in it, so the plugin displays its own register.

## Consequences

- Constructor-time mistakes are caught instantly. A Bases view is handed its `app` *after*
  construction; this has bitten twice, and both times the jsdom tests found it — which is
  the argument for driving the real view rather than units.
- The tests are worth reading as documentation, which is why they are organised one file
  per subject with their own size budgets.
- jsdom's gaps have to be stubbed **explicitly and narrowly**, and each stub is a place the
  test could diverge from reality: `getBoundingClientRect` returns zeros, `dataTransfer` is
  absent unless supplied, `ResizeObserver` does not exist.
- `FakeVault`'s caches are static, so after a write a test asserts frontmatter rather than
  re-rendering. `entry.getValue()` returns null, so property chips render empty.
- Two facts about Obsidian's internals rest on **verification in a live vault, once**:
  that a `.base` leaf presents as a `FileView` with `.file` set
  ([ADR 0011](0011-keep-collapse-state-out-of-the-base-file.md)), and everything on the
  appearance checklist. Both are recorded as re-runnable notes, not as beliefs.
- Anything appearance-shaped ships on a hand check. That is a real, permanent gap, and
  the reason the smoke-test note is kept open to re-run rather than closed as history.

## Alternatives

- **Unit tests with the view mocked out.** Fast and green, and they would have caught none
  of the drag-and-drop bugs, because the bugs were in geometry and event sequencing.
- **End-to-end against a real Obsidian** (Electron driver, a fixture vault). The only thing
  that would test appearance — and it needs a GUI, an Obsidian licence-bound binary, and a
  version to pin, for a plugin whose floor is "whatever Obsidian ships next". The hand
  checklist is the honest version of this at a fraction of the cost.
- **Snapshot tests of rendered HTML.** Detects change, not correctness, and would fail on
  every legitimate markup edit while still saying nothing about how it looks.

## Revisit when

A headless Obsidian becomes available, or a visual-regression path exists that does not
need the app — either would close the one gap this decision knowingly leaves open.
