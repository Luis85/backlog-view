---
type: PBI
parent: "[[Test coverage]]"
order: 10
status: Open
priority: P2
created: 2026-08-08
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Coverage as a property

**As** someone maintaining a test catalog, **I want** a test case to name the backlog items
it covers, **so that** what a test is for is stated on the test rather than remembered by
whoever wrote it.

The shape is [[Dependencies as a property]]'s, deliberately and almost exactly: a
user-named key holding wikilinks, bound in the view options like every other optional
property, read tolerantly, resolved against the same item set `parent` resolves against,
and **never repaired on disk**. The placeholder is `covers`, offered and never matched by
name, as [[Horizons or dates]] requires of every key here.

Direction is settled by the same argument and comes out the same way: **the test names the
work.** A test is written *about* something, so the statement belongs on the test, and
writing it there means adding coverage touches the note the user is acting on and never
the one they merely pointed at. The reverse — a PBI listing its tests — would put a write
on the plan every time the catalog changed, and would make a PBI's frontmatter a thing two
people edit for two different reasons.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The model is built over a result set with the coverage property configured |
| **Preconditions** | The coverage key is bound in the view options; without it the feature is off everywhere |
| **Guarantee** | Reading coverage writes nothing, repairs nothing and moves nothing. No item is hidden, re-parented, re-ranked or re-levelled by an edge, broken or otherwise. A note the Base excluded is never written to and never **declares** an edge; being *named* by a result is allowed, because that statement belongs to the result that made it. |

**Main flow**

1. The coverage key is resolved from the view options like every other optional key.
   Unbound, the property does not exist for this view: nothing is read, drawn or offered.
2. Each **test** result's value is read tolerantly, the way every field here is read — a
   single entry or a list, a `[[wikilink]]` or a bare name, blanks and repeats collapsed.
   The property is read from tests and from nothing else: the direction rule is the
   feature's, so the reader keeps it rather than leaving it to the one menu that happens to
   offer the write.
   **From a test as the view shows it, not as its frontmatter spells it.** A child of a
   `Test suite` with no `type` at all *is* a `Test case`
   ([[Test suite and test case as a ladder of their own]] 4c) — it draws as one and gets
   backfilled as one — so a gate written against the raw `typeName` would silently ignore
   that note's coverage until ✨ happened to run, leaving a covered item reading as
   untested for a reason nothing on screen explains. The gate asks the item's **effective**
   type, which the model has already computed by the time this pass runs, and the
   **Covers…** menu asks the same thing so a row the reader accepts is a row the menu
   offers to edit.
3. Each entry resolves against the item set the model **keeps** — the Base's results plus
   the excluded ancestors the parent walk loaded, less what the scope prune dropped —
   producing an edge from the test that named it to the item it covers.
4. Entries that cannot become an edge — unresolvable, or naming the test itself — are kept
   and **marked broken** on the item that declared them, never dropped and never rewritten
   by the reader.
5. The edges are readable in both directions: a test's own list, and the tests naming a
   given item, which is what [[Untested work names itself]] counts.

**Extensions**

- **1a — the key names a property another key already uses.** `configProblems` reports the
  collision and gates every write, exactly as it does for the state, horizon, date and
  dependency keys. A coverage key is not special enough to earn its own kind of warning.
- **1b — the user runs ✨ to bind the properties nobody has named.** The key is bound and
  **nothing is backfilled onto any note**, a third exemption from the stub pass, spelled
  as its own early return beside the horizon key's and the dependency key's. The reason is
  the dependency key's reason: an empty coverage list is a claim about a relationship that
  does not exist, on every note at once — and here it would be written onto every *work
  item* as well, which is the population that has no business carrying the key at all.
- **2a — the value is a single entry rather than a list.** One covered item. Frontmatter
  spells a one-item list both ways.
- **2b — the value repeats a name, or holds a blank entry.** Collapsed to one edge, blanks
  ignored. A duplicate is a typo, not stronger coverage.
- **3a — the entry names a note the Base excluded but the model already loaded** — an
  ancestor pulled in as a context row. The edge exists and the test's own row states it,
  but the covered item is never counted and never written to: an `outsideFilter` row is
  never a source of anything derived from the Base's results, and a coverage count is
  derived from them.
- **3b — the entry names a note this base never loaded, or one the scope prune dropped.**
  It does not resolve, and **nothing is loaded to make it resolve** — the rule
  [[Dependencies as a property]] argued at length and this note inherits whole. Such an
  entry is not reported as *mistyped*, because telling "no such note" from "a note this
  base did not load" needs a lookup this layer deliberately does not make.
- **3c — the item declaring the coverage is itself outside the filter.** Its list is not
  read at all. An excluded note's claims are not this base's facts.
- **3d — a `Test suite` declares coverage rather than a case.** Read exactly the same way.
  Nothing restricts the property to one type: a suite that covers a Feature as a whole is a
  true statement, and a rule refusing it would be the view deciding how coarse someone's
  tests are allowed to be. What it must not do is double-count — [[Untested work names
  itself]] owns that, and says so there.
- **3e — the entry names another test.** It resolves, and it is an edge like any other.
  Nothing here forbids it, because nothing here can tell a test that sets up another test
  from a mistake, and refusing it would need a rule about what a test may be about. So the
  **target** is unrestricted while the **source** is not, and the asymmetry is deliberate:
  which notes may make a claim is a rule about writes and counts, and what a claim may
  point at is a rule about meaning. Two consequences follow and are stated rather than
  assumed. A test-to-test edge can close a **loop** (4c). And it is **displayed nowhere**:
  the coverage count is drawn on plan rows only ([[Untested work names itself]]), so a test
  named by another test gets no inbound count and no untested signal. That is a decision,
  not an omission — the count answers *which work has nothing checking it*, a question a
  test is not the subject of — and it has to be written down, because the row renderer is
  shared and "draw the count where there is one" would put a number on a `Test case` the
  moment this edge existed.
- **3f — a work item carries the coverage key**, hand-edited or left behind by a re-typed
  note. It is not read, so it declares nothing and inflates no count. Nothing rewrites or
  removes it either: reading is not repairing, here as everywhere. A `PBI` listing its
  tests is the reverse direction [[Test coverage]] refused, and refusing it at the reader
  is what keeps that refusal from resting on a menu.
- **4a — the item names itself.** Marked broken. Nothing covers itself.
- **4b — two tests name the same item.** Two edges, both kept. That is coverage, not a
  conflict.
- **4c — two tests name each other, or a longer loop of them closes.** Kept, and **not**
  marked. A dependency cycle is marked because prerequisites claim an *order* and a loop
  makes that claim incoherent ([[Dependencies as a property]] 4b); coverage claims no
  order, nothing is drawn from it that needs an acyclic graph, and no count is affected,
  since a work item's count reads only the tests naming that work item. The one thing a
  loop here would break is a traversal nobody has a reason to write, so the rule is *do
  not write one* rather than *mark the data*.

## Acceptance criteria

- An unbound key means the feature is absent: nothing read, nothing drawn, nothing offered
  in a menu, and no warning about a property nobody asked for.
- A **bound** key appears in the generated README's property contract, marked optional and
  carried by tests. That document states that *only the properties above are written*, and
  **Covers…** writes this one ([[Linking a test to what it covers]]), so leaving it out
  would make the README's own rule false rather than merely incomplete — which is the
  reason `fieldRows` already documents the two keys the view stamps for itself.
- The property is read from tests only. A work item carrying the key declares no edge and
  raises no count — asserted at the reader, since the menu that offers the write is one path
  and the rule is about all of them.
- A **typeless** child of a `Test suite` declares coverage like any other case, and its
  **Covers…** menu opens. Asserted on a note with no `type` in its frontmatter: it is the
  row where "a test" and "a note whose `type` says test" come apart, and the only one where
  a reader written against raw frontmatter looks correct on every other fixture.
- ✨ binds the key and backfills nothing, on work items and tests alike. The exemption is
  stated where the stub pass runs rather than left to follow from the property being a
  list.
- A value is read tolerantly — one entry or many, linked or bare — with blanks and repeats
  collapsed, and nothing is ever written, reordered or repaired by reading it.
- Entries resolve against the set the model keeps, and **no note is loaded to resolve
  one**. Checkable by building a model whose base returns a note the prune drops and
  asserting the edge that names it is marked broken.
- An unresolvable or self-referential entry is marked **in the model**, never dropped: the
  tree's shape is identical with the property configured and without it.
- A context row's own list is never read, so no edge is declared by one; a result naming an
  already-loaded excluded note is the allowed direction and produces an edge that is never
  counted.
- Coverage does not roll up: no ancestor acquires a descendant's edges, in either
  direction.
- Resolution is one pass over the declared entries, so the model's bound becomes
  O(n log n + E) in the number of entries E — stated in E for the reason
  [[Dependencies as a property]] gives, since nothing caps how many items a test may name.

## Where it lives

**Nothing yet — this note is design.** The key joins the optional property options in
`src/domain/viewOptions.ts` and their resolution in `src/domain/settings.ts`, with the
tolerant read beside the tolerant date and number in `src/domain/noteFields.ts`.

Resolution is a pass in `src/domain/model.ts` **after `pruneOutsideHierarchy`** and after
`assignAll`, for the reason [[Dependencies as a property]] establishes: the marks are
fields of an item, and the set `linkAll` produced is not the set the model keeps.

Whether that is a *second* pass or the dependency pass generalised is the one open
implementation question, and it should be answered when the second one is written rather
than here — two link properties resolved by one walk is the obvious saving, and the two
have different legality rules — a dependency is read from every result and a cycle in it is
marked; coverage is read from tests only and a cycle in it is left alone (4c) — so a shared
walk must not become a shared rulebook.

The stub exemption is in the ✨ backfill, beside the horizon key's — `src/storage/` owns
the write, `src/domain/settings.ts` owns which keys it is asked to write.

`src/domain/backlogReadme.ts` — `fieldRows`, which is easy to miss because it is not part
of reading or writing the property. It **enumerates** the contract by hand rather than
deriving it from the optional-property list, one `if (settings.<key>)` per row, so a key
added to the options, the settings and the reader still does not appear there. A property
the view writes and the contract omits is not a documentation gap: the same document says
only the properties it lists are written.
