---
type: Feature
parent: "[[Release Management]]"
order: 25
status: Active
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Putting work in a release

An item joins a release by naming it, and something has to write that name. This feature is
that write: one value into the membership property [[What is in a release]] defines, offered
from the item wherever the item is — the backlog, the board, the roadmap — and from a
selection of items at once.

**Nothing in this epic wrote the membership property before.** [[Trying a scope change]]
commits a whole proposed scope, which is the bulk case at its largest and the wrong tool for
"this one goes in 2.4"; [[Moving a card between slices]] writes it too, but only from a
storymap's slice rows, which a vault with no storymap never draws.
[[Bulk edits on a selection]] already says its release action is waiting on this epic to give
an item a release property to hold, and names the rule it is waiting on: **a bulk action
exists for a property that exists.**

**The view that offers the action names the membership key it writes.** The backlog, the
board and the roadmap are three projections of **one** registered view, so they share one
option set and one such key between them — but that key is the backlog view's own, never the
release view's, and the two may legitimately be pointed at different properties. Each defaults
to the same suggestion, which is [[Settings scoped to their view]]'s rule exactly: sharing a
suggestion is not sharing a setting. Where the offering view has no membership key bound the
action is simply absent there, whatever the release view is configured to do — and a vault
with no release view at all still gets the action, because nothing about it depends on that
view existing.

**It is one write, and it obeys the register's shape for one.** One host method plans the
batch, three inputs reach it — the item's context menu, the keyboard, and a drag where a view
has somewhere to drag to — and the method is the only place the move is announced. A fourth
input calls that method; it does not plan a write beside it.

**Membership is set and cleared, and clearing removes the key.** An item in no release has no
value where the property looks, not an empty one — the same rule the roadmap's shelf keeps
when it un-places a card, and the same reason: an empty string is a value, and a view that
wrote one would report an item as belonging to a release called nothing. The menu's checkmark
is asked of the plan — an entry is checked exactly when picking it would write nothing —
never of a comparison written beside it.

**The releases offered are the ones the results hold.** A release note the base excluded is
not offered as a target and is refused if a batch names it, because a release the user cannot
act on is not a place the user can put work. That is the context rule, applied to the other
end of a link.

**Outcome** — Work gets into a release by one gesture from wherever it already is, and gets
out again the same way.
