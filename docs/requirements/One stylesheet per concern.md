---
type: PBI
parent: "[[Theming and styling]]"
order: 10
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# One stylesheet per concern

`styles.css` splits into one file per concern, mirroring the modules it styles, and the
build assembles them into the single file Obsidian loads.

**Done 2026-08-03.** Sixteen partials under `styles/`, an entry file that states its
own order as load-bearing, and `styles-assemble.mjs` as the one assembler the build, the
vault script and the test suite all go through. What was decided rather than inherited is
in **The three decisions this PBI had to make** below; the equivalence evidence is in
**What was proven, and how**.

**As** someone changing how one part of the view looks, **I want** to open a file about
that part, **so that** I am not reading 1995 lines to find the forty that matter.

## Use case

| | |
| --- | --- |
| **Actor** | Whoever changes the plugin |
| **Trigger** | Editing any style, or adding a new one |
| **Preconditions** | None — this lands first among the styling PBIs |
| **Guarantee** | The assembled stylesheet is equivalent to today's. A reorganisation that changes what the user sees has failed, and nothing here can see a stylesheet. |

**Main flow**

1. The stylesheet splits into one partial per concern, mirroring the modules it styles.
2. An entry file imports them in a stated, load-bearing order.
3. The build assembles the entry into the single file Obsidian loads.
4. `npm run dev` rebuilds it on change, so a symlinked vault stays current.

**Extensions**

- **1a — the banner does not bound the concern.** The `tags` banner runs to 975 and only
  its first hundred lines are tags; the state chip and the indent guide move to the files
  that own them.
- **1b — the rules are cross-cutting.** The two media queries restyle elements owned by
  three partials, so they get a stated home and a stated reason rather than being filed
  under whichever section they sat in.
- **1c — a `@keyframes` is used outside the partial defining it.** Colocate with its only
  user, or hoist the shared ones; the `pbl-` prefix means nothing collides either way.
- **2a — two rules of equal specificity depend on their order.** That order is behaviour,
  not organisation, so the entry file states it and stays stable.
- **3a — the assembled output is compared against today's.** Not byte-for-byte: moving the
  state chip into the columns partial necessarily moves it relative to the badge and tag
  blocks. The comparison is over the **resolved cascade** — every selector's winning
  declarations — so a reordering that changes nothing observable passes and one that
  changes a winner fails.
- **4a — the root file is now generated.** Three comments and `RELEASING.md` say it is
  hand-edited source; all four become false together and change in the same commit.

## Why this one is not optional

The root `CLAUDE.md` opens its architecture section with *"one file per concern, 400-line
max enforced by lint"*, and the `max-lines` rule in `eslint.config.mjs` makes it real for
every TypeScript file. `styles.css` was **1143 lines** when this note was written and
**1995** by the time it was done — 2.8×, then 5× a cap the rest of the codebase cannot
exceed — and it was exempt for exactly one reason: `eslint .` does not read CSS. It was the
only file in the repository that escaped the rule the repository is built on, and it
escaped it by accident rather than by argument.

`Module structure` closed `One file per concern` for `src/`. This is the same PBI for the
half that was not looked at.

## The seam is *mostly* drawn, and one banner lies

*Every line number in this section and the next addresses the single pre-split file, and
is kept as the record of what was measured rather than re-cited: the file it points into
no longer exists, which is the argument this note closes on.*

The stylesheet is already sectioned by hand with banner comments, and most of those
sections mirror the source tree:

| Section | Lines | Styles |
| --- | --- | --- |
| toolbar | 14-306 | `view/render/toolbar.ts` |
| tree | 307-454 | `view/render/rows.ts` |
| columns | 455-576 | `view/render/columns.ts` |
| badges | 577-646 | `view/render/rows.ts` |
| property columns | 647-732 | `view/render/columns.ts` |
| tags | 733-**838** | `view/render/columns.ts`, `view/interactions/tags.ts` |
| drag & drop | 976-1095 | `view/interactions/dragDrop.ts` |
| empty state | 1096-1135 | `view/render/emptyStates.ts` |
| modals | 1136-1143 | `ui/prompts.ts` |

**The `tags` banner runs to 975 and only its first hundred lines are about tags.** After
`.pbl-tag-add` ends at 838 it carries three unrelated things, and following the banner
mechanically would file all of them under a tags partial:

| Lines | Actually | Belongs with |
| --- | --- | --- |
| 839-894 | `.pbl-state-chip` and its variants | columns |
| 900-914 | `.pbl-children` and the indent guide | tree |
| 915-939 | `@media (prefers-reduced-motion)` — spinners, grips, chevrons | **nothing below it** |
| 940-975 | `@media (hover: none)` — touch affordances | **nothing below it** |

So the earlier claim that this is a mechanical split needing no judgement was wrong. Two
sections need moving, and the two media queries are genuinely **cross-cutting**: they
restyle elements owned by the toolbar, the tree and the tags partial alike, so they belong
to no component file. Filing accessibility rules under `tags.css` would leave the next
reduced-motion change owned by a file nobody would think to open.

That is the one real design decision here, and this PBI has to make it rather than inherit
it: either a shared partial per *condition* (`motion.css`, `touch.css`) that every
component's overrides live in, or each partial carrying its own `@media` block for the
rules it owns. The second keeps a concern in one file and costs a repeated query; the
first keeps the query in one place and splits each component across two files. Whichever
is chosen, the reason goes in the note — because the next contributor adding a
reduced-motion rule needs to know where it goes without re-deriving this.

Every resulting partial is **well under 400 lines** — the largest is the toolbar at 293 —
so the cap is met on the first pass either way. `test/` mirrors `src/` already; this makes
the styles do the same.

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

**All three were changed together, and the watcher was built.** `npm run dev` now watches
`styles/` and rewrites the root file on every save; a partial that fails to assemble logs
the reason and leaves the watcher up, since killing it on a typo'd `@import` would cost the
save that fixes it.

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

## The three decisions this PBI had to make

**The cross-cutting media queries get a partial per CONDITION** — `styles/motion.css` and
`styles/touch.css` — not a block inside each component file. They restyle elements the
toolbar, the tree and the tags partial each own, so filing them anywhere would have left
the next reduced-motion change owned by a file nobody would think to open; named for the
condition, they are found by the person looking for the condition. The cost the
alternative avoids is real and is paid here in one place: the two hover-revealed create
buttons still carry their own `hover: none` block beside the `opacity: 0` they undo
(`.pbl-add` in `columns.css`, `.pbl-bucket-add` in `roadmap.css`), because a media query
adds no specificity and an override written above the rule it undoes reveals nothing.
That shipped broken once and `test/view/rendering.test.ts` pins the ordering; `touch.css`
says out loud that those two are elsewhere and why, so the file named for the condition
does not read as the whole of it.

**`@keyframes` stay with their first user**, not hoisted into a partial of their own:
`pbl-busy-in` and `pbl-spin` in `toolbar.css`, `pbl-pending-pulse` in `tree.css`,
`pbl-expand-nudge` in `dragDrop.css`. `pbl-spin` is used from `motion.css` as well as from
`toolbar.css`, so the boundary is a half-truth either way — and a keyframes file would be
one more place to look for four rules while still not saying who animates with them. The
`pbl-` prefix means nothing collides wherever they sit. `index.css` states this so the
next contributor does not re-derive it.

**The assembled `styles.css` is gitignored, not committed.** `main.js` is the precedent
and the argument is the same one: a generated file in the tree is a file that can be
edited, and an edit to it would survive until the next build and then vanish. The
dev-vault symlink is what made this a real question, and the watcher above is what
answers it. Nothing else needed the committed copy — the one reader that looked at it,
`test/view/rendering.test.ts`, now calls `assembleStyles()` instead, which is strictly
better than what it had: it can no longer read a stale build, and it needs no build to
have run at all.

## What was proven, and how

The guarantee was *"the assembled stylesheet is equivalent to today's"*, over the resolved
cascade rather than the bytes. What was run, against `HEAD:styles.css` and the assembler's
output:

1. **Every declaration is still there, unchanged.** Both files flattened to
   `(media context, selector, property, value)` tuples — 1051 before, 1051 after, an
   identical multiset. Nothing was lost, gained, retyped or re-valued in the move.
2. **Every reordering is between rules that cannot meet.** For each
   `(media context, property)` the ordered list of selectors declaring it was compared;
   186 pairs invert, and every one of them involves a selector from the three blocks this
   PBI required to move —
   the state and horizon chips into `columns.css`, the indent guide into `tree.css`, the
   board advisory into `emptyStates.css`. An inversion changes a winner only if the two
   selectors can match the same element, and none of these can:
   - `.pbl-children::before` is a pseudo-element, and no selector it inverted against
     names a pseudo-element at all.
   - The chip block matches only `.pbl-state-chip` / `.pbl-horizon-chip` and their two
     children, all of which are created in one place (`renderStateChip` and
     `renderHorizonChip` in `src/view/render/columns.ts`) with no badge, tag or property
     class among them — and a chip's only descendants are those two spans, so no
     descendant selector from the partials it jumped (`.pbl-badge-icon .svg-icon`,
     `.pbl-tag-add .svg-icon`, `.pbl-prop-value p`) can reach into it either.
   - `.pbl-children` and `.pbl-cols` are the one bare-class pair, and they are created as
     separate elements with a single class each (`src/view/render/rows.ts`,
     `src/view/render/columns.ts`).
   - `.pbl-board-advisory` is declared once, and the only other rule naming it
     (`.pbl-roadmap .pbl-board-advisory`) both out-specifies it and still follows it.

The instrument was checked before it was believed, which this register has had to learn
twice — and the check earned its keep. Run against the unmoved file compared to *itself*,
the first version reported **two** inversions: it was reading `to` and `from` inside
`@keyframes` as ordinary selectors, and a selector appearing more than once made its
first-occurrence index lie. Keyframe steps do not cascade against ordinary rules, so the
fix was to skip those blocks whole; the corrected instrument reports zero against the
unmoved file, and 186 rather than 188 against the split. Two of the findings this proof
would otherwise have rested on were artefacts of the tool.

**This proof is not a standing gate and was never going to be one** — its baseline is a
file this PBI deletes, so after the split there is nothing left to compare against. What
stands afterwards is the assembler's own two checks (no partial over 400 lines, no partial
missing from `index.css`, both failing `npm run build`) and the six cascade pins in
`test/view/rendering.test.ts`, which now read the assembled output. Making the stylesheet
visible to `npm run check` as a whole is `Styling rules are checks`, which is the next
note and always was.

## Acceptance criteria

- One partial per **concern**, each named for the module it styles, under a directory that
  makes the mirror obvious. Each is under the 400-line cap. The banners are the starting
  point, not the answer: the state chip and the indent guide move out of the `tags` span
  to the files that own them.
- The two cross-cutting media queries have a stated home and a stated reason. A
  `prefers-reduced-motion` rule for the spinner must be findable by someone who has never
  read this note.
- An entry file that imports them in an order that is **stated to be load-bearing**, and
  the build assembles it. `npm run build` and `npm run test-build` both produce a
  stylesheet, and the release keeps shipping the minified one.
- **The assembled output is proven equivalent to today's file**, not eyeballed. Nothing in
  this repository can see a stylesheet, so a refactor that "looks the same" is a claim with
  no evidence behind it.
- Equivalence is over the **resolved cascade**, not the bytes. Byte-identity is not merely
  strict here, it is unsatisfiable: moving `.pbl-state-chip` into the columns partial and
  `.pbl-children` into the tree partial — which this PBI requires — necessarily moves them
  relative to the badge, property and tag blocks. A comparison that rejects the
  reorganisation it mandates is a contradiction, not a high bar. Compare every selector's
  winning declarations, so a reordering that changes nothing observable passes and one that
  changes a winner fails.
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

**Four notes were re-cited, not three.** `Styling rules are checks` was the one the draft
of this section missed: it cites `styles.css:618-621`, line 642 four times and lines 336
and 748-749 again, all inside the argument for a check it has not written yet. Missing a
note while enumerating the notes to fix is the same defect this PBI is named after, at one
remove — the count came from three notes someone remembered rather than from a search.

That also settles the sequencing: this lands **first** among the styling PBIs. The
tokenization sweep and the bound audit both edit the stylesheet extensively, and doing
them in sixteen small files against stable addresses is the difference between a reviewable
diff and a 1995-line one.

## Where it lives

`styles/index.css` is the entry file, and states its own import order as behaviour;
`styles/view.css`, `styles/toolbar.css`, `styles/tree.css`, `styles/columns.css`,
`styles/badges.css`, `styles/propertyColumns.css`, `styles/tags.css`,
`styles/dragDrop.css`, `styles/emptyStates.css`, `styles/modals.css`, `styles/board.css`,
`styles/cards.css`, `styles/roadmap.css` and `styles/timeline.css` are the partials named
for what they style, and `styles/motion.css` and `styles/touch.css` the two named for a
condition · `styles-assemble.mjs` resolves that entry into the single sheet Obsidian
loads, and is the only place the 400-line cap and the every-partial-imported rule are
checked · `esbuild.config.mjs` writes the assembled sheet in every mode, minifies it into
`dist/styles.css` for the release, and watches `styles/` under `npm run dev` ·
`test-build.mjs` copies the assembled sheet into the vault · `test/view/rendering.test.ts`
reads the assembler rather than the file · `.fallowrc.json` seeds the partials as
`dynamicallyLoaded`, since the import graph runs through a build script no static analyser
walks · `eslint.config.mjs` carries the 400-line cap the partials meet and ignores the
assembler with the other build scripts · `.gitignore` lists the generated root
`styles.css` beside `main.js`.
`.github/workflows/release.yml` uploads the built asset; `RELEASING.md` now documents
which file to edit.
