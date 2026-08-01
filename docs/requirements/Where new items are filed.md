---
type: PBI
parent: "[[Creating items]]"
order: 20
status: Done
---

# Where new items are filed

A **home folder** (default `docs`) is the parent of everything the view creates, and each
type is filed in a folder under it — `requirements`, `tasks`, `issues`, `bugs`.

## Acceptance criteria

- Relocating a backlog is one setting: the type folders are relative to the home folder.
- A type folder beginning with `/` reads from the vault root, so the home folder is a
  default rather than a cage.
- The landing folder follows the type picked in the modal, and the modal says so.
- Resolution order: folder mode's parent folder, the type's folder, the configured folder,
  the folder most items live in, then ask.
- The **Create backlog** command points the home folder at the folder it scaffolds, so a
  new backlog files everything inside its own filter.
