---
type: PBI
parent: "[[Module structure]]"
order: 10
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# One file per concern

**As** someone changing this plugin — a maintainer or an agent — **I want** each concern to
live in exactly one file inside a layer that cannot reach upwards, **so that** "where does
this go" has an answer *before* the code is written, and reading one file is enough to
change one behaviour.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever is changing the plugin |
| **Trigger** | Adding or moving any piece of code |
| **Preconditions** | None — the rule applies from the first line |
| **Guarantee** | A violation fails `npm run check`. The structure is checked, not remembered. |

**Main flow**

1. Four layers, outermost first: `main → commands → view → storage → domain`. Each may
   reach anything below it and nothing above.
2. The new code's layer follows from what it does: reads the vault → `domain`, persists →
   `storage`, touches the DOM → `view`.
3. Within the layer it joins the file that already owns that responsibility, or starts a
   new one.
4. `npm run check` confirms it: `no-restricted-imports` per directory rejects an upward
   import, and a line cap rejects a file that has taken on too much.

**Extensions**

- **2a — the code is a *type*.** It belongs with what **produces** it, not what consumes
  it. `DropTarget` and `DropZone` live in `domain/dropTargets.ts` rather than beside the
  writer and the view that read them; both sat upstream once and made the pure layer depend
  on the effectful one.
- **2b — the code is a reusable dialog.** It goes in `ui/`, a leaf that knows about none of
  the layers.
- **3a — the file is at its cap.** It is split along a **real seam** — a responsibility
  that can be named — never at a line number. The seam is the deliverable; the line count
  only asks the question.
- **4a — the import crosses a layer.** Lint fails, so it cannot erode quietly through a
  review nobody had time for.

## Acceptance criteria

- A file that outgrows its cap is split along a real seam, not at a line number.
- A type lives with the code that produces it, not the code that consumes it.
- The layering fails the build when crossed, so it cannot erode quietly.
- Modules reach view state only through `BacklogViewHost`, and `src/view/host.ts` holds no
  runtime code, so imports stay cycle-free.
- `test/` mirrors the same directories, with its own line budget.

## Where it lives

`eslint.config.mjs` (per-directory `no-restricted-imports`, the line caps) ·
`.fallowrc.json` (dead code, duplication, complexity) ·
`CLAUDE.md` and the per-layer `src/*/CLAUDE.md` files (what each layer is for, and which
rules bite where — prose, not an inventory: see
[[A guide is prose, not an inventory]]).
Done by: [[Lift empty states out of rows]], [[Split the view options schema]],
[[Split the view test suite]], [[Split the view dispatch hub]].
