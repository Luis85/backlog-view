---
type: PBI
parent: "[[Creating items]]"
order: 80
status: Done
priority: P2
created: 2026-08-02
source: user request
files:
  - src/domain/backlogReadme.ts
  - src/storage/readmeFile.ts
  - src/commands/readme.ts
  - src/view/registry.ts
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
| **Guarantee** | No frontmatter is written, anywhere. The command writes exactly one file — the generated README, body and all — and no other note in the vault, so nothing it does can change a work item's `parent`, `order`, `type` or state. That holds even when the README has itself been enrolled as a work item (4c): regenerating replaces the body it generated and still writes none of its fields. |

**Main flow**

1. The user runs **Write backlog readme** from an open Product Backlog view.
2. The view's settings are resolved — the same `resolveSettings` the tree is built from,
   so the document describes *this* base rather than the defaults — together with the
   state vocabulary this view actually offers, which the settings alone do not hold: the
   declared workflow when there is one and the observed values when there is not
   (`stateMenuValues`), **plus** the values observed outside a declared workflow, which
   `boardColumns` mints columns for and the state menus therefore offer.
3. The document is generated: what the folder holds, the six type names with the ladder
   and the two types beside it, the parent/child table, the frontmatter contract in this
   view's actual keys — the tags property among them, with the shapes it accepts, since a
   reader who does not know that key writes the conventional one and this view ignores it —
   the ranking rule, the workflow states and which of them count as done, the roadmap keys
   when an axis is configured, where each type is filed, and a worked example note.
4. It is written as `README_PRODUCT_BACKLOG.md` in the resolved home folder, which is
   created if it does not exist.
5. A notice names the path it wrote.

**Extensions**

- **1a — no Product Backlog view is active.** The command does not offer itself. A README
  generated from defaults would describe a configuration nobody has, and getting the keys
  wrong is worse than saying nothing: an agent that trusts it writes `type` into a base
  that reads `kind`. "Active" is the **leaf**, never the file: one base open in two split
  panes is two views with two configurations answering to one path, and only the leaf
  tells them apart. Where the leaf itself is ambiguous — a note embedding two backlog
  bases — the answer is nothing rather than either of them: generating one base's
  contract over the other's file is a wrong answer that reads as a right one.
- **1b — the active view has not had its first result set yet.** Also withheld. An empty
  observed-state list then means "not loaded", not "no states", and generating from it
  would replace a good README with one missing the whole vocabulary — the failure is
  silent, which is what makes it worth a rule rather than a notice.
- **1c — the backlog was just scaffolded by the create-backlog command.** Nothing is
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
  could make. "Unset" is the axis's own definition of it, not a guess, and the property
  table asks the same question as the section: **either** date key alone is a configured
  axis, so a milestone-only roadmap gets its section and is described as the milestone-only
  thing it is, while a horizon property whose values have been cleared is no axis at all
  (`hasHorizonAxis`) and is named nowhere — the view draws no buckets for it and offers no
  action that writes it, so a row for it would advertise an inert key.
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
  In folder mode the section also stops saying that a note is correct wherever it lives —
  there, moving a note with no parent property **is** a hierarchy change, and the way to
  file freely is to name the parent, which always wins over the inference.
- **3c — the reader wants to know what the plugin will refuse.** Almost nothing: the type
  rules decide what is *offered*, never what is accepted. "Advisory" is scoped to what is
  offered and never stretched into what is *shown*: a declared type keeps its own level and
  its own badge however oddly it sits, and only an untyped note is drawn at the level its
  position implies. Saying otherwise would describe the badge wrong for exactly the
  mismatched hierarchy the sentence exists to explain. So a hand-written `Task` under an
  `Epic` is accepted, stays a `Task`, and is rewritten by nothing unless this view assigns
  types on a move. The README says all of it, because an outside editor that expects
  validation will trust a silence that means nothing.
- **3d — the reader is a program.** Every field is stated with the forms the reader
  actually accepts — a parent as a wikilink, a bare name or an alias, and as the first
  entry of a list; a number written as a string — and every derived value is named as
  derived, so nothing writes back a level, a rollup or a board position that this plugin
  computes and never stores ([[Board order is derived not stored]]). The ranking rule is
  stated with its tie-break, and the tie-break is a **view** setting: siblings sharing a
  number fall back to the order the base returned them in, not to anything in the notes.
- **3e — the reader writes a type of their own.** It is kept and shown verbatim, and it
  does **not** enrol a note that has no parent: the scope rule seeds only on the types
  this plugin ships (`ALL_TYPES`), so a custom-typed root written to the letter of a
  contract that said "declare a type" would be dropped by the very configuration the
  document was generated from. Those two facts are one paragraph for that reason.
- **3f — a value or a key contains markup.** Everything interpolated is user data: a state
  named `Waiting | external` ends a table cell, a folder holding a backtick closes a code
  span, and a key containing a colon turns the example's frontmatter into a different
  mapping. Each value is fenced and escaped for the place it lands in, so the document a
  reader copies from is the document the configuration describes.
- **3g — the reader wants to put an item at the top level.** The contract states the
  **empty** parent value, not only the link-shaped one, because that is what this plugin
  writes for a top-level item and because in folder mode the two differ: an empty value
  pins the note where it is, while deleting the key hands it to the folder note above it.
  A document that showed only links would have an outside editor delete the key and get a
  different tree from the one the same action produces here.
- **3h — a configured done value is not one of the workflow's states.** It is named
  anyway. What finishes an item is the done list, not the state list, so a workflow of
  `Todo, Active` beside a done value of `Done` means writing `Done` completes the item
  while nothing in the states table would have said so.
- **3i — the planning properties are called read-only.** They are not, and the document
  must not say they are: the row menu's Set horizon, Clear horizon, Schedule and
  Unschedule write and remove exactly these keys. What it states instead is the rule that
  survives — nothing writes them as a side effect of a move, a state change or a rename —
  which is the guarantee an outside editor actually needs.
- **3j — a property is optional and the table says it is required.** `order` and `type`
  are both optional on a note the parent link enrols: a missing order sorts last, a
  missing type takes the level the position implies, and a type of the reader's own is
  kept. Stating them as required would have an outside editor add or replace metadata the
  model never asked for — the opposite failure to the one this note usually guards, and
  the same cause.
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
- **4d — the file was generated by a different view of the same folder.** Left alone,
  with the notice saying so. Two views may share a home folder and configure different
  property keys, and a folder cannot hold two contracts: replacing the other one would
  leave it documenting keys half its readers do not use, under a notice that said
  "Updated". The marker therefore names the view that wrote it — the base path and the
  view name, the identity the collapse store already resolves — so the mismatch is
  visible both to the code that refuses it and to whoever opens the file.
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
  inputs are the resolved settings **and** the states the view offers — the declared
  workflow, the observed values that stand in for it when nothing is declared, and the
  stray values a declared workflow does not list but the board still gives a column. Two
  bases with identical settings and different states in their notes must not produce the
  same states section, in either configuration. Each value says which of the **three** it
  is, because two of the labels would otherwise be claims about the vault that are not
  true: a declared state is configuration, an observed one is a value some note carries,
  and the done value the menus append when nothing declares one has been used by nobody —
  calling it observed would report a state the backlog does not have.
- The example block is valid YAML for any value it interpolates. It is the part a reader
  copies, so a state called `Needs: review` or `#blocked` — a mapping and a comment, bare —
  is quoted.
- Re-running with the file already matching writes nothing.
- The bytes land from `storage/`, like every other file this plugin puts in the vault, and
  no frontmatter write happens on any note.
- The generated file carries no `type` and no `parent`, so it cannot enrol itself into the
  backlog it documents.
- A file at that path without the generated marker is never overwritten, and one whose
  marker names a different view is not either.
- The worked example claims only what a rank can mean: a number places an item relative to
  its siblings' numbers, never at an ordinal position the surrounding orders decide.
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

`src/domain/backlogReadme.ts` (`backlogReadmeContent`, `readmeStates`, `README_MARKER` —
pure text from the settings and the offered states, applying nothing, beside
`src/domain/writePlan.ts` which decides what a change would say the same way) ·
`src/storage/readmeFile.ts` (`writeBacklogReadme`, `readmePath` — the four outcomes, the
marker check and the no-op, beside `src/storage/baseFile.ts`, the other vault write that
is not a work item) · `src/commands/readme.ts` (`write-backlog-readme`: the configuration
gate, the notices, the `checkCallback` that hides the command with no view) ·
`src/view/registry.ts` (the live views, and which one the active **leaf** is drawing —
`getActiveViewOfType` cannot return a Bases view, which is drawn inside a leaf rather than
being one) · `src/view/backlogView.ts` (announces itself while loaded) ·
`src/main.ts` (registration).
The vocabulary the document is generated from is `src/domain/settings.ts` and
`src/domain/itemTypes.ts`; the tolerant reading rules it describes are
`src/domain/noteFields.ts`, and the ranking step is `src/domain/writePlan.ts`.
Tests: `test/domain/backlogReadme.test.ts` (what the document says, and that it says it
from the configuration), `test/storage/readmeFile.test.ts` (created, unchanged, updated,
refused), `test/commands/readme.test.ts` (the command end to end through a real view, and
the registry).
