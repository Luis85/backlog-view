---
type: Issue
order: 540
parent: "[[Resource Management]]"
status: Done
priority: P3
area: view
created: 2026-08-29
source: user request, PR
files:
  - eslint.config.mjs
started: 2026-08-29
finished: 2026-08-29
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The label bypass rule sees a fifth of its own sentence

`RESOURCE_LABEL_BYPASS` (`eslint.config.mjs`) was added to stop a resource's bare basename
standing where the collision-aware label belongs. Its comment opened by stating the whole
naming rule and then described a selector that refuses two spellings of it — so a reader
who ran lint green had been told more than the check delivers, which is this codebase's own
"write the guarantee to the check, never ahead of it" broken at the rule that exists to
enforce a different one.

## What was measured

Two instruments, both run 2026-08-29 on the merged tree, because a grep for one spelling is
how the original count came to be wrong:

- **The set.** An AST walk over `src/` for every read of `.basename` or `.title` — 102 of
  them, receiver printed as written, so an aliased read is in the list rather than missed.
  Eleven read a RESOURCE's own name or title. Every one is a place raw is correct: the
  roster's own definition and its sort, `namedTargets` itself, the two `domain/` functions
  that ARE the label lookup, the two `??` fallbacks in `view/`, `New resource...`'s
  duplicate-warning list, and the notice for a note created a moment ago. Zero sites in
  `src/` today should be using the label and are not.
- **The reach.** A throwaway probe file planted under `view/` carrying eight spellings of
  one resource's name, then deleted. The rule flags three — the two banned shapes, one of
  them inside a template — and goes past `.title`, `TFile.name`, an aliased read, a
  differently named local, and a read through a callback parameter.

## Decision: narrow the sentence, do not widen the rule

Widening it to `.title` on the same two identifiers was tried against that measurement and
refused with the numbers rather than by argument. It gains no true positive, costs two
false ones — `cardMoves.ts`'s release announcement and `dependencies.ts`'s prerequisite
list, both `target.title` on a `BacklogItem` — and still misses the one real `.title`
resource read in `view/`, whose local is named neither `resource` nor `target`. `.basename`
is safe to ban on those two names because only a `TFile` has one; `.title` is a
`BacklogItem`'s commonest field, so the same ban fires on items far more often than on
resources, and a rule exempted more often than it holds is one a reader learns to switch
off.

So the selector is unchanged and its comment and both messages now say what it delivers: two
spellings, five named misses, and that passing it is not evidence the name reads apart. What
would catch the next miss is the category test the comment already points at — two same-named
resources driven through every naming surface — not a wider selector.
