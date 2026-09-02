---
type: Task
order: 410
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-09-02
closed: 2026-09-02
source: "[[The harness's variable guard says nothing about element defaults]], the cheaper half it sketched"
files:
  - test/harness/vendoredCoverage.test.ts
  - test/harness/obsidian.css
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Name the vendored sheet's gaps instead of guessing them

## The claim, re-derived first

[[The harness's variable guard says nothing about element defaults]] says nothing asserts
`test/harness/obsidian.css` stays **complete** or **current**. It was worth checking
whether that had quietly been fixed — `test/harness/themeStub.test.ts` reads that file in
two of its tests, at the lines the prompt for this pass pointed at.

**It has not.** Both of those tests read `obsidian.css` as the REFERENCE set for a question
about the other file: *never restates, in the stub, a declaration app.css already makes for
that selector*, and *styles nothing in the stub but the harness's own furniture*. Both ask
whether `theme.css` duplicates or overrides app.css. Neither asks anything about app.css's
own coverage. **The note is not stale**, and this is the evidence.

What HAD landed since it was written is one of the four names it lists: `.modal-container`
is in the vendored sheet now. `.modal-bg` is drawn by nothing at all. `.modal-title` and
`.modal-content` are exactly as the note left them.

## The cheaper half, built

The note sketched its own smaller instrument: *comparing the selectors the vendored sheet
defines against the elements and classes the harness actually puts on the page would not
catch staleness, but it would have named `.modal-title` and `.modal-content` as
drawn-but-unstyled without anyone reading the CSS.* That is
`test/harness/vendoredCoverage.test.ts`, and it names both — plus four the note never did.

It mounts the `edges` fixture under `?phone`, expands the tree, drives all four
projections, all three roadmap axes, the shelf and focus knobs and all three dialogs, and
collects every class that is not `pbl-*` **after each of those states** — see the review
correction below for why the word "each" is load-bearing. Which classes count as Obsidian's is
a RULE and not a table: the view's stylesheet dresses only its own prefix, so anything else
was written by the mock, by `dom.ts` or by app.css.

**21 Obsidian classes drawn; 6 with no rule reaching them** (2026-09-02):
`.extra-setting-button`, `.mod-dim`, `.modal-content`, `.modal-title`,
`.setting-item-control`, `.setting-item-info`.

### The instrument was wrong first, and it looked right

Its first run reported **zero** gaps over a page wearing three classes. Two causes, both
silent: `openWantedDialog` was called with the wrong arity inside a `try`, so no dialog
ever opened, and the projection clicks threw into the same swallow. A green "no gaps" over
a page that had drawn almost nothing is precisely the shape this register keeps recording
— an instrument that answers plausibly about a set it never measured. Fixing the call and
widening the drive took it from 3 classes seen to 21. That is why the committed check
asserts a FLOOR on the drawn count and pins `.modal-title` present: a rewrite that stopped
seeing dialog markup cannot leave it green.

**Watched failing**: deleting `.setting-item-name` from the vendored sheet's shared
typography rule turns the check red naming it, on a suite nobody edited.

### And review found it reaching less than it claimed (PR #254)

The first committed version collected classes ONCE, after every state had been driven,
and the section above already claimed it measured "across all four projections, three
axes, the knobs and the three dialogs". It did not. A projection switch replaces the DOM,
so a class only the board or the roadmap draws is gone by the time the catalog is up, and
what was actually measured was the last state plus whatever the dialogs left behind. The
axis loop was worse: it ran after the switch to the catalog, so `setAxisPick` re-rendered
the catalog three times and the three axes drew nothing at all.

Measured both ways over the identical drive: per-state collection sees **21** classes,
end-only sees **20** and misses `.mod-cta`. The six unstyled names do not change — they
are the dialogs', which persist — so the FINDING survived, and the GUARANTEE did not.
This is the second time this instrument answered plausibly about a set it never measured,
and the first time was in this same file.

Fixed by collecting after each rendered state and switching back to the roadmap before
the axis loop. The floor assertion is now pinned at 21 and `.mod-cta` is pinned present:
end-only collection fails on both, which is what was watched.

### And CI found the budget, not the logic (PR #254)

Green locally, red on BOTH `verify` legs: `Test timed out in 5000ms`. Not a flake and not
platform-specific — the drive costs ~2.4s here and 303 files share one runner there.

Timed with `performance.now()`, because the first attempt used `Date.now()` and read every
phase as **0ms**: the suite freezes `Date` (`test/helpers/clock.ts`, `toFake: ['Date']`),
so the obvious clock is the one instrument that cannot measure this. Renders are the whole
cost — mount, expand and the two knobs are 1.3s between them, each projection or axis
switch ~150ms, and the ten collections ~8ms each.

**Not trimmed to fit**, and that was measured rather than assumed: dropping the expand and
the knobs saves 45% and loses no class today. Applying it would have been the wrong lesson
— this check exists to catch what ARRIVES, so a state left undriven is coverage traded for
seconds, and the next Obsidian-classed element on the shelf would go unseen. The budget was
what was wrong, so the budget moved: 30s.

### And the sentence that reported the budget got its own count wrong (2026-09-02)

This section said *"on the only test in the suite that carries one"*, and the comment in
the test said the same. **There were four**, and the instrument is again the finding.

The grep was `}, [0-9]\{4,\});` — which cannot match `}, 20_000);` or `}, 30_000);`,
because the numeric separator breaks the digit run. It matched exactly one of the four
timeouts present (`test/docs/markdown.test.ts`'s `120_000`… which it also missed; what it
actually matched was nothing, and the "one" was this file's own, read by eye). So the
answer *"no precedent"* is what licensed writing the sentence, and the sentence was the
new claim. **A false count inside the sentence claiming to have counted** is the defect
this whole pass was about, met one paragraph after being written up.

Re-measured with a TypeScript AST walk over `test/**/*.ts` — every numeric literal and
every `{ timeout }` object argument to `it`, `test`, `describe` or `bench`, through
`.each` / `.skipIf` / `.concurrent` chains. **Tested on a known input first**: a planted
file spelling all five of those shapes, each one reported. What it still cannot see is a
timeout passed as a named constant, which nothing in `test/` does today.

| | |
| --- | --- |
| per-test timeouts | **4** — `renderCost` and `contextRowWrites` at 20s, `docs/markdown` at 120s, this at 30s |
| file-wide | **1** — `test/helpers/register.ts`'s `vi.setConfig({ testTimeout: 20_000 })` |

The same walk found a **second** false count, in that helper: its own doc comment said
*"every case in the five files that import this"*, and seven files import it. Both are
corrected, and both are the same failure — a count written once and read as current
afterwards. The comment here now names its instrument and says the list is dated rather
than maintained, which is the only version of this sentence that cannot go wrong again in
the same way.

(`test/verification/scriptBoundary.test.ts` added a **second** file-wide one on the same
day — see [[The scripts boundary was already typed and nothing was checking it]]. It was
briefly a fifth per-test timeout instead, and CI is what corrected that: its census case
was left on the 5s default and went over on both legs, which is this file's own episode
repeated by the person who had just written it up. The case was made ~6x cheaper first
and only then given a budget, and the budget went file-wide because a timeout repeated
per case is one a third case forgets.)

## What was refused

**Filling the six gaps.** Every one is a real defect in what the harness draws — the
dialog's title reads unstyled and its content pane does not grow to its frame. Writing
rules for them means guessing app.css's values, and `test/harness/theme.css`'s own header
records what that costs: a guessed baseline beside a real one is two answers to one
question, and it is how `.clickable-icon` sat overriding app.css's real padding and hover
colour for weeks. Filling them is a re-derivation against a local Obsidian install, which
cannot run here. **The list in the test is the finding, not the rule** — what the rule buys
is that a seventh arrives loudly.

## What this does not reach

Stated in the test as well as here, because a check that reads wider than it looks is the
defect this repository keeps finding in itself:

- **Staleness.** The note's other half, untouched. A vendored rule whose value a newer
  app.css has changed is styled, and passes. There is no lifting that without an Obsidian
  to compare against.
- **Element defaults with no class.** A bare `<button>`, `<input>` or `<select>` is
  invisible to a check that reads `classList` — and a missing `button` rule is the very
  episode the parent note was filed about. Classes are what a page can be asked for
  cheaply; tag coverage has to first decide which of jsdom's every-element it cares about.
- **Whether a matching rule APPLIES.** A class token is looked for anywhere in a selector,
  so `.foo` styled only under an ancestor this page never nests it in reads as styled.
  jsdom computes no specificity and no layout.
- **A state no committed knob reaches.** The vendored sheet keeps what the harness was
  DRIVEN through; this inherits that limit exactly. Gestures, failure states and
  configuration variants draw classes nothing here asks for.

## What is left

[[The harness's variable guard says nothing about element defaults]] stays **Open**, at
P3, on the half this does not lift — nothing notices when Obsidian changes a default the
vendored file still states at the old value. Its second-instance section can be read as
answered: the drawn-but-unstyled question is now asked by a check rather than by reading.
