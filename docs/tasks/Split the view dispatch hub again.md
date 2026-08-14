---
type: Task
order: 60
parent: "[[One file per concern]]"
status: Open
priority: P2
area: refactor
created: 2026-08-09
source: final review of the toolbar overhaul branch
files:
  - src/view/backlogView.ts
  - src/view/render/afterContent.ts
---

# Split the view dispatch hub again

## Evidence

`src/view/backlogView.ts` measures **398 effective lines** (`skipBlankLines`,
`skipComments`, the counting `max-lines` uses) against the 400-line cap every `src/` file
is held to. **Two lines**, and its import block is already full: a new import costs one
of them before a line of code is written.

Measured 2026-08-09 by running the rule itself at `max: 1` and reading the number it
reports, then bisecting at 397/398 to check the instrument — because the **395** this
note was filed with matches no revision that could be found: the file was at **exactly
400** on `main` at the merge base of the Bases-driven-columns branch, and 398 after it.
The trend the note is about is unchanged and if anything sharper than the original
figure: two merges running, this file has sat within two lines of a cap it cannot cross.

**And the cheap way out is blocked.** Moving a block to a neighbour is what the last two
increments did, and the two neighbours these blocks would go to are at their own
ceilings: `src/view/interactions/menu.ts` is at **399** of the same 400 (one line — it
cannot receive the menu trio it is the natural home for), and `ResizePolicy`
(`src/view/resize.ts`) takes **five constructor parameters** against the `max-params` cap
of 5, so nothing more can be handed to it the way `syncToolbarFit` was. Of the three
seams named below, only the card-move plumbing has an unblocked destination, and it does
not have one yet — it would be a new file. Which is the argument for a real split rather
than another shave.

[[Split the view dispatch hub]] is the same measurement taken on 2026-08-02, and it is
**Done**: extracting `WriteGate` into `src/view/writeGate.ts` took the file from exactly
400 to 330. Sixty-eight of those seventy lines have come back over the six months of work since, most recently
the toolbar overhaul, which spent the whole of the remaining slack on nothing but a
`css-change` listener and a fit call — and had to give one of them back (the
`syncToolbarFit` call moved into `ResizePolicy`, where the design spec had put it anyway)
to stay under the cap. That is the closed task's own evidence recurring: work being
shaped by the line count rather than by the design.

## Why it matters

A cap is only a forcing function while there is somewhere to go. `backlogView.ts` is what
every interaction module reaches through `BacklogViewHost` and what every render module's
output flows back through, so the next projection increment meets this file whether it
wants to or not — and meets it with two options, both bad: shrink something nearby under
time pressure, or leave a real fix undone. Both happened in the increment that filed the
first task, and the second happened again on this branch (see the structural-debt note in
[[Smoke test the visual changes]]).

The closed task is history, not a plan. Its approach section reasoned from a file whose
shape has since changed twice — the write gate it recommended against is now extracted,
and the menu trio it named as the alternative is still there — so it cannot be re-run as
written. This note is the re-run.

## Approach

Deliberately not prescribed, which is the same choice the first task made and the reason
it landed on a better seam than its own evidence pointed at. Read the file fresh before
cutting.

What is on the table, in the shape the file has now:

- **The menu trio** — `showContextMenuFor`, `showColumnMenuFor` and the private
  `showMenuBelow` they share. The first task's original candidate, passed over then
  because it was worth about twenty lines against the gate's hundred and twenty. Twenty
  lines is a different proposition against a five-line margin, but it is also exactly the
  cut that would put this note back in the backlog within a release.
- **The card-move plumbing** — `applyCardMove`, `performBoardMove`, `performHorizonMove`
  — which is one subject with a stated rule of its own (the root `CLAUDE.md`'s "One move,
  three inputs — per projection"), and would grow by one method per projection added.
- **The render orchestration** — `render` and `renderTreeContent`, the second of which
  has accumulated the post-content sync calls (`syncCountLabel`, `syncCollapseCtls`,
  `renderLegend`, `syncToolbarFit`) and the column-fit second pass.

Whichever is chosen has to leave `BacklogViewHost` answerable by one class, per the
write-gate and lifecycle rules in
[`src/view/CLAUDE.md`](../../src/view/CLAUDE.md) — the constraint that decided the shape
of `WriteGate` and would decide this one too.

**Taken in part on 2026-08-14, and this task stays open.** The resources axis's two folds
put `backlogView.ts` over the cap a third time, and the cut was the render-orchestration
seam named above — but only its post-content half: `syncCountLabel`, `syncCollapseCtls`,
`renderLegend` and `syncToolbarFit` moved whole into `src/view/render/afterContent.ts`,
which is a real subject ("everything that reads what the content render just produced")
rather than a line-count cut. It bought about six lines against the seventy this note asks
for, so the margin is still thin and the next increment will meet this task again — which
is exactly what the criterion below was written to refuse. `render` and the body of
`renderTreeContent` are still here, and are still the cut worth making.

## Acceptance criteria

- `src/view/backlogView.ts` has real headroom under the 400-line cap — enough that the
  next increment does not immediately meet this task a third time. The first split bought
  seventy lines; less than that is worth arguing for, not assuming.
- The split follows a named seam a reader can point to, not a line-count cut.
- `BacklogViewHost` still resolves to one implementation, modules that reach view state
  still go through it, and `host.ts` stays free of runtime code.
- `npm run check` green, with no test rewritten to match the new shape rather than to
  keep asserting the same behaviour.

## Risks

The two blocks with real consequence behind them are the card-move plumbing, whose
capture-before-the-await rule is what stops a move being announced against a board that
has already been rebuilt, and the render orchestration, whose ORDER is load-bearing in
several places at once (the sync calls run after the content because that is what fills
what they read; the column-fit second pass is guarded against recursion). Neither is
protected by a type — both are protected by comments and by the existing suites. A split
that moves either has to move its comments with it and pass those suites with no
assertion touched, which is the bar the write-gate extraction met and the reason it is
trusted.
