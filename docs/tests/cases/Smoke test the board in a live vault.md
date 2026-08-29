---
type: Test case
order: 40
parent: "[[Smoke test the board]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-01
source: Product Kanban epic design
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Smoke test the board in a live vault

**Covers** [[Product Kanban]].

## Why this exists

The jsdom harness will drive the board's structure and writes the way it drives the
tree's, and it renders nothing — the same gap [[Smoke test the visual changes]] records
for the tree, opened here in advance because a board is mostly appearance and gesture.
Everything below needs eyes in a `npm run test-build` vault, and none of it can be
asserted in this repository. Run it once the epic's features land, and re-run it when
board markup or `styles.css` changes; `docs/` itself is the test data, since this base
carries states.

**Preconditions** — the Kanban epic's features have landed; `npm run test-build` has
installed the plugin, and a Base is pointed at `docs/`, which carries states.

## How to check

- **The toggle** — mode survives an Obsidian restart on the same device (it is UI
  state in vault-scoped localStorage, never the `.base` — confirm the `.base` file is
  untouched by toggling), and two saved views of this one base hold different modes at
  once.
- **Drag, on a desktop** — the column highlight is the only drop signal; auto-scroll
  engages near the pane edges only while moving toward them; the drag preview stays
  legible over both themes; with reduced motion set, nothing slides and the landed
  card still flashes its arrival.
- **Touch, on a phone or tablet** — the chosen engine claims full iOS and Android
  support while the ecosystem's experience says native drag from touch has not fired
  in these WebViews ([[Pragmatic drag and drop for the board]]): observe which is
  true on a device, confirm the context menu changes state end to end regardless,
  and record whether drag ships on touch or stays menu-only. That decision belongs
  on evidence from a device, not a guess in a spec.
- **Without a pointer** — with a screen reader on, tab into the board once and confirm
  the hidden instructions are read; then move a card by Alt+Left/Right and by the card
  menu's Set state, and confirm each move is spoken with the card and both column names
  ([[Keyboard, menu and touch]]). The live region is the drag library's, announced on a
  delay so a focus change cannot interrupt it — whether that delay reads as prompt or
  as lost is exactly the question jsdom cannot answer.
- **Collapse** — collapsed done columns and lanes come back collapsed after a restart,
  and renaming the base keeps them (the identity migrations cover the board's keys).
- **Themes** — light, dark, and one community theme: column headers, over-limit
  signals and done styling all read without colour being the only difference.
- **Scale** — a few hundred cards render and drag without jank; the tree's render
  budget applies to the board's passes too.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| 2026-08-02 | **0.3.0** on Windows desktop, after the esbuild 0.28 and TypeScript 6 upgrades (PRs #45, #48) | The plugin loads clean, cards drag between columns, the mode toggle and collapsed columns survive a restart, auto-scroll engages only toward a pane edge, the drag preview reads over both themes, reduced motion behaves, and a few hundred cards render and drag without jank. Nothing needed adjusting in `styles.css`. **A partial pass** — see what remains, below. |

That run also carried a second job. `@atlaskit` is the only third-party code in
`main.js`, and esbuild is what inlines it, so dragging a card is what verified the
bundler major end to end — the one thing the structural bundle checks in PR #45 could
not do. A `-noEmit` compiler bump cannot reach the bundle at all, so TypeScript 6 needed
nothing here.

**What remains, and why this case stays open.** Three lines are wholly unrun:

- **Themes** — light and dark were exercised only incidentally, by the drag preview
  staying legible over both. The line's actual subjects were not inspected — column
  headers, over-limit signals and done styling, each readable without colour being the
  only difference — and **no community theme was used**.
  [[Light, dark and reduced motion]] requires the theme be *named* when it is:
  "checked against a community theme" is not evidence a year later if nobody wrote down
  which one. So this line needs a named theme, not a re-assertion.
- **Touch, on a phone or tablet** — unanswerable without a device, and the one carrying
  a real decision rather than a check: whether drag ships on touch or stays menu-only.
  See [[Pragmatic drag and drop for the board]].
- **Without a pointer** — the screen-reader pass. A desktop *can* run it; this run did
  not. The live region's announcement delay is the specific unknown.

And two more are **partially** run. Both are multi-part lines whose restart case passed
and whose remaining cases were never exercised, so neither can be read as settled:

- **The toggle** — mode surviving a restart is confirmed. Not checked: that toggling
  leaves the `.base` file **untouched**, which is the whole claim behind the mode being
  UI state rather than a base setting; and that two saved views of this one base hold
  different modes at once.
- **Collapse** — collapsed *columns* returning collapsed is confirmed. Not checked:
  *lanes*, and whether **renaming the base** keeps collapse state. That second one is
  the identity migrations for the board's keys, and it is the case most likely to break
  quietly, for the reason [[Verify base identity in a live vault]] gives.

That distinction is the point of writing it this way. An issue whose acceptance criterion
is "every line above checked" must not be closable on a summary that quietly counted a
partly-run line as done.

## Acceptance criteria

- Every line above checked in a live vault, with anything adjusted landing in
  `styles.css` or a recorded follow-up — a behaviour change found here means a spec
  note was wrong and gets corrected, not patched around.
