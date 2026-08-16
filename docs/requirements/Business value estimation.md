---
type: Epic
order: 60
status: Open
area: product
created: 2026-08-16
source: user request — product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Business value estimation

**An item's value is a set of answers, not a number.** Each backlog item can carry an
estimation profile: eight value dimensions scored 1–5, a confidence in the evidence behind
them, and an effort and complexity kept apart from both. A weighted business value is
derived from those answers and **written back to the item's own note**, so every other
view reads a plain property and no other view has to know the model.

This is the plugin's **second Bases view** — its own registration, its own view options,
its own state, its own screen — not a fifth position on the backlog view's toolbar.

**Outcome** — Someone comparing two items can see *why* each one scores what it scores,
how sure anyone is of it, and what it would cost, without any of the three being folded
into the others — and the backlog, the board and the roadmap can show the result without
learning any of it.

## Why this exists

A single `Business value: 5` hides everything that produced it. Two Features can both
carry it while meaning opposite things — one foundational and strategically important with
little immediate customer impact, one high-impact for many users and strategically
marginal — and the number compares them as equal. The number is the least informative part
of the estimate, and it is the only part that survives.

The same field is also where teams quietly merge things that must stay separate: value,
urgency, implementation cost, delivery risk, and how much evidence any of it rests on. A
prioritization built on that mixture cannot be reproduced, explained to a stakeholder, or
argued against constructively — which makes it indistinguishable from an opinion held
firmly.

This epic exists so that a backlog can answer one question in a form somebody can
disagree with: **why do we believe this item is valuable, how confident are we in that
belief, and how does it compare to the others?**

It is decision *support*. The moment a derived number is read as the decision, this epic
has made prioritization less honest rather than more.

## A second view, not a fifth toggle

The backlog view already carries four projections behind one toolbar — tree, board,
roadmap, Deliverables board — and each one is a different *drawing of the same tree*.
Estimation is not that. It is a form over one item at a time, a table of items ranked by
numbers the tree does not hold, and a scatter of value against effort; it has its own
properties, its own vocabulary and its own configuration, and none of it makes a tree
easier to read.

So it registers separately, as its own view type beside the backlog's: its own name and icon
in Obsidian's view picker, its own view options describing estimation keys and weights only,
its own entry in the view-state store — and a vault chooses it per saved view, the way it
chooses any Bases view. The backlog view's toolbar does not grow, its options do not gain a
section nobody using the tree will read, and the two views share the layers below them: one
write boundary, one gate, one undo history, one model of what a work item is.

It is the first capability to follow [[A view per capability]], and the shared kernel that
epic extracts is what it reads the tree with — which is also why the kernel comes first: an
estimation view built against the backlog view's own internals would be the second
implementation of a work item, not the second view of one.

What the two views share on the *screen* is a property, not code. The estimation view
writes a consolidated value onto the note; the backlog view reads it if it has been told
which key holds it, exactly as it reads a risk level today, and shows it without knowing
what a dimension is.

**This is not the MoSCoW priority the backlog already has.** [[Prioritization]] reads a
priority a person *states* on the row — must, should, could, won't — and that is a judgement,
made in one move, needing no evidence. This epic derives a number from answers and says what
went into it. The two are complementary and must not be wired together: a score never writes
the priority property, and a priority never enters the model. Where they disagree, that
disagreement is information — a `Must` scoring 2.1 is a conversation worth having, and a view
that silently reconciled them would delete it.

## The default model

The value dimensions and their default weights, which must total 100 and must be
configurable — **on the estimation view itself**, like every other setting this plugin
has, saved in its `.base` file:

| Dimension | Asks | Weight |
| --- | --- | --- |
| Strategic alignment | How strongly does this serve a current strategic objective? | 20% |
| Customer value | How much better can a user do an important job? | 20% |
| Business impact | What economic or operational change could this create? | 15% |
| Reach | How much of the relevant group is affected? | 10% |
| Risk reduction | How much business, operational or technical risk does it remove? | 10% |
| Compliance | How far is this required by regulation, contract or commitment? | 10% |
| Time criticality | How much does delay cost, in value or in consequence? | 10% |
| Enablement | How much further valuable work does this unlock? | 5% |

`Business value = Σ(score × weight)`, normalized back to 1.00–5.00. Every scale is 1–5,
and the model is worth nothing until **every point on every scale carries a stated
meaning** — a score is chosen against a sentence, never by picking a number that feels
right. Those sentences are deliberately not here: a rubric is what the scoring surface
displays, so the feature that builds that surface owns them, for the eight dimensions,
for confidence, and for effort and complexity alike. The requirements document this epic
came from carries a default set to start from. Until they are written, nothing under this
epic is buildable — a 1–5 selector with no rubric behind it is the arbitrary number this
epic exists to replace, wearing eight faces instead of one.

**So a vault can hold two models, and that is a real consequence rather than an
oversight.** Nothing here is stored at vault scope, because nothing in this plugin is: a
setting lives on the saved view, and a second estimation view is a second set of weights
the same way a second board is a second workflow. Two of them can estimate the same note
and overwrite one another's total. What keeps that legible is the provenance the written
total already has to carry — a total stamped by a model that is not the one on screen
reads as foreign, not as current — and the honest advice, which belongs in the view's own
documentation rather than in a mechanism: **one estimation view per vault** unless two
models are genuinely wanted. A vault-scoped store would be new machinery for a
configuration nobody has yet asked to share, and it would break the rule that a `.base`
file carries its view's settings.

Three quantities stay **outside** that sum and beside it:

- **Confidence** (1–5, assumption → validated evidence) says how much the value estimate
  is worth, never how large it is. High value with low confidence is a candidate for
  discovery, not for the next sprint, and the view has to make that pair visible rather
  than averaging it away. A confidence-adjusted value may be derived — `value ×
  confidence / 5` — but it never replaces the value it adjusts; both are shown.
- **Effort** and **complexity** (1–5 each) never enter the business value at all. They
  meet it only in an explicitly labelled prioritization indicator
  (`confidence-adjusted value / effort`) and in the value-against-effort matrix.

## Definition of done, for anything under this epic

- **Every stored number is an ordinary property, under a key the vault names.** Scores,
  confidence, effort and complexity are frontmatter the way a risk level already is
  ([[Setting the risk on an item]]) — the view names its keys in the view options and
  invents none, an unconfigured key is never written, and a vault with nothing configured
  gets no estimation surface rather than a broken one.
- **The consolidated value is written back; nothing else is.** The business value is the
  one derivation that leaves the view, because its whole job is to be read by views that
  do not implement the model — the backlog row, a Bases filter, a sort, another plugin. It
  lands as an ordinary property through the one write boundary, in the same gated,
  undoable batch as the score that changed it, never on a render pass and never by a
  background sweep. Everything else — the confidence-adjusted value, the indicator, the
  matrix position — stays an inference recomputed on read.

  **A written total is a copy, and a copy can be wrong.** That cost is accepted here
  rather than waved away, so two things are required of it: it is rewritten by the same
  action that changes any of its inputs, and it is **stamped with the model that produced
  it** — a second property beside the total, holding a fingerprint of **everything that
  decides the arithmetic**: which dimensions are enabled, their weights, the property each
  one reads, its range, its direction, the formula that combines them, **and the rubric
  sentences themselves** — a reach of
  5 redefined is a 5 that means something else, and every note holding one was scored
  against the old sentence. Not the weights alone — a dimension repointed at
  a different property that happens to hold the same number today produces the same total
  from a different model, and a fingerprint that cannot see that is a stamp that lies
  exactly when it matters. The total itself stays a plain sortable number, which is why
  the fingerprint is a property of its own. **Current means two things, and the stamp
  answers only one of them**: the stamp must match the model on screen, *and* the total must equal what that
  model computes from the scores on the note as they are now — which the view has already
  computed, since it draws the decomposition beside it. A score edited in Obsidian's own
  property editor, or by another plugin, moves no stamp, so a stamp comparison alone would
  call a total current that its own inputs contradict. A different stamp means another
  model produced it; an absent one means it was written by hand or by something else. None
  of the three failures is shown as current, and the estimation status is where that
  surfaces — `Needs re-estimation`, not a silent pass.

  **A total whose inputs are gone is reported, and removed by an action.** Scores deleted in
  Obsidian's property editor or by another plugin leave an orphan behind, and no rule here
  may turn that into a write nobody asked for: the view says the total has no inputs, and it
  is removed by the next estimation action on that item or by an explicit cleanup the reader
  invokes — never on a render pass, never by a sweep. A gate that writes while nobody is
  looking is a worse failure than a stale number that says it is stale.
- **A result can always be decomposed.** Anywhere a score appears, the dimensions and
  weights that produced it are reachable. A number a reader cannot take apart is the
  problem this epic was opened about.
- **A merged number never stands in for the ones it merged.** The two combinations this
  epic asks for are legitimate and named — confidence-adjusted value, and the
  value-to-effort indicator — but each carries its own label and appears *beside* its
  inputs, never instead of them. What is banned is the unlabelled composite: one figure
  that has quietly absorbed value, confidence or cost and no longer says which.
- **Writes go through the one gate**, as one undoable batch, and never touch a note the
  base excluded.
- **Nothing here decides anything.** The estimation view ranks its own table by whatever
  the reader picks — that is what a comparison surface is for. What it never does is write
  that order anywhere: the backlog's `order`, the sibling ranking and any priority property
  are untouched by a score. Sorting a table is reading; renumbering a backlog is deciding.

## What this epic will not do

- **Decide priority.** No score writes an order, reorders the tree or sets a priority
  property, and no ROI, NPV or financial forecasting is computed. The output is an input to
  a conversation.
- **Replace effort estimation, discovery or research.** It records what those produced.
- **Keep an estimation history.** A revision log — who estimated what, when, and what
  changed the number — is a second item family, refused here for exactly the reason
  [[Test Management]] refuses run history: the note is the current answer, and the vault's
  own file history is where a previous one lives. If the history turns out to be the
  point, it is its own epic and says so.
- **Parse note bodies.** The rationale for a score and the evidence behind it are prose in
  the note, written and read as markdown; the model reads frontmatter, here as everywhere.
- **Force one model on every level.** Which dimensions apply to an `Epic`, a `Feature` and
  a `PBI` is configuration, not a constant.

## Settled before anything is built

Five questions have to be answered in the features under this epic, because each one can
make the work twice as large after it starts:

1. **Roughly fourteen new optional properties**, one per dimension plus confidence,
   effort, complexity, the consolidated value, its model stamp and the estimation status.
   Obsidian's picker
   offers only properties a vault already has, so this view needs the same bind-and-backfill
   action the backlog view has in `src/domain/optionalProperties.ts` — reused rather than
   copied, over its own key list — and both halves of it are needed before a single score
   can be entered.
2. **Inheritance has no mechanism yet.** "Strategic alignment inherited from the parent
   Epic" is a value that is displayed, marked with its source, and written nowhere. A view
   that writes one derivation back must not start writing this one too: an inherited score
   copied onto a child is a second copy of a fact, and it stops tracking its source the
   moment the parent changes.
3. **Changing the weights is answered, and what follows from it is not.** The behaviour is
   already settled above and is not reopened here: weights stay editable, nothing is
   rewritten in the background, and every total the old model produced fails the stamp
   comparison and reads as `Needs re-estimation` until something rewrites it. What is open
   is the ergonomics of the aftermath — whether a bulk re-estimation exists to clear a
   hundred flags in one gated batch, or whether each item is opened, and whether the weight
   editor says how many stored totals its change is about to invalidate before the change
   lands.
4. **An estimation status is a second workflow.** Not estimated → draft → estimated →
   validated → needs re-estimation is a state machine over a property that is not the
   board's, and the board already learned what a second workflow costs
   ([[A Deliverable is coloured by its own workflow]]).
5. **A partial profile is the normal case, and it has no arithmetic yet.** Dimensions are
   optional per level and every score property is optional per note, so most items will
   have some dimensions answered and some not. Three candidate rules — suppress the total,
   renormalize the weights over the answered dimensions, or score a missing dimension as
   its lowest point — give the same item three different values and three different
   positions in the matrix, so exactly one of them has to be chosen and stated before any
   two items are compared. Whichever it is, the rule this epic already holds applies to it:
   **a partial profile never looks like a complete one**, and a displayed total says how
   much of the model it rests on.
