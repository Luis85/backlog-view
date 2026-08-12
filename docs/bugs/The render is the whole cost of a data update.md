---
type: Bug
parent: "[[The render path states its costs as checks]]"
order: 30
status: Open
area: performance
priority: P1
created: 2026-08-10
source: Measured in Chromium through the browser harness, against a user report of an ~800-note folder-mode vault
files:
  - src/view/backlogView.ts
  - src/view/render/rows.ts
---

# The render is the whole cost of a data update

## What happened

A vault of roughly 800 notes, deriving its hierarchy from subfolders, is sluggish. The
harness's `?perf` mode reproduces it. Timing each phase of `refreshFromData` from inside
the call, medians of six, Chromium, tree expanded:

| rows | `buildModel` | `render` | every other phase, summed |
| --- | --- | --- | --- |
| 132 | 2.3 ms | 88.6 ms | ~0.5 ms |
| 232 | 3.6 ms | 144.6 ms | ~0.3 ms |
| 432 | 5.6 ms | 281.7 ms | ~0.3 ms |
| 832 | 9.9 ms | 500.2 ms | ~0.7 ms |
| 1632 | 19.0 ms | 1088.8 ms | ~1.3 ms |

**Nothing is superlinear.** 12.4× the rows costs the render 12.3× and the build 8.3×, and
the other seven phases — `watchApp`, the collapse restore, `resolveSettings`,
`resolveColumns`, `detectIgnoredGrouping`, `collapseNewParents`, `filter.recompute` —
never reach 1.5 ms between them at any size.

What is wrong is the CONSTANT. The render costs about **0.6 ms per row**, and
`src/view/CLAUDE.md` already states the rule that turns that into the symptom: *"Data
updates still rebuild everything."* So an 832-row expanded tree pays half a second on
every data update, and a write batch ends in one — which is the report.

## What it is not, and how that was got wrong

It is **not** the model build. This note replaces one filed the same day claiming exactly
that, on the strength of subtracting the panel's `render only` median from its `update`
median and calling the difference the build.

That subtraction is not a measurement. The two medians are sampled at different points in
one run and each swings by a hundred milliseconds or more, so their difference came out
anywhere from ~30 ms to ~700 ms across runs — for a quantity direct instrumentation puts
at ~10 ms. One run's ~690 ms was read as a finding and written up as one.

Two instruments were wrong before the third was right, and both failures are the same
mistake in different clothes:

- **The subtraction**, above: a difference smaller than the noise of its own terms.
- **A CPU profile under jsdom**, reached for next: 8.5 s of the sample was garbage
  collection and jsdom's own `SymbolTree`, `setAttribute` and `_detach`. It measured
  jsdom, which is what [[The render path states its costs as checks]] said a benchmark
  there would do. That refusal was written about assertions and holds just as well
  against a profile.

What answered it was timing the phases where they happen, in the browser, with a
temporary patch — thrown away once read.

## Partly addressed: `content-visibility: auto`

`.pbl-row` carries `content-visibility: auto; contain-intrinsic-size: auto 30px` since
2026-08-10, which lets the browser skip layout and paint for rows scrolled out of the
pane. Measured in the harness, folder layout, tree expanded:

| rows | render before | render after |
| --- | --- | --- |
| 232 | ~148 ms | **62 ms** |
| 832 | ~718 ms | **283 ms** |
| 1632 | ~1089 ms | **446 ms** |

Still linear, and still ~0.3 ms per row: this removes most of the LAYOUT half and none of
the DOM-building half. `restoreScroll`'s forced layout — 65% of the render before — drops
from 447 ms to 45 ms; what is left is `renderProjectionContent` building 832 rows that
nobody can see.

It works only because nothing measures a row any more. A `scrollWidth` read on a skipped
row forces that row to lay out alone, so the truncation pass this feature deleted would
have cost 5320 ms against 12 ms with the property on. **Anything added to the render that
measures a row takes this back**, which is stated at the declaration itself.

So the note stays open. The remaining cost is the DOM, and the answer to that is to build
fewer rows — see the axis below.

## Partly addressed: icons cloned, listeners delegated (2026-08-12)

Two constant-factor cuts, specified in [[A row costs its content, not its wiring]]:
`setIcon` parsed each icon's SVG per call, three to five times per row, and now clones a
per-name template (`drawIcon`); each row wired eight-plus listeners (five drag, three
activation), rebuilt on every update, and the pane now carries one delegated set,
resolving the row per event.

**Measured interleaved, because this environment drifts.** The same baseline bundle
measured ~570 ms and ~306 ms for `update` a few hours apart on one machine, so two
single runs compared across time can manufacture — or hide — a 2× effect. The shipped
numbers are A/B: the old and new bundles built side by side, four runs each,
alternating, medians of the panel's medians, 832 rows, folder fixture, tree expanded:

| op | before | after | delta |
| --- | --- | --- | --- |
| update (build + render) | 306 ms | 278 ms | −9% |
| render only | 265 ms | 230 ms | −13% |
| switch to tree | 294 ms | 254 ms | −14% |
| switch to board | 317 ms | 281 ms | −11% |
| mount (collapsed) | 97 ms | 84 ms | −14% |

The roadmap switch read +6% and the deliverables switch +13% of 29 ms; both are inside
this instrument's run-to-run swing, and the roadmap took only the strictly-cheaper icon
change. An earlier draft of this section claimed ~17% and ~25% for the two cuts from
single runs isolated with throwaway patches — retracted for the same reason as the
subtraction above: the instrument's drift was larger than the difference it was asked to
resolve.

Both cuts are constants, not the class: the render is still linear in the rows, still
rebuilt whole per update, and the table at the top still describes its shape. What the
delegation also bought is structural — no handler captures an item at render time any
more, which is the correctness prerequisite for reusing row ELEMENTS across updates, the
class-changing fix this note is still open for.

One honesty note on the panel: the fake `entry` has no `renderTo`, so every plain
property cell here falls into the cheap `setText` catch path. A real vault runs
Obsidian's Bases value renderer per cell and real tooltips, so it pays MORE per row than
these numbers — the direction of the error is known, not its size.

## Where to look

The per-row render path, not the model. `src/view/CLAUDE.md`'s own cost section names the
lever in the sentence quoted above: a data update rebuilds every row, and skipping that
"needs to account for arbitrary chip property values". 0.6 ms/row is the number that makes
the accounting worth doing.

Nothing is proposed here. This note records a measurement; which of virtualisation,
diffing, or a cheaper per-row path is right is a design question with prior art in the
register, and the numbers above are what it should be argued against.

## Live-vault checks owed

Neither can be answered here; jsdom does not implement `content-visibility` and the
harness has no screen reader.

- **A skipped row is still in the accessibility tree.** This is `auto`, not `hidden`, so
  the row remains in the DOM and `aria-activedescendant` still resolves to it — but what
  Obsidian's own Chromium reports to a screen reader for a skipped subtree is unverified.
- **Keyboard navigation to an off-screen row still scrolls to the right place.** The
  placeholder height is `auto 30px` until a row has been drawn once, so a jump into
  never-rendered territory could land slightly off before settling.
- **The drag insertion line and its dot still straddle the row boundary.**
  `content-visibility` brings paint containment, which clips anything a row draws outside
  itself — and those two markers do that deliberately, at `-1px` and `-4px`. The target
  row opts out (`styles/dragDrop.css`), and that the opt-out APPLIES was verified in
  Chromium; that the markers then paint whole is a paint behaviour no check here can see.
  Drag a row above another and look.

## How to check

```
npm run harness
```

then open the printed URL with `?fixture=folders&notes=800&perf`. `?notes=` takes any
size; `?notes=1600` and `?notes=100` are the ends of the table above.

The panel reports whole calls — `update`, `render only`, the projection switches. It does
**not** report phases, and its two medians must not be subtracted for one: that is what
produced the retracted note. Timing a phase means patching the phase.

## Lesson

**An instrument that cannot resolve the quantity will still print a number.** Both wrong
answers here were confidently precise — a 690 ms difference, an 8.5 s profile — and
neither had the resolution to say what it was asked. The check on that is not care; it is
measuring the same thing a second way before believing the first, which is what
`CLAUDE.md` already asks for under *measure a set with an instrument that can see all of
it*. It cost a filed bug note and a pull request paragraph to learn that the rule covers
timings too.
