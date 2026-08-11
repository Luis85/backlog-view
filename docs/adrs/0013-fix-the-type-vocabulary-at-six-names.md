---
adr: 13
title: Fix the type vocabulary at seven names
status: Accepted
date: 2026-08-01
area: domain
supersedes: 12
---

# ADR 0013 — Fix the type vocabulary at seven names

## Context

[ADR 0012](0012-make-the-type-vocabulary-configurable.md) made the ladder and the extra
types configurable, and the bill arrived within a day: every level rule had to hold for
any list a user could type, collision rules between two user-supplied lists, a per-type
folder default for names nobody had chosen, a schema that depended on the config it
defined, and two `Object.prototype` bugs that existed only because type names had become
arbitrary strings. What it bought was a rename.

## Decision

The vocabulary is **fixed**, as constants, not options:

```
LEVELS       = Epic · Feature · PBI · Task
EXTRA_TYPES  = Issue · Bug · Idea
MARKER_TYPES = Milestone
```

Matched case-insensitively. The property *keys* stay configurable — pointing `type` at a
different property is a different question, and a cheap one.

A note typed anything else is still handled, and this is what makes the decision liveable:
an **unknown custom type keeps its name** and occupies its parent's next slot so the
ladder carries on beneath it. `Declared pins, undeclared inherits.` (It is never rewritten
at all now. An opt-in cascade used to rewrite one that was itself dragged while leaving the
same name alone as a *descendant* — an asymmetry nobody chose, deleted with the feature on
2026-08-11; [[Assigning type on a move]].)

## Consequences

- Every level rule has exactly **one list** to hold for, and it is four long. Whole
  categories of question stop existing: no collisions, no empty ladder, no rung count.
- Each of the seven gets a **shipped opinion** — a default folder, an icon, a badge colour —
  because there are seven of them and someone chose each one.
- The badge renderer needs **no fallback** for a declared type. That is only safe because
  the vocabulary is fixed and a test asserts the tables cover it.
- The options schema is static again — it still reads the config, but only to derive each
  type folder's *default* from the home folder.
- The lookup of a user-supplied type name goes through one guarded helper (`byTypeName`),
  because a name can still be anything on disk even though the vocabulary is not. Fixing
  the *operation* rather than each site is why that bug stopped recurring.
- **A user who says "Story" cannot have the view say "Story".** That is the price, paid
  deliberately, and the one thing to weigh if it is ever reconsidered.
- Nothing was kept for compatibility. The options vanished and the values users had set
  stopped being read ([ADR 0016](0016-break-compatibility-freely-before-1-0.md)).
- **Amended 2026-08-02 (Milestones).** The vocabulary is now **seven** names in **three**
  categories. The filename still says six; it is kept because the record is addressed by
  its number and renaming it would break every link that resolves today. Nothing this ADR
  decided changed — the vocabulary is still fixed, still not an option, still matched
  case-insensitively, and every one of the seven still gets a shipped opinion. What grew
  is the count, which is exactly the kind of staleness a record absorbs rather than is
  superseded by.
- **Amended 2026-08-08 (`Idea`).** An eighth name, a third extra type
  ([[Ideas as a type beside the ladder]]). The same absorption as the amendment above,
  and it is now worth saying plainly: **this record fixes the vocabulary against being
  a user OPTION, not against growing.** Adding a name costs one line plus its shipped
  opinion — a folder, an icon, a badge colour — precisely because nothing is generated
  per view; that cheapness is what the decision bought, so spending it is not eroding
  it. What would supersede this ADR is a name a *user* supplies, not one this plugin
  ships. Every count in the title, the filename and the prose above is left as written,
  for the reason the previous amendment gives.

## Alternatives

- **Keep it configurable** — [ADR 0012](0012-make-the-type-vocabulary-configurable.md),
  and its consequence list is the argument.
- **Fix the ladder, keep extra types configurable.** Halves the collision problem and
  keeps the worse half: an extra type is exactly where the "no default folder, no icon"
  question lives, because it has no position to inherit from.
- **A display alias** — fixed internally, relabelled in the UI. Genuinely different: it
  changes what the user reads and nothing about what any rule must hold for. Not built
  because nobody has asked; it is the shape to build if they do.

## Revisit when

Someone asks for their own names *and* the display-alias shape above turns out not to
satisfy them. The request to weigh is "call it a Story", not "let me define a ladder" —
the second is what this ADR is refusing.
