---
type: PBI
parent: "[[Item Templates]]"
order: 20
status: Open
started: ""
finished: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
horizon: ""
---

# Creating an item from a template

**As** someone adding a new item, **I want** to optionally start it from a saved template
and adjust the body before it exists, **so that** items of a kind I make often do not
start blank every time, without losing the one-title-and-done speed of a plain item.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, creating an item ([[New item flow]]) |
| **Trigger** | Choosing a type in the new-item modal for which at least one template exists |
| **Preconditions** | `templatesFolder` is configured and at least one template matches the chosen type ([[Configuring the templates folder]]) |
| **Guarantee** | A template only ever adds to what the plugin already writes — its body pre-fills an editable field, its extra frontmatter merges in. The plugin's own hierarchy keys (`type`, `parent`, `order`), the roadmap's axis keys (`horizon`, `start`, `target`) and the workflow's transition stamps (`started`, `finished`) are never taken from a template at all — stripped before anything is written, not merely overridden, since creation does not always supply its own value for every one of them to win with. Two keys are precedence, not strip: the workflow state and, if the resources axis exists, the assignee — each survives from a template only where creation supplies no positional claim of its own to outrank it, state's own claim being three-way (a real column, the no-state column's deliberate absence, or no board-column context at all) and the assignee's two-way (a resource row, or no row context at all). |

**Main flow**

1. The new-item modal opens as in [[New item flow]].
2. Because the chosen type has at least one matching template, the modal adds a template
   picker (default **Blank**) and a multi-line body field beneath the title.
3. Picking a template fills the body field with that template's body, ready to edit
   further; **Blank** leaves it empty.
4. The user edits the body field, or leaves it as filled.
5. Confirming creates the note as in [[New item flow]], with the body field's contents as
   the note's body and the chosen template's extra frontmatter — everything on it besides
   `templateForKey` — merged into the note's frontmatter.
6. Before anything is merged, the hierarchy keys (`type`, `parent`, `order`), the axis
   keys and the transition stamps are stripped from the template's frontmatter entirely —
   the same exclusion [[Adding templates from the plugin]]'s Save as template already
   applies. This is not "the plugin's value wins": `createBacklogItem` writes `parent`
   only when there is one and folder mode is off, so a top-level creation with folder
   mode off supplies no parent value at all — a template's own copied `parent` would
   otherwise pass straight through unchallenged, silently nesting a note meant to be
   top-level. Stripping first means the plugin's own creation logic runs against clean
   frontmatter every time, whether or not it happens to write a value for a given key
   this time.

**Extensions**

- **2a — the chosen type has no matching template.** No picker and no body field appear;
  the flow is exactly [[New item flow]] as it is today.
- **2b — the modal's type dropdown changes** (a row that offers more than one kind).
  The template picker re-filters to that type's templates, live — the same way the
  folder detail line already follows the type. If the previously picked template does
  not match the new type, the pick resets to **Blank** and the body field clears.
- **4a — the user edits the body after picking a template, then picks a different
  template.** The field is overwritten with the new pick — a second pick is a fresh
  start, not a merge of two templates' bodies.
- **5a — the body field is left empty**, whether or not a template was picked. The note
  is created with an empty body, same as today.
- **5b — the template carries a state, and creation is happening from a board column
  with a real state** ([[New cards in place]], itself still design). The column's own
  preset state wins — the same placement precedence the roadmap's bucket creation
  already gives `horizon` over anything else. State is not stripped unconditionally the
  way the axis keys and the transition stamps are: unlike a leftover date, a state is a
  plausible deliberate default for a template to declare ("this kind of Task starts in
  Backlog"), so where creation supplies no placement at all, the template's own state is
  what the note gets, same as any other extra frontmatter.
- **5c — the template carries a state, and creation is happening from the board's
  no-state column.** The template's state does *not* survive here, even though creation
  "supplies none" in the sense of writing no state key: the no-state column's placement
  is an explicit absence, not the absence of a placement, and [[New cards in place]]'s 1a
  is exactly this distinction ("absence is a value here"). A template's state is only
  ever a default for creation with *no board-column context at all* — the tree's **+**,
  the toolbar's **New**, a row's context menu — never for a column that placed the card
  in "no state" on purpose.
- **5d — the template carries an assignee, and creation is happening from a resource
  row on the roadmap** ([[Assigning items to a resource]], itself still design). The
  row's own resource name wins, the same shape as 5b: `assignee` is a second key with a
  plausible deliberate template default ("this kind of Task starts with QA") and a
  positional creation context that can outrank it, so it is not on the unconditional
  strip list with `horizon`/`start`/`target` — those describe a PLACEMENT and have no
  standalone meaning a template could sensibly declare; `assignee` names a PERSON and
  reads perfectly well as an ordinary default. Unlike state, there is no resources-axis
  equivalent of the no-state column — no row means "explicitly nobody" the way that
  column means "explicitly no state" — so this key has only the two-way shape 5b's half
  already covers, not the three-way one 5c adds for state.
- **5e — the template carries an assignee, and creation is happening with no resource
  row context at all.** The template's own assignee survives, same as any other extra
  frontmatter — the ordinary default case 5d's row precedence is the exception to.

## Acceptance criteria

- The template picker and body field appear only when the currently chosen type has at
  least one matching template; a type with none looks exactly like [[New item flow]]
  today.
- The body field is pre-filled from the picked template and freely editable before
  creation; nothing is written until the modal is confirmed.
- Changing the type re-filters the offered templates and resets an unmatched pick.
- The created note's body is exactly the body field's contents at confirmation.
- A template's extra frontmatter merges onto the new note; the hierarchy keys (`type`,
  `parent`, `order`), the axis keys (`horizon`, `start`, `target`) and the transition
  stamps (`started`, `finished`) are stripped from it before the merge, unconditionally —
  never relying on the plugin supplying its own value to override one with, since a
  top-level creation with folder mode off writes no `parent` value at all.
- The workflow state is not on that stripped list, and is not simply "plugin value wins,
  else template default": an explicit placement — a real column's state, or the
  no-state column's deliberate absence — always wins over a template's state; the
  template's state survives only when creation carries no board-column placement at
  all.
- If the resources axis exists, the assignee key is not on the stripped list either, for
  the same reason state is not: creation from a resource row wins over a template's
  assignee, and the template's own survives only where creation carries no resource-row
  context at all. Two-way rather than state's three, since nothing about this axis gives
  "explicitly nobody" a placement of its own the way the no-state column does. State and
  the assignee are the only two keys in the merge with a plausible reason to be a
  deliberate template default rather than incidental copy-through — everything else
  stripped is a placement with no standalone meaning to declare.
- Creation still goes through the same config gate as every other write.

## Where it lives

Nothing yet — this note is design. `src/ui/prompts.ts` (`TitlePromptModal` — the template
picker and body field) · `src/view/interactions/create.ts` (`promptCreateItem`,
`createFromPrompt` — resolving templates for the chosen type, stripping the plugin-owned
keys from a template's frontmatter before passing the body and what remains through) ·
`src/storage/createNote.ts` (`createBacklogItem`, `NewItemSpec` — accepting a body and
already-stripped extra frontmatter).
