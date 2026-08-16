---
type: Feature
parent: "[[Product Strategy]]"
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
---

# Work with no strategy behind it

The complement of the alignment link, counted and listed: how many items the base returned,
how many name a strategic entity, and which ones do not. An unaligned item is a question,
not an error — some work is maintenance and says so.

**The strategy tree is not part of the population it measures.** The base returns the
strategic entities too — [[The strategy hierarchy]] has to draw them — and they relate to each
other with `parent` rather than the work-side alignment property, so counting every returned
note would report the strategy itself as work answering to nothing. The view already knows
which notes those are: it built the tree from them. **A note in that tree is excluded from
both the count and the list**, and no new type list or marker property is added to say so.

The tree is what the alignment links point at, plus everything connected to those by `parent`,
which leaves one case the view cannot see: a strategic note nothing aligns to and nothing
hangs from looks exactly like an unaligned item. That is the base's own filter, on the terms
[[A view per capability]] states for every family that is not work — visible and fixable,
rather than a discriminator the plugin invents.

**Outcome** — Work that answers to nothing becomes visible instead of accumulating quietly.
