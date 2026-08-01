---
type: PBI
parent: "[[Theming and styling]]"
order: 10
status: Open
---

# One stylesheet per concern

`styles.css` splits into one file per concern, mirroring the modules it styles, and the
build assembles them into the single file Obsidian loads.

## Why this one is not optional

The root `CLAUDE.md` opens its architecture section with *"one file per concern, 400-line
max enforced by lint"*, and `eslint.config.mjs:161` makes it real for every TypeScript
file. `styles.css` is **1143 lines** — 2.8× a cap the rest of the codebase cannot exceed
— and it is exempt for exactly one reason: `eslint src test` does not read CSS. It is the
only file in the repository that escapes the rule the repository is built on, and it
escapes it by accident rather than by argument.

`Module structure` closed `One file per concern` for `src/`. This is the same PBI for the
half that was not looked at.

## The seam is already drawn

The split does not need designing. The stylesheet is *already* sectioned by hand, with
banner comments, and the sections already mirror the source tree:

| Section | Lines | Styles |
| --- | --- | --- |
| toolbar | 14-306 | `view/render/toolbar.ts` |
| tree | 307-454 | `view/render/rows.ts` |
| badges | 577-646 | `view/render/rows.ts` |
| columns | 455-576 | `view/render/columns.ts` |
| property columns | 647-732 | `view/render/columns.ts` |
| tags | 733-975 | `view/render/columns.ts`, `view/interactions/tags.ts` |
| drag & drop | 976-1095 | `view/interactions/dragDrop.ts` |
| empty state | 1096-1135 | `view/render/emptyStates.ts` |
| modals | 1136-1143 | `ui/prompts.ts` |

Every one of those sections is **already under 400 lines** — the largest is the toolbar at
293. So splitting at the banners that exist brings the whole stylesheet under the cap on
the first pass, with no judgement calls about where to cut. `test/` mirrors `src/`
already; this makes the styles do the same.

## There is already a CSS build step

`esbuild.config.mjs` runs esbuild over `styles.css` in production and writes a minified
`dist/styles.css`, which is what the release uploads (`RELEASING.md`, and
`.github/workflows/release.yml:72`). What is missing is not a build — it is *sources for
the build to assemble*. esbuild resolves `@import` in CSS natively, so an entry file
importing nine partials is a small change to an existing step rather than a new one.

## What this inverts

Three places currently assert the opposite, in comments written on purpose:

- `esbuild.config.mjs`: *"styles.css is hand-edited source and stays readable at the
  repository root — a dev vault symlinked at the repo reads it directly."*
- `test-build.mjs`: *"styles.css is hand-edited source rather than a build artifact — the
  readable copy is the one worth debugging against, so it is copied as it stands."*
- `RELEASING.md`: *"The `styles.css` at the repository root stays readable and is the file
  to edit."*

All three become false together, and all three have to change in the same commit. The
symlinked dev vault is the real constraint hiding in them: it reads the root
`styles.css` directly, so once that file is generated, **`npm run dev` has to rebuild it
on change** or the vault silently goes stale — the failure mode being a developer
debugging a stylesheet the browser is not using.

## Two hazards CSS has and TypeScript does not

**Order is semantics.** Modules can be imported in any order; stylesheets cannot. Two
rules of equal specificity are decided by which came last, so the `@import` order in the
entry file is behaviour, not organisation. It has to be explicit, commented as
load-bearing, and stable.

**`@keyframes` are global.** There are four (`pbl-busy-in`, `pbl-spin`,
`pbl-pending-pulse`, `pbl-expand-nudge`) at lines 216, 238, 345 and 1033, spread across
three sections, and `pbl-spin` is used by more than the section that defines it. The
`pbl-` prefix already namespaces them, so nothing collides — but a keyframe defined in
one partial and used from another makes the file boundary a half-truth, and that is a
decision (colocate with the only user, or hoist the shared ones) rather than an accident
to carry over.

## Acceptance criteria

- One partial per section above, each named for the module it styles, under a directory
  that makes the mirror obvious. Each is under the 400-line cap.
- An entry file that imports them in an order that is **stated to be load-bearing**, and
  the build assembles it. `npm run build` and `npm run test-build` both produce a
  stylesheet, and the release keeps shipping the minified one.
- **The assembled output is proven equivalent to today's file**, not eyeballed. Nothing
  in this repository can see a stylesheet, so a refactor that "looks the same" is a claim
  with no evidence behind it. Normalise whitespace and compare — a byte-identical rule
  set is the only proof available here, and it is available, so it is required.
- `npm run dev` rebuilds the stylesheet on change, or the symlinked-vault workflow that
  `RELEASING.md` documents is updated to say what replaces it.
- The three comments above are corrected in the same commit. A comment asserting a file
  is hand-edited, sitting next to the code that generates it, is worse than no comment.
- Whether the assembled `styles.css` is committed or gitignored is decided and written
  down. `main.js` is gitignored today and the release builds it, which is the precedent —
  but the dev-vault symlink reads the root file, so this is a real question and not a
  formality.
- `max-lines` for the partials is enforced, not just satisfied. Splitting a file that
  nothing measures leaves it split until someone appends to it — see
  `Styling rules are checks`, which is where the stylesheet stops being invisible to
  `npm run check`.

## The consequence for its sibling notes

Every line number cited anywhere in this register points into the file this PBI deletes.
`Layout survives translated text` cites 96, 336 and 748-749; `One bound, not two` cites
324, 909, 986 and 1008; `Light, dark and reduced motion` cites 915 and 940.

The fix is not to renumber them afterwards. It is to **cite by file and selector**, which
survives a split, a re-order and an edit alike — `.pbl-row.pbl-selected`'s inset shadow is
findable forever, `styles.css:336` is findable until the next insertion above it. This
PBI re-cites its siblings on that basis, and the register prefers selectors from here on.

That also settles the sequencing: this lands **first** among the styling PBIs. The
tokenization sweep and the bound audit both edit the stylesheet extensively, and doing
them in nine small files against stable addresses is the difference between a reviewable
diff and a 1143-line one.
