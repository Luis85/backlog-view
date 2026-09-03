---
type: Bug
parent: "[[A browser harness without Obsidian]]"
order: 40
status: Done
area: test
priority: P2
created: 2026-09-03
closed: 2026-09-03
source: "Found while mocking the capacity figure for the 2026-09-03 increment — the release
  harness entry would not bundle at all"
files:
  - test/helpers/release.ts
  - test/harness/bundles.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The release harness entry could not build

## What happens

`npm run harness -- test/harness/release.ts` fails outright, before anything reaches a
browser: esbuild refuses the whole module graph with `Could not resolve "node:fs"`. The
release view had no way to be looked at outside Obsidian — the one class of question jsdom
cannot answer, since it computes no layout and no styles.

## Why

`test/helpers/release.ts` imported `flush` from `test/helpers/view.ts` for a one-line
`setTimeout(0)` promise. `view.ts` is the shared harness for every `test/view/*.test.ts`
file: it reads `node:fs` and imports vitest, both of which resolve fine under vitest's own
module loader but not under esbuild bundling for a browser target. Pulling in one function
dragged the whole file's build target with it, so the release entry's graph reached a
node-and-vitest module and stopped resolving.

## What it cost

The release view shipped a `display: contents` defect that made its whole index
unreachable by keyboard, and it survived eight jsdom tests and two review rounds — because
nothing had ever drawn that view in a browser to look at it. This is the same class of gap:
a harness entry that cannot build answers no question about appearance, focusability or
geometry, and the suite passing gave no signal that it was broken.

## The fix

`2b8db56` inlines the one-line `setTimeout(0)` promise into `test/helpers/release.ts`
instead of importing `flush` from `view.ts`, so the release entry's graph never reaches a
node-or-vitest module.

## The gate

`test/harness/bundles.test.ts` bundles every non-test module under `test/harness/` with
esbuild, in the same browser configuration `scripts/harness.mjs` uses, and asserts the
reached module graph contains no `node:` specifier and no path under
`node_modules/vitest/`. The entry list is **discovered** (`readdirSync('test/harness')`,
filtered to `.ts` files that are not `.test.ts`), not written down: a frozen list of
today's files would pass the day a fifth entry imports the same node-and-vitest helper,
which is exactly the regression this gate exists to catch. A first case asserts the
discovery itself finds `release.ts` and at least four entries, so an empty or
miscast glob cannot make every case below it vacuous.

Run against the pre-fix `test/helpers/release.ts` (`git show 2b8db56^:test/helpers/release.ts`),
the gate fails on three entries, not one: `test/harness/release.ts` itself,
`test/harness/mountRelease.ts` (which imports it directly), and `test/harness/mock.ts` (the
uncommitted scratch entry from mocking the capacity figure, which mounts the release view
through `mountRelease.ts`). All three report the same `Could not resolve "node:fs"` from
`test/helpers/view.ts`. Restoring the fixed file makes all fifteen cases pass.
