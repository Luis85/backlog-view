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
| [`adrs/`](adrs/README.md) | **How** it is built — architecture decision records | *(none — not backlog items)* |

The backlog says what the product does and why someone wants it. The
[ADRs](adrs/README.md) say what was chosen to make that possible, what it cost, and what
would make us choose again. They are deliberately **not** work items: **no `parent` and no
`type`** — their frontmatter is `adr`, `title`, `status`, `date`, `area`, none of which the
view reads. A note belongs to the backlog if it has a supported type *or* a parent, so the
register's own scope rule ([[What counts as a work item]]) leaves them out of the tree.
That is the plugin's behaviour applied to itself, and the toolbar's advisory counting them
is the honest report.

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

So it is checked, by a command anyone can run:

```bash
npm run docs   # and as part of npm run check, and in CI
```

`docs-check.mjs` enforces everything this file claims — an advertised invariant nobody
can run is worse than none, because it invites trust it has not earned:

1. Every note outside `adrs/` carries a `type`, every parent link resolves, and every
   parent/child pair is legal. A note that lost its frontmatter is reported rather than
   skipped — a skipped file is checked for nothing and says so to nobody.
2. No two siblings share an `order` — the register must not demonstrate the one ranking
   limitation the plugin has.
3. Every wikilink resolves to a note, and **every relative markdown link resolves to a
   file** — anywhere in `docs/`, whatever it points at, percent-encoding decoded and
   anchors stripped. Links inside code spans are examples, not references, and are
   skipped; so are external URLs.
4. Every `src/` or `test/` path named by a note in **`requirements/` or `adrs/`** exists.
   Those two describe the code as it is now. `tasks/`, `issues/` and `bugs/` are records
   of a moment and may legitimately name a file since split away — rewriting them would
   falsify the record — so their stale paths are **listed rather than failed**. Being
   listed is the point: visible, not silently exempt.
5. Every use case has all its sections — including **all four rows** of the use-case
   table, not just `Actor` — and **every** extension bullet is labelled `**Na — `, in step
   order, **naming a step the main flow actually has**. Validating only the bullets that
   already look like labels would let a mistyped one vanish and leave the rest looking well
   ordered; validating only shape and order would let `**99a — ` depart from nowhere.
6. Every ADR: frontmatter complete, number matching its filename, unique, no gaps in the
   sequence, a known status and area, relative links resolving, and every record listed in
   the ADR index. `supersedes` and `superseded-by` must name a record that **exists**, and
   both ends must agree — checked **from both directions**, since a chain half-declared
   from either side rots the same way: the predecessor goes on reading as current. An ADR
   naming a successor must also carry the `Superseded` status, which is that same failure
   inside one record.
7. Every module in `src/`, every file under `test/` — helpers included — **every view-option key and every command id**
   is named by at least one note — the check that finds *missing* notes rather than wrong
   ones. Surface names must appear in **`requirements/`**, not anywhere in `docs/`: a
   record that mentions one in passing, or quotes one as a test case, does not specify it. That includes the six keys *generated* per type, derived from the vocabulary and
   the key template rather than scanned for; a key expression the check cannot resolve
   fails rather than being passed over — and the number of keys found is cross-checked
   against the number the file should contain, so one the pattern cannot see at all makes
   the counts diverge instead of quietly shrinking what is checked. Menu items and toolbar
   controls are display text and stay a hand sweep. See [[Sweep the register against the code]] for which is which,
   and what the sweep found.

Each rule was verified the way this project verifies its lint rules: by planting the
violation and watching the check reject it.

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
