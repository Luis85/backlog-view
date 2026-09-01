---
type: Task
order: 250
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-08-31
closed: 2026-08-31
source: a cast census over test/ after the typecheck gate landed, re-run with a corrected instrument
files:
  - eslint.config.mjs
  - test/helpers/view.ts
  - test/helpers/vault.ts
  - test/helpers/release.ts
  - test/helpers/roadmap.ts
started: 2026-08-31
finished: 2026-08-31
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Close the holes the test typecheck cannot see through

## Evidence

[[Typecheck the test suite]] got `test/` to zero errors and made `npm run typecheck:test` a
step of the gate. It did not ask what the suite was already doing to get around a checker it
did not yet have.

**302 `as never` casts.** `never` is assignable to everything, so each one is a place the new
gate reads nothing at all. Two shapes were most of them — **72 `<vault>.app as never`** and
**57 `view.model?.byPath.get('X.md') as never`**.

The first shape was already dead when it was counted. `FakeVault.app` became `T & App` in the
previous task, so the cast converts a value that already satisfies the parameter. Measured by
deleting every one of them from `test/commands/readme.test.ts` and running the gate: zero
errors. Same for `new FakeViewConfig({…}) as never`, dead since that class's readers were
given the types `BasesViewConfig` declares.

The second shape was never about a double. `byPath.get` returns `BacklogItem | undefined`,
and the cast said "this lookup cannot fail" — at the cost of turning a broken fixture from a
named error into whatever the function does with `undefined`.

**The first count was wrong, and the instrument is the finding.** `grep -o "as never"` was
used, and it matches inside *"w**as never**"* and *"h**as never**"* — words this codebase's
comments are full of. It reported 340 where there were 302, then 101 where there were 63.
`grep -oP "\bas never\b"` is correct because `as` in `was` has no word boundary before it,
and the two disagree by 38 on the tree that produced them. This is
**Measure a set with an instrument that can see all of it, and test the instrument first**,
in the middle of a task whose whole subject is a count. The numbers in this note and in the
pull request that carried the first half were corrected rather than left standing.

## Approach

Both mechanical shapes are deletions. The dead `.app` and `FakeViewConfig` casts go with
nothing in their place. The lookups go through `itemAt(view, path)` in `test/helpers/view.ts`,
which throws `no item loaded: <path>` — a local copy already existed in
`test/view/cardDrag.test.ts`, so this is that function moved to where its other callers can
reach it. `vault.fileAt(path)` is the same idea for `files.get(…) as never`.

What was left after those was classified one by one, and each answer is the rule stated once
rather than at a call site:

- **The plugin double** (8 sites). `captureRegistrations` returns `Plugin & { registerBasesView }`
  now, widened in the helper that makes it.
- **`row(view, path)`** took `ReleaseView` and read only `view.viewEl`; it takes what it uses,
  and the caster stopped casting.
- **The `ReleaseHarness`** hands back the `FakeVault` it was built over, instead of one caller
  digging it out of `view.app.vault` and casting it back. That also collapsed a 55-line clone
  between `test/helpers/estimation.ts` and `test/helpers/release.ts` to 9.
- **A drag payload** was being forced past `CardSource` to set two of its five fields; it is
  built whole.
- **Six casts stay, and they are the point of their tests**: a stored value whose type the
  reader must survive (`42`, `'yes'`), and a message parameter deliberately absent. Each now
  says so in a comment, so the next census reads them as subjects rather than leftovers.

**302 → 6.**

## What the census could not see, and the check that can

A grep finds the casts that exist. `@typescript-eslint/no-unnecessary-type-assertion` finds
the ones that are *pointless*, including spellings a census would not think to look for — and
it holds for casts not yet written, which is
**A category invariant is checked at the forbidden thing**.

It could not run before: the `test/**` block set `languageOptions: { parser: tsparser }` with
no `parserOptions`, and the project service reads `tsconfig.json` by name — which covers
`src/` only, so every test file came back "not found by the project service". Pointed at
`tsconfig.test.json`, the rule reports **48 unnecessary assertions**, all fixed.

**The whole Obsidian ruleset was measured here too and declined.** Enabled over `test/` it
reports 212 findings, and 164 are the doubles doing what they exist to do —
`no-nodejs-modules` at a suite that reads files, `prefer-create-el` at the DOM helper that
DEFINES `createEl`, the five `no-unsafe-*` rules at every fake. Nine exemptions to buy 48
findings, and all 48 come from one rule that costs no exemptions at all. So one rule is on and
the ruleset stays off, which is the same answer [[Typecheck the test suite]] left open with a
different reason: not "there is no tsconfig" any more, just the doubles.

One site has the two gates contradicting each other, and the compiler is right:
`vault.create` is an INTERSECTION of two call signatures, which no single stub satisfies, and
the rule reads only the first. Suppressed at that line, named, and left as the one to look at
if a second appears.

## Duplication in `test/` was never measured

`npx fallow --explain-skipped` says it: **272 files skipped, matching `**/*.test.*`** — a
built-in default nobody in this repository chose. Only the helpers were ever measured, which
is how the 55-line clone above was visible at all.

Measured with `duplicates.ignoreDefaults: false`: **454 clone groups**, against 9 with the
default. The widest is **16 instances of the same 8 lines** — mounting a `ProductBacklogView`
over a `FakeVault` and a config by hand, in `contextCardWrites`, `contextRowWrites`,
`contextRows`, `menu`, `shelfUx` and `assignee` — which is `makeView` written out longhand at
sixteen sites.

**The default stays, and this paragraph is where it says why** — `.fallowrc.json` is JSON and
takes no comment, which is exactly the case the register exists for. 454 findings is not a gate anyone
acts on, and a shared fixture couples the tests that share it, which this register already
argues against. What the number is good for is naming the one extraction worth doing, and that
16-instance group is it — left for its own change rather than folded into a cast census, since
it alters what six suites drive.

## Acceptance criteria

- `npm run check` passes whole, no coverage floor moved, all 4299 tests passing.
- No `as never` is added and no `any` replaces one that is removed; the one suppression is at
  a line, names the contradiction, and is not a rule turned off.
- The counts in this note are reproducible with `grep -rhoP "\bas never\b" test/ --include=*.ts`.

## Outcome

`as never` in `test/`: **302 → 6**, and the six are the ones whose tests are about them.
48 further assertions removed by the rule that now looks for them on every run. Duplication
reported by `npm run analyze` fell 237 → 181 lines as a side effect of the harness change.

`timelineRows` was two different functions in two files — model rows in `src/domain/bars.ts`,
DOM rows in `test/helpers/roadmap.ts` — which fallow reports as a duplicate export. The test
one is `timelineRowEls` now.

## What is left

1. **`scripts/*.mjs` are still unchecked at the boundary.** *(Closed by
   [[A declared member is a bet, and one was lost]].)* Eight of them are imported by
   tests, exporting 31 functions between them, and **one** carries a `@param` — the one added
   in the previous task because a fixture inferred `never[]`. Every call into the other 30
   lands on an implicit `any`, so `typecheck:test` reads nothing there. `--checkJs` over
   `scripts/` reports 253 errors, which is a project rather than a follow-on; type a script's
   boundary when a test needs it, as `rank` did.
2. **The 16-instance mount clone**, above.
3. **The doubles are still widened rather than verified** *(one instance found and fixed in
   [[A declared member is a bet, and one was lost]]; the wider question stands)* — unchanged from
   [[Typecheck the test suite]], and `asApp` plus `captureRegistrations` are two more places
   asserting a shape nothing checks behaves like the real one.
