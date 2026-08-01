---
type: PBI
parent: "[[User manual]]"
order: 40
status: Open
priority: P2
created: 2026-08-01
files:
  - src/view/render/toolbar.ts
  - src/domain/model.ts
  - src/view/render/emptyStates.ts
---

# Help for finding work

**As** someone looking at a backlog with a row missing from it, **I want** to know which
control is hiding it, **so that** I can tell narrowing from data loss instead of assuming
the view lost my note.

The manual section on narrowing a backlog too large to read — and, just as importantly, on
why a row you expected is not on screen.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Opening the manual on the finding section, from the **?** button or from an empty state that has nothing to show |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Every control described here narrows what is *rendered*. None of them changes a note, and restoring the control restores the rows. |

**Main flow**

1. The section describes the **quick filter**: type in the toolbar or press <kbd>/</kbd> in
   the tree, matches keep their ancestors and their whole subtrees, collapse state is
   ignored while it is active, and the text is session state that is never written
   anywhere. Escape clears it.
2. It describes **focus**: picking a type re-roots the tree at the **topmost** match on
   each branch, keeping everything below it.
3. It describes **Show completed items**: the eye hides subtrees that are entirely done,
   and only when a state property is configured. It hides — the items are still ranked,
   still counted, still written to.
4. It then turns to the two things on screen that explain an absence rather than a match:
   the `N notes ignored` advisory, and the context row's `↳` marker.
5. The reader leaves able to say, for any missing row, which of the four is responsible.

**Extensions**

- **2a — the focused type is a ladder rung.** Focusing `PBI` promotes the extra types
  too: `Issue` and `Bug` rank at `EXTRA_TYPE_RANK`, which *is* the PBI rung, so
  `collectFocusRoots` counts them as matches. Focusing an extra type **by name** selects
  only that type. The section distinguishes the two, since "one type" is false for the
  first.
- **2b — a matching type is nested under another.** `collectFocusRoots` stops descending
  at the first match, so the inner one stays below its matching ancestor rather than
  being promoted twice.
- **3a — no state property is configured.** The eye is not offered at all, which is the
  answer to "where is the completed-items toggle" and belongs here rather than only in the
  options section.
- **4a — a note is missing entirely.** The ignored-notes test runs per **root component**,
  not per note: a whole root and everything under it is skipped only when nothing in it
  qualifies — no **supported** type (one of the six the plugin declares, so `type:
  meeting-note` does not count), no parent, no parent link at all. An untyped container
  above a typed Epic is therefore kept, and so is an untyped child of a typed item.
- **4b — a row shows the `↳` marker.** It is an ancestor the Base's filter excluded,
  loaded so matches keep their place. It renders and it parents; it is never counted, and
  no new change writes to it — undo may, deliberately, since its authorization was
  captured while the note was still a result ([[Help for safe writes and undo]]).

## Acceptance criteria

- Each control says what it hides *and* what it leaves intact, since all three look the
  same from the outside — rows missing — and only one of them is about the data.
- Focus is described as re-rooting the **topmost** match on each branch, matching
  `collectFocusRoots`, and distinguishes focusing a rung (which promotes the extra types
  ranking with it) from focusing an extra type by name (which does not).
- The ignored-notes rule is given as `pruneOutsideHierarchy`'s **subtree** predicate over
  **supported** types, not as the per-note shorthand: a section whose job is diagnosing a
  missing row must predict the same rows the view does. The toolbar tooltip carries the
  shorthand today and is worth aligning with whatever this section settles on.
- The context row is explained by its marker, so the `↳` on screen is answerable without
  leaving the view — including that undo is the one thing that may write to it.
- The section states that the filter is session state and reaches no file, because "will
  this change my notes" is the question a first-time user actually has.
- Empty states point here: no match, all done and empty backlog are three different
  screens with three different answers.

## Where it lives

**Nothing yet — this note is design.** The controls it describes are in
`src/view/render/toolbar.ts` (the filter box, the focus picker, the completed toggle and
the ignored-notes advisory), their model rules in `src/domain/model.ts`
(`collectFocusRoots`, `pruneOutsideHierarchy`), and the screens it must agree with in
`src/view/render/emptyStates.ts`.
