---
type: Task
order: 130
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P2
area: testing
created: 2026-08-02
source: PR
files:
  - test/docs/surfaces.test.ts
  - test/view/rendering.test.ts
  - src/domain/settings.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Read the vocabulary instead of reciting it

## Evidence

Specifying a seventh type name ([[Milestones as their own type]]) broke **six** documents
that had written the vocabulary's length down rather than derived it — four requirements
and two ADRs:

| Where | What it said |
| --- | --- |
| [[Type names are data]] | "one of the **six** shipped spellings"; "only the six names this plugin ships get a label" |
| [[What counts as a work item]] | "declares one of the **six** types" |
| [[Types beside the ladder]] | "the vocabulary is fixed at **six** names" |
| [[Where new items are filed]] | the six `typeFolder` keys, listed |
| [[Help for finding work]] | "one of the **six** the plugin declares" |
| ADR 0013 / ADR 0014 | titled for six names; the extra types listed by hand |

None was wrong when written. Each was found by a reviewer rather than by a check, one per
round, over ten rounds.

The same defect is **inside the gates**. `test/docs/surfaces.test.ts` exists precisely
because a regex over source can be fooled — it calls `getViewOptions()` and reads what the
code actually produces. Then it checks the generated per-type keys against a list typed by
hand:

```js
for (const type of ['epic', 'feature', 'pbi', 'task', 'issue', 'bug']) {
    expect(keys).toContain(`typeFolder.${type}`);
}
```

So the half that asks the code is derived and the half that states the expectation is
recited. A seventh name's `typeFolder.milestone` is simply not asserted to exist: if the
schema generated its options over `LEVELS` and `EXTRA_TYPES` instead of `ALL_TYPES`, that
type would ship with **no folder picker** and this suite would stay green. The sibling
test in the same file does not cover it either — it checks that every key which *exists*
is named by a requirement, which says nothing about a key that never appeared.

`test/view/rendering.test.ts` is the counter-example, in the same repository and about the
same vocabulary: it walks `ALL_TYPES` and asserts each badge got an icon and a colour. That
is why the badge table is the one seam a seventh name **cannot** slip past — the test reads
the list, so adding a name adds a case.

## Why it matters

A gate that recites the thing it is checking has stopped being a gate: it agrees with
whatever it was told once, and the failure is silent, which is the mode this feature's
review found ten times and no check found once. The register already holds the general
version of this — [[A comment that states a rule is not a check]] — and this is its
executable twin: **a test that hardcodes what the code derives is a comment with an
assertion around it.**

The cost is not hypothetical. Six documents needed amending on one specification PR, and
the only reason each was caught is that a reviewer read the note beside the change. The
vocabulary is deliberately fixed and therefore deliberately *rare* to change, which makes
this worse rather than better: the next name will land years from now, against notes
nobody remembers pinning.

## Approach

Ordered, because the first step is what makes the rest checkable.

1. **Derive the per-type assertion.** Replace the hand-written list in
   `test/docs/surfaces.test.ts` with `ALL_TYPES`, asserting one `typeFolderKey(type)` per
   name — importing the same helper the schema uses, so the test cannot spell a key the
   code does not.
2. **Assert the count agrees**, so the loop cannot pass vacuously: the number of generated
   `typeFolder.*` keys equals `ALL_TYPES.length`. A derived loop over an empty list is the
   failure mode that replaces a hardcoded one.
3. **Sweep the register for the recited form.** `six`, `seven`, and the enumerated key
   lists — the six documents above are the known set, and the sweep is for the ones nobody
   has hit yet. Rewrite each to name the source (`ALL_TYPES`) rather than its length, which
   is what was done to all six under [[Milestones as their own type]] and is the pattern to
   apply, not to re-decide.
4. **Consider gating it.** `docs-check.mjs` could refuse a requirement that spells a count
   of the vocabulary. This is step 4 and not step 1 deliberately: it needs a rule precise
   enough not to fire on prose that legitimately says "six" about something else, and if
   that rule cannot be written cleanly, steps 1–3 still stand on their own.

## Acceptance criteria

- The per-type key assertion in `test/docs/surfaces.test.ts` derives from `ALL_TYPES` and
  uses `typeFolderKey`; adding a name to the vocabulary adds a case with no edit to the
  test.
- That assertion fails when the option schema generates keys for fewer than every declared
  name — verified by planting it, the way this repository verifies its other gates.
- No requirement states the vocabulary's length. Where one needs to talk about the set, it
  names `ALL_TYPES`.
- If step 4 lands, `npm run docs` rejects a requirement that recites the count, and the
  rejection is driven from `test/docs/checkerRejects.test.ts` with the legal forms it must
  still accept in `checkerAccepts.test.ts`.

## Progress (2026-09-02)

Steps 1 and 2 are done — `test/docs/surfaces.test.ts` loops `ALL_TYPES` through
`typeFolderKey` and asserts the generated keys cover it, minus `RELEASE_TYPE`. Step 3 is
done for the register: all five requirements named above already name the set rather than
its length, and ADR 0013 gained an amendment that states `ALL_TYPES` as the source and
declares itself finished with counts. The two remaining recited copies in `test/view/`
are closed by [[Derive the type folders the fixtures clear]], which also measures the
whole candidate set — 25 hits from an AST walk, 2 defects, 21 correct by design, 2 left
with a stated reason.

**Open on step 4 alone**, the `docs-check.mjs` rule, which the Risks below argue against
attempting cheaply.

## Risks

The sweep in step 3 is the part that can go wrong quietly: a note that says "six" about the
levels-plus-extra-types split may be making a *true* statement about a category rather than
a stale one about the vocabulary — [[Types beside the ladder]] is exactly that case, where
the category is the contract and the count was the incidental part. Rewriting such a note to
say `ALL_TYPES` would lose the distinction the note exists to draw. Read each one for what
it is claiming before generalising it.

Step 4 carries the opposite risk: a gate that fires on prose. "Six" is a common English
word, and a check that cannot tell the vocabulary's count from any other is one contributors
will learn to work around, which is worse than not having it.
