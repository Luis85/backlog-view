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
| `issues/` | Open questions and recorded decisions | `Issue` |
| `bugs/` | Defects, with what was learned from them | `Bug` |
| `deliverables/` | Things this project has to produce that are not code | `Deliverable` |
| `milestones/` | Dates the plan is answerable to, owned by no item | `Milestone` |
| `iterations/` | Time boxes items are scheduled into, owned by no item | `Iteration` |
| `tests/suites/` | Walkable groups of end-to-end tests, their own list rather than a branch of the plan | `Test suite` |
| `tests/cases/` | One executable test each — a Preconditions line plus whatever shape it already had | `Test case` |
| [`adrs/`](adrs/README.md) | **How** it is built — architecture decision records | *(none — not backlog items)* |
| `superpowers/` | Claude's own design specs and implementation plans, not the product's | *(none — not backlog items)* |
| `prds/` | Requirements documents as received, the source epics here are derived from | *(none — not backlog items)* |
| `sdds/` | Design documents as received, the architecture those epics are built against | *(none — not backlog items)* |

`tests/cases/` holds the checks CI cannot run — appearance, base identity, anything that
needs a live vault — and `RELEASING.md`'s release sweep reads it, deriving its set from
`tests/cases/` rather than a list kept here.

The backlog says what the product does and why someone wants it. The
[ADRs](adrs/README.md) say what was chosen to make that possible, what it cost, and what
would make us choose again. They are deliberately **not** work items: **no `parent` and no
`type`** — their frontmatter is `adr`, `title`, `status`, `date`, `area`, none of which the
view reads. A note belongs to the backlog if it has a supported type *or* a parent, so the
register's own scope rule ([[What counts as a work item]]) leaves them out of the tree.
That is the plugin's behaviour applied to itself, and the toolbar's advisory counting them
is the honest report.

`superpowers/` is a third kind of exemption, for a different reason: not a deliberate
design choice about the plugin's own schema, but a landing spot for the `brainstorming`
and `writing-plans` skills' own working documents (CLAUDE.md) — plain markdown with no
backlog frontmatter at all. `docs-check.mjs` exempts anything under it from needing a
`type`, `order` or `status`, so it never has to pretend to be a work item to live under
`docs/`. The exemption is anchored to `docs/superpowers/` itself, not a bare folder-name
match, so a coincidental `superpowers/` nested somewhere else in the register is still
held to the ordinary rules. It is **not** exempt from the basename rule two paragraphs up:
a generated spec or plan is still ordinary prose a `[[wikilink]]` can name, so it still
claims its name against every other note in `docs/`.

`prds/` and `sdds/` are exempt on the same terms and for a sharper reason: **a requirements
or design document is what a backlog is derived from, not a thing in it.** It arrives from
outside, it is kept verbatim so the notes that cite it are citing something that has not been
edited to agree with them, and giving it a `type`, a rank and a status would file the
evidence as work — the same mistake as writing a customer interview into the backlog because
it is important. Each is named for the date it arrived and what it covers, and claims its
basename like everything else, so a document and the epic derived from it can never share a
name.

An SDD is not an ADR and does not replace one. It is what somebody *proposed*; an ADR is what
this codebase *decided*, and where the two disagree — as they currently do about the layer
names — the ADR and the lint rule are what hold, with the disagreement recorded as an issue
until somebody settles it.

## The trees

**Product Backlog** is the product: features covering the hierarchy, moving items,
creating them, progress, finding work, safe writes and view state, plus **User manual**,
the one feature specified rather than built: an in-view help surface whose sections
explain the types, moving, creating, finding, undo and configuration. Its use cases
describe a manual, so each is also a statement of what that part of the plugin is *for*.
A count belongs here only as long as it takes to go stale — open `Product Backlog.base`
for the current shape, or run `npm run docs` for the current totals.

**Codebase health** is the engineering work — features and use cases saying what
"healthy" means here, with the tasks that got it done underneath. Its actor is whoever
changes the plugin, which is the honest way to write an architectural rule as a use case:
someone has to be trying to do something for the rule to be worth having.

**Product Kanban** is the epic in flight: a board projection of the same backlog —
the backlog/board toggle, columns from the workflow the view options define, card
moves as gated state writes, and the hierarchy showing through on the board. Every
note states the precedent or the codebase seam it rests on, from a survey of the
Kanban Guide, the major trackers and the Obsidian ecosystem run on 2026-08-01. The
first increment built the projection: the toggle, the columns, the cards, desktop
drag as a gated state write, and the focus level picking the cards. The drag use case
closed once [[WIP limits]] gave its one outstanding criterion a column to exercise
against. The second built the ways to move a card **without** a drag — Alt+arrow, and
a card menu whose Set state is the board's own columns — with every move, drag
included, announcing itself in the same words from one live region. The third took the
two things that could not wait: **date stamps**, because history is the one thing a
board cannot reconstruct later and every unstamped transition is gone for good, and the
rest of the board's **quick filter**, so a narrowed column says how much work it still
holds and a match nothing on screen can reach names itself on the card that hides it.
The fourth gave the columns their agreements: a **WIP limit** and an **explicit
policy** per configured state, both generated view options keyed by the state's own
name, the way the per-type folder keys are. The limit reads the full population rather
than the matches, so a filter cannot make an overcommitted stage look calm; it signals
in colour, in shape and in words, and it refuses nothing — a check drives every board
write path against a column already over one. The policy is described rather than
named, reachable by pointer and from a column menu this increment introduces and
creation from a column will later share. A fifth did not extend this board but
multiplied it: `Deliverable` items — concepts, designs, anything the team must produce
rather than build — get a second board of their own, reached by a fourth toolbar
toggle, with a workflow property, states and done values overridable independently of
the requirements board's, or — left unconfigured — falling back to the requirements
board's own field by field, so a vault that never bothered to name a separate property
still gets a working Deliverables board rather than an inert one. A later fix scoped the
requirements board the other way in return: it now excludes every `Deliverable` from
its cards, its count and its stray columns, so a design's review status never has to
share a column list with a PBI's implementation status even when the two workflows turn
out to be the same property — a Deliverable acting purely as an excluded ancestor still
surfaces there as a context row, exactly as any other excluded parent does. It keeps
the guarantee — one model, one write gate, one undo history — and the three inputs
that move a card, but takes none of the fourth increment's agreements: no WIP limit,
no column policy, no date stamp, and it does not honor "Show completed items", since
completion there is a question the Deliverable workflow answers, not the requirements
one; its own toolbar creates only Deliverables — and its focus control, briefly
clear-only while an inherited focus still narrowed this board like any other, was
later reversed to ignore the focus level outright, since no level narrows this board
and there is never anything left to clear. What remains under the epic —
creation from a column, column collapse, the touch verdict a device has to answer,
and **iterations** — is still design; lanes were tried and refused
([[Swimlanes by parent]]). That last one multiplies the board a second time and does
it differently on purpose, for a reason that is arithmetic rather than scope: there is
exactly one Deliverables board, and sprints only ever accumulate, so a toggle position
per sprint is not a toggle. `Boards` gains a **scope** picker beside the projection
toggle — `Product`, or one iteration — the control the roadmap already uses to offer
its two axes, over a workflow of its own that falls back to the product board's field
by field. It is also the one board where both kinds of work sit together: a sprint
commits to finishing a design as readily as a PBI, so a `Deliverable` naming the
iteration draws a card there, columned by that board's one workflow like everything
else on it.

Those use cases are the argument for writing a PBI *before* building it rather than
after. The ones still open say **nothing yet** (or **partly built**, naming exactly
which slice landed) and then the module the work will extend, which is a design claim
a reader can disagree with; their extensions are where the epic's hard parts were
settled before any code — what a filtered board does to a WIP signal, what happens to
a card created into a state the base excludes — and every one of those was a
paragraph of prose before the shape asked the question.

**Product Roadmap** is the third projection: the same backlog on a time axis,
specified across six features and 20 use cases — the projection toggle grown to three
positions, Now-Next-Later buckets from a horizon property, a dated timeline whose
parents span their children, scheduling as gated date writes, milestones as a type of
their own, and focus and rollups carried over. Three features are built. The
first was the projection: the toggle's roadmap position, the declared axis with its
collision checks, both frames read-only — buckets and stated bars — the unplaced shelf,
and the roadmap's empty states. The second gave the horizon axis its writes: a card
moves between buckets by drag, by Alt+arrow or from its own menu, all three planning one
value into the note's own horizon property through the one gate, undoable as one batch;
the shelf is the target that un-places, removing the key rather than blanking it, and it
stays reachable while empty because a target that exists only when occupied is one
nothing can reach; and a bucket creates in place, its value riding the same single
creation write. A later PBI made the shelf usable at scale — collapsible, grouped by
type, sortable and filterable, its controls in its own header — and gave the horizon
buckets the width a wide pane actually has, cards reflowing into multiple columns as the
space allows. The dated axis's own moves were the one write this epic still owed —
the milestone type's own lift is still design, named as
[[Keyboard and menu on the roadmap]]'s to deliver, and lanes were tried and refused
([[Lanes on the roadmap]]) — but it
already showed the tree rather than only its stated bars: a parent with no dates of its
own spans its dated descendants, endpoint by endpoint, drawn as the inference it is and
written nowhere. Two decisions organize the epic: the axis is declared in the
view options, never guessed from property names and never derived from dates; and planned
dates are different keys from the board's transition stamps, so a plan can never overwrite
a record. Every note states the precedent it rests on, from a survey of the roadmap
literature, the major trackers and the Obsidian ecosystem run on 2026-08-01.

The third made the dated axis writable: a shelf card schedules at the day under the
pointer, with the zoom's own cell as its default duration; a bar slides and resizes by
whole days, at every zoom — zoom is a pixel density, never a snapping unit; and a bar
dropped back on the shelf removes its keys, exactly as the horizon axis's shelf already
does. It ships alongside three discrete densities and a jump-to-today, a frame that
scrolls inside itself rather than the pane, and the date decision moved into the writer
— the layer that can see a note's live value — so a note's own time, offset and spelling
survive a gesture that moves its date. The dated axis reads as a gantt: a two-tier
header, weekend banding at week zoom, striped and hoverable rows, titles beside the bars,
a compact density, and a bar coloured by the state its item is in — with a legend strip
above the grid naming every colour on it, the today line's included, which is why that
line now renders unlabeled. The title column is the reader's to size rather than a
constant: a grip on its edge resizes it by drag or by keyboard, remembered per saved view
per device like the zoom beside it.

**Business value estimation** is the first epic that is not a projection of the tree at
all: it is the plugin's **second Bases view**, registered beside the backlog one with its
own options, its own state and its own screen, because a form over one item, a ranked
table and a value-against-effort scatter make no tree easier to read and the toolbar has
four positions already. Eight value dimensions scored 1–5 against stated meanings, a
confidence in the evidence behind them, and an effort kept out of both produce a weighted
value that **is written back to the note**, so the backlog, the board and the roadmap read
a plain property and none of them learns the model. It opens with the argument for
existing at all — a single `Business value: 5` compares two items that mean opposite
things as equal — and its definition of done is mostly about what a number may not do: one
derivation leaves the view and the rest are recomputed on read, a written total records
the model that made it and says `Needs re-estimation` when that model moves on, a merged
number never stands in for its inputs, and nothing ranks the backlog on its own behalf.
Specification only, from a product requirements document of 2026-08-16, with **eight
features** under it: the scoring model and its rubrics, the weighted score, the presets, the
ranked list, the matrix, the scenarios and the decomposition.

**Two** of the five questions it opened are answered there. The partial profile is settled
outright: the score renormalizes over the answered dimensions and reports its coverage, and
the matrix plots every item that has both axis values, marking the coverage rather than
dropping a thin point, and shelves the ones missing an axis beside the plot rather than
inventing a position for them. A weight change is settled with one thing left over: stored totals are not
rewritten and read as needing re-estimation, but whether a bulk re-estimation clears a
hundred of those flags at once is undecided. **Three** stay open whole: the dozen-odd
properties to bind, **inheritance**, which has no mechanism, and the **estimation status** as
a second workflow.

**Test Management** is a **fifth** projection's worth of design without a projection's
worth of drawing: an end-to-end test catalog kept as work items beside the work it
checks. Fifth because the toolbar already carries four — the backlog tree, the
requirements board, the roadmap and the Deliverables board — and the catalog joins them
rather than replacing one. `Test suite` → `Test case` is a ladder of its own, rooted at the top level rather
than hanging off a PBI, because `parent` already decides level, rank, rollup and focus and
a test belongs to none of those; what a test is *for* is a user-named property on the
test, resolved the way [[Dependencies as a property]] resolved a prerequisite eight days
earlier. Read forward it says what a case covers; read backward it answers the question
the epic exists for — which work has nothing checking it — and that backward read is why
both families share one base and the plan's projections learn to exclude one of them,
the way the requirements board already excludes a `Deliverable`. Three features, eight use
cases, all design. It also inherits a blocker rather than deferring it: nine declared types
already share Obsidian's eight chromatic families — `Idea` and `Task` both wear yellow, by a
decision recorded beside the CSS — so two more need an answer that is not another pairwise
share, and `The type palette has no unclaimed hue left` is resolved inside this epic or the
types do not ship. What it deliberately does not build
is a result — no pass, no fail, no run history, no automation — since a run is a second
item family and the checklist this register already walks by hand — the smoke test
suites already living in the catalog — is the evidence that the catalog is the part
worth having first.

**A view per capability** is the direction the rest of the register now sits inside, from a
product requirements document of 2026-08-16 kept in [`prds/`](prds): the plugin stops being
one view with a growing toolbar and becomes a family of Bases views over the same notes, one
per capability, each with its own options, state and empty state, sharing nothing at runtime
but the layers below the screen. The rule that makes it work is the data contract — **views
communicate only through the vault** — so a hidden store between two views would be the
proprietary database this plugin has always refused, arriving by the back door. Its features
are the shared kernel every view reads the vault with, the registration, settings scoped to
the view that uses them, a guided empty state that can configure itself, navigation between
the views a base actually has, one suggested name per concept that the user maps, and the
staged extraction of the board, the roadmap and the Deliverables board out of the backlog
view. A software design document of 2026-08-16 in [`sdds/`](sdds) states the architecture it
is built against, and the epic follows its migration order — kernel first, then the registry,
then the projections already built, then new views — because a view registered against logic
still tangled with another view's DOM copies the tangle instead of sharing the logic. What
that document does **not** settle is the directory structure it also proposes, which this
repository already has in another shape with a lint rule behind it: that is
[[The SDD's layers are not the four this repository enforces]], and until it is answered the
four enforced layers are what hold. A review of the whole set found the other thing nobody
had counted — the capability epics ask for **seventeen new item types** against the
eleven declared and the eight hues Obsidian ships — so
[[Ten capabilities want seventeen new types]] blocks any of them from shipping until each name
is placed in one of three buckets, and the register's own default is that most are not types
at all: a type is for something the tree ranks, everything else is a note a property points
at.

**Nine capability epics** hang off that direction, all specification, in the delivery order
the document argues for. **Backlog Health** comes first with prioritization, because every
later view depends on the quality of the data: stated rules, findings that explain
themselves, a score that decomposes into them, and repairs offered only where they are
unambiguous. Then the chain that differentiates the product — **Product Discovery** (a
lifecycle before the backlog, assumptions with their own validation state, and one exit:
promotion that creates a backlog item and leaves the discovery record linked and in place),
**Product Strategy** (objectives and jobs to be done as links rather than rungs, and the
backward read that names work answering to nothing), and **Product Evidence** (what the vault
already holds — interviews, tickets, analytics — connected to the work it argues for, and the
three gaps that read exposes). Then planning: **Release Planning** (scope, capacity in the
vault's own unit, a scenario that writes nothing until it is applied, and a readiness
checklist that refuses nothing), **Product Dependencies** (one canonical direction, a graph
and a table over it, a stated rule for what counts as blocked, and cycles reported rather
than resolved). Then governance: **Product Portfolio**, **Product Analytics** (every figure
naming its population and reporting what it could not measure rather than counting it as
zero) and **Decision Management** (the register's own argument about keeping closed notes,
applied to the product plan instead of the architecture).

Three of the document's twelve epics are already here under other names — its Product
Backlog is [[Product Backlog]], its Prioritization is [[Business value estimation]], its
Roadmap is [[Product Roadmap]] — so they gained what they were missing rather than a
duplicate: bulk edits on a selection, lanes by a property, and the eight features of the
scoring model.

One thing in that document is **declined rather than absorbed**: its Product Backlog asks for
configurable level names and configurable allowed children, and
[ADR 0013](adrs/0013-fix-the-type-vocabulary-at-six-names.md) fixes the vocabulary instead —
after [ADR 0012](adrs/0012-make-the-type-vocabulary-configurable.md) had made it
configurable, which is the version of this idea that was built and withdrawn. The reasoning is
in the ADR and is not reopened by a requirements document restating the wish; what it costs a
vault is the one thing a reader should be able to find, so it is recorded here rather than
left as an absence somebody has to notice.

**Cross-cutting concerns** is the fourth kind: properties that have to be true of
everything, or they are true of nothing. `Multilang` (every string comes out of a
per-locale catalog) and `Theming and styling` (every pixel comes from Obsidian's design
tokens, from a stylesheet organised like the rest of the codebase) are siblings because
they meet at the layout: translated text is longer, shorter and sometimes right-to-left,
and the stylesheet is what absorbs it. Specification only — nothing under this epic is
built yet, and what it asks for applies to the board as much as to the tree.

**The Product Page** is the odd one out: not a projection of the backlog and not a
property every screen must hold, but a public site — built with Astro, hosted on GitHub
Pages — that shows someone who has never opened this repository what the plugin does.
`README.md` already pitches the plugin and walks a visitor who found the repository
through installing it; this epic is the richer, visual surface a search result or the
repository's own GitHub Pages link reaches directly, not a second README. Three features
are specified: the page's own content and structure, a site built from its own directory
independent of the plugin's own toolchain, and its publish to GitHub Pages from a
dedicated workflow — all still design, nothing built yet.

`Issue`, `Bug` and `Idea` hang from whichever requirement they concern, which is exactly
what those types are for: they hold Tasks, they are never re-typed by a move, and they
attach to an Epic, a Feature or a PBI alike. The plugin also lets one hang from nothing;
this register does not, on purpose — a note recording a problem or a thought states which
requirement it concerns, and `docs-check.mjs` holds it to that.

`Milestone` is neither a rung nor a container: it hangs from nothing, holds nothing, and
counts for nothing. It states a date rather than work, so it never enters a rollup — a
number reporting progress must only ever count work — and it files into `milestones/`.

`Iteration` is the second marker, the same three ways: no rung, no children, no parent.
Items **link** to an iteration rather than hanging from one, so it never enters a rollup
either, and it files into `iterations/`.

## The hierarchy is the point

This register is the plugin's own schema, so a wrong parent here is a bug in the example.
Every pair holds:

| Type | Parent may be | Children may be |
| --- | --- | --- |
| `Epic` | *(nothing — it is a root)* | `Feature`, `Issue`, `Bug`, `Idea`, `Deliverable` |
| `Feature` | `Epic` | `PBI`, `Issue`, `Bug`, `Idea`, `Deliverable` |
| `PBI` | `Feature` | `Task`, `Issue`, `Bug`, `Idea`, `Deliverable` |
| `Task` | `PBI`, `Issue`, `Bug`, `Idea`, `Deliverable`, `Test case` | *(nothing)* |
| `Issue` / `Bug` / `Idea` / `Deliverable` | `Epic`, `Feature` or `PBI` | `Task` |
| `Milestone` | *(nothing — a root by nature)* | *(nothing)* |
| `Iteration` | *(nothing — a root by nature)* | *(nothing)* |
| `Test suite` | *(nothing — a root by nature)* | `Test case` |
| `Test case` | `Test suite` | `Task` |

The three EXTRA types travel together — `Issue`, `Bug` and `Deliverable` are one set
repeated at each rung, which is what `childTypeChoices` answers as
`[ladderChild, ...EXTRA_TYPES]` and what `docs-check.mjs` spells as its own `EXTRA`.

**This table is checked against that map, both ways.** `docs-check.mjs` reads the table out
of this file and compares it to `LEGAL_CHILDREN`: a type in one and not the other fails, a
children list that differs fails, and the parent column is checked as the inverse of the
same map. So the table cannot quietly fall behind the gate — which it did, for the whole
increment that introduced `Deliverable`, while this section went on calling itself
authoritative. What is still only prose is the FOLDER table above: nothing ties a type to
its folder, because nothing in the register depends on one.

The plugin does not *enforce* this — the rules decide what is offered, never what is
refused — which is exactly why the register has to hold to it by hand.

So it is checked, by a command anyone can run:

```bash
npm run docs   # and as part of npm run check, and in CI
```

`docs-check.mjs` enforces everything this file claims — an advertised invariant nobody
can run is worse than none, because it invites trust it has not earned:

1. Every note outside `adrs/`, `superpowers/`, `prds/` and `sdds/` carries a `type`, an
   `order` and a supported `status` — the three the conventions table below calls
   required — every parent link resolves, and every parent/child pair is legal. A note that lost
   its frontmatter is reported rather than skipped: a skipped file is checked for
   nothing and says so to nobody. Two notes may not share a **basename**, in any
   folders, because the register addresses work items by name and a collision makes
   every `[[wikilink]]` and `parent:` to either one ambiguous. **ADRs and index pages
   are outside that one rule**, and are the only class that is: they are addressed by
   path — `adrs/README.md`, `adrs/0013-….md` — which is why this file and `adrs/README.md`
   can both be called `README` without the register losing an address. Nothing else is
   exempt: `superpowers/`, `prds/` and `sdds/` are outside the frontmatter half of this
   rule and claim their names like every other note.
2. No two siblings share an `order` — the register must not demonstrate the one ranking
   limitation the plugin has.
3. Every wikilink resolves to a note, and **every relative markdown link resolves to a
   file** — anywhere in `docs/`, whatever it points at, percent-encoding decoded and
   anchors stripped. Links inside code spans are examples, not references, and are
   skipped; so are external URLs. **`prds/` and `sdds/` are outside this rule and the
   `**Checked by**` rule below**, and they are the only two folders that are: a received
   document names notes, files and interviews from wherever it was written, so checking
   them would force the one edit the verbatim rule exists to prevent, and the marker is
   this repository's convention rather than a fact about prose. `superpowers/` is written
   HERE and points at this register, so it keeps every rule in this list except the
   frontmatter in rule 1. The cost is stated rather than hidden: a link in a received
   document that does name a note here is unverified, which is why the editorial preamble
   on each one names its notes in prose instead of linking them.
4. Every `src/` or `test/` path named by a note in **`requirements/` or `adrs/`** exists.
   Those two describe the code as it is now. `tasks/`, `issues/` and `bugs/` are records
   of a moment and may legitimately name a file since split away — rewriting them would
   falsify the record — so their stale paths are **listed rather than failed**. Being
   listed is the point: visible, not silently exempt.
5. Every use case has all its sections **exactly once and in the documented order**; the
   whole `**As** … **I want** … **so that** …` opening, not just its first word; and the four
   table fields as **rows of the table**, parsed inside the block it occupies — ordering
   says where a marker sits, never that it is a row of anything. And **every** extension
   bullet is labelled `**Na — `, **naming a step the main flow actually has**. Validating
   only the bullets that already look like labels would let a mistyped one vanish; not
   asking which step it departs from would let `**99a — ` depart from nowhere. The
   bullets' **order on the page is deliberately not checked** — it is the one property
   here a reader fixes by reading, and the two rules above are what stop a label from
   meaning nothing.
6. Every ADR — meaning **every note under `adrs/` except the index**, found by where it
   lives rather than by whether its name looks right, so a malformed filename is *reported*
   instead of quietly opting out of the checks below. Frontmatter complete, number matching
   its filename, unique, a known status and area, relative links resolving, and every
   record listed in the ADR index. **Gaps in the numbering are not an error** — a reserved
   or abandoned number harms nothing, and the failure it was standing in for (a record
   something still points at going missing) is caught properly by the supersede checks
   below. `supersedes` and `superseded-by` must name a record that **exists**, and
   both ends must agree — checked **from both directions**, since a chain half-declared
   from either side rots the same way: the predecessor goes on reading as current. An ADR
   naming a successor must also carry the `Superseded` status, which is that same failure
   inside one record. Its five headings are checked for presence **and order**, by the same
   code that checks a use case's sections — they are one rule, and the round that found one
   of them un-ordered found the other still asking only whether the heading was somewhere.
   An ADR must also carry **neither** `parent` nor `type` — tested by **key**, since a bare
   `parent:` with no value still reads as an explicit root and enrols the note. Checking
   only the fields an ADR should have would never notice a field it must not.

   **These two shape checks** — a use case's sections and an ADR's — match a section as a
   **line, with code stripped first**. A heading deleted and quoted in a sentence is not a
   heading, and an example inside a fence is not the document's own structure. Rule 7 reads
   sections too and matches the heading the same way, but strips **fences only**: what it
   looks for inside a section is paths, and every path here is written in backticks.

   They are also **counted**, not merely found. Two branches once converted the same note
   to a use case at the same time; neither edit conflicted, the merge kept both, and the
   note landed on `main` with two openings, two tables, two main flows and two
   `## Where it lives` — passing every rule above, because "is it there" and "is it in
   order" are each satisfied twice over. The two halves then disagreed about what the
   feature guarantees, which is what a document that says a thing twice eventually does.
7. Every module in `src/` is **specified** by at least one note, **as a whole path** — in a
   use case's `## Where it lives`, or in an ADR's `## Decision`. Nowhere else counts: not a
   `Task`, `Issue` or `Bug`, not a use case's prose or criteria, not this page, and not an
   ADR's `## Context`, `## Consequences`, `## Alternatives` or `## Revisit when`. The reason
   is the whole rule — **a module nothing specifies is a capability nobody asked for** —
   and a passing mention says nothing about what the file is for. Matching is by whole path
   for a second reason: by substring, a mistyped `src/main.tsx` stood in for the
   `src/main.ts` it misspells while the reference check parsed the prefix and found the real
   file, so one typo passed twice.

   **The ADR arm is one section, not the record.** `## Context` and `## Alternatives` exist
   to describe what was considered and **rejected**, so a path there is evidence a module
   was *discussed* — which is exactly the mention-only satisfaction this rule removes.
   `## Decision` is where the choice is made. `src/view/host.ts` is the case that needs
   this form: it is the interface the layer rule is built on, no use case owns it, and
   [ADR 0003](adrs/0003-four-layers-enforced-by-lint.md) names it under `## Decision`.

   **`test/` is deliberately not covered.** It was, under the older, looser form of this
   rule, and it paid for itself in friction rather than defects: a path token appearing
   somewhere under `docs/` is satisfiable by mentioning the file and describing nothing, so
   every new test file cost a register edit that guaranteed no reader anything. Tightening
   what counts does not bring it back — the friction was the register edit, not its
   weakness — and the suite's shape is documented where it belongs, in
   [`test/CLAUDE.md`](../test/CLAUDE.md) and in the task notes that split it.

**One check lives elsewhere, on purpose.** That every **view-option key** and **command id**
is named by a *requirement* is verified in `test/docs/surfaces.test.ts`, because it needs to
**import** the modules and read what they actually produce: `getViewOptions()` for the
keys — the ones generated per type included — and `onload()` for the commands it registers,
so a second one is discovered rather than remembered. Teaching this script to learn them instead meant regex-scanning
TypeScript, and ten review rounds found ten ways that can be fooled. A script over markdown
checks markdown; a test that can load the module asks the module. A record naming a surface
in passing does not specify it, so that search reads `requirements/` alone — and reads only
the **code spans** in them, matched whole, because an id is never prose: "backlog" is a word
on nearly every page and must not vouch for a command called `backlog`. Menu items and
toolbar controls are display text and stay a hand sweep — see
[[Sweep the register against the code]].

Each rule was verified the way this project verifies its lint rules: by planting the
violation and watching the check reject it. Those plantings now **re-run**, in both
directions — `test/docs/checkerRejects.test.ts` holds the violations, and
`test/docs/checkerAccepts.test.ts` holds the opposite and harder question: *does a valid
document pass?* A false pass is found by someone hunting for holes; a false failure is
found by someone who was doing something else, and their likely response is to change the
document rather than suspect the checker. So the accept corpus is deliberately made of
**legal forms this register does not itself use** — angle-bracket link destinations, `*`
and `+` bullets, trailing whitespace after a heading — since a construct nobody writes here
is exactly the one nothing would notice the gate refusing.

## What each kind of note holds

Eight note kinds, each answering a different question. The **type is a promise about the
content**, so choosing it is the first editorial decision: a defect written as a Task loses
the lesson, and a limitation written as a Bug reads as something someone is about to fix.

| Kind | Answers | Sections |
| --- | --- | --- |
| `Epic` | Why this body of work exists, and what "done" means beneath it | Prose · why it exists · definition of done |
| `Feature` | What outcome one coherent slice delivers | Prose · **Outcome** · *optionally* Landmines |
| `PBI` | What someone does, step by step, and every way it can go otherwise | The use-case shape below — **enforced** |
| `Task` | A piece of engineering work, and the evidence that justified it | Evidence · Why it matters · Approach · Acceptance criteria · Risks · Outcome |
| `Issue` | A question, a decision taken, or a limitation accepted | Varies by which — see below |
| `Test case` | What to check in a live vault, and whether it passed | Why this exists · Preconditions · How to check · Acceptance criteria · Outcome — see below |
| `Bug` | What went wrong, what fixed it, and what it taught | What happened · Fix · Lesson |
| ADR | What was chosen to build it, what that cost, what would change it | Context · Decision · Consequences · Alternatives · Revisit when — **in that order** |

The PBI shape and the ADR shape are gated by `npm run docs`. The rest rests on whoever
writes them. That is the honest division rather than an omission: a checker can see
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
once the feature exists. Nothing else belongs here: detail written at feature level is
detail no use case owns.

**One optional exception: `## Landmines, before implementation`.** A feature may carry a
section naming the traps that sit in the code its use cases will touch — and it earns that
section only when the hazard belongs to the feature as a whole rather than to any one use
case. The test is ownership, not usefulness: **if a use case could hold it, it must.** What
qualifies is the part no use case can state alone — the **order** the work has to be done
in, and the seams that fail *silently* when it is done in the wrong one. What does not is a
rule about one flow, which is an extension of that flow and belongs beside the step it
complicates.

[[Milestones]] is the worked example, and the reason the exception exists. Adding a seventh
name to a fixed vocabulary meets `EXTRA_TYPES` first, which is the wrong list and the
obvious one; getting that backwards is what every other trap in that feature was downstream
of. No use case owns "do this before that", and a reader who met the traps one use case at
a time would meet them in the order that hides the ordering. Write it in the shape that
section uses — the ordering rule first, then the quiet seams against the loud one, then the
records to settle in the same change — because naming which failures are *silent* is most of
the value.

Like the rest of the Feature and Task conventions this section is **not gated**: `npm run
docs` checks the use-case and ADR shapes and nothing here. A feature without it is the
normal case, and one carrying it under a hazard a use case should have owned is worse than
one without.

A Feature does not also keep its own list of the PBIs that deliver it. That fact already
exists once, as each PBI's own `parent` link, and a hand-written second copy of it goes
stale the moment the two disagree without either one saying so — which happened twice
before this rule replaced the list: two branches, each adding a child its sibling
branch's copy of the list could not see. Obsidian's backlinks pane, or `Product
Backlog.base` itself, reads the same link and cannot drift from it, which is the one copy
worth trusting. See [[Check that a feature lists its use cases]] for the check this
replaced and why.

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

### `Issue` — a decision, or a limitation

An Issue is the widest kind, and its shape follows which of two things it is. Say which
in the first heading rather than making a reader infer it:

- **A decision taken** — `The decision` · `Why` · `What a real fix would look like` ·
  `Acceptance criteria`. [[Write batches are refused not queued]] records a rule that is
  correct and looks like a bug, so nobody "fixes" it twice.
- **A limitation accepted** — `The limitation` · `Why it is deliberate` ·
  `What would lift it` · `Impact`. The point is the cost, stated plainly enough that a
  reader can disagree with it.

An Issue may legitimately have **no acceptance criteria**, and should say so out loud
("None; recorded so the trade-off is re-decided knowingly rather than rediscovered"). A
blank criteria section reads as an oversight; an explicit "none" reads as a decision.

An Issue no longer carries the third shape, a live-vault check — that moved to `Test
case` below in the 2026-08-11 test catalog migration, and an `Issue` still carrying
`## How to check` today is a misfiling rather than a third option.

### `Test case` — one executable check, and whether it passed

`Why this exists` · a **Preconditions** line · `## How to check` · `Acceptance criteria`
· `## Outcome` once it has run — the shape an `Issue`'s "verification to run" used to be.
Each hangs from a `Test suite` in `docs/tests/suites/` (a walkable group, holding nothing
to check itself) rather than from a Feature or PBI, since a check belongs to no rung the
tree already ranks by. `## How to check` as a whole heading is what `RELEASING.md`'s
release sweep queries `docs/tests/cases/` for, alongside `cadence:` — `release` (the
pre-tag sweep) or `conditional` (its own trigger, stated in its prose). `docs-check.mjs`
holds those two to each other, for both `Issue` and `Test case`: the heading and the
cadence must both be present or both absent. That check is by **type**, not folder — see
the comment above `SWEPT_TYPES` in `docs-check.mjs` for exactly what it does and does not
catch.

The 25 cases moved from `docs/issues/` kept their existing bodies rather than being
rewritten into the shape above: several exist to record that a multi-part check partly
ran, which a fresh skeleton would erase. That shape is for a case created new in a vault.

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
  | `type` | every backlog note | One of the vocabulary's fixed names. ADRs carry none |
  | `parent` | everything but a root — an `Epic` by position, a `Milestone` by nature | A wikilink, `"[[Note name]]"`, quoted so YAML keeps it |
  | `order` | every backlog note | The rank among siblings. Unique within a group — the register must not demonstrate the one ranking limitation the plugin has |
  | `status` | every backlog note | `Open`, `Active`, `Done`, or `Dropped` — refused, kept for the record |
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
- **A claim about behaviour may name the check that holds it**, and `docs-check.mjs`
  verifies that citation resolves — the file is there and the cited name is still one of
  its quoted strings, whole. The form is a backticked path and a quoted test name on one
  line:

  ```
  **Checked by** `test/domain/settings.test.ts` — "keeps its own declared states over the shared list once configured"
  ```

  The path is a `*.test.ts` file — the set `vitest.config.mts` runs — or `eslint.config.mjs`,
  since a lint rule at the forbidden thing is this repository's other kind of check. A helper
  or a double under `test/` is neither, and the gate refuses it. Quote the name in FULL: the
  match is against whole quoted strings, so a phrase from the middle of a title does not
  resolve — which is what makes a title *extended* rather than replaced count as a rename.
  It is not a check that the string is an `it()` title, and cannot be: a citation here may
  legitimately name a table-driven case label or a lint message, neither of which is a title
  anywhere in its file.

  **One marker, one citation.** Only the first quoted name after a `**Checked by**` is
  resolved, so a second check needs a second marker — two names under one marker leaves
  the second unverified while reading as covered, which review caught in the first note to
  try it. The gate cannot report that: telling a second cited name from an ordinary quoted
  phrase is the judgement this rule exists by not making.

  Read what this is and is not. It does **not** verify the claim; nothing here can, and
  [[A claim in four notes and nothing to check it]] argues why the candidates that try are
  worse than the problem. What it buys is the step where the author goes and fetches the
  test name — the claim this convention was built for was written the same day a test
  asserting its opposite landed, and spread to five notes before a reviewer read one. And
  it is **opt-in**: an unmarked claim is exactly as unchecked as before. A citation that
  rots fails the build, in a closed note as loudly as a living one, and in the root
  `README.md` too — a citation says the check is live, so the historical-path allowance
  that covers prose naming a file does not cover this.
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
