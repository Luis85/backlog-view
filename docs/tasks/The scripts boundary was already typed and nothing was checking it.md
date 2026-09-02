---
type: Task
order: 420
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
created: 2026-09-02
closed: 2026-09-02
source: "[[Close the holes the test typecheck cannot see through]], its first open follow-up, re-measured"
files:
  - test/verification/scriptBoundary.test.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The scripts boundary was already typed and nothing was checking it

## The claim, re-derived first

[[Close the holes the test typecheck cannot see through]] left this as its first
follow-up: *eight of them are imported by tests, exporting 31 functions between them, and
**one** carries a `@param`. Every call into the other 30 lands on an implicit `any`, so
`typecheck:test` reads nothing there.*

**That is no longer true, and re-deriving it was the whole of the work.** Measured on the
merged tree at `db137c16`, 2026-09-02:

| | |
| --- | --- |
| exported functions of `scripts/*.mjs` named in a test's `import { … }` | **23**, across 8 scripts |
| of those, carrying a typed `@param` for **every** parameter | **23** |
| gaps | **0** |

So there was nothing to add. The note's "30 on implicit `any`" was true when it was
written and was quietly paid off, function by function, by whoever wrote each one — which
is exactly the state this parent Feature exists to refuse. A convention held by care is
a convention the next export inherits nothing from.

## The instrument, and the blind spot it had first

A TypeScript AST walk in two passes: every `import` declaration in `test/**/*.ts` whose
specifier ends `scripts/<name>.mjs`, collecting its named bindings; then each named
script parsed for `export function` declarations and `export const` arrows, each
matched against `@param` tags carrying a `typeExpression`.

**Its first run reported two gaps that are not gaps** — `docs-markdown.mjs`'s `prose` and
`proseWithSpans`, both of which carry `@param {string} text` and always have. The walk
read `fn.parent?.jsDoc`, and a comment above `export const prose = (text) => …` attaches
to the **VariableStatement**, two nodes above the arrow function, not to its parent
`VariableDeclaration`. `ts.getJSDocTags(fn)` is the API that walks that chain and is what
the committed check uses. Reading the two functions was what caught it, not the count —
the count was internally consistent and wrong, which is the shape this register keeps
recording. It is also why the committed check pins `prose` present by name: a rewrite
that reintroduced the same blind spot would find 21 functions and report zero gaps.

Spellings the corrected instrument still cannot see, enumerated rather than assumed:

- **A namespace import** (`import * as md from '…mjs'`) or a dynamic `import()`. Neither
  appears in `test/` today; both would be invisible.
- **A script spawned rather than imported.** `docs-check.mjs` and `perf.mjs` are reached
  that way on purpose (`test/helpers/register.ts` says why), and a subprocess has no call
  site to type.
- **An export that is not a function declaration or an arrow** — a class, an object of
  functions, a re-export. Skipped rather than counted as a gap.
- **Whether the type is RIGHT.** `@param {object}` satisfies this check and constrains
  nothing.

## The half that was worth building

A typed `@param` is worth nothing unless the compiler enforces it, and *"`allowJs`
without `checkJs` carries JSDoc types to the call site"* is a claim about TypeScript that
this repository had never asked TypeScript. So the check asks it: a probe file compiled
under the options `tsconfig.test.json` resolves, containing three wrong calls into
`headings`.

**Watched failing, and the watch is what corrected the claim.** The first experiment
deleted `{number}` from `headings`'s `[depth]` parameter. The census went red naming
`docs-markdown.mjs#headings` — and the enforcement probe **stayed green**. `depth = 2` has
a default, so the compiler infers `number` from the initializer and the JSDoc was never
load-bearing on that parameter. Deleting `{string}` from `text`, which has no default and
no other inference source, is what drops a diagnostic and turns the probe red.

So the three assertions are three different mechanisms, and only one of them is what the
census buys:

| call | rejected because of |
| --- | --- |
| `headings(42, 2)` | the `@param {string}` — **this is the guarantee** |
| `headings('ok', 'two')` | the parameter's own default, with or without a `@param` |
| `headings()` | arity, which `allowJs` checks with no annotation at all |

Stated in the test as well as here. A boundary function whose every parameter is
defaulted gains nothing from being documented, which the census cannot tell from one that
does.

Restored from a copy saved outside the repository, not with `git checkout`, per the
standing rule.

## And review found the census agreeing with itself (PR #256, round 1)

The committed check counted typed `@param` tags and compared the total to the arity:
`typed === params`, no gap. **Two errors cancel in that comparison**, and Codex's review
named the pair — a tag duplicated or misspelled for one parameter, another parameter with
none. `2 === 2`, no gap reported, and the untagged parameter an `any` at every call site
in `test/`.

**Reproduced before it was fixed**, on `headings`: two `@param {string} text` tags,
`depth` undocumented, **both tests green**. The probe stayed green too, and for the reason
this note already gives — `depth` has a default, so the compiler infers it either way,
which is precisely why the census cannot be the only thing looking.

This is the rule this pass was handed, met inside the check written to enforce it:
**deriving an assertion from the same shape as the thing under test makes it agree by
construction.** A total is that shape. `ts.getJSDocParameterTags(parameter)` asks each
parameter for its own tag instead, and the gap list now names the parameter rather than
the function.

Watched failing on the same planted input, which now reports
`docs-markdown.mjs#headings(depth)`.

`health-collect.mjs`'s `rank` is the one destructured parameter here, and the fallback
that covers it was measured in both directions rather than taken from the API's
documentation: **renaming** its tag from `sources` to `notSources` leaves the check green
(so the match is by POSITION, not by name), and **removing** the tag turns it red. A
per-parameter check that silently reported every destructured parameter as a gap would
have been the opposite failure and just as invisible.

The third assertion in the non-vacuity guard came from the same round: the parameter
COUNT the walk inspected, which the aggregate version had no way to assert, and which is
what fails if a rewrite stops reading parameters at all.

## What was refused, and on what evidence

**`checkJs`, in every spelling.** The parent note measured 253 errors over the whole of
`scripts/` and called it a project. Re-measured here against only the six scripts a test
imports: **217 errors**, and **no single file is clean** —

| | errors under `checkJs` |
| --- | --- |
| `coverage-floors.mjs` | 11 |
| `health-collect.mjs` | 11 |
| `docs-markdown.mjs` | 21 |
| `health-scatter.mjs` | 41 |
| `health-charts.mjs` | 44 |
| `health-sections.mjs` | 89 |

That is the number that settles the cheaper variant too: `// @ts-check` at the top of one
file is the native, no-new-code way to get `noImplicitAny` reporting an undocumented
parameter, and it needs a file that is otherwise clean to be adoptable. There is none. So
the check is a test, which is rung seven rather than rung four, and the measurement above
is why.

**Adding `@param` to the exports no test imports.** They exist — the census covers the
boundary as it is USED, not every export in `scripts/`. Typing a call site nothing calls
buys the same nothing `checkJs` would, at the same cost per function.

## What is left

The three ways past the check, above. None is reachable from `test/` today; the check
names each in its own header so a future `import * as` is a known hole rather than a
silent one.

## And CI found the budget, the same way it did one file over (PR #256, round 2)

The probe case was given 20s and the census case was left on vitest's 5s default. Green
locally at ~0.8s, **red on both CI legs**: `Test timed out in 5000ms`, with 304 files
sharing one runner and the whole run taking 285s there against 166s here.

That is `test/harness/vendoredCoverage.test.ts`'s own episode, repeated in the branch that
had just written it up — and the correction to its comment was on screen while this test
was being written. Worth recording as evidence rather than as a fix: knowing a hazard by
name did not stop it, because the budget was set on the case that LOOKED expensive (a
`ts.Program`) rather than measured on both.

**Made cheaper before it was raised.** The census parsed all 342 files under `test/`;
the specifier it matches ends `scripts/<name>.mjs`, so a file whose text lacks that
substring cannot hold one — a necessary condition, not a heuristic. Filtering on it parses
17 files instead of 342: **~800ms → ~130ms**, read with `performance.now()` because the
suite's `Date` freeze reports every phase as 0ms.

The budget then went **file-wide**, one `vi.setConfig({ testTimeout: 20_000 })` in
`test/helpers/register.ts`'s spelling and for its stated reason: it is a fact about what
the file does, and a timeout repeated per case is one a third case forgets. So the
per-test count in the repository stays at four and the file-wide count goes to two.
