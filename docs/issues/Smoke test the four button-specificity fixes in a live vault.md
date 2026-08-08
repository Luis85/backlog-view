---
type: Issue
order: 50
parent: "[[Children on the card]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-08
source: Fix for [[Four other controls still lose to Obsidian's button rule]], task-15
files:
  - styles/columns.css
  - styles/tags.css
  - styles/cards.css
---

# Smoke test the four button-specificity fixes in a live vault

## Why this exists

[[Four other controls still lose to Obsidian's button rule]] gave the state chip, the
horizon chip, the tag remove button and the card's match link the same
element-qualified-selector fix `styles/cardChildren.css` already used, and
[[Smoke test the card children in a live vault]] records for that disclosure: the jsdom
harness renders nothing, and the fix was verified only in the browser harness against the
real vendored `app.css` — not against Obsidian itself. `docs/` is the test data, since it
carries tags, states and horizons for a live Base to show.

## How to check

- **The state and horizon chips, in both themes** — point a Base at `docs/`, configure a
  state and a horizon property (`docs/Product Backlog.base` already does), and look at
  the tree and the board. Each chip should read as a bordered pill on
  `--background-secondary`, not a filled, boxed native button; hovering should shift to
  `--background-modifier-hover`; `Tab`-focusing one via assistive tech (or forcing focus
  from devtools, since these are `tabindex="-1"`) should show a visible outline around
  the pill rather than Obsidian's own 3px ring or no indicator at all.
- **The tag remove button** — add a few tags to a note, hover the row. Each tag's `×`
  should stay invisible until the row (or the tag pill's own focus) reveals it via
  opacity, and once visible should read as bare chrome — no boxed button underneath —
  that reddens on its own hover.
- **The card's match link** — switch to the board, type into the quick filter so a card
  hides a deeper match, and look at the link under the card. It should read as a small
  muted pill with left-aligned, truncating text (not centred), filled with
  `--background-modifier-hover` and darkening further on hover, with no boxed button
  chrome underneath.
- **Nothing else moved** — the chips' border, padding and icon sizing, the tag remove
  button's 12px box and its opacity transition, and the card match link's truncation
  should all look exactly as before this fix; only the fill, the shadow and the focus
  ring were ever wrong.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| 2026-08-08 | harness only, both before and after the fix (`.superpowers/sdd/2026-08-07-card-children-expansion/task-15-report.md`) | All four confirmed showing Obsidian's filled `--interactive-normal` chrome and its `--input-shadow` before the fix, and the plugin's own values after — measured with Playwright against the real vendored `app.css`, not in Obsidian. **Not yet run in a live vault.** |

## Acceptance criteria

- Every line above checked in a live vault, in both light and dark themes, with anything
  adjusted landing in `styles/columns.css`, `styles/tags.css` or `styles/cards.css` — a
  behaviour change found here means the fix's own judgment of each control's intended
  appearance was wrong, and gets corrected there rather than patched around.
- The run records each of the four as confirmed fixed, or reopens whichever is not.
