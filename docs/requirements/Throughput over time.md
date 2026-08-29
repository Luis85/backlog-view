---
type: Feature
parent: "[[Product Analytics]]"
order: 40
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
priority: ""
iteration: ""
---

# Throughput over time

How many items reached a done state per period, from the completion stamp the board already
writes. Items finished before stamping existed, or finished outside the plugin, are counted
as unknown and reported as such rather than as zero.

**That takes two keys, not one, and this view names both.** A missing stamp says nothing on
its own — an unfinished item has none either — so the date key alone cannot tell a finished
item nobody stamped from work still in progress, and a view reading only dates reports every
open item as unknown throughput. So this view names the **state key and the values that count
as done** for itself, exactly as [[The release summary]] does for progress, and the
classification is the pair: done with a stamp is throughput in that period, done without one
is unknown, not done is neither.

**Without both, the metric is unconfigured rather than approximate.** There is no useful
fallback: with no state key every undated item is a candidate, so an ordinary backlog reports
its open work as unknown completions, which is the exact ambiguity the two keys exist to
resolve, restated as a number. So the view says which key is missing and measures nothing,
the way an unconfigured rule in [[Rules that say what is wrong]] is listed rather than run.

**Outcome** — The pace of delivery is readable, with the gaps in its evidence stated.
