---
type: Feature
parent: "[[Multilang]]"
order: 20
status: Open
---

# Every surface translated

The sweep: every one of the ~141 string sites moves into the catalog, and the layout
still works when the words that come back are longer, shorter or run the other way.

Split by surface rather than done as one change, because the surfaces have genuinely
different risks — the toolbar is text in a fixed-width strip, the view options are text
next to keys that must not move, and the modals are text the user reads while deciding
something. Each PBI is reviewable on its own and each has its own jsdom tests to keep
honest.

One rule spans all of them: **translating a string must not change what the view does.**
These PBIs are text moves. Any behaviour change found on the way is a separate note.
