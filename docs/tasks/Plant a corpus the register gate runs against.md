---
type: Task
order: 10
parent: "[[The gate is tested only against invalid documents]]"
status: Done
priority: P2
area: verification
closed: 2026-08-01
created: 2026-08-01
source: 2026-08-01 pass over the open issues — the gate was 544 lines with no test
files:
  - docs-check.mjs
  - test/helpers/register.ts
  - test/docs/checkerAccepts.test.ts
  - test/docs/checkerRejects.test.ts
---

# Plant a corpus the register gate runs against

## Evidence

`docs-check.mjs` is 544 lines, runs in `npm run check` and in CI, and had **no test of its
own**.

Every rule in it was verified by planting the violation and watching the check reject it —
the method that found two dozen holes — and every one of those plantings was recorded as
prose. [[The gate is tested only against invalid documents]] counted **eleven** commits to
the file after it was filed, none of which added an executable check, and narrowed itself
to exactly that: the corpus proving the last widening correct existed only as a Markdown
table describing a run somebody once did.

Its acceptance criterion names the shape: *"the spellings already planted by hand are
captured somewhere that re-runs: a fixture corpus of legal forms the register does not
itself use, asserted green."*

## Why it matters

The gate asks one question well — *does an invalid document fail?* — and the Issue is
about the other one. A false pass is found by someone hunting for holes. A false failure
is found by someone who was doing something else, and their likely response is to change
the **document**: *CI is red on a link I just wrote; fine, I will write it the other way.*
The bug then survives as a rule nobody can state.

That is not hypothetical here. `[the filter](<The quick filter on the board.md>)` was
rejected once, because the destination capture stopped at the first space and resolved
`<A slice.md>` to a file called `The`. Angle brackets are Markdown's sanctioned way of
putting a space in a link destination and **every note in this register has spaces in its
filename** — the one correct way to write that link was refused, and the register only
missed it by percent-encoding everywhere.

## Approach

1. Run the **real script as a subprocess** over a throwaway tree, rather than refactoring
   it into something importable. `docs-check.mjs` is a script — top-level await, paths
   relative to the working directory, `process.exit` for its verdict — and it exists to be
   right about a directory on disk. A seam built for the test would be the thing tested;
   this way the file under test is the one `npm run docs` executes. `test/helpers/register.ts`
   owns the tree, the run and the parsing of the report.
2. One valid corpus, with **every case a single delta against it** — so a failure names a
   rule rather than a document. The tree carries `src/` and `test/` as well as `docs/`,
   because the gate's last rule reads them.
3. Both directions, as two files. `test/docs/checkerAccepts.test.ts` plants legal forms the
   register does not itself use and expects green; `test/docs/checkerRejects.test.ts` plants
   the violations that were previously prose and expects each to be named.

## Acceptance criteria

- The corpus itself is asserted green before anything is asserted about a variation of it —
  otherwise an accept case is unprovable and a reject case can pass for the wrong reason.
- Every legal form the Issue lists is covered: angle-bracket destinations, `*` and `+`
  bullets, trailing whitespace after a heading, a `.base` file beside a note, a nested
  folder.
- The planted violations name a specific message, not merely a non-zero exit.
- Breaking a rule in `docs-check.mjs` makes this suite fail.

## Risks

- **A suite that passes because it never ran the gate.** Answered by the last criterion,
  and it was executed rather than reasoned about — see the Outcome.
- **Cost.** Each case spawns a process; 50 cases run in about three seconds, against a
  suite that already takes longer than that.

## Outcome

50 cases: 15 legal forms accepted, 35 violations named. Every one passed on the first run,
which is the honest result and a mild disappointment — the sweep found no new defect in
the gate. What it produces is the thing the Issue asked for rather than a bug: the
plantings now re-run.

**The teeth were checked rather than assumed.** Two rules were broken in `docs-check.mjs`
and the suite re-run:

| Rule broken | What failed |
| --- | --- |
| The end-anchor on a heading match (`## Contextual` satisfying `## Context`) | the reject case for the prefix hole |
| The angle-bracket destination form, restored to the historical single capture | **both accept cases for it**, and a reject case whose message changed |

The second is the defect the Issue calls the most expensive one in the file: a valid
document refused. It was reproduced, the suite caught it, and the file was restored. A
first attempt at that mutation was wrong in a way worth recording — it made the capture
group always match, so every link resolved to the empty string and was skipped, and the
accept cases stayed green while a reject case went red. A mutation that does not reproduce
the bug proves nothing about the test, and the shape of the failure is what said so.

### The suite's own version of the bug it was written about — twice

Review found both, which is the right outcome and an uncomfortable one. The second is
recorded first because it is the smaller and makes the shape obvious: the case named
*"accepts an angle-bracket destination carrying an anchor"* used
`](<A slice.md>#outcome)`, which is not that link. A bracketed destination **ends at
`>`**, so the anchor was invalid trailing content and CommonMark reads no link there at
all. It passed because the gate skips to `)` with `[^)]*` — so the case asserted that the
checker tolerates a *malformed* link while its name claimed a legal one. Removing anchor
handling from `docs-check.mjs` entirely left all sixteen cases green.

The first is the same shape and worse. Every accept case
asserts an **empty problem list**, and the list is parsed out of the gate's report — so a
run that died before printing one contributes exactly that. Green would have meant "the
gate said nothing", which is what acceptance looks like and equally what a crash looks
like. Thirteen of the fifteen cases went through a helper that read the problems and
discarded the exit code.

That is this file's own subject one level up: a check passing for a reason nobody
intended. It is also the more dangerous direction, because the corpus is *meant* to be
green — a crash would have been invisible for as long as the fixtures stayed valid.

Closed in two places rather than one. `checkRegister` now **refuses to return** a run that
exited non-zero without reporting, so a new call site cannot reopen it by omission; and
`expectAccepted` asserts the exit as well as the list, so the claim is stated where it is
made. A case plants the crash directly — a tree with no `src/`, which makes `collectTs`
throw — and removing either guard was checked to fail it.

**The generalisation is the part worth keeping.** Every case in the accept corpus asserts
an *absence* — no problems — which is the weakest thing a test can claim, because almost
anything produces it. Building the corpus is no protection against writing a vacuous case
into it, and the corpus cannot catch that class in itself: both defects were found by a
reader, not by a run. So the file now states the check that does catch it, as an
instruction for adding a case rather than as a rule anything enforces: **break the rule the
case is named after, and watch that case fail.** If it stays green it is testing something
else. That is a hand check, and saying so is more honest than implying the suite is
self-guarding — this is the same limit `docs/README.md` already states about the register,
arriving one level down.

What this does **not** do is close the enumeration: the constructs worth covering come from
Markdown, and the Issue is right that enumerating them exhaustively is the trap this
checker keeps falling into. The corpus is the forms someone has thought of, held where the
next person can add to them.

One case earns its place from a different Issue. A bare `parent:` on an ADR — the key with
nothing after it — is an absent field to a reader that wants a value and an explicit root
to `resolveParent`, so the prohibition *"an ADR carries no `parent`"* once passed for the
one form of the mistake that needs no typo at all. That is the divergence
[[The checker reads frontmatter its own way]] is about, and it is now pinned as a test
asserting it is the **only** problem the document produces, rather than as a paragraph
describing a bug that was fixed once.
