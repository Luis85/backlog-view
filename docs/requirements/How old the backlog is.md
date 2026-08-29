---
type: Feature
parent: "[[Product Analytics]]"
order: 20
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

# How old the backlog is

Items grouped by age — under a month, a quarter, half a year, a year, older — from the
creation property where the vault keeps one. Age is not staleness: an old item that is
being worked is not a problem, and this only says how long things have been in the list.

**The buckets are whole days and they do not overlap**: 0–29, 30–89, 90–179, 180–364, and
365 or more, each bucket taking its lower bound and leaving its upper one to the next. Days
rather than calendar months because a month is 28 to 31 days and a distribution whose
boundaries move with the calendar cannot be compared with itself; whole days because age is
counted from the creation date to today, both civil dates, with no clock in it. The source
document's `181–365` and `365+` overlapped at a day, which is one item in two buckets and a
distribution summing to more than its population.

**Outcome** — The tail of the backlog is visible as a distribution rather than as a scroll.
