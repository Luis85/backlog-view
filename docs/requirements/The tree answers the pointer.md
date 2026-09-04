---
type: PBI
parent: "[[Assigned work in the sidebar]]"
order: 40
status: Open
created: 2026-09-03
source: user request — my-work UX polish, 2026-09-03
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# The tree answers the pointer

**As** a contributor who reads the my-work tree with a mouse or a finger rather than a
keyboard, **I want** a click to mark the row it opens, a way into Set state without a
right-click, and the tree to keep saying which note is open and what to read next, **so
that** the pointer is a first-class way to use this view rather than a keyboard shortcut
away from working.

## Use case

| | |
| --- | --- |
| **Actor** | A contributor with a person picked in the my-work view, or reading the release scope tree |
| **Trigger** | A `mousedown` on a row, a press of a row's own menu button, a note opened from elsewhere in the workspace, or a switch of the picked person |
| **Preconditions** | The shared scope-tree controller (`view/scopeKeys.ts`) is wired to the tree; a model has been built |
| **Guarantee** | A `mousedown` on a row marks that row (`.pbl-selected`, `aria-activedescendant`) and writes `host.activeRowFile`, in both scope trees, and the `focus` that follows leaves the mark where the pointer put it — never repainting row 0. Every my-work row draws a menu button that opens the identical menu a right-click builds, without opening the note. `.pbl-mw-open` marks the row whose note the workspace has open, follows `file-open`, and survives a redraw. A roster of one person draws a press that picks them. A person switch scrolls the drawn Next row into view. Neither tree's context-row emphasis costs contrast on the parts that still carry information. |

**Main flow**

1. The reader clicks a row. The shared controller's delegated `mousedown` listener
   (`wireScopeKeys`, `src/view/scopeKeys.ts`) resolves `.closest('.pbl-row')` against the
   event target, finds that row's index in the draw's own `rows` array, and calls
   `moveTo(at)` — the same function a keyboard move calls — before the browser's own
   `focus` event reaches the tree's `focus` listener. The row the pointer landed on is
   marked; the tree's `focus` handler has nothing left to correct.
2. The reader presses a row's own `.pbl-mw-menu` button (an `ellipsis` icon, drawn last
   in every row, context rows included). Its `click` calls `showMyWorkRowMenu` — the
   same builder the right-click and keyboard Menu-key paths already call — so all three
   entry points open one `Menu` with identical entries, and the press never opens the
   note underneath it.
3. The reader opens a note from elsewhere (a link, the graph, another pane). The view's
   `file-open` subscription (`watchApp`, wired the first time data updates) calls
   `syncOpenRow`, which toggles `.pbl-mw-open` across the last draw's row elements
   against `workspace.getActiveFile()?.path` — no tree scan.
4. The reader switches the picked person. `render()` compares the new pick against the
   one it last drew; on a switch, it scrolls the fresh draw's Next-marked row into view
   instead of restoring the previous scroll offset (which belonged to the person just
   left). A same-person redraw still restores that offset, clamped to the fresh
   `scrollHeight`.
5. A vault with exactly one declared resource draws the no-pick guidance with an added
   `mod-cta` press reading the person's name; picking it calls `view.pick(path)` — never
   an automatic pick, since `pick(null)` and "never picked" share one stored value and an
   auto-pick would silently undo a deliberate clear.

**Extensions**

- **1a — the `mousedown` lands on a control inside the row** (the disclosure, or the row
  menu button). `wireRowOpen`'s shared `fromControl` guard — `evt.target.closest('button')
  !== null` — asks one receiver-side question of both the `click` and `auxclick`
  listeners, so neither tree has to name the other's control classes to stay correct
  under a scroll-selection guard already shared. This governs whether the *row opens*,
  which is separate from and unaffected by the roving-selection mark landing correctly
  under 1.
- **1b — the `mousedown` lands on the tree's own padding, not on a row.**
  `.closest('.pbl-row')` finds nothing (`at === -1`); nothing is marked, and `moveTo` is
  never called.
- **2a — the row is a context ancestor.** The menu button still draws and still opens
  a menu, but the menu itself withholds Set state and the parent-link actions, per
  the context-row rule this Feature's sibling PBIs already state; Open and Open in a new
  tab remain.
- **3a — no tree is drawn** (the no-pick or no-roster guidance screens). `watchApp`
  still subscribes, but `syncOpenRow` has no `rowEls` to toggle against, and nothing is
  marked until a tree is next drawn.
- **4a — the Next-marked row did not survive `visibleRows`** (folded under a collapsed
  ancestor). `renderTree.ts` publishes `null` for the view's `nextRowEl`, and `render()`
  falls back to the offset-restore branch rather than scrolling to nothing.
- **5a — the roster holds more than one person, or none.** No press is drawn; the
  no-pick guidance reads exactly as it did before this change.

## Acceptance criteria

- A `mousedown` in either scope tree marks the row it lands on and writes
  `host.activeRowFile`; a following `focus` leaves that mark where it is.
- Every my-work row draws `.pbl-mw-menu`, opening the identical menu `showMyWorkRowMenu`
  builds for a right-click, and its press never opens the note.
- `wireRowOpen` asks ONE receiver-side question of both gestures — did the event begin
  on a `button` inside the row — rather than naming one tree's control classes.
- `.pbl-mw-open` marks the row whose note the workspace has open, follows `file-open`,
  and survives a redraw. It is never `.pbl-selected`.
- The no-pick state draws `.pbl-mw-solo` exactly when the roster holds one person, and
  no stored value distinguishes "never picked" from "cleared".
- A person switch scrolls the drawn Next row into view; a same-person redraw restores
  the offset instead.
- `.pbl-mw-context` and `.pbl-rel-context` carry no `opacity` over the whole row.

## The row menu button, at width — and what stays unverified here

`A tree that fits a sidebar` measured this row to the pixel at 200–500px before the menu
button existed; this button is a new term in that same measurement, re-read in the
harness (`npm run harness -- test/harness/mywork.ts`, headless Chromium over raw CDP —
no `playwright` package is installed here) at four widths against a fixture whose
deepest row carries the Next marker:

| width | pane width | button right (ordinary row) | button right (row w/ Next marker) |
| ---: | ---: | ---: | ---: |
| 200 | 199 | 187 (fits, 12px margin) | 219.97 — 21px past the pane edge |
| 240 | 239 | 227 (fits) | 227 (fits) |
| 260 | 259 | 247 (fits) | 247 (fits) |
| 600 | 599 | 587 (fits) | 587 (fits) |

Only the one row, only at 200px: the Next marker is a fixed ~36px that was already
pushing the state chip past the row's edge before this button existed, and the button —
drawn after the chip — is pushed the rest of the way outside `.pbl-tree`'s own
`overflow-x: hidden`. Nothing clips at 240px, 260px or 600px, on any row.

The fix is a narrow-width fallback nested inside the existing `@container (max-width:
260px)` block, guarded by `@media (hover: hover)`:

```css
@media (hover: hover) {
	.pbl-mw-view button.pbl-mw-menu {
		display: none;
	}
}
```

A hover-capable pointer below 260px loses the button and keeps the right-click; a touch
pane, which has neither hover nor right-click, keeps the button as its only route to the
menu — the `@media (hover: none)` rule that always reveals it is untouched.

**What this can and cannot say, stated plainly.** This sandbox's headless Chromium
reports `matchMedia('(hover: none)')` as true unconditionally — confirmed directly, and
unmoved by forcing `Emulation.setEmulatedMedia` to claim a hover-capable pointer — so
every width was re-measured under the branch this environment actually renders (the
always-visible, touch-shaped one), and the button was confirmed present and un-clipped
at 240px, 260px and 600px under it. **The `(hover: hover)` branch — the button
disappearing below 260px for a mouse — was never render-verified**, only confirmed from
the built stylesheet: the rule nests correctly inside the container query
(`test/view/mywork/narrow.test.ts` asserts the selector, its `display: none`, and its
position after the base rule, read from the partial's own source (`styles/mywork.css`),
not from computed layout — jsdom computes none). Watching the button actually vanish at
200px under a real mouse is a live-vault or live-browser check this environment cannot
perform.

## Where it lives

- `src/view/scopeKeys.ts` — the shared `mousedown` listener (`wireScopeKeys`) that marks
  a row on a pointer-down for both scope trees.
- `src/view/scopeRow.ts` — `wireRowOpen`'s shared `fromControl` guard, asked by `click`
  and `auxclick` alike, over one selector (`button`) rather than either tree's class
  names.
- `src/view/mywork/renderTree.ts` — draws `.pbl-mw-menu` on every row (`drawRowMenuButton`,
  wired to `showMyWorkRowMenu`), publishes `view.nextRowEl` from the same walk that
  computes the Next marker.
- `src/view/mywork/myWorkView.ts` — `watchApp`/`syncOpenRow` for `.pbl-mw-open`,
  `drawSoloPress` for the roster-of-one press, and `render()`'s person-switch vs.
  same-person scroll branch (reading `nextRowEl` through a local `as HTMLElement | null`
  read — a TS 6.0.3 control-flow narrowing gap this repo's pinned compiler has, confirmed
  by a standalone reproduction, not a stray cast). Also draws the loading state through
  the shared `renderLoadingState` (`view/render/emptyStates.ts`) rather than the bare
  line of text it used to be — no catalog key of this view's own, see the design note's
  own "Not in this change" for why the earlier refusal was of a different shape.
- `styles/mywork.css` — `.pbl-mw-menu`'s reveal rule, the `@media (hover: hover)` narrow
  fallback, `.pbl-mw-open`, and `.pbl-mw-context`'s per-element emphasis (`.pbl-title`
  colour, `.pbl-badge` opacity) in place of the old whole-row `opacity`.
- `styles/releaseScope.css` — `.pbl-rel-context`'s identical per-element emphasis; the
  release tree draws no menu button and no open-note marker, since neither of those
  question the release scope answers.

**One claim from the plan that shipped false, corrected here rather than repeated.**
The old `.pbl-mw-context`/`.pbl-rel-context` rule was `opacity: 0.62` over the whole row,
and both the plan and an early draft of this change's own comments said that dimmed "the
badge and the state chip along with the title." A context row never draws a state chip —
`drawScopeStateChip` (`src/view/scopeRow.ts`) returns early on `row.context`, for both
trees — so there was never a chip for that opacity to dim. What it actually did was dim
the badge and the title together, and multiply the title's own `--text-muted` down below
the contrast floor a theme picked that token to clear. The fix reads: a muted title
colour, and a softened badge, with no chip claim anywhere in it.

**What is still owed.** A themed vault's own colours and accent, anything Bases hands
the view, and how the pane feels dragged into a real Obsidian sidebar at a width a
reader actually resizes to — Obsidian cannot run here, and nothing above claims
otherwise. The context-row emphasis was looked at with the harness on Obsidian's own
default colours (600px and 240px) and read clearly quieter without losing legibility on
any of its three parts; that is an eyes-on-a-screenshot observation, not a measured
contrast ratio. The `(hover: hover)` narrow fallback is verified from the stylesheet
source, not from a rendered, hover-capable browser, for the reason stated above.
