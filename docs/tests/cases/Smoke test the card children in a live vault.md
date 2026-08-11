---
type: Test case
order: 30
parent: "[[Smoke test appearance and chrome]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-08
source: Card children expansion increment
files:
  - src/view/render/cardChildren.ts
  - src/view/childrenList.ts
  - src/view/interactions/menu.ts
  - styles/cardChildren.css
---

# Smoke test the card children in a live vault

**Covers** [[Children on the card]].

## Why this exists

The jsdom harness drives the disclosure's structure and its writes the way it drives
everything else's, and it renders nothing — the same gap
[[Smoke test the board in a live vault]] records for the board, opened here for the same
reason: a disclosure living inside a card is mostly appearance and space, and neither is
something a DOM assertion can see. Run it once the feature lands, and re-run it when the
disclosure's markup or `styles/cardChildren.css` changes; `docs/` itself is the test
data, since several of its epics carry children a card can list.

**Preconditions** — the card-children feature has landed; `npm run test-build` has
installed the plugin, and a Base is pointed at `docs/`, whose epics already carry
children a card can list.

## How to check

- **How the disclosure looks, in both themes** — open a card with children on the board
  and on the roadmap, in light and dark. Check the toggle, the chevron and the child list
  read as part of the card rather than as a bolted-on control, and that a done child's
  muted styling is still legible against the disclosure's own background in both themes.
- **Whether an expanded card scrolls sensibly inside a column** — expand a card with
  several children in a board column short enough to need scrolling. Check the column
  scrolls to reveal the rest of the list rather than the card overflowing its column or
  the board gaining a second, competing scrollbar.
- **Whether a long child title truncates rather than widening the card** — expand a card
  with a child whose title is much longer than the card is wide. Check the title
  truncates (with an ellipsis or equivalent) and the card's own width holds, rather than
  the card growing to fit it and breaking the column's or bucket's layout.

## Runs

| Date | Against | Outcome |
| --- | --- | --- |
| 2026-08-08 | `83050b7`~1 (pre-fix) | **Failed.** Three real defects: button chrome on the toggle and on each entry (a filled, boxed `<button>` look Obsidian paints underneath the plugin's own reset), too little spacing around the disclosure, and centre-aligned entries. Root cause: [[Obsidian's button rule outranks the plugin's chrome-stripping]] — the plugin's class-only selectors lost to Obsidian's own `button:not(.clickable-icon)` on specificity, regardless of source order. |
| — | — | Needs re-running against `a686c3d`. The fix is verified in the harness, against the real vendored `app.css` — not in a vault; see the Bug note above and [[The disclosure's hover still painted a button fill]] for the hover regression `83050b7` introduced along the way. |

## Acceptance criteria

- Every line above checked in a live vault, in both light and dark themes, with anything
  adjusted landing in `styles/cardChildren.css` or a recorded follow-up — a behaviour
  change found here means [[Children on the card]] was wrong and gets corrected, not
  patched around.
- The re-run against `a686c3d` records button chrome, spacing and alignment as fixed, or
  reopens whichever is not.
