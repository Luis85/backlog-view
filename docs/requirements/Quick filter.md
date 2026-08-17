---
type: PBI
parent: "[[Finding work]]"
order: 10
status: Dropped
closed: 2026-08-17
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# Quick filter

**Withdrawn on 2026-08-17, at the user's request: Obsidian Bases carries its own search now,
so this was a second search box over the same rows.** Everything below is what it WAS, kept
because a dropped note is a record — the shape is unchanged so the register can still read
it, and only this paragraph and `## Where it lives` are new.

What replaces it is the Base's own filtering, which this view already handles: a narrowed
result set arrives as fewer results, and [[Filtered bases keep their tree]] loads the
ancestors those results need, so a Bases search still reads as a tree rather than a flat
list. The shelf's own search stays ([[Searching the shelf]]) — scoped to the untriaged work
rather than to the whole view, which is the trade a reader digging through the shelf wants
and the one this box could not make.

**As** someone with a backlog too big to scan, **I want** to type a word and see the
matches *with their place in the tree*, **so that** I find the item and can still tell
what it belongs to — which a flat list of matches cannot say.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Typing in the toolbar's filter box, or pressing `/` in the tree |
| **Preconditions** | The tree has rows |
| **Guarantee** | The filter is **session state**: never written to the `.base` file, never to local storage, never anywhere. Clearing it returns the tree exactly as it was. |

**Main flow**

1. The user types a word into the filter box.
2. Titles are matched against it, case-insensitively.
3. Every match renders with its **ancestors** — so its place is visible — and with its
   whole subtree.
4. The matched substring is highlighted in each title.
5. The user clears the filter with the clear button or by emptying the box; collapse state
   comes back as it was.

**Extensions**

- **1a — the user tries to drag while filtering.** Rows are not draggable: visual
  neighbours under a filter are not siblings ([[Drag and drop]]).
- **1b — the collapse-all / expand-all controls.** Genuinely `disabled` while the filter
  overrides collapse state — not merely styled as such, since a focusable control disabled
  only in CSS still answers the keyboard.
- **2a — nothing matches.** A "no match" state renders, naming what was searched for and
  offering to clear it, rather than an empty pane that looks like a broken view.
- **3a — a match is inside a collapsed branch.** Collapse state is ignored while filtering:
  everything on a match path renders expanded. Nothing is *changed* — the stored state is
  untouched and returns when the filter clears.
- **3b — finished work is hidden.** Hiding is suspended while filtering, so a search can
  find completed items.

## Acceptance criteria

- Ancestors of a match render even when they do not match.
- Collapse state is ignored while filtering, and restored after.
- The filter is session state: it is never written anywhere.
- Typing re-renders the tree only, so the toolbar input keeps focus.

## Where it lives

**Nowhere: every module this section used to name is deleted, so it can no longer name
them** — a living note may only cite source that exists, which is the register rule doing
its job on a withdrawal. The removal is recorded, path by path, in
[[Remove the quick filter, now that Bases has its own search]].

What it took with it, in concepts rather than paths: the toolbar box and its `/` chord, the
match-path walk and the two indexes it kept, the scope that told those indexes apart, the
second row-visibility reading every count was measured "of", a column's paired count, the
walk that found matches with no card of their own, the two fields on the placed-mount
register that said how a surface could name them, the no-match empty state, the title
highlight, and the catalog keys that spoke a pair count.

Three simplifications fell out of the removal rather than being sought, and they are why it
was cheap. Row visibility is one question again — membership plus the completed toggle —
rather than one asked twice with the filter lifted. A column's count is one number rather
than a pair. And three controls that had to pause mid-filter (the tree's chevron, a card's
disclosure, the bulk collapse buttons) no longer have a state to pause for, so the
`disabled` machinery each carried went with the condition that set it.

Nothing about the DATA is affected: the filter never wrote anything — not to a note, not to
the `.base`, not to the view-state store — which is why this leaves no migration and no
stored value behind.
