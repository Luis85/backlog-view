# domain/ — the backlog itself

Tree shape, ranking, levels, scope. Reads the vault, never writes it, never touches the
DOM — enforced by `no-restricted-imports` in `eslint.config.mjs`. The rules below are
the ones that bite when changing anything here; the cross-cutting context-row rule lives
in the root `CLAUDE.md` because it spans every layer.

## Cost

`buildModel` is rebuilt WHOLE on every data update — including the refresh that ends every
write batch, so this is paid on each move and not only when the vault changes underneath.
Its phases are a fixed list of passes over the item set: `createItems`, `linkAll`,
`breakCycles`, the scope prune, two vocabulary collections, `sortSiblingsDeep`,
`assignAll`. `sortSiblingsDeep` is the one deliberately superlinear step — comparison
sorting is the right tool for ranking siblings — so the bound is **O(n log n)**, and what
must not appear is a *second* superlinear step beside it.

Two of those properties are checks (`test/domain/modelCost.test.ts`) and the rest of the
paragraph above is prose. Checked: the vault is read **once per note loaded** — `addItem`
holds the only `getFileCache` call site in this layer, so a later phase re-reading the
cache per item shows up as n² — and **every item is sorted exactly once**, the sum of the
sibling groups `sortSiblingsDeep` sorts equalling the item count, so a phase that
re-sorts or a sort that moves into a per-item path fails. Not checked, and deliberately
not claimed: a traversal phase that turned quadratic without reading the vault again or
sorting again. Nothing observes a walk from outside `buildModel`, and inventing a seam to
count one would be a seam built for the test. Nothing here measures elapsed time either;
a node test that did would be measuring the runner.

## Rules

- The model is built in three phases and **each has its own type**: `RawItem` (what one
  note says about itself) → `LinkedItem` (+ `parent`, `children`, `orphan`, once the tree
  is resolved) → `BacklogItem` (+ levels, depth, `focusRoot`, rollups). A field exists
  only once the phase that owns it has run, so a signature states which fields are real
  and the compiler enforces it — this used to be ten placeholder values in `addItem` and
  a request that readers remember. Only `BacklogItem` leaves this module, so nothing
  downstream knows the difference. **Adding a field means choosing its phase**, which is
  the question that was easy to skip before.
  Promotion is an in-place assertion in `linkAll` and `assignAll`, each followed
  immediately by the loop that fills every field it claims: the graph is cyclic, so a
  phase cannot rebuild its items without rebuilding every reference to them. Those two
  lines are the whole unsafety, and they are why the phases are worth having anyway —
  the alternative is that same unsafety spread across ten fields and every reader.
- The two dependency fields answer that question this way: the raw entries a note
  declares (`dependsOnEntries`) belong to `RawItem`, because they are what one note says
  about itself and because `addItem` holds the one cache read here — gated on the same
  `entry === null` test `outsideFilter` is made of, so a CONTEXT row carries an empty list
  rather than one the derivation discards. That rule (an excluded note may be named and
  may never do the naming) was kept downstream first, by `declaredEdges` skipping the
  item: true, but it left the list parsed and every entry resolved through the metadata
  cache on every rebuild, and left a test whose comment said "not read at all" while
  checking only that no edge came out. Both guards stay — the reader's states the rule
  where the reading happens, the derivation's states it over its own generic input, which
  is not always this model's. What they MEAN —
  `prerequisites` and `brokenPrerequisites` — belongs to `BacklogItem`, assigned by
  `assignDependencies` after `assignAll`. Later than the promotion rather than inside it,
  and the reason is the scope prune: an entry may only resolve against the set the model
  KEEPS, so a pass run at `linkAll` would resolve edges to notes that leave a phase later.
  Nothing about an item's place in the tree depends on either field, which is what makes a
  pass after the last phase legitimate rather than a fourth phase nobody typed.
- Config property ids are `note.`-prefixed (`note.parent`); frontmatter keys are not.
  `resolveSettings` strips the prefix.
- Tag identity is case-insensitive and lives in `noteFields.ts` (`tagKey`, `hasTag`):
  every dedupe, membership test and delta comparison goes through it rather than
  spelling `toLowerCase()` again. `normalizeTag` is the write-side inverse of
  `readTags` and lives beside it, and `applyTagDelta` runs it at the write boundary —
  so "every tag on disk is one Obsidian will read" is a property of the writer, not of
  whichever caller remembered. Letters, digits and **combining marks** all survive it;
  excluding marks corrupts every script that spells a letter with them.
- `tagsKey` is the one property option whose default is a real key, so `resolveSettings`
  tells "never set" from "cleared" (`clearablePropKey`): without that the option could
  not be turned off, since `getAsPropertyId` reports both as null. It is also the only
  key that *yields*: one already used by parent, order, type or state resolves to '',
  because the tags column is skipped in that configuration anyway. That is why
  `configProblems` does not list it — a collision report would gate every write in a
  base whose state property is `tags`, which was a working view before this option
  existed.
- `depth` is VISUAL only (focus mode re-roots it). Level math must use
  `effectiveLevelIndex`, which chains down the parent levels and carries unknown
  custom types through the ladder (see `childLevelIndex`). Never derive levels
  from depth — now a lint rule (`VISUAL_DEPTH`) over the two files that decide
  types (`writePlan.ts` and `interactions/create.ts`), since `rows.ts` legitimately reads
  depth for `aria-level`. `nextLevelIndex` is the one statement of "a child sits one rung
  below, clamped at the deepest level" and `childLevelIndex` is it applied to an item;
  both are what a type write asks, and neither has ever been allowed to ask depth. The
  last exception was the re-typing cascade, deleted 2026-08-11 with the feature it
  belonged to ([[Assigning type on a move]]) — and the argument that ended it is worth
  keeping, because it is the argument for the rule and not for that code: chaining is
  *provably* what the depth arithmetic it replaced computed
  (`min(min(x+1,L)+1,L) = min(x+2,L)`), so switching cost no behaviour and bought a
  reading that survives focus mode re-rooting a row.
- `model.roots` is the PLAN's rendered forest (synthetic under focus, and re-rooted past
  any catalog member); every data operation (backfill, ranking parentless items,
  root-level outdent) must use `model.realRoots`. That rule stopped being advice the day a
  second projection existed: an `order` is a number scoped to the notes sharing a parent,
  and a `Test suite` and an `Epic` share the null one, so ranking against one projection's
  slice of that group takes a midpoint a hidden root may already hold. Three lists, and
  conflating any two breaks something — the RENDERED roots (what is on screen), the
  POSITIONABLE roots (what a move at the top level MEANS, which is a question about the
  screen), and the RANKING group (`realRoots`, what number it gets), which is not a
  projection's list at all and which no projection may narrow.
  Checked by lint in `writePlan.ts` and `interactions/create.ts` — the two files that
  rank. The two files that POSITION at the top level hold both lists at once and must not
  let either answer the other's question: `dropTargets.ts` ranks against `realRoots` while
  asking its no-op question of the drawn order through the `member` predicate the view
  hands it, and `structure.ts` ranks a root-level outdent the same way. That split is the
  subtlety worth reading twice before editing.
- Focus mode: the top row is a synthetic grouping — `focusRoot` items keep their real
  `parent` pointer, and reordering/outdent/indent across that row must stay disabled.
- **A move never writes a `type`, at any depth** — a drop, an indent, an outdent,
  Alt+arrow and both parent-link menu entries write the parent and the rank and nothing
  else. A type is what the note declares, what `Set type` wrote, or what the backfill put
  on a note that carried NONE; a note that already has one is never re-typed by anything
  positional. That is why an unknown custom name is safe here: it is deliberate user data
  and no walk is looking at it. A cascade that did rewrite it existed until 2026-08-11 and
  was removed rather than repaired ([[Assigning type on a move]]) — it was the one write
  path that did not ask `keepsProjection`, and it carried an asymmetry nobody chose
  ([[The dragged item is retyped, its descendants are not]]). If one is ever built again,
  the rule to keep is the one it broke: what a move may not do is take a row out of the
  projection it was moved on.
- **There are TWO ladders**, and every rule that reads a rung asks `ladderFor` which one
  first. `LEVELS` is the plan's and `TEST_LEVELS` is the test catalog's, and they **share
  their deepest rung** — `Task` is a rung of both. That sharing is the load-bearing
  choice, not a coincidence: it turns three separately-argued rules into consequences of
  the structure. A typeless child of a `Test suite` is a `Test case` by plain
  `childLevelIndex` clamping on the right ladder; *a `Task` takes its parent's projection
  and every other type takes its own* IS the ladder chain, so catalog membership needs no
  exception for one type; and a `Task` whose `Test case` parent is not in the model has no
  parent ladder to chain from, so it falls to the plan with nothing read to find out.
  `ladderFor` chains from the parent for exactly two inputs — `Task` and a note with no
  `type` — and answers from the NAME for every other, including a name **neither** ladder
  holds. That last clause is the one to keep: written as "fall through to the parent" it
  sweeps an extra type, a marker or a custom name beneath a `Test case` into the catalog,
  where the register says it is plan work in the wrong place. `inCatalog` is the whole
  membership predicate, read from both directions, so the two projections cannot both
  claim a row or both disown one — and because it asks the LADDER it asks the effective
  type, which is what makes a typeless child of a suite a member. **Nothing crosses
  between them**, and that rule now lives in exactly one place: `keepsProjection`, asked by
  every reparenting gate, which WITHHOLDS the move for the two rows that read their ladder
  from where they hang — a `Task` and a note with no `type`. Every other name answers from
  itself and can never change ladder by moving, so a `Test case` hand-dropped onto a `PBI`
  stays a `Test case`: a legal row in an odd place, drawn as a root of its own projection.
  A second statement of the same rule used to sit inside the re-typing cascade, unchecked,
  and deleting the cascade is what removed it (2026-08-11).
  **An item's workflow follows its type, or its ladder** — the rule the second ladder added
  to the first. There are three workflows (requirements, Deliverable, test), and the two
  secondary selectors are **disjoint by construction** rather than ordered:
  `isDeliverableType` asks a type NAME and `inCatalog` asks the ladder, while `ladderFor`
  answers `LEVELS` for `Deliverable` whatever it hangs under, so no item satisfies both and
  the three-way branch needs no argument about which is tested first. `inCatalog` and not a
  list of test type names, for the reason above: a typeless child of a `Test suite` and a
  `Task` under a `Test case` are both members, and `isTestType(item.typeName)` gets both
  wrong while passing every other fixture. Two things are stated ONCE, both in `board.ts`:
  the KEY (`stateKeyFor`) and the value-and-done pair (`ownWorkflowReading`). **What that
  bought, exactly** — because "everything followed for free" is the flattering version and
  it is false: `pbl-done` on a tree row (`render/rows.ts`) and the state CHIP's own reading
  (`renderStateChip`) took the third workflow with no edit at all, while `Set state`'s
  OFFERS and its CHECKMARKS each needed their own branch in `view/interactions/menu.ts`
  (`deliverableOrTestValues`, and `stateWrites`), because each
  workflow's write goes through a different planner — which PLANNER a pick runs is a third
  selection over the same two predicates, and it is stated there rather than here.
  `columnKind` (`render/columns.ts`) needed a line too, or the chip that reads correctly
  would have had no column to draw into.
- **A projection's forest is computed, never filtered** — `projectionForest`, beside
  `collectFocusRoots`, asked twice with opposite predicates. `renderForest` drops a hidden
  sibling *without descending through it*, so hiding rows loses everything under a hidden
  parent: a `Test case` mis-dragged under a `PBI` is a root of the catalog and a hidden
  child of the plan, and the `PBI` under a `Test case` is the mirror. One function both
  ways, so the two directions cannot be argued separately and disagree. It marks a
  promoted root `focusRoot` — the same category, so the four call sites that already
  refuse to rank or reparent one need no edit — and it assigns depth by walking MEMBERS
  ONLY. That last part is not a detail: both projections walk the same objects, so a walk
  following every child has the plan's descent reach a promoted row through its excluded
  parent and stamp the depth the catalog had just corrected. `model.catalog` is read off
  the whole UNFOCUSED tree beside `deliverableResults`, for that field's own reason.
- The vocabulary is **fixed**: `LEVELS`, `TEST_LEVELS` and `EXTRA_TYPES` in
  `typeVocabulary.ts` are constants,
  not options. Making them configurable cost collision rules between the two lists, a
  "what folder does a name nobody chose get" question with no good answer, and a schema
  that had to be generated per view; what it bought was a rename. Being opinionated
  deletes all of that. What it does NOT buy any more is "one list to hold for", which this
  bullet claimed until the test catalog: there are two ladders, both fixed, and a level
  rule holds for whichever `ladderFor` names. A note typed something else is still handled
  — it keeps its name and carries the ladder through, the `Bugfix` case below.
- **Extra types** (`EXTRA_TYPES` — `Issue`, `Bug` and `Idea`) are declared types that are
  NOT rungs — `itemTypes.ts` owns them. The ladder cannot express "a Bug holds Tasks
  wherever it hangs", because every ladder rule is "one rung below the parent", so an
  extra type's rank is a property of the TYPE: `EXTRA_TYPE_RANK` (the rung whose children
  are the deepest level), pinned, never inherited. Everything else follows from that plus
  `levelIndex === -1`: its children imply the deepest level under an Epic as under a PBI,
  wherever the Bug itself hangs, so anything walking a subtree to hand out rungs has to
  descend from the extra rank rather than from the position the item inherited — the
  failure that rule prevents is a Bug left correctly untouched with its Tasks silently
  rewritten to PBIs. The contrast that keeps this honest: an UNKNOWN custom type still
  takes `childSlot`, so it continues the ladder (Feature > Bugfix > implied Task).
  Declared pins, undeclared inherits.
  `collectFocusRoots` has to know about them too — an extra type has no `levelIndex` to
  match, so focusing its rank would otherwise make it vanish rather than rank beside the
  level it sits level with. Nothing is enforced: `childTypeChoices` decides what is
  OFFERED, and a drag may still put a Bug anywhere, exactly as the ladder has always
  guided rather than refused.
- A **marker** (`MARKER_TYPES`, `Milestone`) is the third category, and the inverse of an
  extra type on all three counts: no rung, no children, no parent — `isMarkerType` is a
  second predicate rather than a widened `isExtraType`, because the two answer opposite
  questions. Three consequences follow, each stated once where it holds for every quantity
  the walk gathers rather than at a call site: it is never counted and never dated evidence
  (the `self` line in `assignAll`, beside the context-row skip it resembles), and any walk
  that hands out rungs must STOP at one rather than guess — a marker supplies no rank to
  descend from, exactly as a row the Base excluded supplies none, which is why the two
  belong in one predicate wherever such a walk exists. The walk that had one
  (`outsideFilter || isMarkerType`) went with the re-typing cascade on 2026-08-11; the
  shape is recorded because the next such walk needs it, not because one is live.
  A fourth, added 2026-08-09 and the same shape again: **a marker DECLARES no
  prerequisites.** A point in time waits for nothing, so `readItems` reads a marker's
  dependency list as empty — beside the `outsideFilter` gate it already sits next to — and
  every consequence falls out of that one reading at once: no edges out, no conflict ever
  computed for it, nothing of its in `declaredMap`, no candidate list, and so never a legal
  drop target, since dropping ONTO a bar is what makes that bar wait. What is deliberately
  NOT symmetric is the other direction: a marker may still be waited FOR, because that is
  the other note's declaration and this rule is about a marker's own. Which is why a marker
  keeps its connector — dragging FROM it is how another bar comes to wait on it.
- Each type's folder is **its own option** (`typeFolder.<lowercased type>`), one per type
  in the fixed vocabulary, so a folder is picked rather than spelled into a mapping.
  `typeFolderKey` is shared by the schema and the resolver, because a persisted key
  spelled twice is a key that can differ.
  Type folders rank ahead of `homeFolder` and inference but behind folder mode's
  "beside the parent's folder note" rule — that mode makes folders the hierarchy, and a
  filing default must not quietly overrule an opt-in structural mode. Two consequences
  to know before debugging them: with every type mapped (the shipped default), inference
  and the folder prompt never run unless the folders are cleared, which is why several
  creation tests clear both layers; and because the folder depends on the chosen type,
  and the type is chosen INSIDE the modal, the prompt's detail line is a function of the
  type rather than a string. `baseFileContent` writes every one of these keys under the
  folder it scaffolds — the type folders outrank the home folder, so writing the home
  folder alone would still file the first Bug outside the filter just written for it.
- Options whose default is a REAL value need `clearable` (or `clearablePropKey` for
  property ids): `config.get` reports "never set" and "cleared" identically, so without
  it the home folder, the extra types and the type folders could never be turned off.
- Scope (`settings.hierarchyOnly`, on by default): a base filtered by folder returns
  every note living there, so `pruneOutsideHierarchy` drops the ones that are not work
  items — a note belongs when it has a *supported* type (matching a level or an extra type) or
  a parent (explicit, empty-marker, folder-inferred, or unresolvable). "Supported" means
  every DECLARED type — `allTypeChoices`, levels AND extra types — because an extra type
  is a work item by the same argument a level is; reading only the ladder dropped a
  parentless Bug out of the model, the note vanishing moments after being typed. The test runs per
  root subtree, so one participant keeps the whole component (untyped children, untyped
  containers of typed items). Pruned notes leave `model.byPath`/`items` entirely, so
  backfill and rollups never see them; `model.ignoredCount` carries the number for the
  toolbar advisory and the empty state. Turning the option off restores "every note is
  an item" — the fixture opt-out (`unscoped`) in the tests.
- Every input that changes a state plans through `computeStateWrites` — a drop,
  Alt+arrow, the board's Set state and the tree's. Not a tidiness rule: the date stamps
  ride that plan, so a path that planned its own `{file, state}` would record a history
  whose holes depended on which projection the user happened to be looking at. It stays
  pure by taking the date as an argument; the clock is read once, in `todayStamp`
  (`noteFields.ts`), from LOCAL date parts — `toISOString` stamps an evening transition
  as tomorrow for everyone west of Greenwich.
- The stamps ask about a state VALUE, not an item (`isStartedValue`, `isDoneValue`):
  the state being written is one no item holds yet. The plan answers only what it can
  know for certain — the state the user PICKED. Whether that crosses the done boundary
  depends on the state being left, which only the note knows, so the plan carries
  `finish: {date, toDone}` and `storage/` decides. `startedStates` empty means NOTHING
  counts as started — a first column is a backlog as often as it is a start, and a
  guessed default would date work nobody began. Both stamp keys join `configProblems`,
  and the RESOLVED `tagsKey` joins it with them: it has already yielded to the four it
  could collide with, so the only collision it can now report is a stamp aimed at the
  tags property — the case the yielding rule never covered.
- `model.results` is the Base's own rows and `model.items` is everything rendered.
  Anything answering "what is in this base" takes `results`; only rendering, navigation
  and collapse state take `items`.
- Outside-filter ancestors (`settings.showOutsideParents`, on by default): the Bases query
  returns matches without their parents, which would flatten the tree, so `loadOutsideParents`
  walks each item's parent chain through the *metadata cache* and adds the missing notes with
  `entry: null` and `outsideFilter: true`. They are context, not results: no Bases row (so no
  property chips), not draggable, excluded from every ranking path (`siblingPosition`,
  `siblingContext`, `outdent`, the move menu) because their real siblings were never loaded,
  and skipped by `computeInitWrites`. They ARE valid drop parents and can take new children.
  Their rollups describe the visible subtree only. `entry` is nullable for exactly this
  reason — anything reading `item.entry` must handle null, which the compiler enforces.
  The seed for the walk is `outsideParentSeed`, which mirrors `linkAll`'s precedence
  (explicit link, else the nearest folder note *in the vault* when `folderHierarchy` is on)
  — seeding from explicit links alone leaves filtered folder hierarchies flat, since
  inference only ever looks in `byPath`.
- `outsideParentSeed` is resolved for every item even when `showOutsideParents` is off: it
  is also the evidence (`item.parentExists`) that a note is anchored in the hierarchy.
  Without it `hierarchyOnly` prunes a folder-inferred Base result whose folder note simply
  wasn't loaded — dropping a row the query explicitly returned. Only the *loading* of the
  ancestors is gated by the option.
- An `outsideFilter` row is NOT always an ancestor: a filter that returns an Epic and its
  PBI but not the Feature between them loads that Feature as context *below* a result, so
  any subtree walk can meet one, above a result and below it alike. A walk that writes
  must therefore skip such a row's whole BRANCH rather than step over the row and carry
  on: half-updating a subtree past a note that may not be written to leaves the tree worse
  than not touching it.
- Renumbering rewrites a whole sibling group, so `computeDropWrites` refuses that path
  when the group holds an `outsideFilter` row and places the item after the highest known
  order instead (`afterHighestKnown`) — the single choke point that makes the context-row
  invariant hold. Because that fallback lands the item last, the *positional* operations
  refuse such a group up front instead of landing somewhere other than aimed:
  `siblingPosition` (before/after drops), `canReorder` (the move menu, Alt+arrow) and
  `outdentTarget`. Appends — dropping *into* a parent, indent — stay
  available, since last is what they mean anyway. Gate each command on what it actually
  does: `canReorder` covers only the four move commands, while Indent follows its
  neighbour and Outdent answers for its own destination — gating those on `canReorder`
  too would make the menu offer less than Alt+arrow already allows.
- Orders are sibling-scoped fractional ranks; when a gap `< MIN_GAP` the whole sibling
  group renumbers. Missing orders sort last, in Bases result order (`entryIndex`) —
  `data.data` arrives presorted by the user's Bases sort config, so never re-sort it.
- Known limitation, not specific to context rows: in a filtered base any parent whose
  children are partly excluded has a partial `children` list, so `insidePosition` +
  `computeInsertOrder` can compute an order that duplicates an excluded sibling's. Equal
  orders fall back to `entryIndex` and the group self-corrects on the next renumbering
  drop. Fixing it properly needs the complete child set (backlinks + folder scan), which
  `computeDropWrites` cannot reach without giving up its purity. Recorded in
  `docs/issues/Duplicate orders in a partially filtered group.md`.
- `breakCycles` re-roots `cycleEntry(item)`, the node that actually closes the loop, not the
  first unreachable item found: with outside-filter ancestors the unreachable item is usually
  a healthy match hanging below a cycle, and re-rooting it would strand a valid parent link.
- Orphans (`parent === null && hasParentValue`): never backfill their type; dropping them
  at top level MUST clear the stale link (`clearsStaleLink`), even position-unchanged.
- Folder mode (`settings.folderHierarchy`): explicit links beat folder-note inference;
  parent-clearing writes `parent: ''` (`explicitRoot`) instead of deleting the key,
  because a deleted key re-infers on the next build. Files are never moved on disk.
  `ItemWrite.removeParentKey` is the deliberate opposite: delete the key to hand the
  item back to folder inference ("Use folder position", "Clear parent link").
- A type belongs with the code that *produces* it, not the code that consumes it — that is
  why `DropTarget` and `DropZone` live in `dropTargets.ts` rather than with the writer and
  the view that read them. Both used to sit upstream and made this layer depend on the
  effectful one.
- The roadmap's axis is DECLARED, never detected (`roadmap.ts`): a horizon property with
  a non-empty values list makes the bucket axis, either date property makes the timeline,
  and no property is ever picked by name-matching — nor is a date ever read as a horizon.
  `activeAxis` honors a retained pick only while its axis is configured; the pick itself
  is the caller's to keep, never rewritten by falling back.
- The roadmap's placement properties are written like the state property and planned
  like every other change: `computeHorizonWrites` / `computeScheduleWrites` produce an
  `AxisWrite`, where **null means remove the key** (absence is the value that means
  untriaged or unscheduled) and no value is ever `''` — creating a key without placing
  anything is a different write, `ItemWrite.stubs`, and it is the only thing the
  backfill can do here without inventing a plan. A re-pick of the horizon an item already
  holds plans nothing, case-insensitively. **The dated axis no longer asks that here**:
  `computeScheduleWrites` states what was requested and claims nothing about what the note
  holds — not whether a date is already stated, not whether a key is there to remove —
  because both are questions about the note RIGHT NOW and the row that planned the write
  can be a refresh behind it. Deciding from the model dropped a request the note actually
  needed and omitted a removal for a key an editor had just added. The writer answers both,
  against the live value, and re-confirming `2026-8-1` still must not rewrite it as
  `2026-08-01` — that comparison moved with the decision rather than going away. The
  horizon axis keeps its model-time check; moving it is not this increment's.
- **The configuration is four modules and the dependencies run one way** (ADR 0026):
  `typeVocabulary.ts` (the fixed type names, `byName`, where a type's notes are filed) is a
  leaf; `settings.ts` is the SHAPE and imports it; `optionalProperties.ts` (the table that
  grows a row per feature) and `settingsResolve.ts` (the only module that touches
  `BasesViewConfig`) sit above the shape and are never imported by it. `configProblems`
  lives with `settingsInconsistency` in `settingsConsistency.ts`, because a collision report
  and a fixture check are the same question — is this combination coherent — asked of the
  two different producers. Put a new piece in the wrong one and `npm run analyze` fails on
  the cycle, which is what makes this checked rather than remembered.
- **Every write target beyond `parent`/`order`/`type` is one vocabulary**, declared once
  in `optionalProperties.ts`: `OptionalField` and the `PROPERTY_TABLE` behind
  `OPTIONAL_PROPERTIES`, which carries per field the option that names it, the key it
  suggests, and the label a collision reports it by. Five readers depend on that being
  one statement — the view options' pickers (whose placeholder IS the suggestion),
  `optionalKeyFor` (the single field → key mapping the planner, the writer, the model's
  presence test and the backfill all share), `configProblems`, `adoptableProperties`,
  and the backfill's stubs. The table is keyed by field so the compiler catches a field
  the union declares and nobody described; `AxisField` is a narrower type over the same
  keys, not a second vocabulary.
- Adoption (`adoptableProperties`) asks the **config**, not the settings: cleared and
  never-set resolve identically, and only never-set may adopt a default — turning a
  property off is a decision. It also refuses a suggestion whose key another property
  owns, since binding it would report as a collision and block every write in the view.
- `item.ownKeys` is PRESENCE, `item.horizon` / `plannedStart` / `plannedTarget` /
  `stateValue` are VALUE, and they answer different questions: an empty horizon reads as
  untriaged while the key is still there to clear. Removal actions gate on presence so
  none of them can write nothing; the backfill fills exactly its complement.
- The roadmap field readers are tri-state (`FieldReading` in `noteFields.ts`): absence
  and refusal are different facts — absent is untriaged (shelved silently), invalid
  shelves with the reason on the card. Collapsing them would turn "can't read this" into
  a silent "not planned". Dates are CIVIL (year/month/day as the note spells them, any
  time/offset ignored for placement, never converted to a zone), and `timeline.ts` takes
  `today` as a parameter — nothing in this layer reads a clock.
- Context rows on the roadmap: never counted, never shelved (the shelf is a statement
  about results), never a source of vocabulary — a context value places into a bucket
  that already exists but never mints one — and never placed on the timeline by its own
  dates. Spans now roll up, and that changed nothing here: `deriveBars` routes an
  `outsideFilter` row straight to `RoadmapModel.context` before any span is computed for
  it, so a context parent draws no inferred bar — the criterion scoping one to its
  visible results is specified and unbuilt. What has no place stands in
  `RoadmapModel.context`, rendered beside the shelf apart from its count. The invariant the tests state from the rule: placed plus shelved equals the
  visible result rows, on either axis.
- A marker gets the same early exit in `deriveBars`, right after the context check and
  for a different reason: it is not a context row, it is reduced (`placeMarker`) to its
  target point before the ordinary span rules — start, target, the reversal check — ever
  run against a type that does not describe a span. A stale start later than the target
  would otherwise read as a reversed pair and shelve, a rendering fix would never reach:
  the reduction has to happen here, in derivation, not in the timeline that draws it.
- Bucket order inside a bucket is the Base's own sort (`entryIndex`), the board's
  derived-order rule; the shelf and the timeline keep tree order — rows arrive from
  `roadmapRows` already in it, which is what "sibling order" on the shelf rests on.
- A horizon move — from a drag, a key or either menu — is planned by
  `computeHorizonWrites`, the same function the row's Set horizon uses: the target value
  byte for byte, nothing for a re-pick of the placement the card already holds, and null
  (remove the key) for the shelf. It clears on the KEY's presence rather than on the
  reading, which is what makes the empty stub the backfill leaves a real thing to take
  away rather than something already absent.
- "Same placement" and "same state" are one question, answered by `sameValue` in
  `noteFields.ts`: case-insensitive, with absence a value rather than a missing one. The
  plan, the menu's checkmark and the keyboard ladder all ask it, because a plan that said
  "unchanged" on a different rule than the checkmark would disagree about what the user
  is looking at.
- **Naming a move's two ends is two questions, not one.** They shared an answer and it
  was wrong in both directions, so they are `targetLabel` and `placementLabel` now:
  - the TARGET is where the user SENT it — the drawn bucket's casing when one exists,
    else the picked value itself, never the shelf. Hiding can remove a value's only
    carrier while `horizonChoices` goes on offering it (deliberately: what is reachable
    must not depend on what is on screen), so a pick can name a bucket the frame is not
    drawing, and the write still puts the note there.
  - the SOURCE is what the note SAID, taken from `HorizonSource` — the reading plus
    whether the key was there at all, captured together so a caller cannot take half.
    Three things shelve a card and only ONE is nothing to clear: no key (`Unplaced`), an
    empty key (`an empty horizon`), a key the axis refuses (`an unreadable horizon`).
    Naming them alike reports a real, undo-consuming cleanup as "from Unplaced to
    Unplaced" — a move that did not happen.
