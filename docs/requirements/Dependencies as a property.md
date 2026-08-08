---
type: PBI
parent: "[[Dependencies]]"
order: 10
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Dependencies as a property

**As** someone whose plan has an order to it, **I want** a note to name the work that
must come first, **so that** the ordering lives in the backlog rather than in the head of
whoever drew the last diagram.

The shape is the one `parent` already has: a user-named property holding wikilinks,
resolved against the same item set, read tolerantly, and never repaired on disk. What is
new is the arity — `parent` names one note and a prerequisite list names several — and
that is the whole of the new data. Direction is the one the ecosystem's own vocabulary
uses and the one that keeps writes honest: **the note that waits names what it waits
for**, so adding a dependency writes to the item the user is acting on, never to the one
they merely pointed at. The placeholder is `dependsOn`, the name the Tasks plugin already
uses for the same idea, so a vault that has one fits without renaming anything — offered
as a placeholder and never matched by name, exactly as [[Horizons or dates]] requires of
every key here.

A dependency is not a second hierarchy. The tree is `parent` and only `parent`: a cycle
in prerequisites re-roots nothing, hides nothing, and changes no item's level, depth or
rank. It is an edge drawn beside the tree, and everything structural stays where it was.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The model is built over a result set with the dependency property configured |
| **Preconditions** | The dependency key is bound in the view options; without it the feature is off everywhere |
| **Guarantee** | Reading dependencies writes nothing, repairs nothing and moves nothing. No item is hidden, re-parented, re-ranked or re-levelled by an edge — broken or otherwise. A note the Base excluded is never written to and never **declares** an edge: no edge comes from reading a context row's own list. Being *named* by a result is a different thing and is allowed, because that statement belongs to the result that made it. |

**Main flow**

1. The dependency key is resolved from the view options like every other optional key.
   Unbound, the property does not exist for this view: nothing is read, drawn or offered.
2. Each result's value is read tolerantly, the way every field here is read — a single
   entry or a list, a `[[wikilink]]` or a bare name, blanks and repeats collapsed.
3. Each entry resolves against the same item set `parent` resolves against, **once the
   scope prune has had it** — the Base's results plus the excluded ancestors the parent
   walk already loaded, less the notes "Ignore notes outside the hierarchy" dropped as not
   work items, and nothing further — producing an edge from the prerequisite to the item
   that named it.
4. Entries that cannot become an edge — unresolvable, self-referential, or part of a
   cycle — are kept and **marked broken**, never dropped and never rewritten by
   the reader. Marked in the **model**: a field on the item, per "Where it lives". Which
   surfaces show it is each surface's own question, and 4d says how few answer it today. Never *by the reader* is the whole of it: the user can still remove one
   deliberately, and [[Linking two items]] is where that path lives.

**Extensions**

- **1a — the key names a property another key already uses.** `configProblems` reports
  the collision and gates every write, exactly as it does for the state, horizon and date
  keys. A dependency key is not special enough to earn its own kind of warning.
- **1b — the user runs ✨ to bind the properties nobody has named.** The key is bound like
  the others and **nothing is backfilled onto any note**: this key is an exception to the
  stub pass, and it has to be written as one, because the machinery's default is the
  opposite. `missingKeyStubs` walks every configured optional field and writes an empty
  value to each result that lacks it, with exactly one exemption today — the horizon key
  when no horizon axis is configured — spelled as its own early return. A second exemption
  is a second early return, not something inherited by being similar to the first.
  The reason it must be exempt: an empty stub is precisely the state
  [[Linking two items]] forbids the removal path to leave behind, so backfilling one would
  have ✨ create what a remove is required to clean up. It is also meaningless in a way the
  other stubs are not — an empty state or an empty date is a slot the user is invited to
  fill on that note, while an empty prerequisite list is a claim about a *relationship*
  that does not exist, on every note at once.
- **2a — the value is a single entry rather than a list.** One prerequisite. Frontmatter
  spells a one-item list both ways and a reader that accepted only the bracketed form
  would make the user's YAML the user's problem.
- **2b — the value repeats a name, or holds a blank entry.** Collapsed to one edge, and
  blanks are ignored. A duplicate is a typo, not a stronger dependency.
- **3a — the entry names a note the Base excluded but the model has already loaded** — an
  ancestor pulled in as a context row. The edge exists and the dependent row states it, but
  it is never counted, never drawn ([[Arrows between bars]] owns that) and never written to.
  This is the context-row rule with nothing new added, and it is worth being exact about
  which direction it governs: **an excluded note may be named, and may not do the naming.**
  The statement here was made by a result, on its own note, exactly as a result naming an
  excluded `parent` is the case that puts a context row on screen in the first place — it
  renders, it parents, and that is all. What the rule forbids is the other direction, 3c's.
- **3b — the entry names a note this base never loaded, or one the scope prune dropped.**
  It does not resolve, and the
  boundary is the point: the item set is the Base's results plus the excluded **ancestors**
  the parent walk pulls in, minus what the prune took, so a prerequisite that is neither is
  simply not there to resolve against. The pruned case is the one that needs saying out
  loud, because such a note *was* returned by the Base and *is* in `byPath` when `linkAll`
  finishes: it leaves the model a phase later, and an edge resolved before that would point
  at a meeting note ([[What counts as a work item]]) — the guarantee that nothing downstream
  sees a pruned note, broken by a pass that ran too early rather than by a rule anyone
  disagreed with. **Nothing is loaded to make any of them resolve.** Doing so would mean a vault
  read per named prerequisite — bounded by the entries someone typed rather than by the
  tree — to obtain a note that then cannot be drawn (an arrow needs both ends inside the
  filter), cannot be counted, and cannot be written to. The one thing it would add is the
  prerequisite's title, which the entry already spells.
  What such an entry must not be called is *mistyped*. Telling "no such note" from "a note
  this base did not load" needs a lookup outside the loaded set, and `addItem` holds the
  only cache read in this layer by design, so the view genuinely does not know which it is.
  It says the true thing instead — this name does not resolve **here** — and shows the text
  the note holds, which is how every entry that became no edge is presented, and reaches
  the same removal path ([[Linking two items]]).
- **3c — the item declaring the dependency is itself outside the filter.** Its list is
  not read at all. An excluded note's prerequisites are not this base's facts, the same
  reason its state is not this base's vocabulary.
- **4a — an item names itself.** Marked broken. Nothing precedes itself, and silently
  dropping the entry would leave a user staring at frontmatter the view is ignoring
  without saying so.
- **4b — the entries close a loop.** **Every** entry in the cycle is marked broken — not
  the one that closes it — and the items render unchanged. [[Broken links still render]]
  settles the direction (mark, do not tidy); what settles the *arity* is that there is no
  order to appeal to. A `parent` loop must pick a link, because a tree with a cycle in it
  cannot be rendered at all, and `breakCycles` picks `cycleEntry`'s — a choice that falls
  out of the order the items were loaded in, and is acceptable only because something has
  to give. Here nothing needs cutting to draw anything, so nothing has to be chosen, and
  choosing anyway would be the worse answer: "the edge that closes it" is a fact about the
  traversal that found it, so with `A → B → A` the red mark would sit on whichever entry
  was reached second, and re-sorting the Base would move it to the other note. Both entries
  say the same wrong thing. Both are marked, and no arrow is drawn for either
  ([[Arrows between bars]] 1d), which is the same picture whichever way the walk went.
- **4c — the loop is entirely between context rows.** It is not read, per 3c, so there
  is no loop to mark.
- **4d — the item is on a tree row, a board card or a bucket card.** Nothing there says an
  entry is broken. Two surfaces read the mark today and no others: the **dated timeline**,
  where the dependent's row carries the marker ([[Arrows between bars]] 1d), and **Remove
  dependency…**, which lists every entry that became no edge by the raw text it holds
  ([[Linking two items]] 4b) and opens wherever a work item's menu opens. So the fact is
  *reachable* from every projection and *visible* in one. That is a deliberate narrowing
  rather than a hole to be filled here: a badge on a tree row, a card and a bucket card is
  three display decisions inside notes that own those rows, while this note owns the
  property and the reading. What it must not do is quietly promise the wider thing — which
  is what the word "marked" did until this extension was written, since a use case saying
  "marked" reads as something on a screen.

## Acceptance criteria

- An unbound key means the feature is absent: nothing read, nothing drawn, nothing
  offered in a menu, and no warning about a property nobody asked for.
- ✨ binds the key and backfills nothing: after it runs, no note carries an empty
  dependency list. The exemption is stated in the stub pass itself rather than left to
  follow from the property being a list.
- A value is read tolerantly — one entry or many, linked or bare — with blanks and
  repeats collapsed, and nothing is ever written, reordered or repaired by reading it.
- Entries resolve against the same item set `parent` resolves against, by the same rule, and
  **no note is loaded in order to resolve one**: a prerequisite that is neither a result nor
  an already-loaded ancestor does not resolve, and the vault is not consulted to find out
  why. Nothing reports such an entry as mistyped, since the view cannot tell that from
  out-of-base without the read it is not making.
- The set is the one the build **keeps**: with the hierarchy scope on, a prerequisite naming
  a note the prune dropped resolves to nothing, so no edge points at a note absent from the
  finished model and no non-work-item is offered as a prerequisite anywhere. Checkable by
  building a model whose base returns a meeting note the prune drops and asserting the edge
  that names it is marked broken — no ordering claim needed about which pass ran first.
- An unresolvable, self-referential or cycle-participating entry is marked **in the model**,
  never dropped: no item is hidden, re-parented, re-ranked or re-levelled by any edge, and
  the tree's own shape is identical with the property configured and without it. Nothing
  here claims the mark is drawn anywhere — the dated timeline and the removal picker are
  the two surfaces that read it, each in its own note, and the tree row, the board card and
  the bucket card show nothing.
- Which entries a cycle marks does not depend on presentation: every entry in the cycle is
  marked, so the same stored data produces the same marks under any Bases sort. Checkable
  by building `A → B → A` twice with the entries in either order and asserting both edges
  broken both times — the assertion a "which one closed it" rule could not make.
- A context row's own list is never read, so no edge is ever declared by one, and it is
  never written to. A result naming an **already-loaded** excluded note as a prerequisite is
  the allowed direction and produces an edge that is never counted and never drawn.
- Dependencies do not roll up: an item's prerequisites are its own, and no ancestor
  acquires them.
- Resolution adds no second superlinear step beside `sortSiblingsDeep`: it is one pass over
  the declared entries, so the model's bound becomes O(n log n + E) in the number of entries
  E. Stated in E rather than folded into O(n log n), because nothing caps how many
  prerequisites an item may name — a register where every note names every other has E in
  n², and a bound that hid that would be claiming a check nobody can run.

## Where it lives

**Nothing yet — this note is design.** The key joins the other optional property options
in `src/domain/viewOptions.ts` and their resolution in `src/domain/settings.ts`, with the
tolerant read beside the tolerant date and number in `src/domain/noteFields.ts` — the
module that already owns "what shape did the user's frontmatter take". Resolution is a
pass in `src/domain/model.ts` **after `pruneOutsideHierarchy`** — not after `linkAll`,
which is the tempting place and the wrong one: the prune runs later and takes whole
subtrees with it, so the set `linkAll` produced is not the set the model keeps. The marks
it produces are fields of `BacklogItem`, which places the pass after `assignAll` rather
than merely after the prune — so the question `src/domain/CLAUDE.md` asks of every new
field, *which phase owns it*, is answered by the phase that can first see every item **that
survives**.
