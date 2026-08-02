# storage/ — the only place anything is persisted

Frontmatter, new notes, the `.base` file, collapse state. Everything upstream decides
what a change should be and hands the plan here.

That boundary is enforced, not described: `no-restricted-syntax` bans
`processFrontMatter`, `vault.create` and `load/saveLocalStorage` everywhere outside this
directory, so a new write path cannot appear by accident and the write-safety invariants
can be checked by reading one directory.

## Writing the vault

- Never write frontmatter outside `frontmatter.ts` (`applyWrites` / `applyRestores` /
  `createBacklogItem`), and every write path — including creation — goes through the
  `configProblems` gate.
- `applyWrites` is serialized but not transactional: a mid-batch failure leaves the
  earlier writes applied (orders self-correct on the next renumbering drop).
- `applyWrites` hands each write's inverse to `onInverse` AS IT LANDS — incrementally,
  because a mid-batch failure leaves the earlier writes applied, and those are exactly
  the ones still needing undo. A write that changed nothing emits no inverse: a state
  re-picked to itself still calls `applySafely`, and it must not cost the caller's
  single undo slot.
- Inverses are raw (`RestoreWrite`): per key, the prior and written value with absence
  a first-class state. `ItemWrite` cannot carry them — `parent` is `TFile | null`
  (no room for an aliased or unresolved prior link), `order` is a `number` (a string
  on disk survives `readNumber` but not a replay) — and a replay through the planner
  would re-normalize rather than restore. `applyRestores` compare-and-swaps: a key
  goes back only where the note still holds what the batch wrote, hand edits since
  are kept and counted, deleted notes are skipped whole and counted — by TFile
  IDENTITY, not path, because a note recreated at the captured path is a different
  file that must not inherit the original's history — and each restore
  emits its own inverse, which is what makes undoing an undo redo. Tags restore by
  *effective* delta, never snapshot, so they compose with edits made in between —
  at the price that a scalar-shaped prior comes back as the list the writer writes
  anyway.
- Parent links are written as `[[wikilinks]]` via `fileToLinktext` regardless of the
  user's link-format setting (markdown links are not parsed in frontmatter).
- Date stamps (`startedDate`, `finish`) are FIELDS of the state write that caused them,
  applied inside the same `processFrontMatter` call — never a second write. That is
  what makes one undo take back the state and its dates together, and it is why they
  join `touchedKeys`: a key listed there but unchanged emits no inverse anyway.
- **Both stamp decisions are made HERE, against the live note, not in the plan** — the
  row that planned a write can be a refresh behind it, exactly as with tags. The start
  is write-once: it lands only where the property is empty, so the earliest start
  survives rework. The finish carries `{date, toDone}` and this module compares
  `toDone` against the state the note is actually LEAVING (read before the state write
  replaces it): crossing in stamps, crossing out deletes, and done-to-done leaves it
  alone. Deciding that from the model's idea of the old state left a note that was
  already done, moved to a not-done state, still carrying its finish.
- A live value read here must go through the **same tolerant reader the model used**
  (`readString` for the state, as `buildModel` does). Frontmatter takes shapes a strict
  read misses — a one-item list, a number, a boolean — and a stricter read here answers
  "no state" to the question the model answers "Done". Two answers to one question is
  how the boundary rule came to keep a finish on a reopened item and overwrite it on a
  re-label. The rule generalizes past the stamps: reading a live value the model also
  reads means borrowing its reader, not writing a second one.

## Collapse state, and the view mode beside it

- The rule that decides where anything persists: **base settings are saved on the view
  (the `.base` options); UI state is saved in vault-scoped localStorage.** The collapse
  sets, the projection (`mode` on the same per-view entry — `board` or `roadmap`,
  absent for the tree) and the retained roadmap-axis pick (`axis` — kept even while its
  axis is unconfigured, so restoring the configuration restores the choice) are UI
  state — one person's working position on one device — and are NEVER written to the
  `.base`: a path per collapsed row is exactly the growth that shared file should not
  take, and a projection choice forced on everyone the base syncs to would be the same
  mistake. The price, accepted knowingly: working position does not sync across
  devices.
- The store's key only has to be UNIQUE, never parsed: each entry carries its own
  `base`, because a view name may contain anything a user can type ("Sprint #3" is an
  ordinary name) and splitting the key on a separator misreads the base path — which
  made another view's `pruneMissingBases` delete a live entry. Both halves are
  percent-encoded so no two identities can collide. The one place parsing *is* sound is
  `rekeyBase`, recovering a view name from a key it knows is encoded, and it says so.
- The base path comes from walking `iterateAllLeaves` for the `FileView` whose
  `containerEl` contains this view's element — the Bases API still hands a view no
  reference to its own file, but the leaf drawing it has one. The leaf's file must be the
  `.base` itself: a base embedded in a note is drawn inside that note's leaf, so the file
  on offer there is the host note, and every base embedded in it would answer to one key.
  When the identity resolves to nothing — no leaf, or an embedded base — the view is
  session-only, exactly as before persistence existed. A shared fallback key would be
  worse than not persisting, because two bases would inherit each other's open rows and
  overwrite each other's state.
  **A `.base` leaf does present as a `FileView` with `.file` set** — confirmed in a live
  vault on 2026-08-01 (Obsidian 1.10.x), which is the fact the whole feature rests on:
  rows came back open across a tab close, and they can only do that if the walk found the
  leaf. Treat it as verified-once, not guaranteed forever — it is an observation about
  Obsidian's internals, not a documented API, so it is the first thing to re-check if
  persistence ever goes quiet after an Obsidian update. The failure is silent by design
  (session-only fallback), so nothing else will report it.
- Both halves of the key, and both collapse sets, are paths or names a user can change
  at any moment — so each one needs its own migration, not just whichever bit first.
  A **note** rename moves that row's entry in `collapsed`/`settled` (`renamePath`, wired
  to `vault.on('rename')` in the view), or the next refresh shuts it as a parent nobody
  has ruled on. A **view** rename moves the stored entry, which is why `dispose` flushes
  on an identity change even with nothing pending — the state is unchanged and yet
  belongs elsewhere. A **base** rename moves every entry naming it (`rekeyBase`, wired in
  `main.ts`, covering bases with no view open) while `flushCollapseState` re-resolves its
  own identity (covering the view watching it happen). And a rename is never only the
  thing renamed: `movedPath` carries everything beneath the old path, because moving a
  *folder* reports the folder — not the base inside it, nor the notes under it — so
  matching the renamed path alone leaves the whole subtree stranded. That also makes
  both migrations idempotent, which is what lets them be right without knowing whether
  Obsidian reports a folder move once or once per descendant. Without these, ordinary
  tidying orphans an entry under a key nothing will look up again, and the next save
  prunes it for naming a file that no longer exists.
- Persisted state changes what pruning may key on. `collapseNewParents` must NOT drop
  paths that are missing from the model — a query that has not warmed up yet, or a
  filter the user just narrowed, would read as "these notes are gone" and throw away a
  session they still want. `flushCollapseState` is the only place that forgets a path,
  and it asks the vault, not the model. Growth is bounded there and by `MAX_PATHS`.
- Saves are debounced (`scheduleCollapseSave`); "Collapse all" settles every parent in
  one loop and a write per row would be quadratic. `onunload` flushes a pending write,
  since closing the view is when it matters most.
- Stored state is read defensively at every level: it is user-writable data on disk that
  another version of this plugin may have written, so anything unrecognizable is dropped
  rather than trusted.
