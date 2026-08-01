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
creating them, progress, finding work, safe writes and view state — 24 use cases in all.

**Codebase health** is the engineering work — three features and four use cases saying what
"healthy" means here, with the tasks that got it done underneath. Its actor is whoever
changes the plugin, which is the honest way to write an architectural rule as a use case:
someone has to be trying to do something for the rule to be worth having.

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
refused — which is exactly why the register has to hold to it by hand.

Six things are checked by script rather than by reading, because each is the kind of error
that survives review indefinitely:

1. Every parent link resolves, and every parent/child pair is legal.
2. No two siblings share an `order` — the register must not demonstrate the one ranking
   limitation the plugin has.
3. Every wikilink resolves to a note.
4. Every `src/` or `test/` path a note names exists.
5. Every use case has all six of its sections, and its extensions are in step order.
6. Every module in `src/` and every test file is named by at least one note — the check
   that finds *missing* notes rather than wrong ones. See
   [[Sweep the register against the code]] for how that sweep is run and what it found.

## Every PBI is a use case

A `PBI` here is not a title with a checklist under it. It is a **use case**, in one shape:

| Section | Answers |
| --- | --- |
| `**As** … **I want** … **so that** …` | Who wants this, and what changes for them if they get it |
| **Actor / Trigger / Preconditions / Guarantee** | What starts it, what must already hold, and what stays true no matter which branch is taken |
| **Main flow** | The numbered path when nothing goes wrong |
| **Extensions** | Every other path, numbered against the step it departs from — `3a`, `3b` |
| **Acceptance criteria** | What has to be true for it to be done. Testable, not aspirational |
| **Where it lives** | The modules and the tests, so the register leads back into the code |

The **extensions** are the part that earns its keep. Most of this plugin's hard-won
behaviour is a branch off a main flow that reads as obvious: a drop onto a descendant, a
tag edit racing a refresh, a base whose identity cannot be resolved. Writing them as
extensions puts each one beside the step it complicates, so the rule and its reason arrive
together instead of the rule surviving alone in a list of criteria.

A `Feature` states its **outcome** and indexes its use cases. An `Epic` states why it
exists and what "done" means for anything under it.

`Issue`, `Bug` and `Task` notes are not use cases — they are records of a question, a
defect or a piece of work — and keep their own shapes.

## Conventions

- Frontmatter is the plugin's own: `type`, `parent` (a wikilink), `order`, plus `status` and
  whatever else is useful (`priority`, `area`, `closed`, `source`).
- **Every note states the evidence it rests on.** A note that cannot say what it observed is
  a guess, and guesses are the thing this register exists to keep out of the code.
- A closed note is not deleted: its outcome is the record of why the code looks as it does.
  Several are checklists to **re-run** rather than history — appearance and base identity
  cannot be tested in this repository, so those two are reopened, not rewritten.
- Anything still open is open for a reason. Nothing here is a backlog of undone chores.
