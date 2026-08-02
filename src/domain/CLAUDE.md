# domain/ — the backlog itself

Tree shape, ranking, levels, scope. Reads the vault, never writes it, never touches the
DOM — enforced by `no-restricted-imports` in `eslint.config.mjs`. The rules below are
the ones that bite when changing anything here; the cross-cutting context-row rule lives
in the root `CLAUDE.md` because it spans every layer.

- The model is built in three phases and **each has its own type**: `RawItem` (what one
  note says about itself) → `LinkedItem` (+ `parent`, `children`, `orphan`, once the tree
  is resolved) → `BacklogItem` (+ levels, depth, `focusRoot`, rollups). A field exists
  only once the phase that owns it has run, so a signature states which fields are real
  and the compiler enforces it — this used to be ten placeholder values in `addItem` and
  a request that readers remember. Only `BacklogItem` leaves this module, and it still
  carries all 24 fields, so nothing downstream knows the difference. **Adding a field
  means choosing its phase**, which is the question that was easy to skip before.
  Promotion is an in-place assertion in `linkAll` and `assignAll`, each followed
  immediately by the loop that fills every field it claims: the graph is cyclic, so a
  phase cannot rebuild its items without rebuilding every reference to them. Those two
  lines are the whole unsafety, and they are why the phases are worth having anyway —
  the alternative is that same unsafety spread across ten fields and every reader.
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
  types, since `rows.ts` legitimately reads depth for `aria-level`. The last
  exception was the autoType cascade, which now descends by `nextLevelIndex` from
  the dragged item's NEW level: the same chain `computeLevel` walks once the writes
  land, so a plan cannot disagree with the model it produces. `nextLevelIndex` is
  the one statement of "a child sits one rung below, clamped at the deepest level";
  `childLevelIndex` is it applied to an item, and the cascade is it applied to a
  level it is still planning. Chaining is *provably* what the old
  `newBaseIdx + (child.depth - dragged.depth)` computed — `min(min(x+1,L)+1,L) =
  min(x+2,L)` — so removing depth changed no behaviour and needed no product
  decision, which is not what the issue expected. Where it does bite is the reading:
  a Task nested straight under an Epic is retyped by the rung it occupies, not by
  the level it declares.
- `model.roots` is the RENDERED forest (synthetic under focus); every data operation
  (backfill, ranking parentless items, root-level outdent) must use `model.realRoots`.
  Checked by lint in `writePlan.ts` and `interactions/create.ts` — the two files that
  rank. Elsewhere `model.roots` is correct and deliberate: `dropTargets.ts` and
  `structure.ts` reach it only after an earlier `focusRoot` return has ruled out the
  synthetic case, which is exactly the subtlety worth reading twice before editing.
- Focus mode: the top row is a synthetic grouping — `focusRoot` items keep their real
  `parent` pointer, and reordering/outdent/indent across that row must stay disabled.
- The autoType cascade retypes only descendants whose type matches a configured
  level; custom types outside the ladder are deliberate user data. **That principle holds
  for descendants and not for the dragged item**, which `computeTypeChanges` exempts only
  when it is a *declared* extra type — so a `Spike` survives inside a moved subtree and is
  rewritten when it is the thing moved. Nobody chose that; it is an artefact of two
  predicates written for different reasons, and this line stating the principle
  unqualified is how four notes came to claim the opposite. Recorded in
  `docs/issues/The dragged item is retyped, its descendants are not.md`. If it is ever
  decided the dragged item is genuinely special, say so **here**, rather than leaving the
  exemption to live in a predicate.
- The vocabulary is **fixed**: `LEVELS` and `EXTRA_TYPES` in `settings.ts` are constants,
  not options. Making them configurable cost collision rules between the two lists, a
  "what folder does a name nobody chose get" question with no good answer, and a schema
  that had to be generated per view; what it bought was a rename. Being opinionated
  deletes all of that, and every level rule now has exactly one list to hold for. A note
  typed something else is still handled — it keeps its name and carries the ladder through,
  the `Bugfix` case below.
- **Extra types** (`EXTRA_TYPES`, `Issue` and `Bug`) are declared types that are
  NOT rungs — `itemTypes.ts` owns them. The ladder cannot express "a Bug holds Tasks
  wherever it hangs", because every ladder rule is "one rung below the parent", so an
  extra type's rank is a property of the TYPE: `EXTRA_TYPE_RANK` (the rung whose children
  are the deepest level), pinned, never inherited. Everything else follows from that plus
  `levelIndex === -1`: its children imply the deepest level under an Epic as under a PBI,
  the cascade already leaves it alone, and `computeTypeChanges` must not retype the
  *dragged* item either — it descends the subtree from the extra rank rather than from
  where the item landed, or a Bug's Tasks would become PBIs on a drop. The contrast that
  keeps this honest: an UNKNOWN custom type still takes `childSlot`, so it continues the
  ladder (Feature > Bugfix > implied Task). Declared pins, undeclared inherits.
  `collectFocusRoots` has to know about them too — an extra type has no `levelIndex` to
  match, so focusing its rank would otherwise make it vanish rather than rank beside the
  level it sits level with. Nothing is enforced: `childTypeChoices` decides what is
  OFFERED, and a drag may still put a Bug anywhere, exactly as the ladder has always
  guided rather than refused.
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
- `autoType` is OFF by default. Re-typing a whole moved subtree is a strong action to
  take on a drag, and the ladder is advisory everywhere else; the option is for people
  who want it enforced. Tests that assert a cascade opt in (`autoTyped`), which also
  keeps them honest about what is default behaviour and what is not.
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
  any subtree walk can meet one. The autoType cascade therefore stops at such a row and
  skips its whole branch — retyping only the levels below it would half-update the ladder.
- Renumbering rewrites a whole sibling group, so `computeDropWrites` refuses that path
  when the group holds an `outsideFilter` row and places the item after the highest known
  order instead (`afterHighestKnown`) — the single choke point that makes the context-row
  invariant hold. Because that fallback lands the item last, the *positional* operations
  refuse such a group up front instead of landing somewhere other than aimed:
  `siblingPosition` (before/after drops), `canReorder` (the move menu, Alt+arrow) and
  `outdentTarget`. Appends — dropping *into* a parent, the top-level strip, indent — stay
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
- The roadmap field readers are tri-state (`FieldReading` in `noteFields.ts`): absence
  and refusal are different facts — absent is untriaged (shelved silently), invalid
  shelves with the reason on the card. Collapsing them would turn "can't read this" into
  a silent "not planned". Dates are CIVIL (year/month/day as the note spells them, any
  time/offset ignored for placement, never converted to a zone), and `timeline.ts` takes
  `today` as a parameter — nothing in this layer reads a clock.
- Context rows on the roadmap: never counted, never shelved (the shelf is a statement
  about results), never a source of vocabulary — a context value places into a bucket
  that already exists but never mints one — and never placed on the timeline by its own
  dates (its span, once spans roll up, is what its visible results give it). What has no
  place stands in `RoadmapModel.context`, rendered beside the shelf apart from its
  count. The invariant the tests state from the rule: placed plus shelved equals the
  visible result rows, on either axis.
- Bucket order inside a bucket is the Base's own sort (`entryIndex`), the board's
  derived-order rule; the shelf and the timeline keep tree order — rows arrive from
  `roadmapRows` already in it, which is what "sibling order" on the shelf rests on.
- A horizon move is planned by `computeHorizonDropWrites` in `writePlan.ts`, shaped
  exactly like `computeStateDropWrites`: the target value byte for byte, nothing for a
  move onto the placement the card already holds, `removeHorizonKey` for the shelf.
  The one asymmetry with the state plan is `invalid`: a key holding something the reader
  refuses still HAS something to un-place, while a key the reader already reads as
  absence (missing, or empty) does not — un-placing that would change the note without
  changing anything the roadmap says about it.
- "Same placement" and "same state" are one question, answered by `sameValue` in
  `noteFields.ts`: case-insensitive, with absence a value rather than a missing one. The
  plan, the menu's checkmark and the keyboard ladder all ask it, because a plan that said
  "unchanged" on a different rule than the checkmark would disagree about what the user
  is looking at.
- `bucketLabelFor` is the roadmap's `columnLabelFor`: anything naming a placement out
  loud reads it from there, so a message can only say what renders. Its fallback is the
  shelf — for absence, and for a value naming no bucket, since a result the axis did not
  place is on the shelf and there is nowhere else it could be.
