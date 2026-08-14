---
type: Task
order: 10
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P2
area: tooling
closed: 2026-07-31
created: 2026-07-31
source: PR #14 maintainability review
files:
  - CLAUDE.md
  - eslint.config.mjs
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Enforce the invariants that can be enforced, co-locate the rest

## Evidence

`CLAUDE.md` is 317 lines. The **"Invariants that bite" section is 135 of them — 43%** —
as a flat list of 46 bullets.

## Why it matters

That section is the single most valuable artefact in the repository and its largest
point of rot. Prose drifts from code silently; nothing fails when it does. It is also
re-read in full on every agent turn, and a flat 46-item list is past the length where a
human reads it before touching the code.

Two of these invariants have already been converted into checks, and both paid for
themselves immediately:

- The layer DAG → per-directory `no-restricted-imports`.
- "Never write frontmatter outside the writer" → `no-restricted-syntax` banning
  `processFrontMatter`, `vault.create` and `load/saveLocalStorage` outside `storage/`.

**Every invariant that becomes a check is one that can never rot.** That is the lever.

## Approach

### 1. Enforce what is enforceable

Candidates, in order of value:

- **"Never derive levels from depth"** — `no-restricted-syntax` on `.depth` arithmetic
  outside `domain/model.ts`. Note this currently *would* flag `computeTypeChanges`; fix
  [stop-deriving-levels-from-depth](Stop%20deriving%20levels%20from%20depth.md) first.
- **"Data operations use `realRoots`, not `roots`"** — harder, but a rule banning
  `model.roots` inside `domain/writePlan.ts` would cover the paths that matter.
- **Test file size** — see [split-the-view-test-suite](Split%20the%20view%20test%20suite.md).

### 2. Co-locate the remainder

`src/` is now layered, so invariants can sit with the layer they govern: the context-row
rules with `domain/`, the render-cost rules with `view/render/`. `CLAUDE.md` keeps the
cross-cutting ones and an index, and stops being a single wall.

### 3. Prune what is now structural

Some entries describe defences that are now enforced in code (`applySafely` refusing a
whole batch, the write boundary). Those can shrink to one line naming the mechanism
rather than arguing the case.

## Acceptance criteria

- At least one further invariant converted from prose to a failing check.
- "Invariants that bite" materially shorter, with nothing lost — moved, not deleted.
- Each remaining bullet still says *why*, not just *what*; the reasoning is the part
  that stops someone undoing it.

---

## Outcome

**Enforced.** Two invariants became lint rules, both green on arrival:

- `showAtMouseEvent` is banned everywhere except `view/interactions/menu.ts`, so a menu
  opened from a focusable button must go through `showMenuForClick`. This one had
  already shipped as a bug once.
- `model.roots` is banned in `domain/writePlan.ts` and `view/interactions/create.ts` —
  the two files that rank — so ranking runs over `realRoots` and never over the
  synthetic focus forest.

Both were verified by introducing the violation and watching lint reject it.

The config was restructured to make that safe, and the first attempt got it wrong in a
way worth recording. Flat config sets a rule *wholesale* per file: a narrower block
replaces the wider one's options rather than adding to them. Composing each block from
"the shared selectors plus its own" fixed that for files with extra rules — but the
blanket block also carried `ignores: ['src/storage/**']`, there to exempt `storage/` from
the *write boundary*, and the menu rule was riding in the same block. So `storage/`
silently lost the menu rule too, and a rule documented as universal was not. Caught in
review on #17.

`src/` is now partitioned into four regions that cannot overlap, each naming every
selector that applies to it: everything-else, `storage/` (the writer, so no write
boundary — but the menu rule still applies), `interactions/menu.ts` (makes the anchoring
decision, so exempt from that alone), and the two ranking files. Adding a region means
removing its files from the one it came out of; adding a selector means asking which
regions want it.

Each region is verified by hand — plant the violation, watch lint reject it — including
the one that started this: `processFrontMatter` in `menu.ts` still fails despite
`menu.ts` having a block of its own.

**Not enforced, and why.** The depth rule from the plan above stays blocked. A blanket
ban on `.depth` would be wrong: `rows.ts` uses it for `aria-level`, where visual depth is
the correct answer. Scoped to `domain/writePlan.ts` it would flag exactly the known
offender, so it waits on
[stop-deriving-levels-from-depth](Stop%20deriving%20levels%20from%20depth.md). The selector is
ready: `MemberExpression[property.name='depth']`.

A `model.roots` ban in `dropTargets.ts` and `structure.ts` was also considered and
rejected — the use there is correct, guarded by an earlier `focusRoot` return, so the
rule would fire on good code. That subtlety is now written down beside it instead.

**Co-located.** The invariants moved beside the layer they govern, so they load when you
are working there rather than being read as one wall:

| file | lines |
| --- | --- |
| `CLAUDE.md` (root) | 341 → 172 |
| `src/domain/CLAUDE.md` | new, 94 |
| `src/view/CLAUDE.md` | new, 94 |
| `src/storage/CLAUDE.md` | new, 69 |

The root keeps what belongs to no single layer: the context-row rule (which the codebase
deliberately states as *one* rule spanning every layer), the write path, the build
gotchas, and an index of the three.

Nothing was lost. Checked mechanically rather than by eye — every backticked identifier
in the old document still appears in one of the four, with a single exception:
`defaultedPaths`, which the old document named after the field had already been renamed
to `settled`. A stale reference found by the check, and corrected.
