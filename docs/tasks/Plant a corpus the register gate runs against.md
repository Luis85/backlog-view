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
  - scripts/docs-check.mjs
  - test/helpers/register.ts
  - test/docs/checkerAccepts.test.ts
  - test/docs/checkerRejects.test.ts
  - test/docs/checkerRejectsAdrs.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
3. Both directions, as three files. `test/docs/checkerAccepts.test.ts` plants legal forms
   the register does not itself use and expects green;
   `test/docs/checkerRejects.test.ts` and `test/docs/checkerRejectsAdrs.test.ts` plant the
   violations that were previously prose and expect each to be named. The ADR rules are
   split off because they alone outnumber every other group in the gate.
4. **One planted case per report site**, enumerated from the gate rather than chosen — see
   the Outcome for why that had to be checked mechanically instead of claimed.

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
- **Cost.** Each case spawns a process. The three suites together run in a few seconds,
  against a test run that already takes longer than that.

## Outcome

Legal forms accepted, violations named, every one passing on the first run — which is the
honest result and a mild disappointment, since the sweep found no new defect in the gate.
What it produces is the thing the Issue asked for rather than a bug: the plantings now
re-run.

**No case totals here on purpose.** The first draft of this section gave them per file,
and they were wrong within the same pull request: the ADR cases moved to their own suite
and fourteen more were added, so a reader auditing the coverage claim against those
numbers would have been auditing against fiction. That is the drift
[`docs/README.md`](../README.md) deleted its epic counts for, arriving in the note written
about verification — which makes it the cheapest possible evidence that the rule was
right. The inventory is `npm run test`; the only number stated anywhere is the report-site
count, and that one is stated **in a test that fails when it drifts**.

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
handling from `docs-check.mjs` entirely left every accept case green.

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

### Coverage, and three attempts to measure it

Review's last finding was that the file claimed *"a rule quietly removed from the gate
fails here"* while covering only the rules that happened to have a case. `ADR_AREAS` was
the example and a good one: every fixture used `area: tooling`, and so does every record
in the real register, so deleting that check left the suite **and** `npm run docs` green.

Enumerating the gate found **45** report sites, of which 31 were covered. The other 14 are
now planted, and the ADR rules moved into their own file — they alone outnumber every
other group.

Then the claim had to be established rather than asserted, and this is the part worth
keeping. **The first two measurements were both wrong, in opposite directions:**

| Attempt | What it did | What it would have "proved" |
| --- | --- | --- |
| 1 | Mutated with `gsub(/\bfail\(/…)` in awk, where `\b` is a **backspace**, not a word boundary | No mutation ever landed, every run tested a pristine gate, and all 45 sites reported *uncovered* |
| 2 | Fixed the regex, but left the new site-count test in the run — it fails on **any** mutation | Every site would have reported *covered*: "uncovered: NONE", indistinguishable from success |
| 3 | Excluded the count test, and asserted two preflights first | Measured: all 45 sites turn the suite red |

The third attempt is the only one that proves anything, and the difference is the two
preflights: **a pristine gate must pass, and a known-covered rule must turn it red**,
checked before any result is believed. Attempt 2 is the more instructive failure — it
would have printed exactly what success prints.

That is five vacuous verifications in this task, counting the two review found. The
pattern is consistent and worth naming: the artifact kept getting built and its existence
treated as the evidence. The check that caught every one of them is a single question —
*if this were broken, what would it print?* — and it is now written into
`checkerAccepts.test.ts` as the instruction for adding a case.

The sweep does not re-run; it was a one-off. What re-runs is a test pinning the number of
report sites, so a rule added to `docs-check.mjs` turns the suite red until somebody
plants a case for it. That is the same trade the register made when it deleted its
hand-maintained counts: a fact worth trusting is one that fails when it drifts.

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
