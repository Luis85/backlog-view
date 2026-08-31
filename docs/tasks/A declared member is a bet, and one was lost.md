---
type: Task
order: 270
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: verification
created: 2026-08-31
closed: 2026-08-31
source: a walk over src/ for every member the test doubles only declare
files:
  - test/helpers/vault.ts
  - test/helpers/obsidian-mock.ts
  - scripts/docs-markdown.mjs
  - scripts/health-collect.mjs
  - scripts/coverage-floors.mjs
started: 2026-08-31
finished: 2026-08-31
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A declared member is a bet, and one was lost

## Evidence

[[Typecheck the test suite]] and [[Close the holes the test typecheck cannot see through]]
both closed with the same open item: **the doubles are widened, not verified.** Four helpers
now assert "this fake is the real type" — `asApp`, `captureRegistrations`, `FakeQueryResult`,
and the `declare`d members on the mock `TFile`/`TFolder` — and nothing checks the parts the
plugin actually calls.

`declare` is the mechanism under all of them. It emits no runtime code, so the member
satisfies the compiler and does not exist at run time. Each one is therefore a **bet that
`src/` never reads that member**, and the comments beside them said the bet was safe because
"a module that starts reading one fails loudly instead of finding a silent stub".

**That sentence is false, and it hid a live instance.** A `declare`d member reads as
`undefined`. Nothing is loud about `undefined`; it fails wherever it lands, and where it
lands may be a truthiness test that quietly answers no.

The walk that found it is one line per member — the `declare`d names on both doubles,
each looked for in `src/`:

```bash
grep -rhoP "^\s*declare \w+" test/helpers/obsidian-mock.ts test/helpers/vault.ts
```

`children`, `getEvaluatedFormula`, `getSummaryValue`, `groupedData`, `parent`,
`properties`, `vault`. Six are unread by `src/`. **`groupedData` is not.**

## The instance

`detectIgnoredGrouping` in `src/view/render/toolbarStatus.ts` reads `data?.groupedData` —
it is the whole mechanism behind the toolbar's "Grouping ignored" advisory.
`FakeQueryResult` only declared it, so in every test the value was `undefined`, `!groups`
was true, and the function returned `false` on the no-grouping path.

The three cases that drive the advisory therefore could not use the double at all. They
assigned `view.data` by hand through `(view as unknown as { data: unknown }).data = {…}` —
which is precisely the mount-injection cast [[The mount injection was a cast nothing needed]]
had just removed from thirty-three other sites, left standing here because the double could
not express the one field these tests needed.

So the widening had produced the thing it was meant to prevent: a member the plugin reads,
absent from the fake, and a cast at every call site that needed it.

## Approach

`groupedData` is a real constructor field on `FakeQueryResult` now, defaulting to `[]`, and
`setResults(view, entries, groups?)` takes it. Twelve `as unknown as { data: unknown }`
casts across seven files became `setResults(…)` calls — the three grouping cases plus nine
more that were re-delivering a result set for an unrelated reason and had the same cast to
hand.

`properties` and `getSummaryValue` stay declared, and the comment now says what that
actually buys: nothing in `src/` reads either **today, checked rather than assumed**, and a
module that starts to will find `undefined` rather than an error. Every comment that
promised a loud failure was narrowed to say so — **write the guarantee to the check, never
ahead of it**, which is the rule this note is an instance of rather than an exception to.

## The script boundary, closed in the same pass

The other open item from [[Close the holes the test typecheck cannot see through]]: eight
`scripts/*.mjs` are imported by tests and carried **one `@param` between their 31 exports**.
Every other call landed on an implicit `any`, so `npm run typecheck:test` read nothing at
that boundary.

The 19 exports tests actually call are typed by JSDoc now, and only those — an export no
test reaches gains nothing. `--checkJs` over `scripts/` reports 253 errors and stays a
project of its own.

**It bit twice while being written**, which is what a boundary type is for:

- `test/verification/coverageFloors.test.ts` built its `measured` fixture as `number[]`
  where `floorReport` destructures `[covered, total]`. An inferred array promises neither
  element exists.
- The first `architecture` doc demanded `caps`, `coverage` and `fallow`, none of which that
  function reads — the shape came from a grep window that ran past the end of the function
  into `modules`. The compiler rejected the real fixture, and the doc was narrowed to
  `layers`. The same class of mistake as the previous task's own miscount: not a wrong
  answer, a wrong **window**.

Checked in both directions before committing: `headings(42)` fails the gate, and removing it
returns to zero.

## The remaining escape hatches, classified rather than swept

The last open item was the leftover casts. Counted with word boundaries, because the
instrument matters here twice over — `grep "as any"` reports four and three of them are the
words *"the same as any other"* in prose, exactly the family of miscount the previous two
tasks each made once:

- **`as any`: one, now none.** `registerBacklogView.test.ts` reached a view's `applySafely`
  through the widest hatch there is; it names that one method's type instead.
- **`as unknown as Record<string, unknown>`: 11 → 7.** The four in
  `estimation/openNote.test.ts` widened a whole workspace to a bag of unknowns to assign
  `getLeaf`; they go through a helper that names that member. The seven left patch
  `HTMLElement.prototype` in `test/helpers/dom.ts` and set `window.__pbl` in the browser
  harness — a prototype IS a bag of unknowns, and no narrower type is honest.
- **The 12 inline shapes stay.** `as unknown as { render(): void }` and its siblings reach
  past a class's public surface to spy on one method, which `eslint.config.mjs` says the
  harness exists to do. Each names exactly the member it reaches, which is the narrowest
  form the reach can take.
- **The six `as never` stay**, commented, for the reason
  [[Close the holes the test typecheck cannot see through]] gives: each is the subject of
  its own test.

Classifying and declining is the finished state of this item, not a skipped one.

## Acceptance criteria

- `npm run check` passes whole, no coverage floor moved, 4299 tests passing.
- No `as unknown as { data: unknown }` remains in `test/`.
- Every `declare`d member on a double is one `src/` does not read, and the comment beside it
  claims no more than `declare` delivers.

## What is left

**The bet is still a bet.** Nothing gates it: the walk above is a command in this note, not
a check that runs. A rule cannot be written as a grep, because `.vault`, `.children` and
`.properties` are ordinary words in `src/` on receivers that have nothing to do with these
doubles — 26, 53 and 0 hits respectively, and only a type-aware reading could tell which
receiver each belongs to. **Re-run the walk by hand before adding a `declare`d member**, and
treat a hit as this note's instance rather than as noise.

The wider question — whether the parts of the fake the plugin *does* call behave the way the
app does — is unchanged and belongs to
[[The fake vault can hold a cache Obsidian would not produce]], which already records three
instances of it and needs a live vault rather than a check. Nothing here closes that, and it
is not claimed to.
