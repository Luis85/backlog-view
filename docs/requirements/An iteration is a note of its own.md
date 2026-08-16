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

A twelfth declared type, one optional property that points at it, and one the iteration
itself carries.

**As** someone running the backlog in time boxes, **I want** an iteration to be a note I
can open, date and write a goal into, **so that** "Sprint 12" is something the vault
holds rather than a string repeated across thirty items.

The **goal** is a property rather than the note's body, and the ladder is what decided
it. A body needs no code at all and would be the cheaper answer if nothing had to read
it — but the goal draws above the board's columns ([[A board scoped to one iteration]]),
and reaching a body means an async read in the view layer plus a rule for which part of
it counts as the goal. A property is read by machinery this plugin already has: the
fifth LABEL property, which is one row in the list `applyLabels` loops over.

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
| **Guarantee** | The link is read, never guessed: no property is matched by name, and an unconfigured key is never written. Setting an iteration writes **one batch on one note** — up to three keys, the link and the two dates the iteration's timeframe supplies ([[An iteration's timeframe schedules its items]]) — through the gate every other write goes through, taken back by one undo. |

**Main flow**

1. The user creates a note typed `Iteration`, which files under its own default
   subfolder and takes its own badge and icon.
2. The user names an iteration property in the view options, or lets the toolbar's setup
   action bind the suggested key ([[Backfill missing properties]]).
3. On a row or a card, `Set iteration` offers every `Iteration` note in the model — read
   from the whole item map, not the focused results, so a focus set elsewhere cannot make
   a top-level iteration unofferable — plus `None`.
4. Picking one writes a wikilink to that note under the configured key — spelled by
   Obsidian's own path-aware link generation, from this note to that one — through
   `applySafely`, in one batch with the two dates the iteration's timeframe supplies
   ([[An iteration's timeframe schedules its items]]), taken back by the one undo slot
   ([[Undo and redo]]).
5. The tree and the product board are unchanged by the link itself: it places nothing and
   hides nothing on its own. The roadmap is not, and that is the dates rather than the
   link — an item joining a sprint moves to that sprint's two weeks, which is the point.

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
  asked of the **plan**, never by a comparison written beside the plan. The two drifted
  once already on the horizon menu, where a value the reader refuses read as no value and
  offered a key removal as the current state.

  Which **part** of the plan is where this menu differs from every other Set menu, and
  the difference is stated here rather than left to be inferred. The plan carries three
  writes, so the register's usual sentence — checked exactly when picking it would write
  nothing — would leave the current iteration **unchecked** whenever the item's dates
  had drifted from it, and no entry would show as current. So the checkmark asks the
  plan's **LINK** component alone: the menu's question is *"which iteration is this item
  in"*, which is only the same question as *"would this write nothing"* while the plan
  holds one write.

  What that earns is the recovery path [[Creating an iteration from the board]] needs:
  picking the **checked** iteration is not a no-op, it re-applies the timeframe.
- **4a — the link names a note that does not exist, or was renamed.** Read the way
  `parent` and `dependsOn` already are, through the metadata cache: a broken link is kept
  and rendered, never silently dropped and never repaired by a write nobody asked for
  ([[Broken links still render]]).

  **Unresolved is not unset**, and the two must not collapse into one answer. The read
  keeps the entry the note spells as well as whatever it resolved to — the `raw`/`file`
  pair `noteFields.ts` already defines, whose own comment says `raw` is what a removal
  matches on for an entry that resolved to nothing. Collapsing an unresolved link to "no
  value" would tick `None` as the current choice on a note whose frontmatter visibly holds
  a link, and leave the reader no way to clear the very value they can see — the horizon
  menu's defect, reached by a different road.
- **4b — two `Iteration` notes share a basename in different folders.** The link written
  still names the chosen one, because the plan carries the target FILE and the writer
  spells the link from the editing note's own path — the same path-aware generation the
  parent link already uses. A link serialized from the basename alone would resolve to
  whichever of the two Obsidian picks, and the menu would look right while the write went
  elsewhere. This is why the iteration write sits beside the parent's rather than in the
  label list: labels are plain strings and carry neither the app nor a source path.
- **4d — the item holds a link but the model has no `Iteration` notes left to offer**
  (the last one was deleted, or the link was always broken). `Set iteration` still renders,
  with `None` alone. No targets is not the same as nothing to do: an item holding a value
  needs the action that clears it, and this is the only place offering one. Hiding the
  submenu because the TARGET list is empty leaves a value on screen the reader cannot
  remove — "unresolved is not unset" (4a) applied to the menu's own gate rather than to
  the plan behind it. With no link and no targets there is genuinely nothing to do, and
  the submenu is absent.
- **4c — the row is itself an `Iteration`.** `Set iteration` is not offered: an iteration
  is the scope a board is chosen by, never something put inside one. The board's
  population refuses one too, rather than trusting the menu — a key written by hand would
  otherwise make one iteration a card on another's board.
- **5a — the item carries an iteration and its parent carries a different one.** Both are
  true and neither is derived. Nothing inherits an iteration down the tree, which is what
  makes the board's population a plain question about one note
  ([[A board scoped to one iteration]]).
- **2c — the toolbar's setup action runs with the goal property configured.** It binds
  the key like any other and then **skips it in the backfill**. Every other optional
  property gets an empty key stubbed onto every note that lacks one, which is honest for
  a state or a date — an empty slot the reader is invited to fill — and dishonest for
  this one: a `goal` on every PBI, Feature and Task in the vault is a property that means
  nothing on the note it lands on. So `missingKeyStubs` gains a **third** early return,
  beside `horizon`'s and `dependsOn`'s and with its own reason written at it rather than
  folded into either. `dependsOn`'s reason is that an empty prerequisite list is a false
  claim about a relationship; this one's is that the property belongs to one type. Two
  rules that agree today are still two rules.
- **2d — a note that is not an `Iteration` carries a value under the goal key**, written
  by hand. Nothing refuses it and nothing reads it. The property is simply never offered,
  never stubbed, and read only from the iteration a board is scoped to — so a type test
  on a plain label would buy nothing the absence of an offer does not already buy, and it
  would be the first such test in the codebase.

## Acceptance criteria

- `Iteration` is a declared type in `MARKER_TYPES` with a default subfolder, an icon and
  a badge colour, and ADR 0013 records the twelfth name. It files into
  `typeFolder.iteration` — shipped default `iterations` under the home folder — and takes
  the `calendar-clock` icon and the purple badge.
- The register's own gate knows the type too: `docs-check.mjs`'s `LEGAL_CHILDREN` and
  `ROOT_TYPES` carry it, matched by the hierarchy table in `docs/README.md`, so an
  `Iteration` note can live in this backlog rather than being rejected as an unknown type.
- The `iterationProperty` view option names the frontmatter key; `iteration` is the
  suggested placeholder, offered by the setup action and never matched by name.
- The `iterationGoalProperty` view option names the key an iteration's goal is stored
  under; `goal` is the suggested placeholder. It is a plain string, written through the
  label list beside the risk and the assignee, and it is the one optional property the
  backfill **skips** — checked by running the setup action over a tree of every type and
  asserting no note but an `Iteration` gains the key, and that even an `Iteration` gains
  no empty stub.
- The value is a wikilink to the Iteration note, read through the same link handling
  `parent` and `dependsOn` use, and WRITTEN through the same path-aware generation the
  parent link uses — so two iterations sharing a basename still get distinct links.
- A link that resolves to nothing is distinguishable from an absent key: `None` clears the
  broken value rather than reading as already chosen.
- `Set iteration` appears on the row and card menus of **plan** rows, offers every
  `Iteration` note plus `None` **whatever focus level is active**, checks its entries from
  the plan, and is absent on a context row, on a catalog member and on an `Iteration` row.
- The write goes through `applySafely`, is never written when the key is unconfigured, and
  is undone by the one undo slot — in one batch with the dates
  [[An iteration's timeframe schedules its items]] adds, so a reader can never take back
  half a commitment.
- **Both new keys are captured for undo**, which is a separate statement from being
  written: `touchedKeys` lists them on the same condition the writer writes on, so undo
  restores the goal and the link and not only the dates that ride the axis capture.
  Checked by writing each and asserting the undo restores the previous value, not by
  reading the list.
- `Set iteration`'s checkmark is asked of the plan's **link** component, so the current
  iteration stays checked when the item's dates have drifted from it, and picking it
  re-applies the timeframe rather than doing nothing.
- No iteration is ever inherited from a parent item.

## Where it lives

The type name and its default subfolder join `src/domain/typeVocabulary.ts`; the marker
rules it inherits are already in `src/domain/itemTypes.ts` and need no edit. Both
properties are rows in `PROPERTY_TABLE` in `src/domain/optionalProperties.ts`, which is
what buys the `iterationProperty` and `iterationGoalProperty` options in
`src/domain/viewOptions.ts`, the resolved keys in `src/domain/settings.ts`, the collision
gate in `src/domain/settingsConsistency.ts` and the setup action's binding. Reading both
is `src/domain/readItems.ts` over `src/domain/noteFields.ts`.

The two writes are deliberately different shapes in `src/storage/frontmatter.ts`. The
**link** is its own pair beside the parent link's own write — NOT in `applyLabels`, which
carries plain strings and neither the app nor a source path — planned by
`src/domain/writePlan.ts`, which carries the target file rather than a serialized string.
The **goal** is a plain string, so it is one more row in the list `applyLabels` already
loops over. Reuse is judged by what the value is, and these two values are not the same
kind of thing.

**Both keys also need a row in `touchedKeys`' `carried` list in
`src/storage/writeKeys.ts`**, on the same condition the writer writes on. That is not a
detail of where code sits: `applySafely` captures each write's inverse from that list, so
a key written and not listed is a change **no undo can reach** — the single undo slot
would put the dates back and leave the goal or the link as the write left them. The list's
own comment states the rule and names the assignee as the property that followed it, which
is the shape both of these take. An earlier revision of this note omitted the module
entirely and would have had an implementer ship exactly that hole.

The backfill exclusion is a third early return in `missingKeyStubs`, in
`src/domain/writePlan.ts`. The menu entry is `src/view/interactions/labels.ts`, beside
the assignee's ([[Setting the assignee on an item]]). Driven in
`test/domain/settings.test.ts` and `test/view/contextRowWrites.test.ts`.
