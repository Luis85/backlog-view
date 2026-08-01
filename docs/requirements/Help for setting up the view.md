---
type: PBI
parent: "[[User manual]]"
order: 60
status: Open
priority: P3
created: 2026-08-01
files:
  - src/domain/viewOptions.ts
  - src/domain/settings.ts
  - src/commands/scaffold.ts
  - src/view/render/columns.ts
---

# Help for setting up the view

**As** someone configuring a backlog, **I want** the options explained by what each one
changes, **so that** I can find the setting behind a feature I am missing instead of
reading a panel of field labels.

The manual section on the configuration around the tree: what the view options do, what
the Base's own settings still control, and the one of them this view deliberately ignores.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner setting up a base |
| **Trigger** | Opening the manual on the configuration section, from the **?** button or from the `Check view options` warning |
| **Preconditions** | A `product-backlog` view is open |
| **Guarantee** | Every option named here is one `getViewOptions` declares, and the grouping describes what each one actually changes rather than where it sits in the panel. |

**Main flow**

1. The section names the fast path first: **Product Backlog: Create backlog** writes a
   folder, a fully configured `.base` and opens the view.
2. It groups the options by what each changes, rather than repeating the panel's own flat
   list:
   - *What the tree is*: the three property names, `Ignore notes outside the hierarchy`,
     `Show parents outside the filter`, and `Infer hierarchy from folder notes` — the last
     because it changes where parents come from, not how they are drawn.
   - *What a write does*: `Assign item type when moving`, which rewrites persisted `type`
     values through a moved subtree, and the state and tags properties, which are the keys
     the chip and the tag column write to.
   - *What progress means*: the state values offered for writing, the values counted as
     done, and `Show completed items` — which decide the rollups, the done styling and
     which subtrees render at all.
   - *Where new notes go*: the home folder and the per-type folders, which change future
     filing rather than the tree in front of you.
   - *Presentation*: the columns, their width and the descendant counts.
3. It calls out the state property as the prerequisite it is: without one there are no
   progress rollups, no done styling, no state chip and no completed-items toggle.
4. It says what the Base still owns: the filter, the sort that orders unranked items, and
   the visible properties that become the row columns.
5. It says what this view ignores — **group by**, and only that — and what it cannot
   compensate for.

**Extensions**

- **2a — the type vocabulary changes.** The folder pickers are generated one per type, so
  the panel's field count moves with the vocabulary. The section is built from the schema
  for that reason, never from a list counted by hand.
- **3a — a state property is configured but its values are not.** The chip offers the
  states observed in the results instead, so the section explains a menu whose contents
  the reader never typed.
- **5a — the Base declares a grouping.** It is ignored, because the hierarchy is the
  grouping, and the toolbar says so.
- **5b — the Base declares a limit.** A limit is *applied* before the view sees anything:
  it truncates the results, so items are missing from the tree and from the counts.
  Loading ancestors brings back the parents a truncation dropped, never the other
  truncated items. Filters, not limits, are the tool for a backlog.

## Acceptance criteria

- Options are grouped by what they affect rather than listed in schema order; the flat
  list is what the options panel already is, and repeating it buys nothing.
- Every group is a behaviour, and nothing behavioural is swept into presentation: the
  progress options decide rollups, done styling and what renders, so they are their own
  group rather than the remainder.
- Coverage is measured against `getViewOptions`, never against a count written here. The
  schema declares sixteen fixed keys plus one folder picker per type — twenty-two today,
  and a number that moves with the type vocabulary — so a section built from a
  hand-counted list would look complete while omitting the generated half.
- The section says which options are prerequisites for features the user may be looking
  for and not finding — the state property above all.
- It distinguishes the plugin's options from the Base's own settings, since both are
  reached from the same toolbar and only one of them this plugin explains — and it
  separates the setting the view *ignores* (group by) from the one it *cannot
  compensate for* (a limit), which are opposite facts about the same panel.
- No option key is named in prose that the schema does not define; the section is
  generated from the same schema where it can be, for the reason the types section is.

## Where it lives

**Nothing yet — this note is design.** The schema it must be generated from is
`src/domain/viewOptions.ts`; what "misconfigured" means concretely is `configProblems` in
`src/domain/settings.ts`; the command it names first is `src/commands/scaffold.ts`; and the
column options it groups as presentation are rendered by `src/view/render/columns.ts`.
