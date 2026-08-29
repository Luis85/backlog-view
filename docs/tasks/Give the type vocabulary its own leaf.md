---
type: Task
parent: "[[One file per concern]]"
order: 50
status: Open
area: architecture
priority: P3
created: 2026-08-03
source: Structure pass on 0.4.0, recorded in docs/superpowers/plans/2026-08-03-codebase-quality-review.md
files:
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Give the type vocabulary its own leaf

## Evidence

`src/domain/settings.ts` carries **34 exports** in 310 effective lines — the most distinct
concerns of any file in `src/`, though comfortably inside the 400-line cap. Among them are
`LEVELS`, `EXTRA_TYPES`, `MARKER_TYPES` and `ALL_TYPES`: the type vocabulary, which the
architecture guide attributes to `src/domain/itemTypes.ts`.

They are not there, and the code says why. `byName` — the safe lookup for user-supplied
type names — carries this in its own comment:

> It lives here rather than in `itemTypes.ts`, which is where it reads more naturally,
> because that module imports this one and the dependency cannot run both ways.

So the placement is a cycle break, not a judgement about where the vocabulary belongs. The
file that is named for the type vocabulary cannot hold it, because it already depends on
the file that does.

## Why it matters

Low, and stated as such. Nothing is over a budget, no rule is broken, and the comment is
honest about what happened — this is a seam, not a defect. What makes it worth recording
is that **the same structural move is required by something else**: [[Multilang]] works out
that the string catalog *"has to be a new leaf below everything — importable by every
layer, importing none of them"*, because `ui/` may import nothing and `domain/` may not
reach `ui/`. A vocabulary leaf below `settings.ts` and `itemTypes.ts` is that same shape,
one layer in. Done together they are one idea applied twice; done separately they are two
arguments about where a leaf goes.

## Approach

Ordered, because the middle step is the one that can go wrong quietly.

1. Move `LEVELS`, `EXTRA_TYPES`, `MARKER_TYPES` and `ALL_TYPES` into a leaf that imports
   nothing from `domain/`.
2. Move `byName` with them **only if it still cannot go in `itemTypes.ts`** — the whole
   point is that the cycle is gone, so re-ask the question rather than carrying the
   workaround into its new home. A helper moved for a reason that has expired is the
   next reader's puzzle.
3. Add the leaf's own `forbidden` entry in `eslint.config.mjs`, naming every other
   directory, so it cannot grow an edge back up. [[Multilang]] asks for the same
   mechanical statement and for the same reason.
4. Update `src/domain/CLAUDE.md` where it describes the vocabulary's home.

## Risks

- **The vocabulary is data, not text.** `ALL_TYPES` is matched against `type:` frontmatter
  and derives `typeFolder.<type>` option keys. A move must not tempt anyone into treating
  these names as display strings — that is [[Type names are data]], and [[Multilang]]
  states the test: ask what breaks if two people with different Obsidian languages open
  the same vault.
- **The 400-line cap is not the reason.** `settings.ts` is at 310 effective. Splitting to
  lower a number rather than at a named seam is what [[One file per concern]] extension 3a
  refuses.

## Acceptance criteria

- `src/domain/itemTypes.ts` no longer imports the vocabulary from `settings.ts`.
- The leaf imports nothing from `domain/`, `storage/`, `view/`, `ui/` or `commands/`, and
  `eslint.config.mjs` enforces it.
- `byName`'s placement is re-decided rather than carried, and whatever it ends up being is
  the reason written beside it.
- `npm run check` passes, coverage thresholds unchanged or raised.
