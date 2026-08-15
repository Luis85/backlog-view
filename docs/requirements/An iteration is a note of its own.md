---
type: PBI
parent: "[[An Iterations board]]"
order: 10
status: Open
priority: P2
created: 2026-08-15
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An iteration is a note of its own

An eighth declared type, and one optional property that points at it.

**As** someone running the backlog in time boxes, **I want** an iteration to be a note I
can open, date and write a goal into, **so that** "Sprint 12" is something the vault
holds rather than a string repeated across thirty items.

The alternatives were weighed and refused. A plain property with an ordered value list —
the [[Buckets from a horizon property]] shape — makes an iteration a word, so it can
carry no dates and no goal. An observed vocabulary makes it a word with no order either.
A note is the only form that can be scheduled, and scheduling a sprint is what
[[An iteration draws as a bar or a line]] then becomes possible at all.

`Iteration` joins `MARKER_TYPES`, beside `Milestone`, and the choice is not filing
convenience: a marker occupies no rung, holds nothing and hangs from nothing, which is
exactly what an iteration is. Items **link** to an iteration; they are never its
children. Every structural rule follows without being written — no rung, no `+` to create
a child under it, ranked out of the ladder, and **no outgoing dependency edge**: a marker
declares no prerequisites, which `readItems.ts` states at the read and `candidates`
enforces by returning none.

Outgoing only, and the narrowing is deliberate rather than a hedge. A marker can still be
**waited for** — `candidates` draws from `model.byPath` and excludes only context rows,
loops and what is already named, so any item may name an iteration as its prerequisite,
exactly as it may name a milestone. That is coherent ("this cannot start until Sprint 12
closes") and it is the behaviour a `Milestone` already has, so refusing it for one marker
would be a new rule about one name rather than a rule about markers. An earlier draft of
this note said "no dependency edges" flatly, which promised a refusal the code does not
make in the incoming direction. It amends ADR 0013 the
way the Milestone addition already did, and owes the same three shipped opinions a
declared name owes: a default subfolder, an icon and a badge colour.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an iteration, or setting an item's iteration from the row or card menu |
| **Preconditions** | The iteration property is configured, or bound by the toolbar's setup action ([[Bind a property by using it]]) |
| **Guarantee** | The link is read, never guessed: no property is matched by name, an unconfigured key is never written, and setting an iteration writes one key on one note through the gate every other write goes through. |

**Main flow**

1. The user creates a note typed `Iteration`, which files under its own default
   subfolder and takes its own badge and icon.
2. The user names an iteration property in the view options, or lets the toolbar's setup
   action bind the suggested key ([[Backfill missing properties]]).
3. On a row or a card, `Set iteration` offers every `Iteration` note in the model, plus
   `None`.
4. Picking one writes a wikilink to that note under the configured key, through
   `applySafely`, and the write can be taken back by the one undo slot
   ([[Undo and redo]]).
5. The tree, both roadmap axes and the product board are unchanged by the value: it
   places nothing and hides nothing on its own.

**Extensions**

- **1a — the vault already has notes typed `Iteration`.** They are read as items with no
  migration and no rewrite, exactly as a `Milestone` was on the day that type was
  declared. A declared name is recognised on read; nothing stamps it.
- **2a — the iteration property names a key the plugin already owns.** Refused by the
  same key-collision gate every configured write target goes through — never the parent,
  order, type, state or tags key, never a transition stamp, never an axis key. One rule
  over the whole set, and it gates writes rather than warning about them.
- **2b — the property is left unconfigured.** Nothing is written under it, ever, and no
  item can be put in an iteration. The scope picker
  ([[A board scoped to one iteration]]) has nothing to offer and does not render.
- **3a — the item is outside the Base's filter.** `Set iteration` is not offered at all,
  with the parent-link actions and Set state it sits beside. A context row renders and
  parents; it is never a write target.
- **3c — the row is a catalog member** (a `Test suite`, a `Test case`, or a `Task`
  beneath one). `Set iteration` is not offered. The population it would join is the plan's
  (see [[A board scoped to one iteration]] extension 3i), so writing the key here would
  store a value no board can ever draw — a link accepted and silently dropped, which is
  worse than an action that is simply absent.
- **3b — the value the note already holds is the entry being offered.** Its checkmark is
  asked of the **plan** — checked exactly when picking it would write nothing — never by
  a comparison written beside the plan. The two drifted once already on the horizon menu,
  where a value the reader refuses read as no value and offered a key removal as the
  current state.
- **4a — the link names a note that does not exist, or was renamed.** Read the way
  `parent` and `dependsOn` already are, through the metadata cache: a broken link is kept
  and rendered, never silently dropped and never repaired by a write nobody asked for
  ([[Broken links still render]]).
- **5a — the item carries an iteration and its parent carries a different one.** Both are
  true and neither is derived. Nothing inherits an iteration down the tree, which is what
  makes the board's population a plain question about one note
  ([[A board scoped to one iteration]]).

## Acceptance criteria

- `Iteration` is a declared type in `MARKER_TYPES` with a default subfolder, an icon and
  a badge colour, and ADR 0013 records the eighth name.
- The `iterationProperty` view option names the frontmatter key; `iteration` is the
  suggested placeholder, offered by the setup action and never matched by name.
- The value is a wikilink to the Iteration note, read through the same link handling
  `parent` and `dependsOn` use.
- `Set iteration` appears on the row and card menus of **plan** rows, offers every
  `Iteration` note plus `None`, checks its entries from the plan, and is absent on a
  context row and on a catalog member.
- The write goes through `applySafely`, writes only the configured key, is never written
  when the key is unconfigured, and is undone by the one undo slot.
- No iteration is ever inherited from a parent item.

## Where it lives

The type name and its default subfolder join `src/domain/typeVocabulary.ts`; the marker
rules it inherits are already in `src/domain/itemTypes.ts` and need no edit. The property
is one row in `PROPERTY_TABLE` in `src/domain/optionalProperties.ts`, which is what buys
the `iterationProperty` option in `src/domain/viewOptions.ts`, the resolved key in
`src/domain/settings.ts`, the collision gate in `src/domain/settingsConsistency.ts` and
the setup action's binding. Reading the link is `src/domain/readItems.ts` over
`src/domain/noteFields.ts`; the write is one more pair in `applyLabels`'
list in `src/storage/frontmatter.ts`, planned by `src/domain/writePlan.ts`. The menu
entry is `src/view/interactions/labels.ts`, beside the assignee's
([[Setting the assignee on an item]]). Driven in `test/domain/settings.test.ts` and
`test/view/contextRowWrites.test.ts`.
