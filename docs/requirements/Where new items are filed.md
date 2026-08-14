---
type: PBI
parent: "[[Creating items]]"
order: 20
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Where new items are filed

**As** someone adding items over months, **I want** each kind to land in its own folder
without my choosing one each time, **so that** the vault stays organised by default and I
can move the whole backlog later by changing one setting.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Confirming the new-item modal ([[New item flow]]) |
| **Preconditions** | A type has been chosen for the new item |
| **Guarantee** | The folder shown in the modal is the folder used. The user is never told one thing and given another. |

**Main flow**

1. A **home folder** (default `docs`) is the parent of everything the view creates.
2. Each type has its **own folder picker**, generated as `typeFolder.<lowercased name>` —
   `typeFolder.epic`, `typeFolder.feature`, `typeFolder.pbi`, `typeFolder.task`,
   `typeFolder.issue`, `typeFolder.bug` today — **one per name in the vocabulary, whatever
   that vocabulary is**, each defaulting to a subfolder of the home folder: `requirements`
   for the three planning levels, then `tasks`, `issues`, `bugs`. The keys are *derived*
   rather than listed, so a name added to the vocabulary brings its picker and its default
   with it and no enumeration here has to be remembered
   ([[Milestones as their own type]] adds the seventh).
3. The modal resolves the folder for the chosen type and shows it.
4. Changing the type in the modal changes the folder shown, immediately.
5. The note is created there.

**Extensions**

- **1a — the user runs the **Create backlog** command.** It points the home folder at the
  folder it just scaffolded, so a new backlog files everything inside its own filter from
  the first item.
- **3a — folder mode is on and the parent has a folder note.** That parent's folder wins,
  so the child lands beside it and the folder hierarchy stays true
  ([[Folder note hierarchy]]).
- **3b — the type has no folder configured** (its picker was cleared, or the type is one
  the plugin does not name). The home folder is used.
- **3c — there is no home folder either.** The view infers: the folder most of the Base's
  own results live in. Only *result* rows are counted — a context row must not pull a new
  note outside the filter.
- **3d — inference finds nothing to go on.** The modal asks, with a folder suggester.

**Resolution order** — folder mode's parent folder → the type's folder → the home folder →
the folder most results live in → ask.

## Acceptance criteria

- Each type has **its own folder picker**, so a folder is chosen rather than spelled into
  a mapping — one class of typo that cannot happen.
- Each picker DEFAULTS to a subfolder of the home folder, and the option list is built
  from the view's own config, so the value shown in the box is the value creation uses.
  Relocating a backlog therefore stays one setting for every folder left untouched.
- The landing folder follows the type picked in the modal, and the modal says so.
- Resolution order is as above.
- The **Create backlog** command points the home folder at the folder it scaffolds, so a
  new backlog files everything inside its own filter.
- A type name that collides with an `Object.prototype` member resolves to *no folder*,
  not to something inherited — see
  [[A user-named type read off Object.prototype]].

## Where it lives

`src/domain/typeVocabulary.ts` (`defaultTypeFolder`, `byName`) ·
`src/domain/settingsResolve.ts` (folder resolution, and
`typeFolderKey` — which builds the persisted key and is shared with the schema, because a
key spelled twice is a key that can differ) ·
`src/domain/viewOptions.ts` (`homeFolder`, and one generated picker per type) ·
`src/domain/itemTypes.ts` (`folderForType`) ·
`src/view/interactions/create.ts` (`inferFolder`) ·
`src/commands/scaffold.ts` (the Create backlog command).
Tests: `test/domain/itemTypes.test.ts`, `test/domain/settings.test.ts`,
`test/domain/viewOptions.test.ts`, `test/view/creation.test.ts`,
`test/storage/baseFile.test.ts`.
