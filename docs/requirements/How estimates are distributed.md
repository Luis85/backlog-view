---
type: Feature
parent: "[[Product Analytics]]"
order: 70
status: Open
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# How estimates are distributed

The spread of estimates across the backlog, in whatever the vault estimates in, with the
unestimated population as its own bar rather than as a hole in the chart.

**One bar per distinct value, and no bins.** The value is not read as a quantity at all: it
is grouped exactly as written, numbers ordered numerically and everything else
alphabetically, so `3` and `3.0` are one bar and a vault estimating in `S`/`M`/`L` needs no
second mode. That answers a question binning cannot — most backlogs estimate in a small
vocabulary, and a chart of it is the vocabulary — while any bin width, quantile or bucket
count would be a boundary somebody has to argue about, moving items between bars without
anybody editing a note.

The cost is stated rather than discovered: a vault estimating in person-days to two decimals
gets a very wide chart. The answer there is a coarser estimate property, not a setting on
this view — a distribution over values nobody chose deliberately is a picture of the data
entry, and the chart showing it plainly is the honest version.

**Outcome** — How much of the plan is sized, and how it is sized, are both visible.
