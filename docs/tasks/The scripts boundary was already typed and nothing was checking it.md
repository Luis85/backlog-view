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
