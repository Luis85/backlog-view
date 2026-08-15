---
type: Epic
order: 66.25
status: Open
area: meta
created: 2026-08-01
started: ""
finished: ""
risk: ""
assignee: Igmar
start: 2026-08-15
due: 2026-10-04
---

# Cross-cutting concerns

Properties the whole plugin has to hold, rather than things the plugin does. A feature
here is not a screen or a behaviour — it is a rule that every screen and every behaviour
has to satisfy, and that decays the moment one of them stops satisfying it.

`Product Backlog` is what the view does, and `Product Kanban` is the next projection of
it. `Codebase health` is what keeps the code maintainable. This epic is the fourth kind:
**qualities that are true of everything or true of nothing.**

That includes work not yet built. `Product Kanban` is design-only today, but a board is a
new set of rendered surfaces — columns, cards, empty states — and every one of
them will need a label from the catalog and a colour from a token. Nothing here has to be
restated in those notes; the point of an epic at this level is that it governs whatever
the plugin grows next, which is why the two features are written against properties rather
than against a list of screens.

## Why they belong together

A concern lands here when it has three properties:

- **It has no single home.** Translation touches all four layers plus `ui/`; styling
  touches one stylesheet that every rendered element reads. Neither can be owned by the
  feature that happened to introduce it.
- **Partial compliance is worse than none.** A view translated except for its menus reads
  as broken software rather than as unfinished translation. A stylesheet that respects
  the theme except in three places is a stylesheet users find by hitting the three.
- **It decays by default.** Nobody adds an untranslated string or a hard-coded colour on
  purpose. They add a button, and the button needs a label and a border. So the rules
  here are worth the cost of *mechanical* enforcement in a way a feature's own rules
  usually are not — the argument `Codebase health` already made as
  `Invariants as checks, not conventions`.

## The features

| | |
| --- | --- |
| `Multilang` | Every string the plugin shows comes out of a per-locale catalog |
| `Theming and styling` | Every pixel it draws comes from Obsidian's design tokens |

They are siblings for a real reason rather than a filing convenience: they meet at the
layout. Translated text is longer, shorter and sometimes right-to-left, and what absorbs
that is the stylesheet. The seam is drawn once and stated in both places —
`Theming and styling` owns the *mechanism* (logical properties, no physical direction
rules, and the lint that keeps it that way), `Multilang` owns the *verification* (that
the view still reads correctly with long compounds in the columns and the tree running
the other way). Since English ships alone in the first round, that verification runs
against a development-only pseudo-locale and a forced `dir="rtl"` rather than against a
shipped translation.

## Definition of done, for anything under this epic

- The rule is stated once, in the feature that owns it, and cross-referenced rather than
  restated where it also applies.
- Whatever can be a check in `npm run check` is one. A rule that lives only in a document
  is a rule that holds until the next contributor.
- Whatever *cannot* be checked here says so, and leaves a re-runnable checklist in
  `docs/tests/cases/` instead of a claim. Appearance and language both fall in this category:
  the jsdom harness renders nothing, and `npm run test-build` is the path to eyes.

## Not a home for

Anything with an obvious owner. A concern that touches two files is a concern for those
two files — this epic is for the ones that touch everything, and it stops being useful
the moment it becomes where unsorted work goes.
