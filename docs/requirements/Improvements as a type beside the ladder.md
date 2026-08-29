---
type: PBI
parent: "[[Work item hierarchy]]"
order: 90
status: Done
priority: P2
area: feature
created: 2026-08-29
closed: 2026-08-29
source: user request
files:
  - src/domain/typeVocabulary.ts
  - src/view/render/badges.ts
  - src/view/manual/typesSection.ts
  - src/view/manual/sections.ts
  - styles/badges.css
started: ""
finished: ""
horizon: ""
start: 2026-08-29
due: 2026-08-29
risk: ""
assignee: ""
iteration: ""
---

# Improvements as a type beside the ladder

**As** someone planning the release after the one that shipped, **I want** to hang an
`Improvement` under the item that was delivered **so that** the next round of work on it
gets its own release without the delivered note losing the release it went out in.

Moving an item's release forward is the alternative, and it rewrites history: the release
that shipped it loses a member, and a note recording delivered work starts claiming to be
pending. A shipped thing and the next round of work on it are two things. This gives them
two notes.

An `Improvement` is an **extra type**: the category [[Types beside the ladder]] defines,
whose rank is a property of the TYPE rather than of where it sits. That is what "hangs
under whatever shipped" means — an Epic, a Feature or a PBI alike — and it is why this is
not a fifth rung, since a ladder rule is always "one rung below the parent".

This is the fifth name in that category and the second since it stopped being two. Nothing
about the category changed to admit it.

**Nothing release-specific is built, and that is the design rather than a deferral.**
Release membership is already a property on any item ([[Releases as their own type]]), so
an `Improvement` joins a release through `Set release` and appears in the release view's
scope tree the way every other item does. A dedicated "plan an improvement" action —
create the child and pre-fill the next release in one gesture — was considered and refused:
it needs a rule for what *next* means that this plugin has nowhere to read, and the two
gestures it saves are the `+` and a menu pick.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an item under a row, creating one from the toolbar with no row selected, or setting an existing item's type |
| **Preconditions** | None |
| **Guarantee** | An `Improvement`'s rank is `EXTRA_TYPE_RANK` wherever it sits, exactly as an `Issue`'s, a `Bug`'s, an `Idea`'s or a `Deliverable`'s — no drag, reparent or auto-type cascade changes it, whether or not it has a parent. |

**Main flow**

1. An item has shipped: its release property names the release it went out in, and its
   state is a done value.
2. The user opens the **+** on that `Epic`, `Feature` or `PBI` row.
3. `childTypeChoices(item)` offers `Improvement` beside the ladder's own child and the
   other four extra types; `promptCreateItem` asks which, since there is more than one.
4. The user names it; the view writes `type`, `parent` and `order`, filing the note in the
   `Improvement` folder ([[Where new items are filed]]).
5. The user sets the new note's release to the next one. The shipped item keeps its own.
6. The release view's scope tree lists the `Improvement` under the next release, and the
   shipped item under the release that shipped it.

**Extensions**

- **2a — the row is a `Task`.** Nothing hangs below a Task; the modal is skipped and no
  `Improvement` is offered. An improvement to a Task is an improvement to what the Task
  belongs to.
- **2b — the row is itself an extra type.** Its only children are Tasks, so again nothing
  is asked. An `Improvement` on an `Improvement` is a second round, and it hangs where the
  first one did.
- **3a — the user instead uses the toolbar's "pick another type" menu, with no row
  selected.** It iterates the whole vocabulary, so `New Improvement` appears the moment the
  type is declared — no code of its own. The note it writes carries no `parent`.
- **4a — the user drags the `Improvement` to a different parent, or to the top level.** Its
  type is left alone: `levelIndex === -1` means "not a rung", as it already does for every
  other extra type.
- **5a — the release property is unconfigured in this base.** The `Improvement` is an
  ordinary item with no release, exactly as any other item is. The type is still worth
  having: it says the work is a further round rather than the original.

## Acceptance criteria

- `Improvement` joins the fixed vocabulary as an extra type, pinned at `EXTRA_TYPE_RANK`;
  its children are `Task`s under an `Epic` exactly as under a `PBI`.
- It is offered under an `Epic`, `Feature` or `PBI`'s own **+** beside `Issue`, `Bug`,
  `Idea` and `Deliverable`, and by the toolbar's top-level creator and the context menu's
  `Set type`, all of which read the whole vocabulary and needed no change.
- It is never re-typed by a move, whichever parent it lands under or whether it lands with
  none, and a parentless one is never pruned by `hierarchyOnly`.
- It files into its own folder (`typeFolder.improvement`, shipped default `improvements`
  under the home folder), like every other declared type.
- It renders with its own icon (`trending-up`) and a badge class the stylesheet defines;
  the test asserting the badge table covers the whole vocabulary covers it too.
- **Its hue is SHARED, and with the worst-placed wearer available.** Green already carries
  `Deliverable` and `Release`, and an `Improvement` and a `Deliverable` are both extra
  types at the same rung — so they can be siblings under one parent, which is exactly the
  pairing `Idea` was moved off green to avoid. It is taken anyway because the alternatives
  are no better (`Issue`'s pink and `Feature`'s blue can both sit beside it too) and
  because the fourteenth badge over eight theme tokens has no unshared hue to take. The
  icon and the type name are what separate them; see `styles/badges.css`. Stating this as
  a criterion the code MEETS rather than one it silently misses is the lesson
  [[Ideas as a type beside the ladder]] recorded.
- The generated README and the in-app manual name it without either counting the category
  — both derive from `EXTRA_TYPES`.
- Every criterion above is asked of `EXTRA_TYPES` rather than of the name `Improvement`,
  so a sixth name cannot join the category without answering them.

## Where it lives

`src/domain/typeVocabulary.ts` — `Improvement` joins `EXTRA_TYPES` and
`DEFAULT_TYPE_SUBFOLDERS` gains `improvement: 'improvements'`. That is the whole of the
behaviour: `ALL_TYPES`, `FILED_TYPES`, the per-type folder option in
`src/domain/viewOptions.ts`, `childTypeChoices` and `EXTRA_TYPE_RANK` in
`src/domain/itemTypes.ts`, the scope test in `src/domain/model.ts`, the cascade's exemption
in `src/domain/writePlan.ts`, the shelf grouping in `src/domain/shelf.ts`, the toolbar's
creator in `src/view/render/toolbar.ts` and the `Set type` submenu in
`src/view/interactions/menu.ts` are all already generic over the vocabulary.

`src/view/render/badges.ts` — the non-rung badge table gains an `improvement` entry, a
`trending-up` icon and the badge class; `styles/badges.css` gains the colour, green, with
the sharing decision recorded there the way every previous one is.

`src/view/manual/typesSection.ts` — an `INTENT` entry, which
`test/view/manualTypes.test.ts` already requires of every `ALL_TYPES` member.

`src/view/manual/sections.ts` — the two AUTHORED sentences that enumerate the category,
in the `+` guidance and the focus guidance, now interpolate `EXTRA_TYPES` instead of
spelling `(Issue, Bug, Idea, Deliverable)`. Found by a review bot on this change, and it
is the gap the generated section hid: the types section covered every type while the two
hand-written parentheses beside it covered four, so the in-app manual would have stated a
complete vocabulary that was one name short. ADR 0031 keeps this directory's prose out of
the catalog and is untouched by that — a derived LIST inside authored prose is not a
message the plugin composes. The guard is asked of the category at the place that can go
stale (`test/view/manualTypes.test.ts`), so re-hardcoding either list fails as soon as the
vocabulary grows. `README.md` carried the same four-name enumeration in four places and is
hand prose, so it was updated by hand.

`docs/README.md`, `scripts/docs-check.mjs` and `test/helpers/register.ts` — `docs/` is
itself a backlog in this schema, so the register's hierarchy table, the checker's `EXTRA`
and `LEGAL_CHILDREN` gate and the fixture that plants a legal tree move together. The
checker holds the table and the gate to each other in both directions, so they cannot be
changed one at a time. This register keeps its own stricter rule: an extra type **here**
states the requirement it concerns, even though the plugin permits a parentless one.

## Verification

`npm run check`. The vocabulary gates fail wherever a name was counted rather than derived,
which is what the badge table's comment claims and is the change's own verification rather
than incidental breakage.

Not verifiable here, as ever: the badge itself — green's third wearer, beside a
`Deliverable` it can be a sibling of. Added to the
[smoke-test checklist](../tests/cases/Smoke%20test%20the%20visual%20changes.md).
