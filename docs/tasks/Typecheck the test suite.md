---
type: Task
order: 240
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-08-31
closed: 2026-08-31
source: tsc run against a tsconfig that includes test/, measured on the merged tree
files:
  - tsconfig.test.json
  - package.json
  - .github/workflows/ci.yml
  - test/helpers/vault.ts
  - test/helpers/obsidian-mock.ts
  - test/i18n/fixtures.ts
  - scripts/health-collect.mjs
started: 2026-08-31
finished: 2026-08-31
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Typecheck the test suite

## Evidence

`tsconfig.json` includes `src/**/*.ts` and nothing else, so `npm run build`'s
`tsc -noEmit` never read a line of `test/`. Vitest does not close that gap: it transpiles
through esbuild, which strips types without checking them. Neither does lint — the
type-aware Obsidian ruleset stops at `src/` by an `ignores` entry, and `eslint.config.mjs`
said the reason was that `test/` had no tsconfig to be checked against.

So the whole `test/` tree was unchecked, and this repository already knew it in two
places without connecting them. `src/i18n/t.ts` said "`tsconfig.json` covers `src/` only,
so a `test/` fixture is its author's problem". `test/helpers/releaseSettings.ts` said the
same thing as a post-mortem: four fields added to `ReleaseSettings` "arrived here as
`undefined` rather than as a build error", and `createRelease`'s duplicate-key guard read
two `undefined`s as one key spoken twice, so every creation threw. Both comments describe
a missing gate. Neither asked for one.

Measured: a `tsconfig` extending the shipped one with `test/**/*.ts` added, `lib` raised
to `ES2021` (the suite calls `String.replaceAll`) and `types: ["node"]` (it reads files),
reports **1193 errors across roughly 180 files, and 0 in `src/`**.

## Why it matters

Most of the 1193 are the doubles being doubles, and those are noise. What is underneath
them is not. Sorted from the list, the checks that were passing while saying something
that is not true:

- `test/domain/model.test.ts` called `displayType(item, settings)` at eight sites.
  `displayType` takes one argument. The second was evaluated and discarded.
- The same file called `childLevelIndex(bugfix, settings.levels)`. `BacklogSettings` has
  no `levels` — the ladder moved onto the item — so it passed `undefined` and the
  parameter's own default supplied the answer. The assertion held for a reason it did not
  state, which is the shape [[A comment that states a rule is not a check]] is about.
- `test/view/uiStateNoOps.test.ts`, in a case named *still reaches the view when the value
  actually changes*, wrote `view.setZoom(view.zoom === 'weeks' ? 'months' : 'weeks')`.
  `ScaleId` is `week | month | quarter`. The comparison could not be true, and the setter
  was handed a value outside its own union — twice, since `setShelfSort` had the same
  shape against `'rank'`, which is not a `ShelfSort` either.
- `test/view/columns.test.ts` called `rowContext` with three of its four arguments, at two
  sites, so the signature cache it measures was `undefined` both times.
- `test/domain/scoringModel.test.ts` called `modelProblems(model)` without `typeKey`;
  `test/docs/surfaces.test.ts` constructed the plugin without its manifest;
  `test/ui/prompts.test.ts` passed `selectSuggestion` a second argument it does not take.
- Two fixtures had fallen behind the shape they claim to be: a `ViewFolds` without
  `collapsedColumns`/`expandedColumns`, and a `LiveBacklogView` without `config`.
- `test/domain/writePlan.test.ts` imported `DropTarget` from `writePlan`, and
  `test/harness/perf.ts` imported `Projection` from `viewStateController`. Neither module
  exports the name — both are re-exported through the import chain, and only a checker
  reading `test/` can tell that apart from an export.
- Eight `@ts-expect-error` directives suppressed nothing. They were written against a
  configuration that never read the file they sat in.
- Twenty-four files imported `Menu`, `Modal`, `MenuItem`, `TFile` or `NullValue` from
  `'obsidian'`. Vitest's alias resolves that to the mock at run time; nothing resolved it
  at all at check time, so a test could name a static the real class does not have and a
  reader could not tell which class it meant.

## Approach

`tsconfig.test.json` extends the shipped config rather than replacing it, adds
`test/**/*.ts` beside `src/`, and is run by `npm run typecheck:test` — a step of
`npm run check` and of CI, both platforms. It is a second file rather than a widened
include because `src/` must keep its own `lib` and its own empty `types`: what ships is
held to the DOM and ES2020 the manifest's floor promises, and the test tree's `replaceAll`
and `node:fs` must not quietly become available to it.

A `paths` alias mapping `obsidian` to the mock was tried and rejected. It makes `tsc`
resolve the way vitest does, which sounds right and is not: one program cannot alias the
module for `test/` and leave it alone for `src/`, so `src/` typechecked against the mock
and produced 452 errors of its own. The imports were corrected instead — a file that means
the mock now says so.

Four edits in the helpers removed 972 of the 1193, and each is the rule stated once rather
than at the call sites:

- `FakeVault.app` goes through `asApp`, which returns `T & App`, so the fake passes where
  an `App` is asked for and keeps its own members visible to the test.
- The mock `TFile` and `TFolder` gained the members the app's carry and nothing here reads
  (`vault`, `children`, `isRoot`), `declare`d — no runtime cost, and a fake file is
  assignable where the real type is asked for.
- `FakeVault.entries()` returns `BasesEntry[]`, widening its deliberately-`unknown` planted
  values once.
- `FakeViewConfig`'s three readers return the types `BasesViewConfig` declares.

The remaining 221 were per-file, and two of them were duplication the check made visible:
nine hand-rolled marked-catalog builders became one `markedCatalog()` in
`test/i18n/fixtures.ts`, and three hand-written `ReleaseSettings` literals became calls to
the `releaseSettingsWith` helper that already existed for exactly them — the third being
the one whose own comment recorded the bug this task is about.

## Acceptance criteria

- `npm run typecheck:test` exits 0, and is a step of `npm run check` and of both CI legs.
- `npm run check` passes whole, with no coverage floor moved.
- All 4299 tests still pass, and every fix above is a corrected call rather than a
  suppression: no `@ts-expect-error` and no `any` was added.

## Outcome

Zero errors, and the three comments that recorded the gap now name the gate that closed
it. `test/helpers/releaseSettings.ts`'s "a field added to `ReleaseSettings` has to be
added here by hand" is now a check: the field fails `typecheck:test` until it is.

## What this does not do, and what is left

Stated rather than left to be discovered, since each is a place the new gate reads less
than it appears to:

1. **The doubles are widened, not verified.** `asApp` and the `declare`d members assert
   that the fake is an `App`; nothing checks that the parts of it the plugin actually
   calls behave like one. That is the same limit
   [[The fake vault can hold a cache Obsidian would not produce]] already records, and the
   widening makes it slightly easier to reach.
2. **`scripts/*.mjs` are JavaScript.** `allowJs` puts them in the program, so a test
   calling one is checked against whatever types the script's JSDoc carries — which for
   `health-collect.mjs` is now `rank`'s parameter shape and nothing else in the file. A
   script with no JSDoc infers `never[]` from an empty default and will keep doing so.
3. **Type-aware lint still stops at `src/`.** A tsconfig covering `test/` is what the
   Obsidian ruleset was said to be missing, and it is no longer missing; the ruleset stays
   off `test/` for the reason that was always the real one — the doubles exist to do what
   it forbids. Turning it on for `test/` is a separate decision with its own exemption
   list, not a follow-on from this.
4. **The suite's own escape hatches were not counted.** 340 `as never` casts sat in
   `test/` when this landed, and `never` satisfies every parameter — so the gate reads
   nothing at each one. Counted and mostly removed by
   [[Close the holes the test typecheck cannot see through]]; 101 remain.
5. **Nothing forces a new test directory into the include.** `test/**/*.ts` is a glob, so
   this holds by construction today; a suite moved outside `test/` would leave silently.
