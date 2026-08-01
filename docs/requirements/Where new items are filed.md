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

- Each type has **its own folder picker**, so a folder is chosen rather than spelled into
  a mapping — one class of typo that cannot happen.
- Each picker DEFAULTS to a subfolder of the home folder, and the option list is built
  from the view's own config, so the value shown in the box is the value creation uses.
  Relocating a backlog therefore stays one setting for every folder left untouched.
- The landing folder follows the type picked in the modal, and the modal says so.
- Resolution order: folder mode's parent folder, the type's folder, the configured folder,
  the folder most items live in, then ask.
- The **Create backlog** command points the home folder at the folder it scaffolds, so a
  new backlog files everything inside its own filter.
