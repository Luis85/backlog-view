---
type: PBI
parent: "[[Risk management]]"
order: 10
status: Done
priority: P2
created: 2026-08-08
source: user request
files:
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
  - src/domain/writePlan.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/menu.ts
started: ""
finished: ""
horizon: ""
start: 2026-08-08
due: 2026-08-09
risk: ""
assignee: ""
iteration: ""
---

# Setting the risk on an item

**As** someone answerable for a plan, **I want** each item to carry a risk level from a
short list I declare, **so that** the thing most likely to go wrong is written down where
the work is, rather than in a spreadsheet nobody opens.

Risk is a judgement, not a measurement, so the vocabulary is the reader's: a property
this view names and an ordered list of levels, shipped prefilled with the numbered
High/Normal/Low triple because risk is read as a ranking far more often than as a label.
Everything else is machinery this plugin already has — risk is one more of the optional
properties the ✨ button sets up and backfills ([[Backfill missing properties]]), and one
more menu whose checkmark is asked of the plan rather than of a comparison beside it.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Naming a risk property in the view options, or pressing ✨; then **Set risk** on a row |
| **Preconditions** | The view options are valid; the tree has loaded |
| **Guarantee** | A risk is written only to a note the base returned and only to a key the options name; absence is preserved as a value — a note nobody has judged carries no risk key at all, and clearing removes the key rather than blanking it. |

**Main flow**

1. The user names the risk property (`riskProperty`), or presses ✨ and lets this view
   bind the key it suggests — `risk`, the same key the picker already shows as its
   placeholder.
2. The levels option (`riskValues`) ships prefilled with `1 - High, 2 - Normal, 3 - Low`
   and stays editable: a default vocabulary, not a fixed one.
3. ✨ creates that key, empty, on every result that does not carry it. Nothing is judged
   for the user — the note gains a property Obsidian's own editor can now show and its
   property picker can now offer, which is the loop the button exists to break.
4. The row's context menu carries **Set risk**, listing the declared levels with the one
   the item already holds checked.
5. Picking a level writes it to the note's own risk property, through the one write gate,
   as a single undoable batch.
6. **Clear risk**, at the foot of the same list, removes the key.

**Extensions**

- **1a — the risk property shares a key with another property this view owns.** The
  collision is reported and every write in the view is blocked until it is fixed
  ([[Safe writes]]). Risk joins that report by name like every other property; nothing
  about it is special-cased.
- **1b — the option was cleared rather than never set.** Turning the property off is a
  decision, so ✨ does not quietly bind it again. Only an option nobody has ever touched
  adopts the suggested key.
- **2a — the levels list is emptied.** The **Set risk** menu is absent rather than
  inert — a submenu opening onto nothing is the failure an absent control avoids — but
  the property is still backfilled and still editable in Obsidian's own property editor.
  This is deliberately unlike the horizon axis, whose key is *not* stubbed when its
  values are cleared: that key would be the one write on an axis nothing else
  acknowledges, and risk has no projection to be incoherent with.
- **3a — the note already carries the key.** It is left exactly as it is, value and all.
  The button fills gaps; it never normalises, re-judges or overwrites.
- **4a — the row is an ancestor the base filtered out.** No **Set risk** at all. A
  context row renders and parents and is never a write target, and the gate refuses the
  whole batch if a write reaches one anyway.
- **4b — the note holds a level the declared list does not name.** It is appended to the
  end of the list so it can render checked. A menu that cannot show what the item *is*
  loses that value on the next pick.
- **4c — the note carries the key with nothing in it**, the state ✨ leaves behind. No
  entry is checked, and no nameless entry is added to the list: an empty value is not a
  level anybody chose, and **Clear risk** is already the entry that deals with it.
- **5a — the level picked is the one the item already holds.** Nothing is planned and
  nothing is written, matched case-insensitively, so a re-pick cannot spend the one undo
  slot on a change nobody made.
- **6a — the note carries no risk key.** **Clear risk** is absent. Every removal action
  in this view is offered on the key's *presence* rather than on its value, so none of
  them can write nothing.

## Acceptance criteria

- A `riskProperty` picker and a `riskValues` list appear in the view options under **Risk
  management**; the list ships holding `1 - High, 2 - Normal, 3 - Low` and can be emptied.
- ✨ binds `risk` when the option was never touched, and creates that key empty on every
  result lacking it — leaving every existing value untouched.
- **Set risk** offers exactly the declared levels plus the item's own unlisted value, and
  checks an entry exactly when picking it would write nothing.
- Picking a level writes only the risk key; clearing deletes it; both are one undoable
  batch.
- **Set risk** is absent when the property is unnamed, when the levels are cleared, and on
  a row the base filtered out — and a risk write aimed at such a row is refused whole.

## Where it lives

Risk is a row of the optional-property table in `src/domain/optionalProperties.ts` —
the one statement of "which property does this write target live in" that the pickers, the
collision report, the adoption and the backfill all read. Adding that row is what makes
steps 1 and 3 work with no code of their own: `adoptableProperties` binds the suggestion,
`configProblems` reports its collisions, `readOwnKeys` in `src/domain/model.ts` tracks
whether the note carries the key, and `missingKeyStubs` in `src/domain/writePlan.ts`
stubs it. `hasRiskLevels` beside them is the pair from steps 1 and 2 asked once, so what
the menu offers and what the options declare cannot drift.

The **Risk management** option group is `src/domain/viewOptions.ts`, and the level the
note declares is read into `riskValue` by `src/domain/model.ts`, the tolerant way the
workflow state is read.

Steps 5 and 6 are `computeRiskWrites` in `src/domain/writePlan.ts` — the value, or null
for a removal that is offered only on presence — applied by `applyLabels` in
`src/storage/frontmatter.ts`, which states this module's two standing rules — never a key
no property names, and a null removes rather than blanks — once for risk and the assignee
together, having been `applyRisk`'s third restatement of them until the fourth optional
property made a shared one cheaper. What the menu
OFFERS moved to `src/view/interactions/labels.ts` when the assignee arrived
([[Setting the assignee on an item]]) — one shape for both label properties, differing
only in where the list comes from — while `src/view/interactions/menu.ts` keeps the
**Set risk** entry beside **Set state** rather than with the roadmap's placement actions,
because risk is an attribute of the item and not a position on an axis.

Driven in `test/domain/settings.test.ts`, `test/domain/writePlan.test.ts`,
`test/storage/frontmatter.test.ts`, `test/view/risk.test.ts` and
`test/view/contextRowWrites.test.ts`.

What no test here can reach is the appearance: whether the group reads well in the
view-options menu and whether the submenu opens where a reader expects are live-vault
checks, and belong to [[Smoke test the tree]].
