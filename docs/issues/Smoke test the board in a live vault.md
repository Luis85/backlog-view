---
type: Issue
order: 50
parent: "[[Product Kanban]]"
status: Open
priority: P2
area: verification
created: 2026-08-01
source: Product Kanban epic design
---

# Smoke test the board in a live vault

## Why this exists

The jsdom harness will drive the board's structure and writes the way it drives the
tree's, and it renders nothing — the same gap [[Smoke test the visual changes]] records
for the tree, opened here in advance because a board is mostly appearance and gesture.
Everything below needs eyes in a `npm run test-build` vault, and none of it can be
asserted in this repository. Run it once the epic's features land, and re-run it when
board markup or `styles.css` changes; `docs/` itself is the test data, since this base
carries states.

## What to look at

- **The toggle** — mode survives an Obsidian restart, and two saved views of this one
  base hold different modes at once.
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
- **Collapse** — collapsed done columns and lanes come back collapsed after a restart,
  and renaming the base keeps them (the identity migrations cover the board's keys).
- **Themes** — light, dark, and one community theme: column headers, over-limit
  signals and done styling all read without colour being the only difference.
- **Scale** — a few hundred cards render and drag without jank; the tree's render
  budget applies to the board's passes too.

## Acceptance criteria

- Every line above checked in a live vault, with anything adjusted landing in
  `styles.css` or a recorded follow-up — a behaviour change found here means a spec
  note was wrong and gets corrected, not patched around.
