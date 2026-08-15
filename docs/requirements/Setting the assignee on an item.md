---
type: PBI
parent: "[[Assignment]]"
order: 10
status: Done
priority: P2
created: 2026-08-10
source: user request
files:
  - src/domain/settings.ts
  - src/domain/vocabulary.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/labels.ts
  - src/view/render/columns.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Setting the assignee on an item

**As** someone running the work rather than only writing it down, **I want** each item to
say who is on it, picked from the names already in this backlog or typed when the name is
new, **so that** "who has this" is answered where the work is instead of in a standup
nobody minuted.

Who exists is not a vocabulary anybody has to declare. That is the one thing this property
does not share with [[Setting the risk on an item]]: risk is a short list the reader writes
down once, while a team is a set that grows by one person at a time and is already
written on the notes. So the menu offers what the RESULTS carry — the same rule the tag
menu follows, over a single value — and `New assignee...` is what makes a name nobody
carries yet reachable. **Has to** rather than **can**, since 2026-08-14: the resources
axis added an optional roster ([[Showing a resources axis on the roadmap]]) and a name
typed into it now leads this menu wherever the menu opens. That widens the list and
changes none of the reasoning above — a roster is a recommendation and an observed name is
still a fact, so nothing declared can hide or overrule one, and the key alone is still
enough to draw the chip. Everything else is machinery this plugin already has: one more of
the optional properties the ✨ button sets up and backfills
([[Backfill missing properties]]), one more menu whose checkmark is asked of the plan,
and one more chip in the property column the base already shows.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Naming an assignee property in the view options, or pressing ✨; then **Set assignee** on a row, or its chip |
| **Preconditions** | The view options are valid; the tree has loaded |
| **Guarantee** | A name is written only to a note the base returned and only to a key the options name; absence is preserved as a value — a note nobody is on carries no assignee key at all, and clearing removes the key rather than blanking it. |

**Main flow**

1. The user names the assignee property (`assigneeProperty`), or presses ✨ and lets this
   view bind the key it suggests — `assignee`, the same key the picker already shows as
   its placeholder. There is no second option beside it: nothing to declare, so nothing
   to clear.
2. ✨ creates that key, empty, on every result that does not carry it. Nobody is assigned
   for the user — the note gains a property Obsidian's own editor can now show and its
   property picker can now offer, which is the loop the button exists to break.
3. The row's context menu carries **Set assignee**, listing every name the base's results
   carry, alphabetically, with the one this item already holds checked.
4. Picking a name writes it to the note's own assignee property, through the one write
   gate, as a single undoable batch.
5. **New assignee...**, under the names, opens a prompt that suggests the same list and
   accepts anything typed. The name is trimmed and written the same way a picked one is.
6. **Clear assignee**, at the foot of the list, removes the key.
7. Where the base shows the assignee property as a column, that cell is a chip: it names
   who is on the item, or invites a name where nobody is, and pressing it opens the very
   list the menu offers.

**Extensions**

- **1a — the assignee property shares a key with another property this view owns.** The
  collision is reported and every write in the view is blocked until it is fixed
  ([[Safe writes]]). The assignee joins that report by name like every other property;
  nothing about it is special-cased.
- **1b — the option was cleared rather than never set.** Turning the property off is a
  decision, so ✨ does not quietly bind it again. Only an option nobody has ever touched
  adopts the suggested key.
- **2a — the note already carries the key.** It is left exactly as it is, value and all.
  The button fills gaps; it never normalises or overwrites.
- **3a — no result names anybody yet.** The menu is still offered, holding
  **New assignee...** alone. This is the one place this property differs from risk, whose
  Set entry is withheld when its declared list is emptied: a submenu opening onto nothing
  is the failure an absent control avoids, and this one can never open onto nothing.
- **3b — the row is an ancestor the base filtered out.** No **Set assignee** at all, and
  its chip is drawn static. A context row renders and parents and is never a write
  target, and the gate refuses the whole batch if a write reaches one anyway.
- **3c — only a context row names somebody.** That name is not offered. An excluded
  note's value is not this base's vocabulary, and offering it would make a name
  assignable to every result because an ancestor nobody can act on happened to use it.
- **3d — the note holds a name no other result carries.** It is offered anyway, so it can
  render checked. A menu that cannot show what the item *is* loses that value on the next
  pick.
- **4a — the name picked is the one the item already holds.** Nothing is planned and
  nothing is written, matched case-insensitively, so a re-pick cannot spend the one undo
  slot on a change nobody made — and the note's own spelling is never tidied.
- **5a — the prompt is submitted blank.** Nothing is written and nothing is closed over:
  the prompt is the way to add a name, not a way to write one nobody typed.
- **6a — the note carries no assignee key.** **Clear assignee** is absent. Every removal
  action in this view is offered on the key's *presence* rather than on its value, so
  none of them can write nothing.
- **7a — the properties menu does not show the property.** No chip, and the menu entry
  stays — the same answer state, risk and horizon already give, for the reason ADR 0023
  records: the plugin cannot write the visible order back, so withholding the write with
  the column would leave the note itself as the only route to the property.

## Acceptance criteria

- An `assigneeProperty` picker appears in the view options under **Progress**, with no
  companion list.
- ✨ binds `assignee` when the option was never touched, and creates that key empty on
  every result lacking it — leaving every existing value untouched.
- **Set assignee** offers the declared roster, then the names the results carry, then the
  item's own — one entry per name in the first spelling of it that appears, matched
  case-insensitively — checks an entry exactly when picking it would write nothing, and
  always carries **New assignee...**. With no roster declared that is exactly the observed
  names, which is what it was before one could be.
- A name typed into the prompt is written trimmed; a blank submission writes nothing.
- Picking a name writes only the assignee key; clearing deletes it; both are one undoable
  batch.
- **Set assignee** is absent when the property is unnamed and on a row the base filtered
  out — and an assignee write aimed at such a row is refused whole.
- The chip is drawn whenever the property is a visible column and the key is named, with
  no vocabulary condition beside it.

## Where it lives

The assignee is a row of the optional-property table in
`src/domain/optionalProperties.ts` — the one statement of "which property does this write target live in" that the pickers, the
collision report, the adoption and the backfill all read. Adding that row is what makes
steps 1 and 2 work with no code of their own, and the resolver now builds every optional
key FROM that table rather than restating the pairing a line at a time. The picker itself
is `src/domain/viewOptions.ts`, in the **Progress** group beside the state and the tags
rather than in a group of its own: one property with no list is not a section.

The vocabulary is `collectObservedAssignees` in `src/domain/vocabulary.ts`, which is where
extension 3c holds rather than at the menu — that module states the "a context row
contributes nothing" rule once for every vocabulary at once. It is no longer the WHOLE
list: `assigneeChoices` merges it with the declared roster and, on the resources axis, with
the rows that axis draws, through `mergedValues` in `src/domain/settings.ts` — the same
first-seen-casing union `horizonMenuValues` already was, generalised to take three sources
rather than two rather than written a second time beside it. The scoping rule stops at the
observed half deliberately, and `assigneeChoices` says why: a roster is one statement the
view options make about this base, not a fact gathered off a population, so there is no
other projection's names for it to leak. What the note itself says is
read into `assigneeValue` by `src/domain/readItems.ts`, the tolerant way the workflow
state and the risk level are read, and carried on the model by `src/domain/model.ts`.

Steps 4 to 6 are `computeAssigneeWrites` in `src/domain/writePlan.ts` — the value, or null
for a removal offered only on presence — applied by `applyLabels` in
`src/storage/frontmatter.ts`, which is now one statement of this module's two standing
rules for BOTH label properties: this was the fourth optional property, and the first one
wanting exactly the risk write's two lines with none of the axis's date handling, which is
the case the root guide said to re-examine at. Its key joins `touchedKeys` in
`src/storage/writeKeys.ts` on the same condition the writer writes on, so a name and its
removal are undoable.

The menu is `src/view/interactions/labels.ts`, which holds both label properties' offers —
the risk levels and the assignee names — because they are one shape differing only in
where the list comes from; `src/view/interactions/menu.ts` keeps the Set entries and the
chip openers over it, so mouse and keyboard reach the identical builder. The prompt behind
**New assignee...** is `ValuePromptModal` in `src/ui/prompts.ts`, generalised from the tag
prompt it was: both ask for one value from a vocabulary this plugin does not own. Step 7's
chip is `renderLabelChip` in `src/view/render/columns.ts`, drawn from a table of the two
label chips rather than a second copy of the risk chip's renderer.

Driven in `test/domain/settings.test.ts`, `test/domain/writePlanProperties.test.ts`,
`test/storage/labelWrites.test.ts`, `test/ui/prompts.test.ts`, `test/view/assignee.test.ts`,
`test/view/columnKinds.test.ts` and `test/view/contextRowWrites.test.ts`, whose write-safety
sweep now drives this chip and both its menu entries too.

What no test here can reach is the appearance: whether the chip reads as a person rather
than a state, and whether the picker sits where a reader looks for it, are live-vault
checks and belong to [[Smoke test the tree]].
