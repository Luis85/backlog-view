---
type: PBI
parent: "[[Multilang]]"
order: 40
status: Open
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Every surface translated

The sweep: every English literal outside the view options moves into the catalog. Roughly
90 sites over ten files — the toolbar, the tree, the empty states, the menus, the modals
and every notice.

`View options and config warnings` is deliberately not here. It is the one surface where
text sits on adjacent lines to keys that must not move, and it carries a domain-layer
change with it, so it is reviewed on its own.


**As** someone using the plugin in another language, **I want** every label, tooltip and
notice to come from the catalog, **so that** the view does not read as half-translated —
which is worse than not translated at all.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone using the view in a non-English Obsidian |
| **Trigger** | Any rendered surface: the toolbar, a row, a menu, a modal, a notice |
| **Preconditions** | The catalog and the locale layer exist |
| **Guarantee** | Nothing the view *does* changes. This is a text move: the same rows, the same menu items in the same order, the same writes. |

**Main flow**

1. A developer works through one surface at a time, moving each literal to a key.
2. Screen-reader text moves with the visible text — `aria-label` and tooltips are UI text.
3. Values the user owns stay as they are: titles, tags, state names, file names.
4. The surface renders from the catalog.

**Extensions**

- **1a — the string names a view option.** It quotes the *translated* option label, so the
  sentence points at a control the user can find. Two sentences spell one option's label as
  a literal today.
- **1b — the string is withheld for a context row.** It stays withheld. `Set type`,
  `Set state` and the parent-link actions are *absent* for an `outsideFilter` row, not
  translated and disabled.
- **2a — the surface is a modal detail line.** It stays a function of the chosen type, so
  it is still true at the moment of confirming, and it stops sentence-casing its own first
  character — the capitalized form belongs in the message.
- **3a — the value is interpolated into a sentence.** The sentence is one key with the
  value as a parameter, never a translated word glued to a data value.
- **4a — the surface is the busy chip.** Its 250 ms `animation-delay` behaviour is
  unchanged; a text move must not read as a flicker regression.

## What is here

**Toolbar** (`toolbar.ts`, 23 sites) — the `New <type>` button and its type picker, the
tooltips on every icon control (`Assign missing type and order properties`, `Undo last
backlog change`, `Expand all`, `Collapse all`), the `Grouping ignored` advisory and its
explanation, the `Check view options` warning, the item count, and the busy chip's
`Updating N of M…`.

**Rows** (`rows.ts`, 11 sites) — the orphan marker (`Parent is set but not part of this
view`), the context-row marker (`Not in this base's filter — shown to keep the
hierarchy`), the badge tooltip for an implied type, and the add-child button's
`aria-label`.

**Columns** (`columns.ts`, 20 sites) — the `Progress` / `Items` header, the tag pills'
`Add tag` and `Remove tag <tag>` labels, the rollup tooltip `N of M items done`, and the
state chip's `Set state` / `Change state (currently <value>)`. The chip's static form for
a context row carries its own message (`state can't be changed here`).

**Empty states** (`emptyStates.ts`, 8 sites) — `Loading backlog…`, `No <type> items` with
its hint, the no-match state and `Clear filter`, and the all-done state with `Show
completed items`.

**Context menu** (`menu.ts`, 16 sites) — `Open in new tab`, `Open to the right`, `Clear
parent link`, `Use folder position`, the four move commands, `Outdent`, and the three
submenus `Set state`, `Edit tags`, `Set type`.

**Modals** (`ui/prompts.ts`, 13 sites) — the new-item modal's `Type`, `Title` and `Folder`
settings, the `Create` button, the example placeholders (`Item title`, `Backlog`,
`Sprint-12`), the `Add tag` title, and the detail line saying where the item will land.

**Notices** — all 14, including the filter refusal (`That change would edit a note
outside this base's filter, so nothing was written.`), `Still applying the previous
change — try again in a moment.`, `Nothing to undo.`, the undo summary assembled from
parts in `undo.ts:94-99`, and the two `See the developer console for details.` failures.

**Command and view names** (`main.ts`) — the `Create backlog` command and the
`Product Backlog` view name passed to `registerBasesView`. Resolved once at `onload`,
which is correct: Obsidian needs a restart to change language.

## Acceptance criteria

- Every `aria-label`, `setTooltip` and visible label on these files comes from the
  catalog. Screen-reader text is UI text; leaving it English translates the view for
  sighted users only.
- The sentences that name a view option by its label quote the **translated** label, so
  the text points at a control the user can find. Two of them spell *"Ignore notes
  outside the hierarchy"* as a literal today (`emptyStates.ts:50`, `toolbar.ts:140`);
  afterwards it is one parameter from one key.
- The menu's item order and its withheld-for-context-row set are unchanged — `Set type`,
  `Set state` and the parent-link actions stay *absent* for an `outsideFilter` row, not
  translated-but-disabled. `test/view/contextRowWrites.test.ts` passes untouched.
- The new-item modal's detail line stays *true* at the moment of confirming: it is a
  function of the chosen type, and translating it must not turn it back into a fixed
  string. `test/view/creation.test.ts` already guards this.
- The undo summary is one message per outcome, not translated fragments joined with
  `'; '`. It has two counted clauses today, both with inline plural ternaries.
- `Updating N of M…` keeps its 250 ms `animation-delay` behaviour. The busy chip is the
  one place a text change could be mistaken for a flicker regression.
- Interpolated **values** stay as the user wrote them: the state name in `Change state
  (currently <value>)`, the tag in `Remove tag <tag>`, the title in the truncation
  tooltip, and any file name a notice quotes.
- The plugin name is not translated — Obsidian prefixes command names with it in the
  palette, and it is the plugin's identity in the community list.
- The modal's detail line stops capitalizing its own first character. `create.ts:92` does
  `${where[0].toUpperCase()}${where.substring(1)}` to sentence-case a fragment it built —
  which is wrong once the fragment comes from the catalog, since the capitalized form
  belongs *in* the message and not every script has case at all.
- No behaviour changes. This is a text move; anything else found on the way is its own
  note.

## Where it lives

**Nothing yet — this note is design.** The sweep touches every rendering module without
changing what any of them does.

`src/view/render/toolbar.ts` · `src/view/render/rows.ts` · `src/view/render/columns.ts` ·
`src/view/render/emptyStates.ts` · `src/view/interactions/menu.ts` ·
`src/view/interactions/create.ts` · `src/view/interactions/tags.ts` ·
`src/view/interactions/structure.ts` · `src/view/interactions/undo.ts` ·
`src/view/backlogView.ts` · `src/view/writeGate.ts` · `src/ui/prompts.ts` ·
`src/commands/scaffold.ts` ·
`src/main.ts`.
Tests: `test/view/contextRowWrites.test.ts` and `test/view/creation.test.ts` must pass
untouched — they guard the two behaviours this sweep is most likely to disturb.
