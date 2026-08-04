---
type: PBI
parent: "[[Item Templates]]"
order: 20
status: Open
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
| **Guarantee** | A template only ever adds to what the plugin already writes — its body pre-fills an editable field, its extra frontmatter merges in. The plugin's own `type`, `parent` and `order` always win over anything the template also carries, and the roadmap's axis keys (`horizon`, `start`, `target`) and the workflow's transition stamps (`started`, `finished`) are never taken from a template at all. |

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
6. Where a template's frontmatter names `type`, `parent` or `order`, the plugin's own
   value wins; the template cannot override its own placement. Where it names an axis key
   or a transition stamp, that value is dropped rather than merged — the same exclusion
   [[Adding templates from the plugin]]'s Save as template already applies, and for the
   same reason: creation supplies no value of its own to override a copied one with for
   any of these, so a merge would let a template's stale date read as this new note's real
   history or a real schedule the moment it exists.

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

## Acceptance criteria

- The template picker and body field appear only when the currently chosen type has at
  least one matching template; a type with none looks exactly like [[New item flow]]
  today.
- The body field is pre-filled from the picked template and freely editable before
  creation; nothing is written until the modal is confirmed.
- Changing the type re-filters the offered templates and resets an unmatched pick.
- The created note's body is exactly the body field's contents at confirmation.
- A template's extra frontmatter merges onto the new note; the plugin's own hierarchy
  keys (`type`, `parent`, `order`) are never overridden by it, and the axis keys
  (`horizon`, `start`, `target`) and the transition stamps (`started`, `finished`) are
  never carried over from it at all — stripped, not merely lost to precedence.
- Creation still goes through the same config gate as every other write.

## Where it lives

Nothing yet — this note is design. `src/ui/prompts.ts` (`TitlePromptModal` — the template
picker and body field) · `src/view/interactions/create.ts` (`promptCreateItem`,
`createFromPrompt` — resolving templates for the chosen type, passing the body and merged
frontmatter through) · `src/storage/frontmatter.ts` (`createBacklogItem`, `NewItemSpec` —
accepting a body and extra frontmatter, plugin-owned keys still applied last).
