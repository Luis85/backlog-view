---
type: Feature
parent: "[[Codebase health]]"
order: 40
status: Done
area: docs
created: 2026-08-03
closed: 2026-08-03
started: ""
finished: ""
horizon: ""
start: 2026-08-03
due: 2026-08-14
risk: ""
assignee: Ben
---

# Guides that describe rather than enumerate

The guides a contributor reads first say what each layer is *for* and which rules bite
there. Nothing in them is a list of the code, because a list of the code is wrong the
moment the code moves.

**Outcome** — A guide is either true or it fails a check; no reader has to wonder whether
the file they are reading has kept up with the tree beside it.

## Landmines, before implementation

The two use cases below pull in opposite directions and the order matters, because the
first one removes the thing the second one currently leans on.

**Re-anchor the rule first, then delete the table** — the two PBIs below are ordered
10 then 20 for this reason and not for reading order.
`docs-check.mjs` rule 7 — every module in `src/` is named by a note — used to justify
itself *by* the module table: *"the architecture table names one per concern, so a module
nothing describes is a real gap."* Running
[[A guide is prose, not an inventory]] first would have taken the table away while rule 7
still cited it, leaving the gate green on a reason that no longer exists — the exact
defect this feature is about, introduced by the change meant to remove it.
[[A module is named where it is specified]] is what gave the rule a reason of its own, so
it went first: both landed on 2026-08-03, in that order.

**The quiet seam: the table's deletion is safe only because rule 7 survives.** The
argument for deleting the table is that the fact it carries — every module is described
somewhere — already exists once and is already gated. Delete both in one pass and nothing
guarantees a module is described at all. So these two are one change in two steps, never
one step, and never the first without the second.

## Acceptance criteria

- No guide under `src/`, `test/` or the repository root enumerates the modules.
- Every module in `src/` is named where it is *specified*, and `npm run check` says so.
- The four layer guides are unchanged by this work — they are already the shape, and
  changing them to match a new rule would be churn rather than progress.

## Where it lives

`CLAUDE.md` · `docs/README.md` · `docs-check.mjs` · `test/docs/checkerAccepts.test.ts` ·
`test/docs/checkerRejects.test.ts`
