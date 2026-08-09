# Risk management — design

An item can declare a **risk**, read from a frontmatter property the view names, chosen
from a levels vocabulary the view options declare. The property joins the optional
properties the ✨ **Assign missing properties** button sets up and backfills, so adopting
risk on an existing backlog costs a click.

## Why it is nearly free

`domain/settings.ts` already holds one vocabulary for *every* write target beyond
`parent`/`order`/`type`: the `OptionalField` union and the `PROPERTY_TABLE` behind
`OPTIONAL_PROPERTIES`. Five readers consume it through loops rather than switches. Adding
one row therefore buys, with no new branches:

| Reader | What risk gets |
| --- | --- |
| `viewOptions.ts` (`optionalPropertyOption`) | A property picker whose placeholder is the suggested key |
| `configProblems` | A collision report if risk shares a key with another property |
| `adoptableProperties` | ✨ binds `risk` when the option was never touched |
| `readOwnKeys` (`model.ts`) | `item.ownKeys.risk` — presence, so removal actions cannot write nothing |
| `missingKeyStubs` (`writePlan.ts`) | ✨ creates the empty key on every item lacking it |

The last row is the whole of the "added via the note property update button" requirement.
It is satisfied by an existing loop.

## What is built

### `domain/settings.ts`

- `OptionalField` gains `'risk'`; `OptionalSettingsKey` gains `'riskKey'`.
- `PROPERTY_TABLE.risk = { option: 'riskProperty', suggested: 'risk', label: 'risk',
  settingsKey: 'riskKey' }`, declared last so the pickers, the collision wording and the
  stubs read it last.
- `BacklogSettings` gains `riskKey: string` (`''` when no property is named) and
  `riskValues: string[]`.
- `DEFAULT_RISK_VALUES = ['1 - High', '2 - Normal', '3 - Low']`.
- `resolveSettings` reads `riskKey` with `propKey('riskProperty', …)` and `riskValues`
  with `clearable` + `dedupe(list(…))` — a real default that must stay clearable, exactly
  the `horizonValues` rule, since an emptied list has to mean "no levels" rather than
  falling back to the shipped three.
- `hasRiskLevels(settings)`: a named property **and** a non-empty list. One predicate, so
  what the menu offers and what the options declare cannot drift.

### `domain/viewOptions.ts`

A `Risk management` group holding `optionalPropertyOption('risk', 'Risk property')` and a
`riskValues` text option whose default and placeholder are both
`DEFAULT_RISK_VALUES.join(', ')` — the shipped default and the parsed one cannot drift
because `defaultSettings` parses that same list.

### `domain/model.ts`

`RawItem.riskValue: string | null`, read the tolerant way `stateValue` is
(`settings.riskKey ? readString(ownValue(fm, settings.riskKey)) : null`). Phase 1: it is
what one note says about itself, known before any linking.

### `domain/writePlan.ts`

- `ItemWrite.risk?: string | null` — a string sets the level, `null` removes the key.
  Absence is the value that means "nobody has judged this", so a cleared risk deletes the
  key rather than blanking it.
- `computeRiskWrites(item, value)`:
  - a re-pick of the level the item already holds plans nothing, asked through `sameValue`
    (case-insensitive, absence a value) — the same predicate the state and horizon plans
    ask, so the menu's checkmark and the plan cannot disagree;
  - `null` plans a removal only while `item.ownKeys.risk`, so no offered action writes
    nothing.

### `storage/frontmatter.ts`

Risk is the **third** shape of "absence is a value, and an unconfigured key is never
written to". The root `CLAUDE.md` names this moment and says the third property adds a
*statement* of the rule rather than a call, because extracting a helper across the state
key's inline guard and the axis keys' `axisEntries` would be a larger diff than restating
it. So:

- `applyInto`: `write.risk !== undefined && settings.riskKey` → `null` deletes, a string
  goes through `setOwn` (never `fm[key] =`, for the `__proto__` reason).
- `touchedKeys`: the same condition pushes `settings.riskKey`, so applying and capturing
  read one list and the write is undoable.

The root `CLAUDE.md` paragraph is updated to say there are three shapes now.

### `view/interactions/plan.ts`

`addRiskItems(host, menu, item)`, mirroring `addHorizonItems`:

- the declared levels, plus the item's own value when it is on neither list — a menu that
  cannot show what the item *is* loses it on the next pick;
- each entry checked exactly when `computeRiskWrites(item, value).length === 0` — asked of
  the **plan**, never a comparison written beside it, which is the drift that once checked
  `Unplaced` on a note whose key still held something;
- a `Clear risk` entry after a separator, only while `item.ownKeys.risk`.

There is one input, so there is no `performRiskMove` host method: the rule is that a
*second* input calls the first one's method rather than planning beside it, and a single
menu path has nothing to disagree with. `chooseRisk` goes straight through
`host.applySafely`.

### `view/interactions/menu.ts`

`addSetRiskMenu` — a `Set risk` submenu with a `shield-alert` icon — added inside
`buildItemMenu`'s `editable` guard, beside `addSetHorizonMenu`, gated on `hasRiskLevels`.
Being inside that guard is what withholds it from a context row; `applySafely`'s
whole-batch refusal is the structural backstop behind it.

## Decisions taken

- **Cleared levels turn the menu off, not the backfill.** The horizon's stub is skipped on
  an unconfigured axis because writing its key would be the one write on an axis nothing
  else acknowledges. Risk has no projection to be incoherent with: a named risk property
  with no declared levels is still a legitimate free-text property, and creating its key is
  exactly what the button is for. So `missingKeyStubs` needs no risk-specific test — the
  `optionalKeyFor(...) === ''` line already covers it.
- **No risk column.** A chip column would enter the responsive column-fit budget
  (`columnFit` sums every column a row can carry; one drawn but not summed overflows rather
  than dropping) and cost a stylesheet partial. The menu makes the levels pickable, which
  is what the levels were for.
- **The levels are declared-only, not declared ∪ observed.** The horizon takes the union
  because an undeclared horizon is a bucket a drag can already drop into — a reachability
  argument that needs a projection. Risk has none, so the vocabulary is the declared list,
  with the item's own value appended for the checkmark. That is `stateMenuValues`'s
  configured-list arm without the observed fallback.
- **Risk is not a rollup and not a filter.** A parent does not inherit or aggregate its
  children's risk. Nothing asked for it, and a rolled-up risk is a judgement the plugin
  would be making on the user's behalf.

## Register

- New Feature `docs/requirements/Risk management.md`, parent `[[Product Backlog]]`, order
  45 — between `Progress tracking` (40) and `Finding work` (50), which is where an item
  attribute read off a property belongs.
- New PBI `docs/requirements/Setting an item's risk.md` under it, in the enforced use-case
  shape. It carries `riskProperty` and `riskValues` in **code spans**:
  `test/docs/surfaces.test.ts` requires every key `getViewOptions()` produces to be named
  by a requirement, matched whole and inside a code span.
- `docs/requirements/Backfill missing properties.md` main flow step 2 **enumerates** the
  optional properties ("the state, the two date stamps, and the roadmap's horizon and
  dates"). That sentence goes stale the moment risk joins them, so it is updated in the
  same change.

No new module in `src/`, so `docs-check.mjs` rule 7 needs nothing beyond the paths the new
PBI's `## Where it lives` names.

## Tests

| Where | What |
| --- | --- |
| `test/domain/settings.test.ts` | `riskKey` resolution, `riskValues` default, dedupe, and the cleared-list case meaning no levels |
| `test/domain/writePlan.test.ts` | `computeRiskWrites`: sets, re-pick plans nothing, `null` removes only on presence |
| `test/storage/frontmatter.test.ts` | the key is written, removed, never written when unconfigured, and its inverse restores |
| `test/view/…` (menu) | `Set risk` offers the declared levels, checks the current one, appends an unlisted value, and shows `Clear risk` only on presence |
| `test/view/contextRowWrites.test.ts` | a context row is offered no `Set risk`, and a risk write aimed at one is refused whole |
| `test/docs/surfaces.test.ts` | passes with the two new option keys named by the new PBI |

Coverage thresholds in `vitest.config.mts` only ever go up; `npm run check` is the gate.

## What this cannot verify here

Obsidian does not run in CI. What the property picker looks like in the view-options menu,
and whether the `Set risk` submenu opens where a reader expects, are live-vault checks —
`npm run test-build` and the `Feature Test` epic's smoke lists.
