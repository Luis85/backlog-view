---
type: Feature
order: 25
parent: "[[Cross-cutting concerns]]"
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
priority: ""
iteration: ""
---

# A view per capability

**One capability, one Bases view.** The plugin stops being a view with a growing toolbar
and becomes a family of focused views over the same notes: a vault adds the ones it wants
and meets the settings of no other. Nothing is shared at runtime except the layers below
the screen — one model of what a work item is, one write boundary, one gate, one undo
history — and on screen the views share only what every other Obsidian plugin shares with
them: properties and links in the vault.

**Outcome** — Someone who wants a backlog installs a backlog and configures a backlog.
Someone who wants prioritization, discovery and release planning adds three more views and
configures each one only for what it does.

## Why it sits under `Cross-cutting concerns` rather than beside the capability epics

It was an Epic of its own until 2026-08-21, with the seven notes below it as Features. It is
the same rule either way; what changed is where the register admits the rule is *stated*
rather than *scheduled*. `Cross-cutting concerns` is for qualities true of everything or
true of nothing, and "one capability, one view; views communicate only through the vault" is
exactly that shape — the same shape as `Multilang` (every string comes from a catalog) and
`Theming and styling` (every pixel comes from a token). An Epic promises a body of work with
an order; this promises a property every view has to satisfy, including the views nobody has
written yet.

The seven notes below are **Issues**, not Features, and that is the honest half of the same
move: each is a question this rule has not answered — what the shared kernel actually
contains, what a registration costs, how a base names a view it does not have — and none of
them is a capability a vault could install. They become Features again, or PBIs under one, on
the day a capability is scheduled against them rather than argued about.

## Why this is a stated rule rather than a habit

The alternative is the one this plugin has been living: every capability becomes another
toggle on one toolbar, another block in one options schema, and another reason for a user
who wanted a tree to scroll past settings for a matrix. Four projections already sit behind
that toolbar. The cost is not the toolbar — it is that a view's configuration stops being
readable, and that a capability nobody uses still has to be understood to configure the one
they do.

The rule that makes it work is the data contract: **views communicate only through the
vault.** The discovery view writes a validation state; the prioritization view reads that
property because it was told which key holds it, not because the two views know each other.
Any hidden channel between two views — a shared store, a cache, a plugin-level settings
file — is the proprietary database this plugin has always refused, arriving by the back
door.

## The design it is being built against

A software design document of 2026-08-16 ([`sdds/`](../sdds)) states the target
architecture: a view registry, a shared product kernel, a vault infrastructure layer, and
one Bases view per capability on top of them, with `ProductEntity` as the normalized note
every service reads and a property-mapping layer between a domain concept and whatever the
vault calls it. Two of its claims are the load-bearing ones for this rule — **the product
model is the vault, not the views**, and **no view implements hierarchy traversal or
frontmatter mutation for itself**.

Its migration order is the one this feature follows, and it is deliberately not
newest-first: extract the shared kernel without changing behaviour, then the registry, then
the projections already built, then the new views. Extraction before registration matters —
a second view registered against logic that is still tangled with the first view's DOM
copies that tangle rather than sharing the logic.

**What the document does not settle is the directory structure**, which it also proposes,
and which this repository already has in a different shape with a lint rule holding it up.
That disagreement is [[The SDD's layers are not the four this repository enforces]] and it
is answered there, not here: this rule needs one implementation of each concept, and is
indifferent to which directory it sits in.

## Notes that are not work still look like work

This register's scope rule is that **a note belongs to the backlog if it has a supported type
or a parent** ([[What counts as a work item]]). Several capabilities here keep families that
use `parent` among their own notes — strategy entities, portfolio groupings, discovery
candidates — so a backlog base that returns those notes will draw them, rank them and roll
them up. Nothing about owning a separate view changes that, and no hidden discriminator will
be added to pretend otherwise.

**The mechanism is the base's own filter**, which is what every vault already uses to exclude
done items or Deliverables, and each view's guided empty state offers the filter it needs on
both sides: its own base returns its family, and a backlog base that does not want them
excludes them by the same property. The cost is stated wherever it applies: a vault that
configures neither filter sees both families in both places, which is visible, ordinary and
fixable — unlike a rule the plugin would enforce behind the reader's back.

## What the capabilities cost the vocabulary

The capability epics beside this one ask, between them, for seventeen new item types —
against the eleven the plugin declares and the eight hues Obsidian ships. A type is not
scoped to the view that wanted it: it appears in every type menu, needs a badge nothing else
wears, and enters the map that decides what a drag means. That is
[[Ten capabilities want seventeen new types]], and no capability here ships a type before that
issue places it, because the alternative is what happened to the palette once already —
each type reaching for whichever hue looked least crowded, on branches that could not see
each other.

The default the register's own precedents point at is that most of them are not types at
all: a type is for something the tree ranks, and everything else is a note a property points
at.

## Definition of done, for anything this rule governs

- A capability is a registered view type with its own options, its own state and its own
  empty state. A setting appears in exactly one view's options: the view that uses it.
- Every concept two views share is implemented once, below both of them — and a view
  reaching for a second implementation is the signal that the kernel is missing something,
  never that the view needs its own.
- No view requires another to be present or configured. Absence is a value here too — a
  key nothing has named is read as nothing, never as an error.
- Nothing is written that only the plugin can read. Every property a view writes is one a
  human, a Bases filter or another plugin can read without this plugin installed.
- What the views share is code below the screen, properties in the vault, and **exactly one
  piece of runtime state: the write path.** The gate and the undo history are plugin-wide,
  deliberately — two views writing the same note have to be serialized against each other,
  and an undo has to be able to take back the last write whoever made it, so a gate per view
  would be two views racing on one vault with two ideas of what "the last batch" was. The
  visible cost is stated rather than discovered: a write in one view makes the other's write
  briefly unavailable, and an undo in either takes back the most recent batch, not that
  view's most recent batch.

  Everything else is per view and shared with nobody: configuration, selection, folds,
  filters, scroll, zoom, the projection on screen. A view reading another view's settings or
  UI state is the coupling this rule exists to prevent, and no exception to that is
  contemplated.

## What this rule will not do

- **Migrate anyone by force.** The projections that move out of the backlog view leave a
  working configuration behind; a staged extraction is the point, and a base that names a
  projection that has moved keeps working or says exactly what to add.
- **Invent a product methodology.** A view offers a vocabulary and defaults; a vault that
  wants different words gets different words.
