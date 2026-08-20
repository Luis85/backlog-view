---
type: Epic
order: 4.9219
status: Open
area: product
created: 2026-08-16
source: product requirements document, 2026-08-16
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Product Discovery

**Work before it is work.** An idea, a problem, an opportunity and an assumption are not
backlog items — they are candidates, and treating them as backlog items is how a backlog
fills with things nobody has decided to build. This view gives them a place with its own
lifecycle, its own validation state, and one exit: a validated opportunity is promoted into
the backlog and stays linked to what it came from.

**Outcome** — A team can develop an idea until it is worth committing to, and the backlog
only contains work somebody decided on.

## A discovery item is an ordinary note, and that includes `Idea`

The opening sentence needs one correction the register can make and this epic cannot dodge:
`Idea` is **already** a backlog type here ([[Ideas as a type beside the ladder]]), it may
hang from nothing, and a base that returns it shows it. Nothing this epic adds changes that,
and no hidden discriminator will be invented to hide one — a property only this plugin
understands is the proprietary model the whole architecture refuses.

So "not a backlog item" means *not committed work*, not *invisible to the backlog view*.
What separates the two lists is the mechanism Bases already gives every vault: **the base's
own filter**. A discovery base returns the lifecycle property's items; a backlog base that
does not want candidates in it filters them out by that same property, exactly as a base
today excludes done items or a `Deliverable`. Both are one filter expression, written by the
user, over a property this epic writes in the open.

That is a real cost, stated rather than hidden: a vault that configures neither filter sees
its ideas in both places. The epic's answer is the guided empty state — a discovery view
that can offer the filter it needs — and not a rule the plugin enforces behind the reader's
back.

## Why it is its own view

The discovery lifecycle is not the delivery workflow, and running both through one state
property is how `Idea` ends up in a column called `In progress`. A separate view means a
separate vocabulary — captured, idea, opportunity, discovery, validated, candidate,
planned — configurable, and invisible to a vault that never adds the view.

Promotion is the seam that matters: it is a write, it creates a note of a backlog type, and
it leaves the discovery item in place with a link. Nothing is moved or re-typed, because a
discovery item that becomes an epic loses the record of what was validated.

## Definition of done, for anything under this epic

- The lifecycle is configuration, not a constant, and an unconfigured lifecycle means no
  discovery surface rather than a broken one.
- Nothing here writes to a backlog item except the promotion, which creates one.
- Every claim about an opportunity — validated, supported, rejected — points at the
  evidence that says so, or says it is an assumption.

## What this epic will not do

- **Run experiments.** It records what an experiment concluded; it does not conduct one.
- **Replace research.** The notes are the research; this view organizes their conclusions.
