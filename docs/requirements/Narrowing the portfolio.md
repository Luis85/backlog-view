---
type: Feature
parent: "[[Product Portfolio]]"
order: 50
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

# Narrowing the portfolio

The aggregate can be narrowed to a product, a domain, an owner, an objective, a release or
a status — filters over the same population the rollups counted, so a narrowed view's
numbers always describe what is on screen.

**Each filter is a key this view names**, and three of them are keys the rollup did not
already need: the **owner**, the **objective link** and the **state**, beside the release and
the grouping property [[Rolling a portfolio up]] and [[Levels above the epic]] already
declare. A filter reads no other view's settings — a portfolio narrowed by a state key it
borrowed from a board would change meaning when somebody reconfigured that board — and **a
filter whose key is unconfigured is not offered at all**, rather than offered and always
empty. The list of filters a vault sees is therefore the list it configured, which is also
the honest answer to "why can I not filter by owner here".

**Outcome** — A portfolio question can be asked about one slice without leaving the view.
