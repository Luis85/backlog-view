---
type: Task
order: 70
parent: "[[One file per concern]]"
status: Open
priority: P2
area: refactor
created: 2026-08-15
source: measured after the row reconcile landed (ADR 0029)
files:
  - src/view/render/rows.ts
  - eslint.config.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Split the row renderer

## Evidence

`src/view/render/rows.ts` measures **395 effective lines** — `skipBlankLines`,
`skipComments`, the counting `max-lines` uses — against the 400-line cap every `src/` file
is held to. **Five lines.** The next change to row rendering meets the cap before it writes
anything, which is the same position [[Split the view dispatch hub again]] recorded for
`backlogView.ts` and is a different file with a different seam: that task is Done and its
cuts were all in `backlogView.ts`.

The growth is recent and it is one subject: the reconcile ([ADR
0029](../adrs/0029-reconcile-rows-by-signature.md)) added the reuse walk to this file, and
the delegation before it added the pane's row and chip listeners. Both landed in the same
increment.

[[Lift empty states out of rows]] is this same file at this same cap on 2026-08-01,
**Done** — 392 counted lines then, and the empty states moved to
`src/view/render/emptyStates.ts`. That seam is spent; the file grew back through it and
past it in two weeks of work.

## Why it matters

A cap forces a split only while there is somewhere to go. This is the tree's hot path —
`RowContext` exists so per-row work stays proportional — so the next projection, column
kind or chip meets this file whether it wants to or not, and meets it with the two bad
options a full file always offers: shave something nearby, or leave the real change
undone. Both have already happened once each on `backlogView.ts`.

## Approach

Deliberately not prescribed — the two closed tasks above both landed on better seams than
their own evidence pointed at. Read the file fresh. Three subjects share it today:

- **The delegation** — `wireRowEvents`, `wireChipEvents`, `CHIP_ACTIONS`, `fromRowControl`,
  `foldOnClick`, `rowItem` and `itemForEvent`. It arrived whole in this increment and is
  one stated subject: the pane carries one listener set and resolves the row or item per
  event. It is also the seam with a lint consequence — see Risks.
- **Building a row** — `buildRow`, `renderRowLead`, `renderRowTrailing`, `renderBadge`,
  `renderTitleText`, `renderChevron` and `disclosureButton`. The largest block, and the one
  with the most callers outside this file.
- **The reconcile walk** — `renderTree`, `renderForest`, `renderItem`, `childGroupEl` and
  the three small helpers around them. One subject with an ADR behind it, but it is what
  `renderPass.ts` calls and its comments hold invariants no type does (see Risks).

## Acceptance criteria

- `src/view/render/rows.ts` has real headroom under the cap — enough that the next
  increment does not immediately meet this task again. The empty-state split bought about
  sixty lines; less than that is worth arguing for rather than assuming.
- The split follows a named seam a reader can point to, not a line-count cut.
- Every comment that states an invariant moves with the code it is beside, and the lint
  regions that name this file by path move with it too.
- `npm run check` green, with no test rewritten to match the new shape rather than to keep
  asserting the same behaviour.

## Risks

**`ROW_LISTENER` names files, not functions.** `eslint.config.mjs` bans `addEventListener`
across `ROW_CONTROLS` — `render/rows.ts`, `render/columns.ts`, `render/chips.ts` — with the
delegation's own calls as named exemptions in this file. Move the delegation to a new file
and the ban stops applying to it: the exemptions would no longer be needed, and a per-row
control wired there next year would not be caught. Whatever file the delegation lands in
has to join `ROW_CONTROLS`, and the rule's message, which names `wireChipEvents in
render/rows.ts`, has to follow it.

**The reconcile walk's rules are held by comments.** That a claimed row also needs its
`ctx.rows` entry, that the empty states fire after the reuse decision and before anything
prunes, that a row's group is read off the previous element before anything moves — each is
a comment beside the line it governs and not a type. A split that moves any of them moves
the comments verbatim, and passes `test/view/rowReuse.test.ts` with no assertion touched.
