---
type: Task
order: 340
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: tooling
created: 2026-09-02
closed: 2026-09-02
source: re-measuring the small residue of the test-suite census, on the merged tree
files:
  - test/helpers/cssVars.ts
started: 2026-09-02
finished: 2026-09-02
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The last cast census, re-measured with three instruments

## Evidence

The residue after [[Close the holes the test typecheck cannot see through]] was carried as
three small numbers: **5 `as any`, 24 non-null assertions, and a private type leak in
`test/harness/perf.ts`**. Re-measured on the merged tree, **none of the three is what it
said**, and the three errors are three different kinds.

| Carried | Measured | What the gap was |
| --- | --- | --- |
| 5 `as any` | **0** | every hit is the English phrase, in a comment |
| 24 non-null assertions | **301** | the earlier instrument saw a fraction of them |
| 1 leak in `test/harness/perf.ts` | **0** | fixed since; the 20 that remain are all in `src/` |

## The `as any` count is zero, and the instrument was already the careful one

`grep -rhoP "\bas any\b"` reports 3. Word-bounded, so it does not repeat the `as never`
mistake — and tested on a known input, `"it was any of these"`, which it correctly does not
match.

All three are still false. They are prose:

- `test/helpers/cssVars.ts` — "no name a partial READS may be declared **as any** CSS-wide keyword"
- `test/view/linkDrag.test.ts` — "a fresh `dnd` registration per row, same **as any** other render pass"
- `test/view/iterationHidden.test.ts` — "the same **as any** other card the axis could not place"

**A word boundary fixes a token that is a substring of a word. It does not fix a token that
is also a phrase**, and this repository writes long comments, so every census over it meets
the second problem after fixing the first. The reading here is by hand, at three sites,
which is affordable exactly because it is three.

## The non-null count is 301, and the instrument is the compiler's

`!` cannot be grepped: it is one character, and it is also negation, `!==`, `!`-prefixed
JSX, and a `!` inside every string in the tree. So the count came from the rule that
actually parses:

```bash
npx eslint test --rule '{"@typescript-eslint/no-non-null-assertion":"error"}' -f json
```

**301**, across about sixty files — twelve times the number carried, which is a difference
in kind rather than in freshness. A dated count is re-measured; a count off by an order of
magnitude means the instrument was answering a different question.

## Nothing is swept, and this is the argument

301 is not the small tidy the residue was filed as, and the shape they take says the sweep
would not pay:

```ts
expect(containerEl.querySelector('.pbl-est-table')!.getAttribute('role')).toBeNull();
view.viewEl.querySelector<HTMLButtonElement>('.pbl-rel-collapse')!.click();
flipped.dimensions.find((d) => d.id === 'reach')!.lessIsBetter = true;
```

Each is a test saying *this exists, or the test is meaningless*. The claim is true or the
test fails either way — what the `!` costs is the message: `Cannot read properties of null`
at a line, rather than a named selector. That is a real but small loss, and it is paid only
on a test that is already failing.

**Compare it with what the same census's other findings cost.** An `as never` read nothing
at the gate; a `declare`d member answered `undefined` and moved a failure somewhere else
([[The bet a declared member makes is loud now]]); a broken fixture behind
`byPath.get(…) as never` produced a confusing crash instead of a named error. None of those
is true of a `!` on a selector: the assertion is checked at run time by the very dereference
that follows it.

So this is left, deliberately and with the number written down — the register's own
[[A rule chased past the mistakes it prevents]] is the case, and 301 mechanical edits across
sixty files to improve a message on an already-red test is on the wrong side of it.

## What would change the verdict

A `!` in a HELPER rather than in a test — `test/helpers/` has its own callers and a null
there fails in somebody else's file, which is the accessor case `itemAt` and `fileAt` were
extracted for. Two of the 301 are in `test/helpers/fixtures.ts`. If a third arrives, extract
rather than assert.

## Acceptance criteria

- Every number above is reproducible by the command beside it, and each instrument was run
  on a known input before its output was believed.
- No code changed. This is a measurement and a decision.
