# Arrows between bars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task.

**Goal:** Increment 2 of item dependencies. The dated timeline draws an arrow from a
prerequisite's bar to the bar that waits on it, and marks the edge whose dates contradict
its own ordering — without moving a bar or writing anything.

**Spec:** the register note `docs/requirements/Arrows between bars.md` is the
specification. Its **Main flow**, ten **Extensions** and **Acceptance criteria** are the
requirements; this plan decomposes them and adds nothing.

**Architecture:** `src/domain/dependencies.ts` decides which edges are drawable and which
are in conflict — a pure question over the placed bars. `src/domain/timeline.ts` turns one
edge into geometry beside `barGeometry`. `src/view/render/timeline.ts` draws the layer in
the idiom the milestone lines and grid rhythm already use: absolute, `aria-hidden`,
`pointer-events: none`, positioned in days × `scale.dayPx`. Nothing writes.

**Increment 1 (merged into this branch) supplies:** `BacklogItem.prerequisites` (resolved,
collapsed) and `BacklogItem.brokenPrerequisites` (raw text of every entry that became no
edge). Both are empty when the key is unbound, which is what makes "the feature is absent"
free.

## Global Constraints

- `npm run check` must pass before every commit — build, lint, coverage-thresholded tests,
  fallow, docs register. CI runs the same five on Ubuntu **and** Windows.
- Layering: `view/` may reach `domain/` and `storage/`, never the reverse. Enforced by
  `no-restricted-imports`.
- **Nothing in this increment writes frontmatter, moves a bar, or changes a date.** If a
  step tempts you to write, stop — the read-only property is what makes the whole feature
  safe without a per-path check.
- `src/` files are capped at 400 counted lines by lint (`skipBlankLines`, `skipComments`);
  `test/**` at 450; style partials at 400. Current headroom is thin:
  `src/view/render/timeline.ts` is 581 raw lines and `styles/timeline.css` is 387 raw
  lines. **If a file goes over, extract a module rather than compressing** — and the
  register must name any new module in the same commit (`docs-check.mjs` rule 7).
- Coverage thresholds in `vitest.config.mts` only ever go up. Prefer removing an
  unreachable branch to leaving it uncovered — `Map.get`'s `?? fallback` and
  `Array.pop()`'s `undefined` arm are the two that keep appearing.
- Fallow gates dead code, duplication, complexity/CRAP and import cycles. An export with
  no consumer fails it: do not export a symbol for a future increment.
- UI text is sentence case. `setCssProps` over inline styles. No global `app`.
- The timeline keeps **one selection stop per row**. Nothing this increment adds is
  focusable — not an arrow, not its head.
- A wikilink in `docs/` must not wrap across a line — `docs-check.mjs` reports it as
  unresolved.
- **Every `git add` is a reminder, not an inventory.** Run `git status --short` before
  committing and stage everything the task changed.

---

### Task 1: Which edges draw, and which are in conflict

**Files:**
- Modify: `src/domain/dependencies.ts` (add the derivation)
- Modify: `test/domain/dependencies.test.ts`, or create `test/domain/dependencyArrows.test.ts`
  if the first would pass 450 lines

Add one exported function deciding, for a set of placed bars, which prerequisite edges are
drawable and which of those are conflicts. It takes what `deriveBars` produced
(`TimelineBar[]`, which carry `item`, `span`, `inferredStart`, `inferredEnd`) and returns
one entry per drawable edge: the two bars, and whether the edge is in conflict.

**The rules, from the note's Extensions — every one of these is a test:**

- An edge draws only when **both** ends have a bar in the passed set (1a, 1b). An end that
  is shelved, hidden, collapsed or filtered out simply is not in the set, so this needs no
  special case — but assert it.
- **Neither end may be `outsideFilter`** (1c). An arrow across the results is derived from
  the results, and a context row is never a source of one.
- An edge that is **marked broken** never draws (1d). The model already marked it; broken
  entries are in `brokenPrerequisites` and never in `prerequisites`, so again assert
  rather than re-derive.
- A conflict is `dependent.start <= prerequisite.end`, **on or before** (main flow step 2):
  an end is inclusive here — `barGeometry` computes `spanDays` as `clampedEnd -
  clampedStart + 1` — so a dependent starting the same day occupies a day its prerequisite
  is still running.
- A conflict rests **only on dates the two notes state** (2a). Per END, not per item: a bar
  carries `inferredStart` and `inferredEnd` independently, so a prerequisite with a stated
  target and a rolled-up start still conflicts. An end that is **absent** (`span.target ===
  null`, the open end 1g draws) also suppresses it — `inferredEnd` is false there, so
  "stated" is the test and "inferred" is not.
- A **shelved dependent** is never in conflict (2b) — it has no start to compare.
- A **milestone** takes part like anything else (1e): its two ends are the same day.

**Verification:**
- [ ] Each rule above has a test named for the rule, not for the function.
- [ ] The equal-day case is tested in both directions: same day is a conflict, one day
      later is not.
- [ ] A prerequisite with a stated target and an inferred start still conflicts; one whose
      compared end is inferred, and one whose compared end is absent, do not.
- [ ] `npm run check` passes. Commit.

---

### Task 2: The arrow layer

**Files:**
- Modify: `src/view/render/timeline.ts` (draw the layer) — or create
  `src/view/render/timelineArrows.ts` if it would exceed 400 counted lines, in which case
  also update the register note in this commit
- Modify: `styles/timeline.css` (or a new partial + `styles/index.css`, same size rule)
- Modify: `src/domain/timeline.ts` (geometry for one edge, beside `barGeometry`)
- Modify: `test/view/roadmapFrame.test.ts`, or create `test/view/dependencyArrows.test.ts`

Draw one element per **edge** — never one per pair of rows (4a) — from the prerequisite's
end to the dependent's start, in the same idiom as `renderMilestoneLines`: absolute,
`aria-hidden`, `pointer-events: none`, positioned from days × `scale.dayPx`.

**The rules, from the note:**

- An edge in conflict is drawn as one (step 2), and **the dependent's row is marked with
  it** so the contradiction is findable without hunting for the arrow.
- An anchor at an **open end** (1g) sits at that open end, which already carries the
  vocabulary for "no date here". The arrow still draws — suppressing it would hide a stated
  ordering to protect an unstated date.
- An anchor at a **clipped end** sits at the clipped edge, inside the grid — `barGeometry`
  clamps `startDay`/`spanDays` to the window and reports `clippedStart`/`clippedEnd`, so
  "past the end" would be off the scrollable grid.
- Two bars on the same row, or too close to route between, still draw at the minimum
  geometry the grid allows (1f).
- **Nothing added is focusable** (3a), and nothing is written (step 4).

**Verification:**
- [ ] One element per edge, asserted by count against a fixture with more rows than edges.
- [ ] A conflict edge and its dependent row both carry their marks; a non-conflict edge
      carries neither.
- [ ] No element the layer adds has a `tabindex`, and the pane's selection stops are
      unchanged in number.
- [ ] Rendering with the key bound writes nothing — assert `vault.writeLog` is empty.
- [ ] `npm run check` passes. Commit.

---

### Task 3: What the row says

**Files:**
- Modify: whichever module builds the timeline row's accessible name (find it — the
  milestone line's own note says the row's name carries `${title} — ${dates}`)
- Modify: the test file covering that name

Step 3 of the note: every dependent row's accessible name names what it waits for, and
marks the conflict **on the prerequisite it belongs to** — at the same resolution the
picture has. A row waiting on four things with one contradiction says *which* one; a single
"in conflict" appended to a list of four names is the picture's information rounded down.

This is the half that carries 1a and 1b: when an end has no bar, no arrow draws, and the
dependent's row is where the dependency is still stated. A dependent the reader's own
controls have **hidden** has no row at all, and the note's guarantee is scoped to rendered
dependents — do not invent a surface for it.

**Verification:**
- [ ] A row waiting on two prerequisites, one in conflict, names both and marks only the
      one.
- [ ] A dependency whose prerequisite has no bar is still stated by the dependent's row.
- [ ] `npm run check` passes. Commit.

---

### Task 4: The register

**Files:**
- Modify: `docs/requirements/Arrows between bars.md`

Replace `**Nothing yet — this note is design.**` in `## Where it lives` with what was
built, naming every module the increment touched, and set `status: Done` with a `closed:`
date of 2026-08-08. Say what the code does and why, in the register's voice — not a list of
functions. If any rule in the note turned out to be wrong or unbuildable as written, say
so in the note rather than leaving it standing.

**Verification:**
- [ ] `npm run check` passes — `docs-check.mjs` gates the note's shape and every path it
      names.
- [ ] Commit.
