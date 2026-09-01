---
type: Feature
parent: "[[My work]]"
order: 10
status: Open
area: product
created: 2026-08-31
source: user request, 2026-08-31
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# Assigned work in the sidebar

**A flat hit list cannot say what is next.** A contributor moves between their own items
all day. Today they search their own name, or read the backlinks on it, and get matches
with no rank and no hierarchy — the two things that make a backlog answer "what is next"
rather than "what mentions me". Bases can filter on `assignee`, but that answer costs a
saved view per person, which is the price [[My work]] exists to remove.

This feature is that epic's first surface: a **Bases view of its own**, showing one
person's work as a backlog tree, with the person picked in the view rather than in the
Base. Where it is docked is Obsidian's business, not the plugin's — a `.base` tab drags
into the left sidebar already — so what the plugin owes beyond the view is that the tree
survives that width: a toolbar, columns and chips that give way, and a tree still
readable in a narrow pane.

**Outcome** — One saved view, docked wherever the contributor wants it, answers "what is
mine, what is next" in plan order without evicting the note they are reading.

## Landmines, before implementation

The order matters here, and getting it wrong is not loud: each of the three shapes below
draws a working panel and loses a guarantee somewhere else in the plugin.

**It is a Bases view, and that is the decision rather than the default.** A standalone
`ItemView` is the obvious way to put something in a sidebar, and it is the alternative
[ADR 0001](../adrs/0001-build-on-the-bases-custom-view-api.md) already refused: query,
filter, sort and property configuration would all be rebuilt, badly, and every backlog
would be locked inside one plugin's storage. Registering a view and letting the user drag
the tab is what makes that refusal survive contact with this request.

**A surface with no Base has nothing to refuse a write with.** The context-row rule is
stated against `outsideFilter`, and that set exists only because a Base said what was in
scope. A panel that walked the vault directly would have no filter, so
[[My work]]'s "every write goes through the same gate and the same context-row refusals"
would be true of nothing — and the failure is silent, because the writes all succeed.

**A surface with no `.base` leaf has no store identity.** The view-state store keys each
entry by base path and view name, resolved by walking for the `FileView` holding the
view, and falls back to session-only when that resolves to nothing. The person pick is
device UI state ([ADR 0011](../adrs/0011-keep-collapse-state-out-of-the-base-file.md)),
so on a non-`.base` surface it would be re-picked every restart — on the one view that is
open all day.

[[The roster comes from the notes]] is done, so this feature does not wait on it: the
picker lists declared people from the start, as [[My work]] requires.
