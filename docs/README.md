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

**Product Kanban** is the next increment, and it is design only: a board projection of
the same backlog, specified across four features and 15 use cases — the backlog/board
toggle, columns from the workflow the view options define, card moves as gated state
writes, and the hierarchy showing through on the board. Nothing under it is built; every
note states the precedent or the codebase seam it rests on, from a survey of the Kanban
Guide, the major trackers and the Obsidian ecosystem run on 2026-08-01.

Those 15 are the argument for writing a PBI as a use case *before* building it rather
than after. Their `Where it lives` sections say **nothing yet** and then name the module
the work will extend, which is a design claim a reader can disagree with; their
extensions are where the epic's hard parts are already settled — what a filtered board
does to a WIP signal, what happens to a card created into a state the base excludes —
and every one of those was a paragraph of prose before the shape asked the question.

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
   skipped — a skipped file is checked for nothing and says so to nobody. Two notes may not
   share a **basename**, in any folders: the register addresses work items by name, so a
   collision makes every `[[wikilink]]` and `parent:` to either one ambiguous.
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
5. Every use case has all its sections **in the documented order**; the whole
   `**As** … **I want** … **so that** …` opening, not just its first word; and the four
   table fields as **rows of the table**, parsed inside the block it occupies — ordering
   says where a marker sits, never that it is a row of anything. And **every** extension
   bullet is labelled `**Na — `, in step order, **naming a step the main flow actually
   has**. Validating only the bullets that already look like labels would let a mistyped
   one vanish and leave the rest looking well ordered; validating only shape and order
   would let `**99a — ` depart from nowhere.
6. Every ADR — meaning **every note under `adrs/` except the index**, found by where it
   lives rather than by whether its name looks right, so a malformed filename is *reported*
   instead of quietly opting out of the checks below. Frontmatter complete, number matching
   its filename, unique, no gaps in the
   sequence, a known status and area, relative links resolving, and every record listed in
   the ADR index. `supersedes` and `superseded-by` must name a record that **exists**, and
   both ends must agree — checked **from both directions**, since a chain half-declared
   from either side rots the same way: the predecessor goes on reading as current. An ADR
   naming a successor must also carry the `Superseded` status, which is that same failure
   inside one record. Its five headings are checked for presence **and order**, by the same
   code that checks a use case's sections — they are one rule, and the round that found one
   of them un-ordered found the other still asking only whether the heading was somewhere.
   An ADR must also carry **neither** `parent` nor `type`: the runtime enrols a note with
   either one in the backlog, so checking only the fields an ADR should have would never
   notice a field it must not.
7. Every module in `src/` and every file under `test/` — helpers included — is named by at
   least one note, **as a whole path**. This is the check that finds *missing* notes rather
   than wrong ones, and matching by substring let a mistyped `src/main.tsx` stand in for the
   `src/main.ts` it misspells while the reference check parsed the prefix and found the real
   file: one typo, passing twice.

**One check lives elsewhere, on purpose.** That every **view-option key** and **command id**
is named by a *requirement* is verified in `test/docs/surfaces.test.ts`, because it needs to
**import** the modules and read what they actually produce: `getViewOptions()` for the
keys — the six generated per type included — and `onload()` for the commands it registers,
so a second one is discovered rather than remembered. Teaching this script to learn them instead meant regex-scanning
TypeScript, and ten review rounds found ten ways that can be fooled. A script over markdown
checks markdown; a test that can load the module asks the module. A record naming a surface
in passing does not specify it, so that search reads `requirements/` alone — and reads only
the **code spans** in them, matched whole, because an id is never prose: "backlog" is a word
on nearly every page and must not vouch for a command called `backlog`. Menu items and
toolbar controls are display text and stay a hand sweep — see
[[Sweep the register against the code]].

Each rule was verified the way this project verifies its lint rules: by planting the
violation and watching the check reject it.

## What each kind of note holds

Seven note kinds, each answering a different question. The **type is a promise about the
content**, so choosing it is the first editorial decision: a defect written as a Task loses
the lesson, and a limitation written as a Bug reads as something someone is about to fix.

| Kind | Answers | Sections |
| --- | --- | --- |
| `Epic` | Why this body of work exists, and what "done" means beneath it | Prose · why it exists · definition of done |
| `Feature` | What outcome one coherent slice delivers | Prose · **Outcome** · Use cases |
| `PBI` | What someone does, step by step, and every way it can go otherwise | The use-case shape below — **enforced** |
| `Task` | A piece of engineering work, and the evidence that justified it | Evidence · Why it matters · Approach · Acceptance criteria · Risks · Outcome |
| `Issue` | A question, a decision taken, or a limitation accepted | Varies by which — see below |
| `Bug` | What went wrong, what fixed it, and what it taught | What happened · Fix · Lesson |
| ADR | What was chosen to build it, what that cost, what would change it | Context · Decision · Consequences · Alternatives · Revisit when — **in that order** |

Only the PBI shape and the ADR shape are gated by `npm run docs`; the other four rest on
whoever writes them. That is the honest division rather than an omission: a checker can see
whether a heading is present, never whether the paragraph under it says anything. What
follows is what "says something" means for each kind.

### `Epic` — why the work exists

An Epic is not a folder with a title. It says **why this body of work exists at all**, and
what "done" means for everything beneath it, so a use case three levels down can be argued
against something. [[Product Backlog]] names the gap it fills (Obsidian has queryable tables
and no tree with a rank) and then states three conditions every item under it must satisfy.

The failure mode is an Epic that only restates its own name. If it could be deleted without
any child becoming harder to judge, it was a heading.

### `Feature` — one outcome, and its use cases

A Feature states an **outcome** — one sentence, in the user's terms, about what is true
once the feature exists — and then indexes the use cases that deliver it. Nothing else
belongs here: detail written at feature level is detail no use case owns.

Keep the index complete. A Feature whose list has drifted from its actual children is worse
than one with no list, because the list is what a reader trusts instead of the tree.

### `PBI` — a use case

A `PBI` is not a title with a checklist under it. It is a **use case**, in one shape:

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

Three habits make the difference between a use case and a paraphrased implementation:

- **The guarantee is what survives every branch**, not what the main flow achieves. "The
  tree is never left in a shape the model cannot represent" holds down the refused-drop path
  too; "the item moves" does not.
- **Extensions carry their reason.** `1a — the quick filter is active` is a rule; adding
  *"under a filter, visual neighbours are not siblings"* is why it will still be there after
  the next refactor.
- **Acceptance criteria are testable.** Each one should map to something a test asserts or a
  human can check in a vault in under a minute. "Feels responsive" is not a criterion.

### `Task` — engineering work, with its evidence

Tasks are the work that keeps the plugin maintainable, and they open with **Evidence**
rather than with a proposal: a measurement, a review finding, a line count. `Approach` is
ordered when order matters — [[Split the view test suite]] cannot split anything until the
shared harness moves, and says so as step 1. `Risks` appears when there is one worth naming.

`Outcome` is written **after** the work and says what actually happened, including what the
task did not anticipate. That last part is the most valuable paragraph in the folder: it is
where a decision nobody planned to make gets recorded at the moment it was made.

### `Issue` — a question, a decision, or a limitation

An Issue is the widest kind, and its shape follows which of three things it is. Say which
in the first heading rather than making a reader infer it:

- **A decision taken** — `The decision` · `Why` · `What a real fix would look like` ·
  `Acceptance criteria`. [[Write batches are refused not queued]] records a rule that is
  correct and looks like a bug, so nobody "fixes" it twice.
- **A limitation accepted** — `The limitation` · `Why it is deliberate` ·
  `What would lift it` · `Impact`. The point is the cost, stated plainly enough that a
  reader can disagree with it.
- **A verification to run** — `Why this exists` · `How to check` · `Acceptance criteria` ·
  `Outcome`. Written as a checklist someone can execute, because appearance and base identity
  cannot be tested here.

An Issue may legitimately have **no acceptance criteria**, and should say so out loud
("None; recorded so the trade-off is re-decided knowingly rather than rediscovered"). A
blank criteria section reads as an oversight; an explicit "none" reads as a decision.

### `Bug` — what happened, the fix, the lesson

Three sections, and the third is the reason the note is kept after the fix ships.
`What happened` describes the **observed** behaviour and the mechanism — not the symptom
alone. `Fix` names the change *and the test that fails without it*. `Lesson` generalises to
the rule that was missing, which is what stops the same defect arriving somewhere else:
[[Nested extra type lost its pinned rank]] ends at "a rule that pins a rank has to hold
wherever that type appears", and that sentence is worth more than the diff. Drop the lesson
only when the fix genuinely generalises to nothing — and notice that being rare.

A bug that turns out to be a limitation gets rewritten into the limitation shape above
rather than closed quietly.

### ADR — what was chosen, and what it cost

Full conventions live in [`adrs/README.md`](adrs/README.md); the essentials are that an ADR
carries `adr`, `title`, `status`, `date`, `area` and no work-item fields, and that its five
headings appear in the documented order — Context before Decision before Consequences is an
argument, and the same five sections rearranged are a different one.

**An ADR earns its place when an alternative was genuinely available.** A record that could
only ever have gone one way is documentation, and belongs in a `CLAUDE.md` beside the code.
Two sections do the work: `Consequences` must include what got *harder* — one with only good
consequences has not been thought about — and `Alternatives` must give the specific reason
each was rejected, where "simpler" is not a reason and "cost N and bought a rename" is.

## Conventions

- Frontmatter is the plugin's own vocabulary, so the register is a working example of it:

  | Field | On | Holds |
  | --- | --- | --- |
  | `type` | every backlog note | One of the six names. ADRs carry none |
  | `parent` | everything but an Epic | A wikilink, `"[[Note name]]"`, quoted so YAML keeps it |
  | `order` | every backlog note | The rank among siblings. Unique within a group — the register must not demonstrate the one ranking limitation the plugin has |
  | `status` | every backlog note | `Open`, `Active` or `Done` |
  | `priority` | Tasks, Issues, Bugs | `P1`–`P3`. Absent means nobody has judged it |
  | `area` | Tasks, Issues, Bugs | Where the work sits: `testing`, `design`, `verification`, … |
  | `created` / `closed` | Tasks, Issues, Bugs | Dates, `YYYY-MM-DD` |
  | `source` | Tasks, Issues, Bugs | **Where the evidence came from** — a PR number, a review, a vault run |
  | `files` | Tasks, Issues, Bugs | The paths the note is about, so a reader lands in the code |

  The last five belong to record notes because that is where they earn their keep, not
  because a requirement may not carry one — a few do, where the same need arose.

- **Every note states the evidence it rests on.** A note that cannot say what it observed is
  a guess, and guesses are the thing this register exists to keep out of the code. That is
  what `source` and the `Evidence` heading are for, and why a Task opens with a measurement
  rather than an opinion.
- **Write it when it is decided, not when it is convenient.** Half of what is worth keeping
  here — an asymmetry nobody chose, a rule that only holds by luck — was noticed in passing
  while doing something else, and would have been unrecoverable an hour later.
- **Record what was rejected, and why.** An Issue that says only what was done leaves the
  next reader to re-derive the alternatives; naming them is what makes a decision arguable
  rather than merely historical.
- A closed note is not deleted: its outcome is the record of why the code looks as it does.
  Several are checklists to **re-run** rather than history — appearance and base identity
  cannot be tested in this repository, so those two are reopened, not rewritten.
- Anything still open is open for a reason. Nothing here is a backlog of undone chores.
