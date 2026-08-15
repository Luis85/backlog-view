---
type: Bug
parent: "[[Rollups and hiding finished work]]"
order: 10
status: Done
area: styling
priority: P2
created: 2026-08-15
closed: 2026-08-15
source: User report from a live vault of well over 800 PBIs — progress bars on rows whose counts have 1, 2 and 3 digits do not line up
files:
  - src/view/render/columns.ts
  - src/view/render/rows.ts
  - styles/columns.css
  - test/helpers/fixtures.ts
  - test/harness/harness.test.ts
  - test/view/rollupReservation.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Bars drift out of line as the counts grow

## What happened

In a vault of well over 800 PBIs, the tree's progress bars do not share a left edge. A row
counting under ten items, one counting tens and one counting hundreds each draw their bar
at a different x, so the column reads as ragged — worst in exactly the backlog big enough
to need it, since that is the one where the three widths occur together.

## Why

The rollup lane (`.pbl-meta-col`) is 84px wide and anchored at its END, and it holds a
48px bar, a 4px gap and the label. The label reserved a flat `min-width: 28px`, which
holds `9/99` and nothing longer. A label wider than its reservation therefore widens the
group, and because the group is anchored on the right, the extra width comes off the
LEFT — moving the bar. `0/3` and `44/136` differ by about 13px, which is a quarter of the
bar's own length.

Nothing in the repository could see it. The suite asserts labels and classes, not
geometry; the browser harness draws real CSS, but no fixture had a three-digit count —
`demoVault()` is curated and small, and `addBulk`, which `?notes=` grows either backlog
with, nests one Epic per 25 notes, so its widest label is two digits over two at every
size. The case existed only in real vaults.

## The fix

Every row reserves the widest label THIS TREE draws, so all the labels occupy one width
and every bar starts in one place. `rollupReservation` (`view/render/columns.ts`) asks
`rollupReport` for each item's label and takes the longest, `renderTree` publishes it as
`--pbl-rollup-label` beside the other geometry it owns, and the stylesheet reserves it on
the label and lets the lane grow to hold it.

Two details are borrowed rather than invented, both from `syncBusyCount`
(`view/render/toolbarBusy.ts`), which solved the same problem for the write indicator's
count: the reservation is in `ch` with `font-variant-numeric: tabular-nums`, because `ch`
is the advance of "0" and tabular figures give every digit that same advance — so the
reservation is exact rather than approximate, and re-resolves by itself on a theme or font
change where a measured pixel goes stale.

`columnFit` still budgets with the flat `META_COL_WIDTH`, so a tree whose labels take the
wider branch spends those pixels from the row's flexible middle rather than from the
column count. That is the same accepted inexactness the gap terms in that constant already
carry, and it is stated at the rule in `styles/columns.css`.

## What checks it

- `test/view/rollupReservation.test.ts` — the reservation is the widest label in the tree
  and not the row's own, nothing is reserved where there is no bar to push out of line,
  and a re-render with no reservation takes the stale one back off (the tree element
  outlives the render, so `setCssProps` alone would leave it — Codex, PR #153). Each was
  watched failing.
- `test/harness/harness.test.ts` — `?fixture=edges` draws `1/3`, `3/10` and `40/120` on
  sibling rows, so the case someone would look at is still there to look at.
- Neither asserts alignment: jsdom computes no stylesheet, and appearance is not asserted
  here at all ([ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md)).
  The bars were looked at in Chromium against `?fixture=edges`, before and after. A vault
  is still where a theme's own font is answered for — `ch` is exact for every font, but a
  theme that turns tabular figures off is a case nothing here can see.
