---
type: PBI
parent: "[[Creating items]]"
order: 80
status: Open
priority: P2
created: 2026-08-02
source: user request
files:
  - src/commands/scaffold.ts
  - src/storage/baseFile.ts
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
  - src/domain/writePlan.ts
  - src/domain/noteFields.ts
---

# A README in the backlog folder

**As** a team keeping its backlog in a git repository, where some people edit the notes in
Obsidian and the rest read and write them in another editor, **I want** the backlog folder
to carry a `README_PRODUCT_BACKLOG.md` describing its own types, hierarchy and properties,
**so that** the notes are legible and writable without this plugin — by a colleague in
VS Code and by an AI agent working the repository — instead of the schema living only in
the head of whoever installed the view.

The frontmatter contract is the whole product: `parent`, `order` and `type` are what make
a flat folder a tree. Today that contract is stated in the repository's `README.md`, which
travels with the *plugin*, not with the *vault* — so the folder that depends on it says
nothing about it. This use case writes it down where the notes are, generated from the
configuration in force rather than copied from the docs, because every key it names is one
the view options can rename.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner, from a Product Backlog view |
| **Trigger** | The **Write backlog readme** command, offered while such a view is active |
| **Preconditions** | A `product-backlog` view is open and its configuration has no problems |
| **Guarantee** | No work item is touched. The command writes exactly one file — the generated README — and never `parent`, `order`, `type` or any other frontmatter on any note. |

**Main flow**

1. The user runs **Write backlog readme** from an open Product Backlog view.
2. The view's settings are resolved — the same `resolveSettings` the tree is built from,
   so the document describes *this* base rather than the defaults — together with the
   state vocabulary the view is actually offering, which is not a setting whenever the
   states are left undeclared (`stateMenuValues`, over the model's observed states).
3. The document is generated: what the folder holds, the six type names with the ladder
   and the two types beside it, the parent/child table, the frontmatter contract in this
   view's actual keys, the ranking rule, the workflow states and which of them count as
   done, the roadmap keys when an axis is configured, where each type is filed, and a
   worked example note per type.
4. It is written as `README_PRODUCT_BACKLOG.md` in the resolved home folder, which is
   created if it does not exist.
5. A notice names the path it wrote.

**Extensions**

- **1a — no Product Backlog view is active.** The command does not offer itself. A README
  generated from defaults would describe a configuration nobody has, and getting the keys
  wrong is worse than saying nothing: an agent that trusts it writes `type` into a base
  that reads `kind`.
- **1b — the backlog was just scaffolded by the create-backlog command.** Nothing is
  written yet.
  Calling the same generator from the scaffold is a second change, deliberately: the
  scaffold has no view in hand, and the file it would produce documents a configuration
  the user has not seen. [[Scaffolding a backlog]] ends at an open view, which is exactly
  where this command becomes available.
- **2a — the configuration has problems** — two roles resolved to one property key, say.
  It refuses, with the problems named, like every other write path in this plugin. A
  document generated from a contradictory configuration would state each collided key as
  though it were the one true answer for both roles.
- **3a — a property is unset.** The section is omitted rather than rendered around a blank
  key: no state property means no states section, and no horizon or dates means no roadmap
  section. The README describes the view in front of the reader, not the one the options
  could make.
- **3b — the home folder or a type folder was renamed.** The paths come from the resolved
  settings, so the README names where notes actually go. It states the whole precedence and
  not the configured path alone, because the configured path is not the answer in every
  configuration: folder mode's "beside the parent's folder note" wins first — **unless the
  parent is a context row**, where that rule is skipped so the child does not land outside
  the filter it was created from — then the type's own folder, then the home folder, and
  where the items already live is the last resort ([[Where new items are filed]]). A README
  that named the type folder as *the* destination would send an outside editor to the wrong
  folder in exactly the mode where the folder tree is the hierarchy; one that named the
  parent's folder unconditionally would send it to a folder this plugin deliberately avoids.
- **3c — the reader wants to know what the plugin will refuse.** Almost nothing: the type
  rules decide what is *offered*, never what is accepted, so a hand-written note with a
  `Task` under an `Epic` renders at the level its position implies and is not rewritten.
  The README says so, because an outside editor that expects validation will trust a
  silence that means nothing.
- **3d — the reader is a program.** Every field is stated with the forms the reader
  actually accepts — a parent as a wikilink, a bare name or an alias, and as the first
  entry of a list; a number written as a string — and every derived value is named as
  derived, so nothing writes back a level, a rollup or a board position that this plugin
  computes and never stores ([[Board order is derived not stored]]).
- **4a — the file already exists and matches, byte for byte.** Nothing is written. A team
  in git gets no commit for running the command twice.
- **4b — the file exists and differs.** It is replaced only when it carries the generated
  marker its first line puts there; otherwise the command refuses and says why, because
  the file may be somebody's own writing. The whole document is generated, so a hand edit
  inside it does not survive regeneration — and the marker line says that out loud.
- **4c — the home folder sits inside the base's filter**, so the new file is a note the
  base returns. It carries no `type` and no `parent`, so the scope rule leaves it out of
  the tree ([[What counts as a work item]]) — the same way this register's own
  `docs/README.md` sits in the folder it describes. What its own frontmatter can promise is
  only that it **declares** nothing: with "Ignore notes outside the hierarchy" on — the
  default — it is then pruned and the toolbar advisory counts it, and with the option off
  nothing is pruned at all, `ignoredCount` is zero, there is no advisory and it renders as
  an untyped root. Two things enrol it anyway, and neither is a field it could omit
  differently: **folder mode**, where inference reads a note's *position* — a folder note
  anywhere above it becomes its parent — and **a work item naming it as parent**, which
  keeps the whole root subtree, the README included, as an untyped container. Both are the
  scope rule working as specified ([[What counts as a work item]]); the limitation to state
  here is that a generated file cannot opt out of a hierarchy other notes put it in.
- **5a — the write fails.** A notice says so and points at the console, like every other
  vault write this plugin makes.

## Acceptance criteria

- One command, run from a Product Backlog view, produces `README_PRODUCT_BACKLOG.md` in
  the resolved home folder, creating the folder if needed and normalizing the path.
- Every property key, folder, state and horizon value the document **emits as a key** — in
  a frontmatter example, a field table, a label naming what to write — is read from the
  resolved settings: renaming the parent property to `kind` changes every one of them. The
  criterion is about emitted keys and not about the word: the prose has to keep saying
  *parent* and *child* whatever the key is called, and a check that banned the word would
  refuse a correct document or strip it of the table it exists for.
- Every type in `ALL_TYPES` has an entry, enforced by a test that reads the vocabulary — a
  seventh type cannot ship without its explanation.
- The parent/child table agrees with `childTypeChoices`, not with the ladder read
  literally: the clamp at the deepest rung means a `Task` may hold a `Task`, and the extra
  types rank with the second-deepest rung.
- The ranking rule is stated with the spacing the planner actually uses (`ORDER_SPACING`),
  and says what duplicate orders do rather than promising they cannot happen.
- Generation is pure and node-testable: same inputs in, byte-identical markdown out. Its
  inputs are the resolved settings **and** the state vocabulary the view offers, since with
  the states left undeclared that vocabulary comes from the results rather than from any
  setting — two bases with identical settings and different states must not produce the
  same states section. Where the values were observed rather than declared, the document
  says so: an outside editor writing a state nobody has used yet is then adding to a
  vocabulary rather than breaking one.
- Re-running with the file already matching writes nothing.
- The bytes land from `storage/`, like every other file this plugin puts in the vault, and
  no frontmatter write happens on any note.
- The generated file carries no `type` and no `parent`, so it cannot enrol itself into the
  backlog it documents.
- A file at that path without the generated marker is never overwritten.
- Nothing about the command is persisted to the `.base` file or to localStorage.
- Sentence-case command name and notices, `normalizePath` on the folder, no global `app`.

## Why it is filed here and not under the manual

[[A help button for the item types]] and its siblings explain the same vocabulary, and
this is deliberately not one of them: [[User manual]] decides that the manual is *rendered
and never written* — help is not backlog data, and the write boundary is not a thing to
widen for documentation. This note widens it anyway, for a reader the manual cannot reach:
someone who does not have Obsidian open, and for whom a dialog inside the plugin is not a
document at all. The manual is the short answer at the point of use; this is the contract
that ships with the notes. They share a source — the type vocabulary and the settings —
and a test that keeps both honest is worth more than either.

## Where it lives

**Nothing yet — this note is design.** The generator is pure text from `BacklogSettings`
and belongs in `src/domain/`, beside `src/domain/writePlan.ts`, which is the existing
example of a module that decides *what* a change would say and applies none of it; the
vocabulary it reads is `src/domain/settings.ts` and `src/domain/itemTypes.ts`, and the
tolerant reading rules it has to describe are `src/domain/noteFields.ts`. The bytes land
from `src/storage/`, beside `src/storage/baseFile.ts` — the one existing vault write that
is not a work item, and the reason "everything that puts bytes in the vault is in
`storage/`" has no exception to remember. The command joins `src/main.ts` next to
`create-backlog`, acting on the active view rather than on the vault at large, and the
flow it borrows is `src/commands/scaffold.ts`.
Tests: the generator is a node test beside `test/domain/`; the write and the refusals are
jsdom tests beside `test/commands/scaffold.test.ts` and `test/storage/baseFile.test.ts`.
