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
them, and an effort and complexity kept apart from both. The view reads those properties,
derives a weighted business value from them, and shows the derivation beside the result —
in the row, on the card, and in a value-against-effort projection of the whole backlog.

**Outcome** — Someone comparing two items can see *why* each one scores what it scores,
how sure anyone is of it, and what it would cost, without any of the three being folded
into the others.

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

## The default model

The value dimensions and their default weights, which must total 100 and must be
configurable per vault:

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
- **Every derived number is derived, and written nowhere.** Business value,
  confidence-adjusted value and the indicator are inferences over the scores, recomputed
  on read, the same way a parent's roadmap span is drawn as the inference it is. A
  persisted total is a copy that can disagree with its inputs.
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
- **Nothing here decides anything.** The matrix, the indicator and the ranking are read;
  no ordering is applied to the backlog on their behalf.

## What this epic will not do

- **Decide priority.** No automatic ranking, no sorting the tree by score, no ROI, NPV or
  financial forecasting. The output is an input to a conversation.
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

1. **Roughly twelve new optional properties.** Obsidian's picker offers only properties a
   vault already has, so the suggest-and-backfill action in `src/domain/optionalProperties.ts`
   has to bind and backfill them — a dozen keys at once is a different action from the
   handful it binds today, and both halves of it are needed before a single score can be
   entered.
2. **Inheritance has no mechanism yet.** "Strategic alignment inherited from the parent
   Epic" is a value that is displayed, marked with its source, and written nowhere. That is
   a third kind of derived value in a view that already has two, and it must not become a
   write.
3. **The matrix is another projection.** The toolbar already carries four toggles, with a
   test catalog wanting a fifth ([[Test Management]]); a value-against-effort plot is
   either a sixth or something that lives inside the estimation view. Decide which before
   drawing it.
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
