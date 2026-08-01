---
adr: 9
title: The type rules are advisory, never enforced
status: Accepted
date: 2026-07-30
area: domain
---

# ADR 0009 — The type rules are advisory, never enforced

## Context

The plugin knows a great deal about what *should* go where: a Feature belongs under an
Epic, a Task holds nothing, an `Issue` may hang from three of the four levels. That
knowledge could drive **what the view offers**, or it could drive **what the view refuses**.

The notes are the user's. They existed before this view and will outlive it, and a vault
routinely contains structures that are half-migrated, mid-thought, or deliberately odd.

## Decision

**The rules decide what is offered. They never decide what is refused.**

- `childTypeChoices` decides which types the **+** modal and the menu propose.
- Level inference decides what an untyped item *displays* as.
- The auto-type cascade decides what a move *writes* — and is **off by default**.

No drag is rejected for producing an illegal pair. A Task may be dropped under an Epic. A
`Bug` may be put anywhere. The two things that *are* refused are refused for different
reasons entirely: a cycle, because the model cannot represent it, and a write to a note the
Base excluded ([ADR 0010](0010-load-excluded-ancestors-as-context-rows.md)), because it is
not the user's to act on here.

## Consequences

- A backlog that does not match the ladder still works. That is the common case during
  adoption, and a tool that refuses to show you your data until you fix it is a tool nobody
  finishes adopting.
- An unrecognised custom type (`Spike`, `Chore`) keeps its name and occupies its parent's
  next slot. The view does not know what the user meant; carrying it through is the only
  honest option. **With one exception, and it is not one this decision chose**: the
  auto-type cascade — opt-in, off by default — leaves such a type alone as a *descendant*
  and rewrites it on the *dragged item itself*. Two different predicates, only one of them
  ever written down as a rule. Recorded under *The asymmetry* in
  [[Assigning type on a move]]; this ADR states the intent, and the intent is not what the
  dragged-item branch does.
- Every feature is additive rather than a new veto. Adding `Issue` and `Bug`
  ([ADR 0014](0014-rank-extra-types-by-type-not-by-position.md)) touched inference and
  offering, and needed no validation in the drop maths, the four move commands, the menu,
  or a refusal message for each.
- Enforcement would have been *unimplementable* in the case that matters most anyway: in a
  filtered base the view cannot see an item's real siblings, so it cannot know whether a
  pair is legal.
- The cost is that a backlog can drift into shapes the ladder does not describe, and the
  view will render them without complaint. The badge tells the truth — implied levels
  render dashed, unknown types render bare — but nothing stops the drift.

## Alternatives

- **Refuse illegal drops.** Would have meant validation in drop-target maths, in move,
  indent and outdent, and in the menu, plus a distinct refusal message for each, plus a
  decision about what to do when the view lacks the information to judge. It buys tidiness
  in exchange for a tool that argues with you.
- **Auto-correct on drop, always.** Re-typing a whole moved subtree is a strong action to
  take on a drag; it exists, and it is opt-in for exactly that reason.
- **A schema the user declares and the plugin enforces.** Every rule would then have to
  hold for any schema a user can write — the same trap that
  [ADR 0013](0013-fix-the-type-vocabulary-at-six-names.md) records paying for once.

## Revisit when

Someone reports a backlog corrupted by a move that a refusal would have caught. So far the
reports have gone the other way: the bugs were rules applied too eagerly, not too loosely.
