# Draw a dependency between bars — increment 3

**Date** 2026-08-09
**Delivers** `[[Draw a dependency between bars]]`, the last Open PBI under
`[[Dependencies]]`. It currently says "Nothing yet — this note is design."

## Why this increment

The three PBIs before it are Done, in the order `[[Dependencies]]` requires:
`[[Dependencies as a property]]` (the key and the read), `[[Arrows between bars]]` (the
picture), `[[Linking two items]]` (the single-pointer write, which WCAG 2.2 SC 2.5.7
makes the obligation rather than the alternative). This increment adds the gesture on
top of all three and adds no fourth idea of what a dependency is: the drop calls the
method the menu calls.

That is the whole shape of the work. What is genuinely new is the affordance and the
legality question asked from the other end — the rest is wiring an existing write to a
second input, and refusing that input everywhere it does not belong.

## Scope

**In:**

- A connector on a drawn bar: revealed on row hover or connector focus, permanent under
  `(hover: none)`, sitting outside the bar's end and at the clipped edge where the bar
  runs past the window.
- A drag from it that marks illegal targets while held, previews a line to the pointer,
  and on release calls the existing dependency write on the bar dropped **onto**.
- The structural refusal that keeps a link drag out of every drop target that means
  something else.
- Harness fixtures for the cases the gesture has to survive, and the rule that says
  where such a fixture goes.

**Out — each for a stated reason:**

- A second plan for a dependency write. `applyDependencyWrite` is exported and called;
  nothing is re-planned beside it. The PBI states this as the point of the increment.
- An **announcement**. The menu path announces nothing today, and the PBI's acceptance
  criterion is parity with the menu path, which parity satisfies. Adding a live-region
  message here would mean adding it to the menu too, which is a change to
  `[[Linking two items]]`'s shipped behaviour and belongs to whoever asks for it. It is
  a real gap for a screen-reader user and is registered as an issue rather than silently
  left — see **Register work**.
- Dragging **from** the shelf to state a dependency. Extension 2c: the shelf holds what
  has no bar, so this gesture cannot reach it by construction, and the menu is the
  answer. Dragging from the shelf already means scheduling.
- Any change to what a dependency MEANS: no link types, no lag, no auto-scheduling.
  `[[Dependencies]]` refuses the last outright.
- A second connector at the bar's start. `dependsOn` is one relation, so a start-side dot
  would write the identical thing while suggesting a choice the frontmatter cannot record.

## Behaviour

### The connector

One per drawn bar, at the bar's **drawn** end. It renders when all of:

- the item is a result (an `outsideFilter` row never has a bar at all — `deriveBars`
  routes it to context before any span is computed, so extension 1b is satisfied by
  construction, the same way `[[Arrows between bars]]` 1c is);
- `settings.dependsOnKey !== ''`, the same predicate `dependenciesAvailable` already is
  (1c);
- the bar is actually drawn — not `geometry.outside`, where there is no on-screen end.

It is deliberately **not** gated on `barHolds`. A grip writes a date and is withheld
where no date is the note's own; a connector writes a link and claims no date, so an
inferred bar — which has no grips at all — still offers one. This is the same reasoning
1f gives for a clipped bar: a handle asserts nothing about a date, so it may sit where a
diamond may not.

Placement, in three cases:

| Case | Where the dot sits |
| --- | --- |
| Ordinary bar | Outside the bar's right edge, clear of `.pbl-bar-grip-end` at `right: -3px`, so a one-day bar keeps both (1d) |
| Clipped end (1f) | **Inside** the clamped edge. Past it is outside the scrollable grid, unreachable at exactly the zoom that produced the clipping |
| Milestone (1a) | At the diamond, whose rule carries `translateX(-50%)`, so `left: 100%` would miss it |

The clipped case needs a class the renderer cannot currently express: `barClasses` folds
`geometry.clippedEnd` together with `span.target === null` into `pbl-bar-open-end`, and
those two want different connector placement. A `pbl-bar-clipped-end` class is added
beside it, changing no existing rule.

**Reveal.** `opacity: 0`, undone by `.pbl-timeline-row:hover`, by `:focus-visible` on the
connector itself, and by a `@media (hover: none)` block placed **immediately after** the
`opacity: 0` it overrides. Not in `styles/touch.css`: a media query adds no specificity,
so any later rule for the same selector would get between the pair. `.pbl-add` and
`.pbl-bucket-add` each carry exactly that block for exactly this reason, and a
hover-revealed control that lacked one shipped unreachable on touch once.

**The label collision.** `renderBarLabel` places the title just past the bar's right edge
with `padding: 0 var(--size-4-2)` — 8px, which is inside the connector's space. Seen in
the harness before it was fixed. `.pbl-bar-label-after` gains enough left padding to
clear the dot. The link drag hides labels too, so this is the hover collision only — but
hover is when both are on screen at once.

**The link drag gets its own live class, `pbl-linking`, and does not reuse
`pbl-dragging`.** They are not the same statement: `pbl-dragging` means "a card is being
dragged in this view" and carries consequences a link drag must not fire — the harness
mock, which set it by hand, revealed the tree's root strip ("Move to top level") under a
gesture that can never reparent anything. What the two share is the decluttering, so
`.pbl-linking` joins `.pbl-dragging` in the one rule that hides `.pbl-bar-label`, and
nothing else.

### Legality, asked from the other end

Dragging S onto T writes to **T**: T waits for S. So the question is not the menu's
("what may this item wait for") but its mirror, and the same words name the wrong end.

T is illegal when any of:

1. **T is S.** The loop of length one.
2. **S already waits on T, transitively.** The new edge would close a loop. Note this is
   S's own transitive *prerequisites*, not the dependents closure the menu walks.
3. **T's own list already names S** — however that entry is spelled, and whether or not
   it resolved. `declaredPrerequisitePaths` is the existing answer; a broken cyclic entry
   still names a note, so re-offering it would be a pick the writer collapses into the
   line already on disk.
4. **T is `outsideFilter`.** Never a write target.

**This is not restated as a new rule.** It is exactly `candidates(app, model, T)`
containing S — `candidates` already encodes all four, and a second formulation beside it
is what would drift. The legal set is therefore `{ T : S ∈ candidates(T) }`, computed
**once at drag start**, never per frame.

To keep that affordable, `candidates` is refactored to take the `declared` map it
currently rebuilds per call, so a per-target sweep builds that map once and each target
costs one closure walk rather than a rebuild plus a walk. Signature change only; the
menu passes a freshly built map and behaves identically.

The verdict is re-asked at drop time against `host.model` for the same reason
`promptAddDependency`'s `onChoose` does: the graph can change while the gesture is held.
A drag that started legal and ended illegal writes nothing.

### What the drag shows

- Illegal targets are marked — dimmed and desaturated — for as long as the drag is held.
  Legal targets are **not** marked. Most bars are legal, so marking legal marked four of
  six rows in the harness and read as a multi-select; refusal is the scarce thing, and
  the acceptance criterion asks for exactly it ("an illegal target is visibly illegal
  before release").
- The bar under the pointer takes the accent outline — the `pbl-drop-over` idea, spelled
  for a mark that is a bar rather than a region.
- A dashed line follows the pointer from the connector, in the drop-indicator vocabulary,
  drawn into the timeline content box so it needs no coordinate arithmetic of its own.
- Auto-scroll at the grid's edges is the existing `wireScroller` registration (2b).
- Escape, or release on anything that is not a legal target, cancels: nothing written,
  nothing marked (main flow 4).

### The refusal that is not in the note

Every existing drop target gates on the view token alone. A connector drag would
therefore be accepted by the timeline grid's positional target — which calls `planFor`,
takes the `source.hold === null` arm, and **writes a date** — and by the dated shelf,
which would unschedule. Both break the guarantee "no drop changes a date", and neither is
mentioned in the PBI.

Fixed at the forbidden thing rather than target by target: the drag payload carries its
kind, and `CardDragController`'s `canDrop` refuses a link source unless the registration
opted in. Every target that exists and every target not yet written refuses by default,
which is what makes this a category invariant rather than a list of the places someone
thought of.

### The write

`applyDependencyWrite` is exported from `interactions/dependencies.ts` — its own comment
already names this PBI as the reason it would be — and called as
`applyDependencyWrite(host, target, { add: source.file })`. Same batch, same
`configProblems` gate, same `outsideFilter` refusal, same single undo (4a). A drop while
the configuration has problems is refused loudly by the gate, identically to the menu
(3a), because it is the same gate.

## Harness fixtures, and the rule

The gesture's awkward cases are exactly the ones a picture answers and markup assertions
do not: a bar clipped at the window's edge, a bar one day wide, an inferred bar, a
prerequisite chain two deep. None is in `demoVault()` today.

**Two fixtures, because one cannot serve both jobs.** A clipped bar requires the window to
exceed `MAX_TIMELINE_DAYS`, which clamps the grid to 1830 days around today — squeezing
every other bar in the demo and degrading the everyday picture the fixture exists to be.
So:

- `demoVault()` keeps its job — the everyday backlog — and gains only what does not
  distort it: a **one-day bar** (non-marker, `start === due`), an **inferred bar** (an
  undated parent with a dated child), and a **two-deep prerequisite chain**, so the
  transitive half of rule 2 is visible in the picture rather than only in a unit test.
- A named variant supplies the cases that would: a bar running past the window on both
  sides, so the clipped-end connector is drawable. The harness selects it by URL
  (`?fixture=edges`), the same way `?view=` already selects a projection.

**The rule** goes in `test/CLAUDE.md` beside "Looking at it":

> A change that visibly alters the view puts its cases in a harness fixture — in
> `demoVault()` where the case belongs in the everyday picture, in a named variant where
> it would distort it. A throwaway `mock.ts` is for markup no code produces yet; once the
> code produces it, the case belongs in a fixture the harness can be pointed at.

**And its check**, because a rule with no check is the defect this repository has already
named twice. `test/harness/harness.test.ts` asserts that each fixture *renders* the cases
it exists for — a clipped bar in the variant, a one-day bar and an inferred bar in the
default, and that every variant mounts. That fails when a fixture note is deleted or a
class renamed, which is the honest scope of the guarantee: it checks that the cases are
drawable, not that a future contributor remembered the rule.

## Architecture

Layers are unchanged; every new piece sits in the layer that already owns its concern.

- **`src/domain/dependencies.ts`** — `candidates`' `declared` map is hoisted to a
  parameter. No new graph algorithm: legality stays one function.
- **`src/view/interactions/linkDrag.ts`** — new. The connector's source registration, the
  legal-target sweep taken once at drag start, the preview line, the marking, and the
  call into the write. Its own module rather than growing `interactions/dependencies.ts`,
  which is "the two menu entries", or `interactions/cardDrag.ts`, which is the shared
  drag layer and not any one gesture.
- **`src/view/interactions/cardDrag.ts`** — the payload kind and the default refusal, plus
  the opt-in registration a link target uses. This is the shared layer's job precisely
  because the refusal has to hold for targets it does not know about.
- **`src/view/interactions/dependencies.ts`** — `applyDependencyWrite` exported.
- **`src/view/render/timeline.ts`** — draws the connector beside the grips loop; adds
  `pbl-bar-clipped-end` in `barClasses`.
- **`styles/timeline.css`** — the connector, its reveal, its `(hover: none)` pair, the
  three placements, and the drag marking.
- **`styles/timelineFurniture.css`** — the label's left gap.
- **`test/helpers/fixtures.ts`** — the additions above and the named variant.
- **`test/harness/page.ts`** — `?fixture=`.

## Testing

Node tests for the domain change, jsdom view tests for everything else, and one honest
admission at the end.

- **`test/domain/dependencies.test.ts`** — the hoisted map produces the same candidate
  sets as before; the transitive case (a chain two deep) and the already-declared case
  including a broken spelling.
- **`test/view/linkDrag.test.ts`** — the connector renders under each of its conditions
  and is absent under each refusal (no key, no bar, bar wholly outside); a completed drag
  writes `dependsOn` on the item dropped **onto** and on no other note; a drop on an
  illegal target writes nothing; Escape writes nothing; a drag that became illegal while
  held writes nothing; **no drop changes a date** — asserted over the whole batch, not
  over the dependency key alone.
- **The category invariant, at the forbidden thing.** A link-kind payload dispatched at
  the timeline grid's positional target and at the dated shelf writes nothing. This is
  the check that holds for targets not yet written; it is asserted through the real
  `CardDragController`, so a new target registered the ordinary way inherits it.
- **`test/view/contextCardWrites.test.ts`** — a third block. A connector drag is a new
  entry point over the context-row rule, and the file's stated job is asking the same
  three questions of each card projection's entry points.
- **`test/view/rendering.test.ts`** — the `(hover: none)` block sits immediately after the
  `opacity: 0` it overrides, checked the way that file already checks it for the other two
  revealed controls. A stylesheet cannot be asked whether a control is reachable, so this
  is the narrower thing that can be checked, and the sentence says so.
- **`test/harness/harness.test.ts`** — the fixture checks above.
- **A cost check, not a comment.** The legal-target sweep runs once per drag, not per
  frame: a spy on the sweep, driven through a multi-frame drag. `[[Cost claims are spies,
  not comments]]` is the register note requiring this shape.

**What no test here can answer**, and what therefore stays owed to a live vault: whether
a 9px dot is hittable at 4px/day zoom on a real trackpad, whether the reveal reads as an
affordance or as noise in a themed vault, and whether the dimming survives a theme that
replaces the colour tokens. Those go on `[[Smoke test the roadmap]]`.

## Register work

- `[[Draw a dependency between bars]]` — replace "Nothing yet — this note is design" in
  `## Where it lives` with the modules above. Two deliberate divergences from what that
  section currently sketches, and the note is corrected rather than the code bent to it:
  - it names `src/domain/dropTargets.ts` as where legality is asked. Legality here is a
    graph question, and both existing closure walks live in `src/domain/dependencies.ts`;
    `dropTargets.ts` is about tree structure and knows nothing of the dependency graph.
  - it does not mention the structural refusal, which is the one piece of this increment
    that is neither the affordance nor the write. Added to the note, since it is the part
    a future reader is most likely to reopen by omission.
- `[[Draw a dependency between bars]]` — status Open → Done on completion.
- A new issue: **a dependency write is announced to nobody**. Both inputs are silent,
  so parity holds and nothing regressed, but a screen-reader user gets no confirmation
  from either path while every card move gets one. Registered rather than fixed here,
  because fixing it changes shipped menu behaviour.
- `test/CLAUDE.md` — the fixture rule and the scope of its check.

## Definition of done

`npm run check` — build, lint, coverage-thresholded tests, fallow, docs register — all
five, on this branch, before committing. Plus the harness, pointed at both fixtures, for
the thing the suite cannot answer.
