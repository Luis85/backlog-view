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

`columnFit` budgets with the same width, through the same `metaColWidth` call. It did not
at first — the fit kept the flat constant and this note called the difference slack — and
review was right that it is not: at a fit boundary the row's flexible middle is already at
zero and `.pbl-tree` is `overflow-x: hidden`, so the extra width came out of the end of the
row instead of out of room that was no longer there. The pixels the fit sums are a
per-digit ceiling (8px, over the ~7.2px a figure measures at the default 12px label)
rather than a measurement; the `ch` on the label is what holds the layout exact where the
two differ, which is a phone whose text size lifts `--font-ui-smaller` past 12px. There the
fit is a few pixels optimistic and the lane still grows, which is the direction that costs
slack rather than a clipped row.

## What checks it

- `test/view/rollupReservation.test.ts` — the reservation is the widest label in the tree
  and not the row's own, nothing is reserved where there is no bar to push out of line,
  a re-render with no reservation takes the stale one back off (the tree element outlives
  the render, so `setCssProps` alone would leave it), and a tree whose labels widen the
  lane drops a column the same pane held before — the fit and the stylesheet reading one
  number. The last two came from review (Codex, PR #153). Each was watched failing.
- `test/harness/harness.test.ts` — `?fixture=edges` draws `1/3`, `3/10` and `40/120` on
  sibling rows, so the case someone would look at is still there to look at.
- Neither asserts alignment: jsdom computes no stylesheet, and appearance is not asserted
  here at all ([ADR 0020](../adrs/0020-the-browser-harness-draws-it-does-not-assert.md)).
  The bars were looked at in Chromium against `?fixture=edges`, before and after. A vault
  is still where a theme's own font is answered for — `ch` is exact for every font, but a
  theme that turns tabular figures off is a case nothing here can see.
