---
type: PBI
parent: "[[Work item hierarchy]]"
order: 80
status: Done
priority: P2
area: feature
created: 2026-08-08
closed: 2026-08-08
source: user request
files:
  - src/domain/settings.ts
  - src/domain/itemTypes.ts
  - src/domain/backlogReadme.ts
  - src/view/render/rows.ts
  - styles/badges.css
started: ""
finished: ""
horizon: ""
start: 2026-08-08
due: 2026-08-08
risk: ""
assignee: ""
iteration: ""
---

# Ideas as a type beside the ladder

**As** someone who has a thought before they have a plan, **I want** to type an item as
`Idea` and hang it at any level of the backlog — or at none — **so that** a thought
raised against an Epic and one raised against a PBI are the same kind of thing, filed
where it occurred to me, without pretending either is a Feature.

An `Idea` is an **extra type**: the category [[Types beside the ladder]] already
defines, whose rank is a property of the TYPE rather than of where it sits. That is what
"lives at every level" means here, and it is the whole reason this is not a fifth rung —
a ladder rule is always "one rung below the parent", and an Idea's position and its
contents are independent.

This is the third name in that category, and the first since it stopped being two.
Nothing about the category changed to admit it; what changed is prose that had counted
on there being two ([[A guide is prose, not an inventory]] is the standing rule, and the
generated README's `Issue and Bug and Idea` is what it reads like when the count is
assumed rather than derived).

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Creating an item under a row, creating one from the toolbar with no row selected, or setting an existing item's type |
| **Preconditions** | None |
| **Guarantee** | An `Idea`'s rank is `EXTRA_TYPE_RANK` wherever it sits, exactly as an `Issue`'s or a `Bug`'s — no drag, reparent or auto-type cascade changes it, whether or not it has a parent. |

**Main flow**

1. The user opens the **+** on an `Epic`, `Feature` or `PBI` row.
2. `childTypeChoices(item)` offers `Idea` beside the ladder's own child, `Issue` and
   `Bug`; `promptCreateItem` asks which, since there is more than one choice.
3. The user names it; the view writes `type`, `parent` and `order`, filing the note in
   the `Idea` folder ([[Where new items are filed]]).
4. The Idea renders with its own icon and colour, ranked as though it were a PBI
   wherever it hangs.
5. Opening **+** on that Idea offers `Task` alone, and asks nothing.

**Extensions**

- **1a — the user instead uses the toolbar's "pick another type" menu, with no row
  selected.** It iterates the whole vocabulary, so `New Idea` appears there the moment
  `Idea` is declared — no code of its own. The note it writes carries no `parent`.
- **2a — the row is a `Task`.** Nothing hangs below a Task; the modal is skipped.
- **2b — the row is itself an `Issue`, `Bug` or `Idea`.** Its only children are Tasks,
  so again nothing is asked.
- **3a — the user drags an existing Idea to a different parent, or to the top level.**
  Its type is left alone: `levelIndex === -1` means "not a rung", as it already does for
  `Issue` and `Bug`.
- **4a — the Idea has no parent at all**, whether created that way or dropped there. It
  stays in the model: a declared type is enough to belong
  ([[Parentless extra type dropped from the model]]).

## Acceptance criteria

- `Idea` joins the fixed vocabulary as an extra type, pinned at `EXTRA_TYPE_RANK`; its
  children are `Task`s under an Epic exactly as under a PBI.
- It is offered under an `Epic`, `Feature` or `PBI`'s own **+** beside `Issue` and `Bug`,
  and by the toolbar's top-level creator and the context menu's `Set type`, both of which
  read the whole vocabulary and needed no change.
- It is never re-typed by a move, whichever parent it lands under or whether it lands
  with none, and a parentless `Idea` is never pruned by `hierarchyOnly`.
- It files into its own folder (`typeFolder.idea`, shipped default `ideas` under the home
  folder), like every other declared type.
- It renders with its own icon and a badge colour distinct from every **other extra
  type's**; the test asserting the badge table covers the whole vocabulary covers it too.
  **Not distinct from every level's, which is what this criterion demanded until
  2026-08-08 and what the shipped styling does not do.** `Idea` wears yellow, shared with
  `Task`, after `Deliverable` landed on the green this note had claimed — the decision and
  its reasoning are in `styles/badges.css` and the paragraph above. A criterion the shipped
  code cannot satisfy is worse on a `Done` note than on an open one: it reads as a
  contract somebody kept.
- The generated README names the extra types in a sentence a third name does not break:
  `Issue`, `Bug` and `Idea`, not `Issue and Bug and Idea`.
- The three rank, pruning and choice criteria above are asked of `EXTRA_TYPES` rather
  than of the name `Idea`, so a fourth name cannot join the category without answering
  them.

## Where it lives

`src/domain/typeVocabulary.ts` — `Idea` joins `EXTRA_TYPES` and `DEFAULT_TYPE_SUBFOLDERS`
gains `idea: 'ideas'`. That is the whole of the behaviour: `ALL_TYPES`, the per-type
folder option in `src/domain/viewOptions.ts`, `childTypeChoices` and `EXTRA_TYPE_RANK` in
`src/domain/itemTypes.ts`, the scope test in `src/domain/model.ts`, the cascade's
exemption in `src/domain/writePlan.ts`, the shelf grouping in `src/domain/shelf.ts`, the
toolbar's creator in `src/view/render/toolbar.ts` and the `Set type` submenu in
`src/view/interactions/menu.ts` are all already generic over the vocabulary.

`src/view/render/rows.ts` — the non-rung badge table gains an `idea` entry (a
`lightbulb` icon and the badge class); `styles/badges.css` gains the colour, green, clear
of the four levels and of pink, red and cyan. `DESIGN.md` had pencilled green in for
`Deliverable`, a type specified and never built, and this takes it: a hue held for
something unbuilt is a hue nothing is wearing. It is also the LAST one — the eight
declared types now wear Obsidian's eight chromatic families, so the Ladder Rule's "adding
a type takes an unclaimed hue" has run out of hues to take. That is
[[The type palette has no unclaimed hue left]], and it blocks a ninth type rather than
this one.

**Both halves of that paragraph were overtaken within the day, and the shipped state is
the opposite of each.** `Deliverable` was not "never built" — it landed on a branch that
could not see this one and reached for the same green, so `Idea` moved to **yellow** and
`Deliverable` kept green. There is therefore no hue "clear of the four levels" here: Idea
shares yellow with Task, which `styles/badges.css` argues for as the smallest available
collision. And the ninth type was not blocked; it shipped, by sharing. The paragraph is
kept because it is what this PBI was decided on, and corrected because
`requirements/` describes the code as it is now.

`src/domain/backlogReadme.ts` — `andList` joins a category's names as English rather than
with ` and ` between every pair. Two sentences in the generated README name a whole
category, and both read as a list only while the category holds two; `Intl.ListFormat` is
the stdlib answer and is out of reach, its typings arriving in `ES2021.Intl` where
`tsconfig.json` sets `lib` to `ES2020`.

## Two things this PBI refused and then had to do

Both were declined as another note's scope, and both came back as a contradiction *this*
change had created. Recorded rather than tidied away, because the reason they came back is
the useful part: a refusal is only safe while nothing else in the same change asserts the
opposite.

**`childTypeChoices(null)` now answers the whole vocabulary.** It was `Epic` plus the
markers — an opinion ("a Bug hangs from something") that nothing enforces and nothing acts
on, since a `+` button needs a row. Its one caller is `parentsOf` in
`domain/backlogReadme.ts`, so the only thing it ever did was tell the README this plugin
writes **into the user's vault** that an extra type must hang from a rung, while
`renderToolbar` was making parentless ones. Declining it was defensible until the repo
README gained "they can also hang from nothing" — then two documents this change touched
disagreed. [[Deliverables as a rootable extra type]] had already reasoned this out and
called it not `Deliverable`-specific; that criterion is satisfied now, ahead of the PBI
that owns it, and every declared type's row carries the root marker correctly.

**`docs-check.mjs`'s `LEGAL_CHILDREN` names `Idea`.** Same shape: the table is the schema
of *this register*, so leaving it was fine until the prose above it in `docs/README.md`
listed `Idea` as attachable to an Epic, a Feature or a PBI. The table now says so too, and
the register keeps its own stricter rule — an `Issue`, `Bug` or `Idea` **here** states the
requirement it concerns, even though the plugin permits a parentless one.

## Verification

`npm run check`. The vocabulary gates caught every place a name had been counted rather
than derived — nine failures across six suites from the one-line change, which is what
the badge table's comment claims and had not been asked since `Milestone`.

Not verifiable here, as ever: the badge itself. Added to the
[smoke-test checklist](../tests/cases/Smoke%20test%20the%20visual%20changes.md).
