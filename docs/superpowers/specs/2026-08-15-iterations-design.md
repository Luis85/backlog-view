# Iterations — design

Date: 2026-08-15
Revised: 2026-08-16
Status: approved, not built

## The ask

An `Iteration` concept for the backlog: work items say which iteration they belong to,
and a second kanban board shows one iteration at a time, with a workflow based on the
product board's. The two boards are reached from one switcher, the way the roadmap's two
axes are.

## What the 2026-08-16 revision changed

Nothing here had been built when the user refined the ask, so this spec is amended in
place rather than answered by a second one that would contradict it. A reader must not
have to know which of two documents is current. What changed, and what it reversed:

1. **The board has no workflow of its own.** `iterationStateProperty`,
   `iterationStateValues` and `iterationDoneValues` are withdrawn, with the whole
   field-by-field fallback that made them work. The board reads the **resolved product
   state key** and buckets the product workflow into three columns — **Open**,
   **In Progress**, **Resolved** — over two list options that name which product states
   fall in the outer two. One workflow at two granularities, which is what the user asked
   for in those words: *"I don't want to add another workflow… the same workflow as the
   product just narrower."* §5 is rewritten and §6 rewritten around what a bucket costs
   that a column does not.
2. **Joining an iteration schedules the item.** `Set iteration` stops being one write and
   becomes a batch of three — the link and the two dates, taken from the iteration's own
   timeframe. §9 is new.
3. **The third column is `Resolved`, not `Done`.** A product workflow can hold states
   downstream of the point a sprint is finished with an item, so the board's terminal
   stage claims the weaker verdict. §5 states the difference and what it costs.
4. **An iteration carries a goal**, as one more optional property. §2 gains the row.
5. **Iterations are created and edited from the board**, from the scope picker that
   already names them, with a new one's dates derived from the previous iteration and a
   configured default length. §10 is new.

Two things the revision explicitly did **not** add, each refused once and recorded so it
is not re-proposed: a state written onto an item when it joins an iteration (§9), and a
re-stamp of every member when an iteration's dates are edited (§10).

## Decisions taken during design

Four questions were put to the user on 2026-08-15 and seven more on 2026-08-16. The
answers below are the constraints, not proposals.

1. **An iteration is a note of its own**, typed `Iteration` — not a property value and
   not an observed vocabulary. It can therefore carry dates, a goal and a body.
2. **The switcher chooses the board's scope** — the CONTROL is one `Board` toggle position
   plus a picker naming `Product` or an Iteration note, never a fifth toggle position. The
   Deliverables board keeps its own position, unchanged. *(This was originally written as
   "not a new projection", conflating the control with the internal identity. Only the
   control was ever the user's decision; §3 records why the internal identity had to
   become a projection anyway, and what that cost.)*
3. **Only items that carry the iteration land on its board.** No inheritance down the
   tree. A Task in Sprint 12 says so itself, whatever its parent says.
4. **An iteration draws as a bar or as a line, and that is a toggle**, not a fixed
   consequence of the type.

Added 2026-08-16, in the order they were asked:

5. **The board's first column is the iteration backlog**, holding the items in the
   iteration that carry no state (§5).
6. **The board has no state property of its own.** It narrows the product workflow into
   three buckets, and which product states fall in the outer two is configured (§5).
7. **The third bucket is `Resolved`, not `Done`** — a product workflow can hold states
   downstream of the point a sprint is done with an item (§5).
8. **Joining an iteration overwrites the item's start and target with the iteration's**,
   always, with no branch on what the item held; leaving one (`None`) writes the link
   removal alone and leaves the dates (§9).
9. **Nothing writes a state on joining** (§9).
10. **Iterations are created and edited from two entries in the scope picker**, through
    one dialog; the previous iteration is the one ending latest, and the default length
    is configured (§10).
11. **Editing an iteration's dates re-stamps no member** (§10).

## What this is not

Deliberately out of scope, so a reader does not look for them:

- No burndown, no velocity, no capacity.
- No swimlanes and no all-iterations board.
- No "Show completed items" on an iteration board, following the Deliverables board's
  own deferral of the same control: the toggle is about a subtree rollup and this board
  draws cards (§4).
- No inheritance of an iteration from a parent item (decision 3).
- No automatic roll-over of unfinished work into the next iteration.
- **No re-stamp of an iteration's members when its dates change** (decision 11, §10).
- **No state written by joining an iteration** (decision 9, §9).
- **No rename in the edit dialog** (§10).
- **No second state property, and no per-bucket representative state.** The value a drop
  writes is the first in its bucket. Naming three representatives is the upgrade if the
  first ever proves to be the wrong one, and it needs evidence rather than a third and
  fourth list.

## 1 — `Iteration` joins the type vocabulary

A twelfth declared name, in `MARKER_TYPES` beside `Milestone`
(`src/domain/typeVocabulary.ts`). Twelfth, not eighth: earlier revisions of this spec said
eighth, taken from ADR 0013's title rather than from `ALL_TYPES`, which has held eleven
names since the two test types joined. The register's own rule covers it — measure a set
with an instrument that can see all of it — and a decision record's title is not that
instrument.

A marker occupies no rung, holds nothing and hangs from nothing, which is what an
iteration is: items *link* to it, they are never its children. Every structural rule
that follows is therefore inherited rather than written — no rung in the ladder, no `+`
offering to create a child under it, no **outgoing** dependency edge, ranked out of the
ladder by `itemTypes.ts`.

Outgoing only. A marker declares no prerequisites (`candidates` returns none for one) but
can still be **waited for**: `candidates` draws from `model.byPath` and excludes only
context rows, loops and what is already named. So any item may name an iteration as its
prerequisite, exactly as it may name a milestone — coherent ("this cannot start until
Sprint 12 closes"), already true of the other marker, and refusing it for one name would
be a rule about that name rather than about markers.

It owes the three shipped opinions ADR 0013 requires of a declared name: a default
subfolder (`iterations`, in `DEFAULT_TYPE_SUBFOLDERS`), an icon, and a badge colour.
This amends ADR 0013 exactly as the Milestone addition did on 2026-08-02.

Consequences that follow for free and are wanted: the type appears in the creator menus,
is accepted as a focus root, groups on the shelf, and is documented by the generated
README and the in-app manual, because all of those read `ALL_TYPES`.

## 2 — `iteration` and `iterationGoal` join the optional properties

Two rows in `PROPERTY_TABLE` (`src/domain/optionalProperties.ts`):

| | | |
| --- | --- | --- |
| field | `iteration` | `iterationGoal` |
| option key | `iterationProperty` | `iterationGoalProperty` |
| suggested key | `iteration` | `goal` |
| label | `iteration` | `iteration goal` |
| settings key | `iterationKey` | `iterationGoalKey` |

Each row buys the view option, the ✨ setup binding, the key-collision gate and the
`ownedProperties` listing. No new machinery.

**The goal is a plain string on the Iteration note**, and everything below about reading
and writing a link is about `iteration` alone. `iterationGoal` is the fifth LABEL
property, so it is one row in the list `applyLabels` loops over — which is exactly what
`src/CLAUDE.md` says a fifth label costs, the assignee having already turned that loop
from a restatement into a list.

**The backfill must skip it**, and that is the one thing the row does not buy. `✨`
stubs an empty key for every configured optional property a note lacks, which is honest
for a state or a date — an empty slot the reader is invited to fill — and dishonest for
this one: a `goal` on every PBI, Feature and Task in the vault is a property that means
nothing on the note it lands on. `missingKeyStubs` (`src/domain/writePlan.ts`) therefore
gains a **third** early return beside `horizon`'s and `dependsOn`'s, with its own reason
written at it rather than being folded into either — `dependsOn`'s reason is that an
empty prerequisite list is a false claim about a relationship, and this one's is that the
property belongs to one type. Two rules that happen to agree today are still two rules.

The goal is deliberately **not** scoped by a type test anywhere else. Nothing refuses a
`goal` key on a PBI that a user writes by hand; the property is simply never offered,
never stubbed and never read except from the iteration a board is scoped to. A type
filter on a plain label would be the first in the codebase, and it would buy nothing the
absence of an offer does not already buy.

**Both keys need a row in `touchedKeys`' `carried` list** (`src/storage/writeKeys.ts`),
on the same condition the writer writes on. Writing a key and capturing it are two
statements, and only the second makes the write undoable: `applySafely` builds each
inverse from that list, so a key written and not listed is a change no undo can reach.
The single undo slot would put the dates back — they ride `axisEntries`, which is already
captured — and leave the goal or the link where the write left them. The list's own
comment states the rule and names the assignee as the property that followed it, which is
the shape both of these take.

**Reading it.** The value is a wikilink to the Iteration note. `src/domain/noteFields.ts`
already resolves a link property through the metadata cache — handling wikilinks,
aliases, bare names and lists — which is how `parent` and `dependsOn` are read.

**Writing it.** Beside the **parent link's** own write in `src/storage/frontmatter.ts`,
not in `applyLabels`. An earlier draft of this spec said the label list, reaching for the
cheapest reuse; that list is for plain LABEL strings — the risk and the assignee — and it
carries neither the app nor the source path, which `wikilinkTo` needs. Two Iteration notes
sharing a basename in different folders would then get one ambiguous `[[Sprint 12]]` that
resolves to whichever Obsidian picks, while the menu looked right. Reuse is judged by what
the value IS, and this one is a link. The plan therefore carries the target **file**, never
a serialized string. The three rules the label list keeps are kept here too: an
unconfigured key is never written, `null` deletes, `undefined` leaves the key alone.

**Never put in one.** An `Iteration` is not offered `Set iteration`, and the board
population refuses one as a card rather than trusting the menu to have prevented it — a
key written by hand would otherwise make one iteration a card on another's board, which
the badge decision leans on being impossible.

**Setting it.** A `Set iteration` submenu on the row and card context menus, offering
every Iteration note plus `None`. Picking one plans **three** writes rather than one —
the link and the two dates the iteration's timeframe supplies — in one batch through one
gate; §9 owns that rule and everything it refuses.

Its checkmark is asked of the **plan**, never by a comparison written beside the plan,
and §9 narrows *which part* of the plan it asks. That narrowing is the whole of what the
three-write batch costs this menu.

## 3 — The board grows a scope

`Board` stays one position on the projection toggle. `renderProjectionZone`
(`src/view/render/toolbarControls.ts`) switches on the toolbar POSITION rather than the
projection, and its `'board'` case draws a scope picker — the axis picker's twin, in the
same zone, built the same way. (Switching on the projection would delete the picker the
moment it was used; see the price below.)

```
[ Tree | Board | Roadmap | Deliverables ]
[ Scope: Product ▾ ]  →  Product · Sprint 11 · Sprint 12
```

Offered only when the iteration property is configured **and** at least one Iteration
note is in the model. Both halves: with no notes there is nothing to choose between —
the refusal `renderAxisPicker` already makes for a single configured axis — and with no
configured property nothing can join a scope, so every entry the picker offered would
draw an empty board.

**Internally it is a projection, not a flag.** `Projection` gains `'iteration'`, and the
chosen note's path is stored beside it as a parameter. The *control* is unchanged — one
`Board` position plus a picker, which is what was asked for — but "am I an iteration
board" becomes a question `src/view/projection.ts` answers rather than a comparison
repeated at call sites.

That reverses an earlier revision of this spec, and the reversal was expensive enough to
record. As a scope FIELD, seven separate functions answered for the product board while
an iteration was chosen: `filterScopeFor`, `countedPopulation`, `hideCompleted`, the
columns dispatch, the `Set state` gate, its checkmark planner, and `byProjectionType`.
They were found one review round at a time, each fix correct and one case short of the
next. `projection.ts` states the rule in the file itself — *"a projection added beside
`'tree'` rather than **as** a tree fails each of those gates silently and differently"* —
and `filterScopeFor`'s comment records the identical history for the Deliverables board:
three fixes, each one case short, because one set was being asked two questions.

As a projection, `Record<Projection, …>` in `src/view/collapseState.ts` fails to compile
until every question has an answer. That is an instrument that can see the whole set,
which is what the register asks for wherever a category invariant is at stake.

**The split has a price, and it falls on the toolbar.** Two controls compare the
projection to a *position* directly: `renderProjectionZone`'s switch, and the toggle's
`is-active` / `aria-pressed`. Once the internal identity and the control identity stop
being the same value, both are wrong — the scope picker would delete itself on first use,
leaving no way back to `Product`, and no toggle position would render pressed. So
`projection.ts` gains a `toolbarPosition` question answering `'board'` for `'iteration'`,
and both controls ask it. One extra question is the whole cost, and it is worth the
compile-checked gates; it is named here rather than discovered, because a split that
keeps the control shape must be checked *at the control*.

**Both values are UI state.** The projection and the scope path live in the collapse
store's per-view entry (`src/storage/collapseStore.ts`) — vault-scoped localStorage, per
saved view, per device, never the `.base`. ADR 0011's rule, applied again.

Read defensively, as every stored value there is: a stored path that no longer names an
Iteration falls back to `Product` and is **retained rather than rewritten**, so restoring
the note restores the saved choice. That is the axis pick's own rule
([[Horizons or dates]] extension 3a), and it is what makes a stored value user data
rather than a cache.

A host accessor pair `boardScope` / `setBoardScope` joins the siblings in
`src/view/uiState.ts`.

## 4 — Population and columns

| Scope | Cards | Columns |
| --- | --- | --- |
| `Product` | unchanged | `requirementsWorkflow`, one column per state |
| An iteration | the plan results whose `iteration` link resolves to that note, **whatever their work-item type** | `iterationBuckets`, three columns over the SAME workflow |

**Catalog members are excluded, and that is not a type filter.** `projectionMember`
returns `!inCatalog` for every projection but the catalog's own, and `inProjection` is
asked first and unconditionally in the single `VisibilityRule` — *no needle makes a
`Test case` a row of the plan*. The iteration board is a board in the plan projection and
inherits that answer, as the tree, the product board and the roadmap already do. So
"whatever their type" means every **work-item** type, `Deliverable` included; the two
ladders stay apart. `Set iteration` is therefore offered on plan rows only, so the
property is never written where no card could draw.

**A workflow gates the columns, never the scope.** An iteration scope must be enterable
with no state key resolved — otherwise the unconfigured empty state below is unreachable,
since the only way to see it is to be on the board that has none. Since the revision the
key in question is the **product** one, so a vault with a working product board can never
reach that guidance; a vault with no `stateProperty` at all reaches it on both boards at
once, which is the same condition described twice rather than a second one to configure.

**Deliverables are included** — decided by the user on 2026-08-15, after a review round
had argued them out. No type filter at all: not the product board's `!isDeliverableType`,
and not its mirror. A sprint is a commitment to finish some work, and a concept or a
design is part of what a sprint commits to, so this is the one board where the two kinds
sit together. The product board is scoped to a kind of work and the Deliverables board to
another; this one is scoped to a fortnight, which does not care what kind of note a piece
of work is.

Two consequences follow, and the revision made the first sharper rather than softer. A
`Deliverable` card is **bucketed by the product state key**, like every other card here —
one board has one column list, and since the revision that list is the product workflow's.
A vault that configured a separate `deliverableStateProperty` will therefore see its
Deliverables sit in **Open** on this board, because they carry no value under the key this
board reads. That is accepted rather than corrected: reading each card by its own
workflow's key would give one board two vocabularies, which is the thing extension 3f
already refuses, and the fix a vault has is the one it already has for the shared key —
leave `deliverableStateProperty` unset and let it fall back to `stateKey`.

The second is a correction. An earlier draft said a card's finished styling would come from
the board's workflow, "through the shared card shell, which already takes completion as
an input rather than reading `item.done`". **That is false about this codebase.**
`createCard` asks `ownWorkflowReading(item)` and takes **no** completion parameter; its
comment records that the parameter was removed precisely because a per-board override is a
category invariant asked at the places someone thought of — the Deliverables board and the
timeline passed their own while the horizon buckets, the shelf and the context strip
styled a Deliverable by a workflow that does not track it. So on an iteration board **no**
card's `pbl-done` is decided by the column it sits in: each follows its own type's
workflow. A card can sit in `Resolved` and not be styled done — which since the revision
is the ordinary case rather than an oddity, and §5 is where that stops being a surprise.

What this costs is a claim the design cannot make: *every card on an iteration board is
also a card on the product board* is false, and an earlier draft used it as the argument
for a scope picker over a toggle position. The argument is replaced rather than patched.
A control is chosen by **how many things it has to offer** — iterations are unbounded,
Deliverables are one — never by whether two populations coincide.

`iterationBuckets(population, settings)` sits in `src/domain/board.ts` beside
`deliverablesWorkflow`, and it is **not** a third `Workflow` instance — §5 says what it is
instead and why the difference matters more than the name.

It takes the **population**, not the model, and that survived the revision for a reason
the revision narrowed rather than removed. Only the three buckets are drawn, so a stray
observed value cannot mint a column here at all; what the population still decides is
every column's **counts** — `count`, `fullCount`, `held` and `openWork`. Handed the model,
a `Sprint 13` card would be counted on `Sprint 12`'s Open column, which is the same defect
a model-wide `observedIterationStates` would have caused one level up, and the same
argument retires both.

The context-row rule applies unchanged: an `outsideFilter` item renders, it parents, and
that is all — never a card to drag, never a write target, never counted, never a source
of this board's column vocabulary.

**Neither of the two narrowing controls reaches this board**, which is the Deliverables
board's arrangement adopted wholesale rather than an exception argued case by case.

*No focus level narrows it, at any level.* The cards are read off the whole, unfocused
tree, the way `model.deliverableResults` already is. An earlier draft of this spec said
the opposite and was wrong twice. A focus level is a **ladder** control — it picks which
rung becomes a card — and this population is defined by a **link**, which the ladder knows
nothing about, so there is no rung to pick. And the product board does not narrow the way
that draft assumed: under a focus it cards `requirementsFocusRoots(model.roots)`, not the
results, so "narrows exactly as the product board does" named no behaviour that exists.
Implementing it faithfully would be worse than incoherent — a PBI in Sprint 12 whose
Feature sits in Sprint 13 would disappear from Sprint 12's board because of a control set
on another projection. The human already ruled this way for the sibling board: *"there are
only the deliverables to display."* There are only this iteration's items to display.

*"Show completed items" does not reach it either*, as one field — `hideCompleted: false`
in this projection's `VisibilityRule` — never a per-caller choice. That predicate's own
comment records why: it was a per-caller choice for three surfaces and the fourth forgot.
The toggle describes the **requirements** rollup (`item.subtreeDone`), which is a verdict
about a whole subtree, and this board draws individual cards in a `Resolved` column
instead. Letting it through would empty that column of exactly the cards it exists to
show. The revision makes this cheaper to state, not harder: the board and the toggle now
read the same key, and they still ask different questions of it — one about a card, one
about everything under a card.

The toolbar follows: on an iteration scope the focus picker renders no menu, no
"Focused: <level>" label and no clear button, and "Show completed items" is absent rather
than present and inert.

## 5 — The product workflow, narrowed to three

**There is no second workflow.** This reverses the section that stood here until
2026-08-16, and the reversal is the user's, in their own words: *"I don't want to add
another workflow… I want to use the same workflow as the product just narrower into a
simple Open, In Progress, Done workflow based on products workflow."* Withdrawn with it:
`iterationStateProperty`, `iterationStateValues`, `iterationDoneValues`,
`resolvedIterationStateKey`, and the field-by-field fallback that existed only to make a
second property survive being unset. A fallback is machinery for reconciling two sources
of truth; deleting the second source deletes the need for it.

The board reads **`settings.stateKey` directly**, and puts each card in one of three
columns:

**Not through `stateKeyFor`**, which is the function this sentence originally named and
the one an implementer will reach for, because it looks like the reader of the product
key and is what every other board uses. It is not: it **dispatches on the item** —
`resolvedDeliverableStateKey` for a `Deliverable`, `resolvedTestStateKey` for a catalog
member, `settings.stateKey` for everything else. Following it here would bucket and move a
`Deliverable` by the Deliverables workflow, which is the exact opposite of §4's rule that
one board has one vocabulary, and would silently contradict the documented outcome that a
Deliverable with a separate state property sits in Open. One board, one key, read without
asking the card what it is.

| Column | Holds | A drop writes |
| --- | --- | --- |
| **Open** — the iteration backlog | no state at all, plus any state named in `iterationOpenStates` | the first value in `iterationOpenStates` **that reads back into Open** |
| **In Progress** | every state in neither outer bucket | the first `stateValues` entry in no bucket |
| **Resolved** | any state in `iterationResolvedStates`, **plus** every product `doneValue` | the first value in `iterationResolvedStates`, or the first `doneValue` when that list is empty |

**Every representative is asked of the reading, never of the list.** One rule covers all
three cells above: *a bucket's representative is the first state the bucket rule itself
places in that bucket*. Stated generally rather than as a guard on the one cell that can
break it, because a lookup and a reading that disagree is the exact drift the checkmark
rule exists to prevent, and the next configuration to expose it is the one nobody thought
of.

Only Open can break today, and it takes a misconfiguration to do it: a state named in
`iterationOpenStates` **and** in `iterationResolvedStates` or the product `doneValues` is
routed to Resolved by the precedence rule below. Written as the naive "first value in
`iterationOpenStates`", a drop on Open would write it and then redraw the card in
Resolved — the card visibly landing in a column it was not dropped on, which is worse
than either a refusal or a no-op. The other two cells are self-consistent by
construction: a state in no list *is* In Progress, and anything in
`iterationResolvedStates` or `doneValues` *is* Resolved, whatever else names it.

Two new options in the `Iterations` group, both `text` lists like `deliverableStateValues`:

| Option key | What it is |
| --- | --- |
| `iterationOpenStates` | the product states an iteration has not started work on |
| `iterationResolvedStates` | the product states an iteration is finished with |

**Both may be empty and the board still works**, which is what replaces the withdrawn
fallback. Empty `iterationOpenStates` leaves Open holding the state-less cards alone;
empty `iterationResolvedStates` makes Resolved exactly the product `doneValues`. A vault
that configures neither gets a three-column board that already reads correctly, so
"unconfigured" needs no separate story here.

**A bucket can have nothing to write, and then it takes no drop.** The lookup can come
back empty in four configurations: `iterationOpenStates` unset, every one of its entries
claimed by Resolved (the case above), every declared state claimed by the two lists so In
Progress has none, and `iterationResolvedStates` unset with no `doneValues` either. One
rule covers all four — **a bucket with no state to write is not a drop target**: it still
draws, it still holds the cards that read into it, and it offers no `Set state` entry and
refuses a drag and an Alt+arrow onto it. A column that accepted a drop it could not
express would write nothing and report a move, which is worse than a column that declines.

**Open is the one exception, and it is not a special case.** With no usable open state —
the list empty, or every entry of it routed to Resolved — a drop on Open **removes the
state key**, which lands the card in Open by the reading rather than by a lookup. That is
the leading no-state column's own semantics, which the product board has always had: Open
is the bucket that holds the state-less cards, so "put this card in Open" already has an
unambiguous meaning there without any list being set. In Progress and Resolved have no
such natural reading, which is why they decline instead.

**`Resolved`, not `Done`, and the difference is the point.** A product workflow may hold
states downstream of the moment a sprint is finished with an item — `In review`,
`Released`, `Verified` — so the board's terminal column claims the weaker verdict. That
makes two rules read as contradictory unless both are stated:

- The **column** is `done: true`. It is this board's terminal stage, so it takes the
  finished column styling, the settled-fold default via `openWork`, and the rule that a
  done column carries no WIP limit.
- A **card** in it is usually not styled done. `pbl-done` follows the item's own workflow
  (§4), and `In review` is not in anyone's `doneValues`.

A column's verdict and a card's are different questions asked of different vocabularies.
That was an oddity to apologise for while the board had its own workflow; after the
revision it is the feature.

**A state in both lists counts as resolved.** The rightmost bucket wins, stated once here
and implemented once, because a value read by two membership tests is a value two call
sites will eventually disagree about. `doneValues` is folded into Resolved by the same
rule: an item the product calls finished can never be drawn as still in progress, and
folding it in is cheaper than asking every user to restate their done values in a second
list.

**No stray columns, and that is a deletion.** With a fixed three, an observed value the
configuration does not name mints nothing — it lands in In Progress with everything else
the two lists do not claim. The `outsideWorkflow` column the product board grows has no
counterpart here, so `collectObservedIterationStates` is withdrawn along with the
model-wide list its own argument already refused.

## 6 — Moves

A column move on an iteration board writes the **product** state key, plans through
`computeStateWrites` and lands in the same `applySafely` gate and the same single undo
slot. Moving a card here therefore moves it on the product board too, which is what one
workflow at two granularities means and is not a side effect to be designed away.

**`computeIterationStateWrites` is withdrawn** — there is no second key, so there is no
second planner. `performIterationBoardMove` **stays**, and its reason has changed
completely. It was a third host method because a second key needed its own write; it is
now a third host method because **a bucket is not a state**, and exactly two things break
when that difference is not asked.

*An earlier revision of this section said the move went through "`performBoardMove`,
unchanged", and named the guard below in the next paragraph as if the two could both be
true. They cannot, and the contradiction is the kind this register keeps proving is
cheapest to catch at the call:*

- **`computeStateWrites` compares the exact state.** `sameValue(item.stateValue, state)`
  is what it asks, so a card in `Ready` dropped on an Open bucket whose first value is
  `Todo` is a change by that test and gets rewritten — silently restating the user's own
  state and spending the undo slot to do it. Three states map to one column, so *"the card
  is already here"* and *"the write is a no-op"* stop being the same sentence.
- **`announceBoardMove` looks a column up by the exact state too.** `columnLabelFor(board,
  from)` is handed `Ready`, and a bucket carrying only its representative `Todo` does not
  answer to it — so a correct move would be announced from a column the board does not
  name.

Both are the same missing question — **which bucket holds this state** — so it is one
function in `src/domain/board.ts`, asked twice rather than reimplemented at either site.
`performIterationBoardMove` asks it first and returns having written nothing when the card
is already in the target bucket, then delegates to `performBoardMove` for everything else:
one place the batch is planned, one place it is announced, and one place the bucket
question is asked, with all three inputs still landing on one method.

That is the checkmark rule (§2, §9) at a third surface — **ask the plan, and refuse an
action that would write nothing** — and it is also the codebase's own rule read correctly
rather than argued around: *"adding a projection means adding one such method, not a
second idea of what a move is."* The method is the rule being kept; what the withdrawn
section got wrong was the reason, not the method.

`applyCardMove`'s capture rule holds here too: the vocabulary that names the move is
read before the await, because the batch's own refresh rebuilds the board before it
resolves and the column just vacated may be gone with its last card.

## 7 — Empty states, and the goal line

Two empty states, in `src/view/render/emptyStates.ts`:

- **No state property is configured at all** — the Deliverables board's unconfigured
  twin, naming the option to set and where. Since the revision this is the **product**
  `stateProperty`, so the same condition empties the product board; the guidance is
  therefore the product board's own, reached from a second screen rather than reworded
  for one.
- **The iteration holds no items** — "No items in this iteration yet". Never the product
  board's "All N items are done and hidden", which cannot tell an empty base from an
  empty scope. That is [[A board scoped to Deliverables]] extension 1b, met a second
  time.

**The goal draws above the columns.** When the chosen iteration carries a value under
`iterationGoalKey`, the board heads its columns with one line of it. A sprint goal that
only lives in frontmatter is a goal nobody reads on the board it governs, and reading it
is the whole reason §2 makes it a property rather than the note's body.

Three refusals, so the line cannot become furniture: no goal, no line — never an empty
one, and never a placeholder inviting a value. On `Product` scope, no line at all: there
is no iteration to have a goal. And the line is **text, not a control** — it is set from
the dialog in §10 and by editing the note, never by clicking the line, so nothing about
the board's write surface changes to carry it.

## 8 — A bar or a line

`isMarkerType` today answers two different questions, and only `Milestone` needs them
fused. Adding `Iteration` to the same list without splitting them would make
`isMarkerType` mean two things at eight call sites — the exact defect
`src/domain/typeVocabulary.ts` records for `isExtraType`.

The split:

| Predicate | Means | Asked by |
| --- | --- | --- |
| `isMarkerType` | no rung, no children, no dependencies | `childTypeChoices`, `src/domain/dependencies.ts` and `src/view/interactions/dependencies.ts` — unchanged |
| `drawsAsPoint(typeName, settings)` | drawn at one date, and holdable at neither end | `placementEnds`, `placeItem` **and `barHolds`** in `src/domain/bars.ts`, `src/view/render/timeline.ts`, `src/view/render/milestoneLines.ts` |

`drawsAsPoint` is `isMarkerType(t) && !(isIterationType(t) && settings.iterationBars)`.
Toggle off, an iteration draws a boundary line exactly as a Milestone does. Toggle on,
it draws a bar from the dates it has and no line — closed with both, open-ended with one,
exactly as `inferSpan` already places every other item.

`barHolds` is the call site to name rather than leave to a rule. It asks **both**
predicates inside one function — `placementEnds` for which ends are writable, then
`isMarkerType` on a line of its own to return a body hold and nothing else. Widening
`placementEnds` alone leaves that branch meaning what it meant before: `iterationBars`
on, the bar drawn, and neither grip there. It is the third question the single predicate
answers today — what a *gesture* may take hold of — and finding it is what turned a
two-way split into a three-way one.

**A grip needs two independent yeses, and this option buys only one.** The *type* decides
which ends are drawable (`drawsAsPoint`); the *configuration* decides which are writable
(`optionalKeyFor`, which `barHolds` already checks). A base with a target property and no
start property gets no start grip on an iteration bar, exactly as it gets none on any
other bar, because a grip whose drag writes an unconfigured key is the safe-write rule
broken. Widening the first question must never be read as widening the second.

**The toggle is a `.base` view option** (`iterationBars`, in the Iterations group), not
UI state. That is not a preference call: `placementEnds` is read by the **writer** in
`src/storage/frontmatter.ts` to decide which date keys a drag may touch, and `storage/`
cannot reach localStorage-backed UI state without breaking the layer rule. It governs
writes, so it is configuration.

**Cost, stated plainly — and it is wider than one signature.** TWO functions ask the new
predicate and neither has `settings` today:

- `placementEnds(typeName)`, reached by the row's Schedule and Unschedule, the shelf drop,
  the body slide, both grips, and the writer;
- `placeItem(item, stated)`, reached by `deriveBars`, `buildRoadmap` and the resources
  placement, the shelf, card moves and the timeline drag.

`placeItem` is the one that decides point-or-span for the main dated axis, so without it
threaded the option changes nothing a reader can see. An earlier revision of this spec
costed only `placementEnds` and would have had an implementer widen one signature, watch
the tests pass, and ship an option that does not work.

That is the widest diff in the feature by some margin, and it is why this ships as its own
PBI that the board work does not depend on — and why that PBI needs its own plan rather
than being folded into this one.

## 9 — Joining an iteration schedules the item

*(New on 2026-08-16.)* An iteration is a time box, so an item that joins one is being
committed to those two weeks. `Set iteration → Sprint 12` therefore plans a **batch of
three writes**, not one:

| Key | Value | When |
| --- | --- | --- |
| `iterationKey` | a wikilink to the iteration | the resolved link differs from the item's |
| `startKey` | the iteration's own start | the iteration HAS a start, and the item's differs |
| `targetKey` | the iteration's own target | the iteration HAS a target, and the item's differs |

One batch through `applySafely`, so the whole commitment is taken back by the one undo
slot. Three separate batches would let a reader undo the dates and keep the link, leaving
an item in a sprint it is not scheduled for — a state nothing in the UI could have
produced deliberately.

**The dates overwrite whatever the item held.** No merge, no fill-only-what-is-empty, no
branch on the item's own dates: joining a sprint means taking the sprint's dates, decided
by the user on 2026-08-16 against a fill-the-gaps alternative. The rule with a branch in
it was refused because two items in one sprint would then draw different bars on the
roadmap, which is the one screen a sprint is supposed to make legible.

**An end the iteration does not carry writes nothing** and deletes nothing. This is the
one asymmetry in "overwrite always", and it follows the codebase's own rule rather than
softening the user's: an iteration with no target has no timeframe to impose, and
`undefined` leaves the key alone where `null` would delete it. An unconfigured `startKey`
or `targetKey` is likewise never written — absence is a value, and §2's three rules are
the same three rules here.

**`None` removes the link alone.** The dates stay. Removal is not a reschedule: an item
taken out of a sprint still has whatever plan it had, and deleting two date keys on the
way out is a decision nobody made. Chosen by the user on 2026-08-16 over a variant that
cleared them.

**No state is ever written.** This is the second refusal, and it is the user's, in these
words: *"Putting an item into the iterations backlog must not be driven by the status
field."* An item shows in **Open** because it has not been started — §5's first bucket —
never because joining stamped it there. The backlog is fed by a reading, not by a write,
which is why §5's three buckets need no entry-state option and why an item carried from
Sprint 12 to Sprint 13 keeps the progress it had made.

**The checkmark narrows, deliberately.** §2 states the register's rule — an entry is
checked exactly when picking it would write nothing — and a three-write plan breaks it:
an item whose iteration had its dates edited has a non-empty plan for the iteration it is
already in, so the rule as written would leave the current iteration **unchecked** and
offer no entry as current. The checkmark therefore asks the plan's **link** component
alone.

That is a narrowing of the rule and not an abandonment of it, and the difference is that
the question changed rather than the answer's source. The menu asks *"which iteration is
this item in"*; it never asked *"would this be a no-op"* except while those were the same
question. It is still asked of the plan, so nothing compares values beside it, which is
the drift the rule exists to prevent.

It also earns something. Picking the **checked** iteration re-applies the timeframe and
writes no state — so a member whose sprint dates moved has a way back into step, one item
at a time, which is what §10's no-cascade decision needs to be liveable.

**Creating into a scope carries all three writes.** Extension 5c already requires a note
created from an iteration board to claim that iteration in the same create rather than in
a second write afterwards; since the revision that create carries the two dates too, for
the same reason it carried the link — a note that is momentarily in a sprint it is not
scheduled for is a note whose own frontmatter contradicts the board it was made on.

**Everything the context-row rule already refuses, it still refuses.** A context row is
never a write target, so `Set iteration` is not offered on one and no date reaches one.

## 10 — Creating and editing an iteration from the board

*(New on 2026-08-16.)* The scope picker already names every iteration, so it is where a
new one is made and an existing one is edited. Two entries below the scopes:

```
[ Scope: Sprint 12 ▾ ]
    Product
    Sprint 11
  • Sprint 12
    ──────────────
    Edit iteration…
    New iteration…
```

`Edit iteration…` is offered only while an iteration is the chosen scope — on `Product`
there is nothing to edit, and offering it there would need a second picker inside a
dialog to say which.

**One dialog, in `ui/`.** A modal with a name field, a start date, a target date and a
goal — the leaf directory of reusable Obsidian dialogs, which knows about no layer and is
where `stateColorsDialog.ts` already sits.

**`New iteration…` prefills its dates from the previous iteration.**

- **Previous** is the `Iteration` note **in the model** with the greatest target date —
  ties broken by start, then by path, so the answer is total rather than merely usually
  unique. Not the chosen scope: creating from Sprint 8 while Sprint 12 exists would
  silently make an iteration overlapping four others. Decided by the user on 2026-08-16.

  In the model, not the vault. A base that filters an `Iteration` out leaves it out of
  this derivation, which is the same limit the scope picker and `Set iteration` already
  have — and a base hiding iterations hides the picker this action is reached from. Stated
  as a limit rather than answered by reaching outside the base for a set every other
  surface reads from the model.
- **Start** prefills to that target **+ 1 day**. Iterations abut; they do not overlap.
- **Target** prefills to start + `iterationLengthDays` **− 1**. Inclusive, so a
  fourteen-day iteration starting on a Monday ends on the second Sunday rather than the
  third Monday.
- **With no dated iteration in the vault at all**, start prefills to today and target
  follows from the length. A first sprint has no predecessor, and refusing to prefill
  would make the empty vault the only one where the feature does nothing.

Every prefill is a **prefill**: the three fields are editable, and what the dialog writes
is what the user confirmed. Nothing here computes a date at write time from a rule the
reader could not see and change.

`iterationLengthDays` is one more option in the `Iterations` group, default **14**. Bases
has no number option, so it is a `text` option parsed to a whole number, the way the WIP
limits already are, and a value that does not parse — or is not positive — falls back to
the default rather than producing a target before its start.

**What the dialog writes.** `New iteration…` creates the note through
`createBacklogItem`, typed `Iteration`, into the `iterations` subfolder §1 gives it, with
the two dates and the goal in the same create — never a create followed by a write, the
rule §9 and extension 5c already keep — and then opens it. `Edit iteration…` writes the
two dates and the goal to the chosen note through `applySafely`, so it is one undoable
batch like every other write.

**Renaming is not in the dialog**, and the name field is on the create path only. An
iteration's name is its note's name, Obsidian renames notes better than a plugin dialog
can, and the stored scope already follows a rename (extension 2e) — so a rename path here
would be a second, worse spelling of something that already works. That is a refusal to
re-propose, not an omission.

**Editing an iteration's dates re-stamps nothing.** The write goes to the iteration note
alone; its members keep the dates they were stamped with. Decided by the user on
2026-08-16 against re-stamping every member in the same batch.

The consequence is real and is accepted rather than hidden: after an edit, an iteration's
members can disagree with it, and nothing on any screen says so. What makes that liveable
is §9's checkmark narrowing — re-picking the iteration on an item re-applies the
timeframe — and what would make it a defect is a bulk write nobody asked for, from a date
field, over notes not on screen. If the disagreement proves to matter, the thing to build
is a way to **see** it, not a write to prevent it.

## Testing

`domain/` gets node tests, `view/` gets the jsdom harness, as ever.

- `test/domain/iterationBuckets.test.ts` — every product state lands in exactly one of
  the three; both lists empty; a value in both lists resolving to Resolved; a `doneValue`
  outside `iterationResolvedStates` still landing in Resolved; each bucket's representative.
- `test/domain/iterationModel.test.ts` — population is carriers only; a descendant
  without its own iteration is absent.
- `test/domain/iterationDates.test.ts` — §9's plan: the three writes, the two ends the
  iteration lacks, the unconfigured keys, `None` leaving the dates, and **that no plan
  ever names the state key**. That last one is the category invariant of §9 and is asked
  of the planner rather than of the menu, since the menu is only one of its callers.
- `test/domain/iterationSchedule.test.ts` — §10's derivation: previous is the
  greatest target with its two tie-breaks, +1 day, length − 1, the no-iterations case, and
  an unparseable or non-positive `iterationLengthDays` falling back to 14.
- `test/view/iterationBoard.test.ts` — the scope picker, its persistence, the fallback
  of a stale stored scope, the two empty states, the goal line and its three refusals,
  and the drop-on-own-bucket no-op driven through each of the three inputs.
- `test/view/contextCardWrites.test.ts` — extended, since a card projection's three
  entry points are what that file exists to ask about.
- `test/domain/bars.test.ts` — `drawsAsPoint` both ways, and that `isMarkerType`'s
  structural callers did not change meaning.

Obsidian cannot run here. A live-vault smoke test is still owed for: the type's badge
colour and icon, the scope picker's fit in the toolbar row once it carries two more
entries, the goal line's fit above the columns, the create/edit dialog on a themed vault,
and the bar/line toggle's appearance. `npm run harness` can answer layout and hierarchy
for the scope picker, the three buckets and the goal line before any of it is built, by
adding an `Iteration` type and a scope to `demoOptions()` / `demoResults()` in
`test/helpers/fixtures.ts` — which is the offer to make **before** implementing, not after.

## Register work this implies

- `docs/requirements/An Iterations board.md` — the Feature, under [[Product Kanban]].
- **Five** PBIs under it, in the order the work should land — three written on
  2026-08-15, two added by the revision:

  | Order | Note |
  | --- | --- |
  | 10 | [[An iteration is a note of its own]] — the type, the two properties, the menu |
  | 15 | [[An iteration's timeframe schedules its items]] — §9 |
  | 20 | [[A board scoped to one iteration]] — the scope, the three buckets, the moves |
  | 25 | [[Creating an iteration from the board]] — §10 |
  | 30 | [[An iteration draws as a bar or a line]] — §8, still independent |

- An amendment to ADR 0013 for the twelfth name.
- `docs/README.md`'s folder table gains an `iterations/` row, and its hierarchy table
  gains `Iteration` — both are gated by `docs-check.mjs` against `LEGAL_CHILDREN` and by
  `test/docs/surfaces.test.ts` against the real option keys, so neither can be skipped.
- Every new option key must be named in `docs/requirements/`, or
  `test/docs/surfaces.test.ts` fails: `iterationProperty`, `iterationGoalProperty`,
  `iterationOpenStates`, `iterationResolvedStates`, `iterationLengthDays`,
  `iterationBars`, and the generated `typeFolder.iteration`. The revision **withdrew**
  `iterationStateProperty`, `iterationStateValues` and `iterationDoneValues`; nothing had
  been built, so there is no stored `.base` value to migrate and no compatibility to keep.
- `CHANGELOG.md` gains an `[Unreleased]` entry in the pull request that earns it.
- The implementation plan `docs/superpowers/plans/2026-08-15-iterations-board.md` is
  **stale** as of the revision — its Part B builds the withdrawn workflow — and is
  re-written from this spec rather than patched.
