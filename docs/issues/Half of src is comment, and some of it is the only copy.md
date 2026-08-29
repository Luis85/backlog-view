---
type: Issue
parent: "[[Codebase health]]"
order: 90
status: Open
priority: P2
area: docs
created: 2026-08-10
source: maintainer request, 2026-08-10 — "cut the comment essay, cut to rule 7"
files:
  - src/view/host.ts
  - src/view/render/toolbarFit.ts
  - src/ui/manualDialog.ts
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

# Half of src is comment, and some of it is the only copy

## What was asked

Cut the essay-length comments out of `src/`, keep a short what-and-why at each module,
and let the register hold the reasoning — "cut to rule 7", rule 7 being the one that
already requires every module to be specified in a use case's `## Where it lives` or an
ADR's `## Decision`.

This note records the measurement and the one constraint that stops it being a
straightforward cut. It does not do the pass.

## The measurement

Counted over every `.ts` under `src/`, blank lines excluded:

| | |
| --- | --- |
| Comment lines | **9533** |
| Code lines | 11300 |
| Comment share | **46%** |
| Blocks of 15+ consecutive comment lines | **105** |

The densest files, by comment lines:

| File | Comment / code | Share |
| --- | --- | --- |
| `src/domain/settings.ts` | 453 / 396 | 53% |
| `src/view/render/timeline.ts` | 421 / 369 | 53% |
| `src/view/interactions/cardDrag.ts` | 298 / 231 | 56% |
| `src/domain/writePlan.ts` | 292 / 275 | 51% |
| **`src/view/host.ts`** | **289 / 121** | **70%** |
| `src/storage/frontmatter.ts` | 284 / 376 | 43% |

And the longest single blocks:

| Lines | Where |
| --- | --- |
| 109 | `src/view/render/toolbarFit.ts:40` |
| 94 | `src/ui/manualDialog.ts:174` |
| 40 | `src/view/interactions/cardDrag.ts:386` |
| 39 | `src/view/render/rows.ts:210` |
| 38 | `src/view/render/toolbarBusy.ts:106` |

`max-lines` skips comments, so none of this fails lint. Nothing here is a gate violation;
it is a question about where the prose should live.

## The constraint: it is a MOVE, not a cut

Rule 7 requires a module be **named** in a use case's `## Where it lives`. That is a
pointer, not the rationale. So "the register holds the reasoning" is true of some of these
essays and false of others, and the difference decides whether cutting destroys anything.

Both cases are already on the shelf, checked rather than assumed:

- **Already in the register.** `toolbarFit.ts`'s 109-line block explains the fit ladder —
  and [[A toolbar that fits one row]] independently states the `overflow: clip` behaviour
  and the "every control a step removes is still reachable, from step 2 onward" rule. Cut
  that block and nothing is lost that a reader cannot find.
- **The only copy.** `src/view/host.ts` is 70% comment, 289 lines of it, and the whole
  register says one thing about the file: *"holds no runtime code, so imports stay
  cycle-free"* in [ADR 0003](../adrs/0003-four-layers-enforced-by-lint.md)'s
  `## Decision`. That single line satisfies rule 7. Cutting the other 289 would satisfy
  rule 7 too, and delete the only written account of what that interface is for.

So the pass is **write-to-the-register first, then cut** — never cut and trust that rule 7
covered it. Rule 7 is satisfied by a mention; it was never a promise that the reasoning is
recorded somewhere.

## The argument against doing this at all, stated fairly

This codebase's comments are unusually load-bearing, and its own guide is why. `CLAUDE.md`
asks that an invariant be stated where it binds, that a refused alternative be recorded so
nobody re-proposes it, and that a rule be written as a rule rather than a list. Much of
the 46% is exactly that: `styles/index.css` explaining which import positions are
load-bearing, `frontmatter.ts` stating the absence-is-a-value rule in the three shapes it
takes, `pickAndRefocus` naming its carve-out as a category after a list-shaped version
went stale twice.

Those comments have paid for themselves repeatedly, including during the work that
produced this note — several defects were caught because the reasoning sat beside the
code. A pass that treats comment volume as the defect will cut them.

The honest framing is therefore not "the comments are too long" but **"some of this prose
is in the wrong place"**: rationale that a reader needs while changing the code belongs
beside it; rationale about why the design is what it is belongs in the register, where it
can be linked, superseded and found without opening a module.

## What a pass should do

1. **Triage before cutting.** For each block over ~15 lines, decide which of three it is:
   an invariant that binds the code beside it (keep), a design rationale the register
   already holds (cut, and check the register really holds it), or a design rationale
   nowhere else (move to the register, then cut).
2. **Do it per file, not repo-wide.** A 46%-to-something diff across 76 modules is
   unreviewable, and this repository has just been reminded that a large mechanical pass
   hides the one edit that mattered.
3. **Take `host.ts` first.** It is the extreme case, its 289 lines are the clearest
   instance of "only copy", and it is small enough that the move is legible.
4. **Do not add a length cap.** A blunt maximum would fight the comments that earn their
   length, and this register already has [[Guides that describe rather than enumerate]]
   for the shape of the rule that would actually help.

## Acceptance criteria

- A triage exists for every 15+ line block: keep, cut, or move.
- No block is cut whose reasoning is not demonstrably in the register — demonstrated by
  the link, not by rule 7 being satisfied.
- Each file's pass is its own reviewable change.
- The comment share is recorded again afterwards, so the next reader knows what the pass
  actually bought.
