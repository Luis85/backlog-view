# docs — the plugin's own backlog

This folder is a working backlog **for the plugin, in the plugin's own schema**. Open the
repository as an Obsidian vault (`npm run test-build` installs the plugin into it) and open
`Product Backlog.base` to see it as a tree.

It is also the layout the view ships as its default, so the folders are the feature
demonstrating itself:

| Folder | Holds | Type |
| --- | --- | --- |
| `requirements/` | What the plugin is meant to do | `Epic` → `Feature` → `PBI` |
| `tasks/` | Engineering work done to keep it maintainable | `Task` |
| `issues/` | Open questions, verifications and recorded decisions | `Issue` |
| `bugs/` | Defects, with what was learned from them | `Bug` |

## The trees

**Product Backlog** is the product: seven features covering the hierarchy, moving items,
creating them, progress, finding work, safe writes and view state.

**Codebase health** is the engineering work — three features, each with the PBIs that say
what "healthy" means there, and the tasks that got it done underneath.

**Cross-cutting concerns** is the third kind: properties that have to be true of
everything or they are true of nothing. Two features — `Multilang` (every string comes
out of a per-locale catalog) and `Theming and styling` (every pixel comes from Obsidian's
design tokens). They are siblings because they meet at the layout: translated text is longer,
shorter and sometimes right-to-left, and the stylesheet is what absorbs it. Specification
only — nothing under this epic is built yet.

`Issue` and `Bug` hang from whichever requirement they concern, which is exactly what those
types are for: they hold Tasks, they are never re-typed by a move, and they attach to an
Epic, a Feature or a PBI alike.

## The hierarchy is the point

This register is the plugin's own schema, so a wrong parent here is a bug in the example.
Every pair holds:

| Type | Parent may be | Children may be |
| --- | --- | --- |
| `Epic` | *(nothing — it is a root)* | `Feature`, `Issue`, `Bug` |
| `Feature` | `Epic` | `PBI`, `Issue`, `Bug` |
| `PBI` | `Feature` | `Task`, `Issue`, `Bug` |
| `Task` | `PBI`, `Issue`, `Bug` | *(nothing)* |
| `Issue` / `Bug` | `Epic`, `Feature` or `PBI` | `Task` |

The plugin does not *enforce* this — the rules decide what is offered, never what is
refused — which is exactly why the register has to hold to it by hand. It has been checked:
every parent link resolves, and every parent/child pair is legal.

## Conventions

- Frontmatter is the plugin's own: `type`, `parent` (a wikilink), `order`, plus `status` and
  whatever else is useful (`priority`, `area`, `closed`, `source`).
- **Every note states the evidence it rests on.** A note that cannot say what it observed is
  a guess, and guesses are the thing this register exists to keep out of the code.
- A closed note is not deleted: its outcome is the record of why the code looks as it does.
  Several are checklists to **re-run** rather than history — appearance and base identity
  cannot be tested in this repository, so those two are reopened, not rewritten.
- Anything still open is open for a reason. Nothing here is a backlog of undone chores.
