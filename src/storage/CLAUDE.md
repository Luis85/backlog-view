# storage/ — the only place anything is persisted

Frontmatter, new notes, the `.base` file, view state. Everything upstream decides
what a change should be and hands the plan here.

That boundary is enforced, not described: `no-restricted-syntax` bans
`processFrontMatter`, `vault.create` and `load/saveLocalStorage` everywhere outside this
directory, so a new write path cannot appear by accident and the write-safety invariants
can be checked by reading one directory.

## Writing the vault

- Never write frontmatter outside `frontmatter.ts` (`applyWrites` / `applyRestores`),
  `createNote.ts` (`createBacklogItem`) and `propertyWrite.ts` (`applyPropertyWrites`),
  and every write path — including creation — goes
  through the `configProblems` gate. Two files rather than one since 2026-08-16, on the
  line cap: **editing** a note grows a row in a list per optional property, **making** one
  grows a field on `NewItemSpec`, and the second was the faster half. A third joined
  2026-08-17 for a different reason than the line cap: `propertyWrite.ts` is the
  estimation view's own writer — plain key/value batches (a score, its recomputed total,
  its stamp) with no `BacklogSettings`, no hierarchy, none of `applyInto`'s per-property
  rules, because that view has none of those concepts. It captures the same
  `RestoreWrite` inverses `applyWrites` does (`rawValueOf`/`sameRaw`, exported from
  `frontmatter.ts` for exactly this reuse), so `applyRestores` replays either writer's
  batches without knowing which one produced them. The boundary is
  unchanged and is still the DIRECTORY's — `no-restricted-syntax` bans the calls
  everywhere outside it, not outside a file.
- `applyWrites` is serialized but not transactional: a mid-batch failure leaves the
  earlier writes applied (orders self-correct on the next renumbering drop). A date
  batch REFUSED against the live note stops there for the same reason and reports what
  landed rather than claiming nothing did — the refusal needs frontmatter only readable
  inside `processFrontMatter`, so there is no pass that could refuse every file up front
  without opening each twice. Every date batch today is one write, which is why the two
  readings coincide; the outcome is what makes the difference visible if that changes.
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
  anyway. `restoreDependsOn` pays a related price for the same reason: it appends what
  it restores rather than reinserting at the removed position, so undoing a removal from
  `[B, A]` can hand back `[A, B]` — a captured index would only be meaningful if nothing
  else changed between the write and the undo, which is exactly what compare-and-swap
  exists because it cannot assume. The list is semantically a set (resolution collapses
  duplicates and spellings), so the only observable effect is display order — but
  `dependencyNote` renders that order, so the row's own text visibly reorders. A known
  limitation, not a bug: see `restoreDependsOn`'s own doc comment.
- Parent links are written as `[[wikilinks]]` via `fileToLinktext` regardless of the
  user's link-format setting (markdown links are not parsed in frontmatter).
- Date stamps (`startedDate`, `finish`) are FIELDS of the state write that caused them,
  applied inside the same `processFrontMatter` call — never a second write. That is
  what makes one undo take back the state and its dates together, and it is why they
  join `touchedKeys`: a key listed there but unchanged emits no inverse anyway.
- **Both stamp decisions are made HERE, against the live note, not in the plan** — the
  row that planned a write can be a refresh behind it, exactly as with tags. The start
  asks two things of the live note: that the write actually MOVES it to another state
  (a stale row can propose the state it already holds, and dating that records a
  redundant selection rather than the moment work began — and spends the undo slot on
  it), and that the property is still empty, so the earliest start survives rework.
  The finish carries `{date, toDone}` and this module compares
  `toDone` against the state the note is actually LEAVING (read before the state write
  replaces it): crossing in stamps, crossing out deletes, and done-to-done leaves it
  alone. Deciding that from the model's idea of the old state left a note that was
  already done, moved to a not-done state, still carrying its finish.
- Every WRITE of a user-configured key goes through `setOwn`, never `fm[key] = value`:
  `__proto__` is a legal property name, and plain assignment reaches
  `Object.prototype`'s setter instead of creating a key — silently dropping a string
  or a number (the state changes, its date vanishes) and, for the tag list, replacing
  the object's prototype with the array. `Object.defineProperty` is what round-trips
  through YAML for every key including that one.
- Every live read of a USER-CONFIGURED key goes through `ownValue`, never `fm[key]`:
  `toString`, `constructor` and `valueOf` are legal property names, and on a note
  lacking them the lookup returns the inherited function — truthy, so a blank test
  reports a date already recorded and the stamp is declined forever. `byName` in
  `domain/typeVocabulary.ts` says this hazard has shipped three times on other tables; this
  is the same answer for frontmatter, and `rawValueOf` was already doing it alone.
- A live value read here must go through the **same tolerant reader the model used**
  (`readString` for the state, as `buildModel` does). Frontmatter takes shapes a strict
  read misses — a one-item list, a number, a boolean — and a stricter read here answers
  "no state" to the question the model answers "Done". Two answers to one question is
  how the boundary rule came to keep a finish on a reopened item and overwrite it on a
  re-label. The rule generalizes past the stamps: reading a live value the model also
  reads means borrowing its reader, not writing a second one.
- The roadmap's placement keys (`ItemWrite.axis`) follow the state key's two rules:
  never written to an unconfigured key, and a null REMOVES rather than blanks. Applying
  and capturing read the same `axisEntries` list — a key written but not captured would
  be a change no undo could reach, which is exactly how a hole gets in. They share that
  writer and NOT a meaning: the dated ends get civil-date equality and the datetime shape
  merge, the horizon gets neither. `readDate` accepts a trailing group, so a label like
  `2026-08-01 Planning` parses as a date — treated as one, re-picking `2026-08-01 Review`
  compares equal and writes nothing, and the merge carries ` Planning` onto its
  replacement. `axisEntries` yields the FIELD with the key so that stays decidable.
- **A key the note's LIVE type may not hold is refused here, whatever the plan says** —
  one question (`mayHoldField`, `domain/itemTypes.ts`), asked of the type the note states
  at the moment it is opened rather than the type the plan was made against. It is one
  function because it was two answers and the second had a hole in it: the horizon's
  live-type check sat inside `refusesAxis`, which returns at its first clause for a write
  carrying no `axis`, so the iteration assignment and the ✨ backfill's stubs both reached
  a `Release` ungated. What each door DOES about a refusal still differs, and that is the
  part to keep rather than tidy: a GESTURE refuses its whole batch loudly
  (`refusesLiveType`), because the user acted on a note that is no longer the note they
  acted on; a STUB is dropped and the batch goes on (`withHoldableStubs`), because a
  backfill names hundreds of notes and refusing at the one release would abandon every
  note after it for a key that carries no decision. `missingKeyStubs` declines to plan
  those stubs as well — not redundant with the drop here, for `applySafely`'s own reason:
  authorization at plan time is not authorization at write time. `applyRestores` asks none
  of it, so a legitimate write made before a retype can still be taken back.
  The rule is name-shaped by ruling (only a `Release` is asked) and widening it is an edit
  to that one function — see `docs/issues/Creation seeds a placement the type may not
  hold.md`.
- The LABEL properties (`ItemWrite.risk`, `ItemWrite.priority`, `ItemWrite.assignee`) are
  those same two rules a
  third time, in `applyLabels`, and they share the axis's writer with none of them: a label
  is a value the user picked or typed, so it takes the horizon's plain `setOwn` rather than
  the dated ends' civil-date equality and datetime merge. One loop over a list pairing each
  planned value with its configured key, because they want the identical two lines —
  `applyRisk` alone was the third restatement of the rule, and the assignee was the fourth
  property, which is where the root guide said copying stops paying. The priority is the
  proof it stopped: a third label cost one row in that list and nothing else here, and a
  fourth is another row. Each key joins `touchedKeys` on the very condition the writer writes on,
  which is what makes a label and its removal undoable — a key written but not captured is
  a change no undo could reach.
- Two writes here are not work items — the `.base` file and the generated README — and
  both are in this directory for the same reason: "everything that puts bytes in the vault
  is in `storage/`" is only checkable while it has no exceptions. `readmeFile.ts` is also
  the one write that may REPLACE an existing file, so it reads before writing: identical
  content is a no-op (a repository must not get a commit for regenerating the same
  document), and content whose first line does not parse whole as the generated marker is
  somebody else's file and is refused. Neither may be decided from the file name alone.
  The replacement itself goes through `Vault.process`, Obsidian's atomic read-modify-write,
  and re-asks "still ours?" inside the callback: the permission is about CONTENT, and
  `read` then `modify` answers it about content that need not still be there when the
  write lands. It is read-then-`process` rather than `process` alone because the two
  outcomes that write nothing promise exactly that, and a callback returning the file
  unchanged has still been through a save.
- `createBacklogItem` writes everything a new note gets in ONE call — type, parent,
  order, and the horizon when it was created from a bucket. A create-then-update pair
  could fail in between and leave a note in a bucket its frontmatter does not claim,
  which is the same argument the hierarchy properties were already there for.

## Undoing a prerequisite: one identity rule

The dependency inverse is the one restore whose target can be RENAMED, DELETED or
REPLACED between the write and the undo, and it took six review rounds discovering those
cases one at a time — each fix a new condition beside the last, each new condition the
source of the next finding. What follows is the rule they were all approximations of.
It is written as the rule rather than as a list of cases on purpose: the cases are how
this went wrong, and a seventh case is a question to ask of the rule, not a seventh
branch to add.

**A captured inverse holds a FILE, never a name.** `DependsOnRestore` carries each line
as `{ text, file }`: the text is what gets written back, the file is what says which note
the line was about. Text alone cannot survive a rename — Obsidian mutates the one `TFile`
and rewrites the links that named it, so a captured `[[A]]` resolves to nothing while the
live entry reads `[[B]]`, and an undo matching on text or on a captured PATH finds no line
and silently does nothing.

**Which live line is a captured line is ONE question** (`namesCaptured`): does it name
the note the capture held. Everything the replay decides is that question asked of a
different pair — never a comparison of spellings, never a special case for a deletion.
What makes it answerable is a single fact about Obsidian, which the rule leans on in two
directions at once: **a rename mutates the one `TFile` in place and rewrites the links
that exist.** So `entry.file.path` is always the note's LAST path, and a live line the
plugin wrote says that same last path, whatever happened in between.

| the captured entry | the live line | is it the same line |
| --- | --- | --- |
| named nothing (`file` is null) | anything | same trimmed TEXT, and nothing else — a broken line has no note to share, so only its own spelling can be it |
| holds a file | resolves | iff it resolves to that FILE — never merely to a file at that path, since a note recreated under the old name is a different object and somebody else's dependency |
| holds a file | resolves to nothing | iff it names the file's LAST path (`namesPath`) — nothing else can be claiming an unresolved spelling |

The third row is what a text-or-path comparison could see neither half of. It covers a
prerequisite DELETED (its line sits there broken, and the undo owns it) and one RENAMED
and then deleted (Obsidian rewrote the line to `[[B]]` before the note went, so neither
the captured text nor any resolution finds it, and only the last path connects them).

**A live line satisfies the captured line it IS before one it merely resembles**
(`claimLines`): two passes over all the captured lines, the first claiming an identical
spelling and the second letting what is left claim any line naming the same note. Claims
are exclusive, so this is a MULTISET match — `[A, A]` is one dependency and two lines,
and each captured copy must find its own or be restored. Per-entry ordering breaks it:
removing `[A, [[A]]]` and hand-restoring only `[[A]]` had captured `A` claim it by note,
leaving captured `[[A]]` to be appended — two `[[A]]` on the note and the spelling the
user lost still missing. The exact pass compares RAW text to RAW text, padding included;
counting it off the trimmed reading made `" A "` an exact match for a captured `"A"`.

The exact pass is still subject to `namesCaptured`, which is what used to be a separate
conditional preference and is now nothing at all: an identical spelling that has come to
name somebody else's note is not this line, and falls out of the one rule rather than
needing to be excluded by a second.

**What goes back is the captured TEXT**, carrying the user's padding and their choice of
`A` over `[[A]]` — `restoredLine` changes it only because, while a line is OFF the note,
the note it named can move and no rewrite reaches a line that is not there. That is
`namesCaptured` twice and no rule of its own: the captured text goes back if it still
names the captured note, is retargeted to that note's current name if it does not, and
whichever text that leaves is written only if it too names the captured note. The second
ask is the one refusal — a spelling that RESOLVES to a note the capture never held would
silently make the user depend on a note they never picked.

A deleted prerequisite needs no branch there, because the table's third row already
answers it. Deleted outright, the captured spelling still names the file's last path, so
it goes back as the broken line the note would be showing had the removal never happened.
Renamed and THEN deleted, it does not — so the line is retargeted to the name the note
died under, which is what Obsidian's own rewrite would have left on the note, and what
keeps a note later recreated under the old name from inheriting the dependency.

Following a rename replaces the link's TARGET only: the `#heading` and the `|alias` say
what the user meant by the link and are none of a rename's business, and rebuilding the
whole thing from the file resolved correctly while silently dropping both.

## View state: the folds, and every pick beside them

- The rule that decides where anything persists: **base settings are saved on the view
  (the `.base` options); UI state is saved in vault-scoped localStorage.** What that
  entry holds is one person's working position on one device: the collapse sets, and
  every pick that says how this view is being LOOKED at rather than what it contains —
  which projection, which roadmap axis, how the frame is zoomed, sized, sorted and
  narrowed. None of it is ever written to the `.base`: a path per collapsed row is
  exactly the growth that shared file should not take, and a projection choice forced
  on everyone the base syncs to would be the same mistake. A pick is retained even
  while whatever it applies to is unconfigured, so restoring the configuration restores
  the choice. The price, accepted knowingly: working position does not sync across
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
  `main.ts`, covering bases with no view open) while `flushViewState` re-resolves its
  own identity (covering the view watching it happen). And a rename is never only the
  thing renamed: `movedPath` carries everything beneath the old path, because moving a
  *folder* reports the folder — not the base inside it, nor the notes under it — so
  matching the renamed path alone leaves the whole subtree stranded. That also makes
  both migrations idempotent, which is what lets them be right without knowing whether
  Obsidian reports a folder move once or once per descendant. Without these, ordinary
  tidying orphans an entry under a key nothing will look up again, and the next save
  prunes it for naming a file that no longer exists.
- **Not everything a view remembers is keyed by a path, and the entry says which is
  which.** The stored entry is `{ folds, prefs }`: `folds` is everything keyed by
  something the vault can lose, and it is what the prune and the rename walk. The shelf's
  hidden types, the tree's column widths, the resources axis's folded bands and the folded
  board columns and horizon buckets are per-view lists or maps keyed by NAMES — a type, a
  Bases property id, a resource, a state value — while the rules below are all about paths:
  the flush drops an entry the vault has no file for, and the rename migrations move
  entries when a note or a base moves. So `shelfHiddenTypes` and `colWidths` are `prefs`
  values, which neither ever touches; a BAND and a COLUMN are folds and sit in
  `folds.lanes` and `folds.collapsedColumns`/`folds.expandedColumns`, which the prune must
  therefore skip — it walks `collapsed` and `expanded` only. They need no migration either:
  nothing renames a type or a resource, and a name no row draws simply has no band to shut.
  The columns are the one of these stored as a PAIR, and the reason is a default rather
  than a shape: a band nobody has ruled on is open and needs no entry, while a done board
  column nobody has ruled on is SHUT — so an explicit open has to be recorded or the
  default would take it back on the next render. That is the same two-set argument
  `collapsed`/`expanded` make for rows, reached for the second time and for the same
  reason. Their key is scoped and lower-cased (`columnKey` in `view/viewState.ts`),
  because two boards and the horizon axis can each hold a `Done` and each identifies its
  own columns case-insensitively.
- **Every entry carries the shape it was written in** (`v`, `SCHEMA`). The shape has
  changed once already and it cost every reader their working position, because the only
  thing that distinguished 0.8's entry from 0.9's was the KEY — and moving the key is a
  reset. With a stamp the next change is a migration. The two directions are deliberately
  not symmetrical: an entry stamped by a version this one does not know is DROPPED rather
  than read defensively (guessing at a shape never seen is how a value lands somewhere it
  means something else), while an entry with NO stamp is this shape, because every entry
  in the wild is unstamped and reading absence as "not mine" would reset exactly the
  readers the stamp protects.
- **The prune asks whether the vault index can be trusted before it believes it.**
  `pruneMissingBases` deletes every OTHER view's entry on one question asked of the index,
  so it first asks that question about the base of the view doing the saving — a file that
  is on screen. If the index cannot find THAT, it is not answering about anybody else's
  base either, and one save while it is unavailable would forget every base in the vault.
  That is the only loss here reopening a view cannot undo: those entries are gone, not
  merely unread. The base comes from the identity, never from the map, since a view at its
  defaults has just had its own entry deleted. Same rule as the one below, one level up:
  never read "I cannot see it" as "it is not there" without first checking the reader can
  see anything.
- Persisted state changes what pruning may key on. `collapseNewParents` must NOT drop
  paths that are missing from the model — a query that has not warmed up yet, or a
  filter the user just narrowed, would read as "these notes are gone" and throw away a
  session they still want. `flushViewState` is the only place that forgets a path,
  and it asks the vault, not the model. Growth is bounded there and by `MAX_FOLDS`, which
  counts KEYS rather than notes — a parent settles once per scope — so a scope added is a
  cap to raise with it, or the headroom it promises in notes quietly halves.
- Saves are debounced (`scheduleCollapseSave`); "Collapse all" settles every parent in
  one loop and a write per row would be quadratic. `onunload` flushes a pending write,
  since closing the view is when it matters most.
- Stored state is read defensively at every level: it is user-writable data on disk that
  another version of this plugin may have written, so anything unrecognizable is dropped
  rather than trusted. **Absence is the default for every pick** — the tree, no axis, no
  zoom, comfortable rows, the default lead width, the whole tree — which is what makes a
  failed check and a value never written the same thing on the way back in, and why the
  write side stores nothing for a pick that means the default. A NAME is checked against
  the vocabulary it mirrors (`oneOf`, spelled as strings here rather than imported as
  a type, because stored state is not trusted as one). Each pick is one row in
  `PREF_READERS`, run on the way IN over a stored entry and on the way OUT over the
  snapshot the view hands down — so a value the store would refuse to read can never be
  written. `leadWidth` is the first pick that
  is a NUMBER, so there is no vocabulary to check it against: `inRange` takes
  finite and inside `MIN_TIMELINE_LEAD_PX..MAX_TIMELINE_LEAD_PX` and drops anything else
  rather than clamping it, since a clamp still trusts a corrupt-but-plausible number into
  the layout. A range check is the same rule as a vocabulary check, not an exception to
  it. `colWidths` — the tree's property columns, one width each — is that same range check
  per ENTRY (`eachInRange`, which is `inRange` run over a map), and the granularity is the
  whole point: a bad number is one column back at the default, never every column reset,
  and a `colWidths` that is not an object at all is no widths. Every other reader refuses
  its value whole, which is right for one pick and wrong for a collection of independent
  ones. Its keys are property ids rather than paths, so it is a `prefs` value for the
  reason the shelf's hidden types are, and nothing prunes it: a property hidden for an
  afternoon comes back the width its reader left it. The map it builds sits on a NULL
  prototype, here and in the live copy alike, so a column a Base calls `constructor` or
  `__proto__` is a plain width rather than something inherited off `Object` — or, on an
  object literal, a rewritten prototype. `focus` is checked for SHAPE only, not against
  the vocabulary: the
  type list lives in `domain/typeVocabulary.ts` and `focusTarget` already answers a name no
  configured type matches with "no focus" — the same tolerance it had while this value
  lived in the `.base`.
- The focus level is the one piece of this that is also an input to the MODEL, not just to
  a render, which is why the view restores before it builds (`refreshFromData`) rather
  than after. Restoring later draws the whole tree until something else refreshes it.
