# domain/ — the backlog itself

Tree shape, ranking, levels, scope. Reads the vault, never writes it, never touches the
DOM — enforced by `no-restricted-imports` in `eslint.config.mjs`. The rules below are
the ones that bite when changing anything here; the cross-cutting context-row rule lives
in the root `CLAUDE.md` because it spans every layer.

- Config property ids are `note.`-prefixed (`note.parent`); frontmatter keys are not.
  `resolveSettings` strips the prefix.
- `tagsKey` is the one property option whose default is a real key, so `resolveSettings`
  tells "never set" from "cleared" (`clearablePropKey`): without that the option could
  not be turned off, since `getAsPropertyId` reports both as null.
- `depth` is VISUAL only (focus mode re-roots it). Level math must use
  `effectiveLevelIndex`, which chains down the parent levels and carries unknown
  custom types through the ladder (see `childLevelIndex`). Never derive levels
  from depth. **`computeTypeChanges` still does** — it is safe there because both
  depths come from one pass over the same subtree, but it is the reason this rule is
  not yet a lint rule. See `docs/issues/stop-deriving-levels-from-depth.md`.
- `model.roots` is the RENDERED forest (synthetic under focus); every data operation
  (backfill, ranking parentless items, root-level outdent) must use `model.realRoots`.
  Checked by lint in `writePlan.ts` and `interactions/create.ts` — the two files that
  rank. Elsewhere `model.roots` is correct and deliberate: `dropTargets.ts` and
  `structure.ts` reach it only after an earlier `focusRoot` return has ruled out the
  synthetic case, which is exactly the subtlety worth reading twice before editing.
- Focus mode: the top row is a synthetic grouping — `focusRoot` items keep their real
  `parent` pointer, and reordering/outdent/indent across that row must stay disabled.
- The autoType cascade retypes only descendants whose type matches a configured
  level; custom types outside the ladder are deliberate user data.
- Scope (`settings.hierarchyOnly`, on by default): a base filtered by folder returns
  every note living there, so `pruneOutsideHierarchy` drops the ones that are not work
  items — a note belongs when it has a *supported* type (matching a configured level) or
  a parent (explicit, empty-marker, folder-inferred, or unresolvable). The test runs per
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
  The seed for the walk is `outsideParentSeed`, which mirrors `linkParents`' precedence
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
  `docs/issues/duplicate-orders-in-a-partially-filtered-group.md`.
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
