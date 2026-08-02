---
type: Issue
order: 110
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: verification
created: 2026-08-02
source: PR #47 — ten review findings across five rounds, counted afterwards
files:
  - src/view/interactions/menu.ts
  - src/view/backlogView.ts
  - src/view/interactions/outcome.ts
---

# A comment that states a rule is not a check

## The limitation

This codebase writes its rules down in comments, at length and on purpose. That is
worth doing and it is not verification: **in PR #47, six of ten review findings were
places where a comment nearby asserted the opposite of what the code did.**
Not vague comments — precise ones, naming the exact invariant that was being broken.

| The comment said | The code did |
| --- | --- |
| *"the checkmark asks the same question the write plan asks … so the menu can never show an entry as current that picking would rewrite"* | compared values instead of asking the plan, so `Unplaced` rendered checked on a note whose key still held an unreadable value — picking it wrote |
| *"a Bases update arriving mid-batch is rebuilt … which is before the await below resolves"* — in the same function | armed the outcome watch **after** that await, so the one pass that could answer had already run |
| *"cover both ways a note can leave: the filter dropping it, and 'Show completed items' swallowing one"* | one sentence naming the filter for both |
| *"never blames the write for a filter the user typed"* (the rule the report was designed around) | held only for the render path; a filter typed before the data pass still blamed the move |
| *the write plan's own note that "from Unplaced to Unplaced" would be nonsense for a real change* | announced exactly that |
| *"bounded by construction … each move's own response is the pass that finally reaches it"* | assumed every data pass belongs to a queued write; an edit in another pane produces one too |

The pattern is not carelessness in any single case. It is that **a comment is written
once, beside code that was correct when it was written, and then nothing re-reads
them together.** Every one of these was true of the code at the moment the comment was
typed, and stopped being true one edit later — usually the edit that added the second
caller, the second property, the second projection.

## Why it is deliberate

The comments stay. The alternative — writing less down — loses the reasons, and the
reasons are most of what makes this repository navigable: every one of the six was
*findable* precisely because the rule was stated somewhere to contradict. A reviewer
with no comment to read has to derive the invariant before noticing it is broken.

The register already draws this line for its own notes:

> a checker can see whether a heading is present, never whether the paragraph under it
> says anything.

The same limit applies one layer down, to source comments, and it is worth naming there
too: `npm run check` will read every line of a comment and verify nothing in it.

## What would lift it

Nothing general — there is no checking a paragraph against a function. What is
available is narrower and did work, from round two onward:

1. **An invariant asserted in a comment gets a test that fails without it.** Every fix
   in rounds two through five shipped with one.
2. **Prove the test fails.** Revert the fix, run the test, watch it fail, restore. Done
   for all six later fixes; two of them turned out to assert less than they read as
   until that check forced the fixture to be sharpened.
3. **Read the comment above the line you are editing before you edit it**, and treat a
   contradiction as the finding rather than as prose to update. Four of the six were
   introduced *while implementing the fix for the previous one*, which is exactly the
   moment nobody re-reads the surrounding paragraph.
4. **A comment asserting something is impossible is the one to distrust most.** The
   sharpest case was not a stale comment but a confident one: "the menu can never show
   an entry as current that picking would rewrite" was written as a guarantee, and the
   code beside it had never provided it. The last row of the table is the same shape —
   "bounded by construction" was an argument, not a property.

Step 2 is the one worth insisting on. It is the same argument
[[Plant a corpus the register gate runs against]] makes for the docs gate and
[[Enforce and colocate invariants]] makes for the lint rules — a check nobody has
watched fail is a check nobody has tested — applied to the ordinary tests a feature
ships with.

## Impact

Six defects, all caught in review, none shipped. The cost was five review rounds on
one pull request, and the honest reading is that review did the job a check could not:
this note exists so that the next person writing a confident comment knows it buys
nothing on its own.

## Acceptance criteria

None as a gate — there is nothing to gate, which is the point of filing this as a
limitation rather than as work. The four habits above are the whole content, and they
are recorded here rather than in `CLAUDE.md` because a rule about how to verify rules
belongs beside the evidence that it was needed. `CLAUDE.md` carries habit 1 alone, where
someone writing a test will meet it.
