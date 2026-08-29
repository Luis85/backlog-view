---
type: PBI
parent: "[[Creating items]]"
order: 40
status: Done
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Scaffolding a backlog

**As** someone who just installed this plugin, **I want** one command to give me a working
backlog, **so that** my first experience is a tree I can add an Epic to — not a `.base`
file I have to learn the syntax of before anything renders.

## Use case

| | |
| --- | --- |
| **Actor** | New user, from the command palette |
| **Trigger** | The **Create backlog** command |
| **Preconditions** | None. This is the path for someone who has nothing yet. |
| **Guarantee** | Nothing existing is overwritten. The command only ever adds a folder and a new file. |

**Main flow**

1. The user runs **Create backlog**.
2. A modal asks which folder, defaulting to `docs`, with a folder suggester.
3. The folder is created if it does not exist.
4. A `.base` file is written inside it, already filtered to that folder's markdown notes
   and already opening in the Product Backlog view.
5. Its `homeFolder` is set to that same folder, so every type's folder defaults beneath it
   and the first item created lands **inside the filter just written for it**
   ([[Where new items are filed]]).
6. The base opens, with a notice inviting the first Epic.
7. The empty state offers a **New Epic** button, so the next step is one click.

**Extensions**

- **2a — the folder name contains a `#` or a quote.** It survives: the folder goes through
  two escaping layers — inside the filter formula's string literal, and again as a
  double-quoted YAML scalar. A plain scalar would read `" #"` as the start of a YAML
  comment and silently truncate the filter, leaving a base that matches everything.
- **2b — the field is left empty.** `docs` is used.
- **4a — a `Product Backlog.base` already exists there.** A numbered name is used. The
  command adds; it never replaces.
- **5a — the user later moves the whole backlog.** Changing the home folder moves every
  type folder that was left at its default, because they are derived from it rather than
  copied out of it.
- **6a — the write fails.** A notice says so and points at the console. The `.base` file
  is written in one call, so it never exists half-configured — but a folder created at
  step 3 is left behind. See [[Failed creation leaves its folder behind]].

## Acceptance criteria

- One command produces a folder, a configured `.base` file, and an open working view.
- The scaffolded base's `homeFolder` is the folder it created, so the first item created
  lands inside its own filter.
- An existing base of the same name is never overwritten, and no existing folder is
  touched.
- The `.base` file is written in one call: it never exists without its view configuration.
- Folder names that are legal in Obsidian but hostile to YAML round-trip into a filter
  that still means what it says.
- The `.base` file is written from `storage/`, like every other byte this plugin puts in
  the vault.

## Where it lives

`src/commands/scaffold.ts` (the flow) · `src/storage/baseFile.ts` (`baseFileContent`,
`createBacklogBase` — the one vault write that is not a work item) ·
`src/ui/prompts.ts` (`FolderPromptModal`, `FolderSuggest`) ·
`src/ui/valueSuggest.ts` (the suggester both the folder and tag pickers extend) ·
`src/main.ts` (the `create-backlog` command).
Tests: `test/commands/scaffold.test.ts`, `test/storage/baseFile.test.ts`,
`test/ui/prompts.test.ts`.
The manual alternative — writing the `.base` by hand — is documented in the project
`README.md`.
