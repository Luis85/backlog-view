---
type: Bug
parent: "[[The model build states its cost as a check]]"
order: 20
status: Open
area: performance
priority: P1
created: 2026-08-10
source: Measured in the browser harness's `?perf` mode, against a user report of an ~800-note folder-mode vault
files:
  - src/domain/model.ts
  - test/harness/perf.ts
---

# The model build is superlinear past a few hundred notes

## What happened

A vault of roughly 800 notes, deriving its hierarchy from subfolders, is sluggish. The
harness's `?perf` mode reproduces it without Obsidian. Medians of five, in Chromium,
tree expanded:

| notes | rows | update (build + render) | render only | build, by subtraction |
| --- | --- | --- | --- | --- |
| 0 | 32 | 24 ms | 22 ms | ~2 ms |
| 200 | 232 | 156 ms | 148 ms | ~9 ms |
| 800 | 832 | 1226 ms | 536 ms | **~690 ms** |

The render is linear and unremarkable: 3.6× the rows costs 3.6× the time (148 → 536 ms).
The **build is not**. The same 3.6× increase in rows costs it roughly seventy times as
much, which is the shape of something worse than O(n log n) — and it is paid on every
data update, so a write batch ends in it too.

The flat layout pays it as well but less: at 800 notes, `update` is 770 ms against a
516 ms render, so ~254 ms of build. Folder inference roughly triples that, which makes the
reported vault the worst case rather than an unusual one.

## What it is not

Not the test double. `FakeVault.getFirstLinkpathDest` was a linear scan until this was
measured, and was indexed first precisely so these numbers could be trusted — the vault's
remaining lookups (`getAbstractFileByPath`, `getFileCache`) are map reads.

Not the two costs already checked, either. [[One vault read per note, one sort per item]]
holds `getFileCache` to one call per item and `Array.sort` to one group per item, and it
passes. Whatever is superlinear here is a phase neither spy watches — which is the gap
that PBI's own guide sentence admits when it says what the check cannot reach.

## Where to look

Unknown, deliberately: this note records a measurement, not a diagnosis, and guessing at
`buildModel`'s phases from a reading of the source is how the wrong one gets optimised.
The next step is a profile, which the harness now makes cheap — the page is a URL and
devtools does the rest.

## How to check

```
npm run harness
```

then open the printed URL with `?fixture=folders&notes=800&perf`. The panel reports the
rows above. `?notes=200` and `?notes=0` give the other two lines, and dropping `fixture=`
gives the flat comparison.

That instrument reports; it asserts nothing, and no check in this note's fix may assert on
elapsed time — the refusal [[The render path states its costs as checks]] and
[[The model build states its cost as a check]] both make, and ADR 0020's fourth.

## Lesson

**A cost claim can be true at every call site and still be false about the whole.** Both
of this layer's checked properties hold at 832 rows, and the layer is a second and a half
slow anyway. Counting the calls someone thought to count is not the same as knowing what
the phase costs, and nothing here could see the difference until something could generate
a backlog big enough to ask.
