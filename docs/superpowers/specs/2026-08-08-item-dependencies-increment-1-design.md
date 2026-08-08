# Item dependencies, increment 1 — the property and the menu

**Date** 2026-08-08
**Delivers** two PBIs already registered: `[[Dependencies as a property]]` and
`[[Linking two items]]`, both under `[[Dependencies]]`. Both currently say
"Nothing yet — this note is design."

## Why this increment

`[[Dependencies]]` is designed in four PBIs and none of them is built. The order they
ship in is a real decision, not a formality, because two of them are entangled:
`[[Dependencies as a property]]` 4d says a broken entry is **marked in the model** and
that exactly two surfaces read the mark — the dated timeline (`[[Arrows between bars]]`)
and **Remove dependency…** (`[[Linking two items]]`). The removal path is also the *only*
repair a broken entry has: 4b of `[[Linking two items]]` says without it "the marker the
reader is being shown has no answer but hand-editing frontmatter — a marker pointing at
a repair the view refuses to make".

So the read and the removal belong in the same increment. Property + arrows would ship a
marker with no repair; property alone ships nothing anybody can use. Property + menu is
the smallest slice that is coherent on its own terms: every mark it produces, it can also
clear, and it needs no geometry, no window, no conflict rule and no second projection.

`[[Arrows between bars]]` and `[[Draw a dependency between bars]]` are increment 2 and 3.
`[[Linking two items]]` already states that it ships before the drag, because WCAG 2.2 SC
2.5.7 makes the menu the obligation and the gesture the alternative.

## Scope

**In:**

- The `dependsOn` key as an optional property: a view option, the collision report, ✨
  adoption, and an exemption from the stub backfill.
- A tolerant read of a link **list** — one entry or many, wikilink or bare name, blanks
  dropped, duplicates preserved for the removal path.
- Resolution against the item set the model keeps, with unresolvable, self-referential
  and cycle-participating entries marked broken in the model.
- **Depends on…** and **Remove dependency…** on the work-item context menu, over one
  suggester, through the existing write gate and undo.

**Out — and each is out for a stated reason, not for want of time:**

- Arrows, conflict marking, and everything about the dated timeline. That is
  `[[Arrows between bars]]`, whose eight extensions are geometry and comparison rules
  that need none of this increment's decisions reopened.
- The drag between bars. `[[Draw a dependency between bars]]`, and it is a second input
  onto this increment's write, not a second write.
- Any display of a dependency or its broken mark on a tree row, a board card or a bucket
  card. `[[Dependencies as a property]]` 4d refuses the promise, not the feature: three
  display decisions in three notes that own those rows, and nobody has asked.
- A reverse `dependents` field on the item. Nothing in this increment walks the graph
  backwards; `[[Arrows between bars]]` can add one when it has a reason to.
- Auto-scheduling, of any kind, ever. `[[Dependencies]]` refuses it on the epic's own
  rule.

## Behaviour

### The key

`dependsOn` joins the optional properties, with `dependsOnProperty` as its view option
id and `dependsOn` as its suggested key — the name the Tasks plugin already uses, offered
as a placeholder and never matched by name.

Being one of the optional properties is what supplies most of the PBI's first extension
set, rather than any code written for dependencies:

- **1a — collision.** `ownedProperties` already lists every optional property, so a key
  that collides with another gets the same `configProblems` report every other pair gets,
  and gates every write the same way.
- **1b — ✨ binds it.** `adoptableProperties` already offers every option nobody has
  touched.
- **Step 1 of `[[Linking two items]]` — "judged on the key's presence rather than on what
  the reader parsed".** The model already tracks `ownKeys` per optional field. That is
  precisely the test the removal control needs, and it is already there.

The one thing that has to be **written** is the exemption from the stub pass:
`missingKeyStubs` walks every configured optional field and stubs each result that lacks
it, with one exemption today (the horizon key with no bucket axis), spelled as its own
early return. This is a second early return with its own reason — an empty prerequisite
list is a claim about a relationship that does not exist, and it is exactly the state the
removal path is required never to leave behind, so backfilling one would have ✨ create
what a remove must clean up. It is not inherited by being a list, and not folded into the
horizon test.

### The read

A new `readLinkList` in `src/domain/noteFields.ts`, beside `resolveParent`, which already
does four of the five things needed:

1. Obsidian's `frontmatterLinks` cache keys a list entry as `dependsOn.0`, `dependsOn.1`.
   `resolveParent` already matches `key` **or** `key + '.'` — the dotted form was written
   for this shape and is the reason a list needs no second parser.
2. Entries that are not in the link cache (a bare name, no brackets) fall back to the raw
   frontmatter value, through the existing `linkpathFromRawValue`, which already strips
   brackets, aliases and heading refs.
3. Blank entries are dropped (2b). A single string rather than a list is one entry (2a).
4. Each entry is returned as **both** its raw text and its resolved `TFile | null`.

The one difference from `resolveParent`: **duplicates are preserved here.** `[[Linking two items]]` 4c requires removal to drop every raw entry an offered line stands for, so
the raw list has to survive the read intact. Collapsing happens at resolution, where it
is a statement about dependencies rather than about YAML.

Reading writes nothing, reorders nothing and repairs nothing.

### Resolution and the broken mark

A new module `src/domain/dependencies.ts`, one pass called from `buildModel` **after
`assignAll`** — which is after `pruneOutsideHierarchy`, so the set an entry resolves
against is the set the model keeps (3b), and every field it writes belongs to a phase
that can see every item that survives.

Per item:

- An `outsideFilter` item's own list is not read at all (3c). It may be *named* by a
  result and that produces an edge (3a); it may not do the naming.
- Each raw entry resolves against `byPath` and nothing else. **No note is loaded to make
  one resolve** (3b), so an entry naming a note this base never returned, or one the
  prune dropped, simply does not resolve — and nothing calls it mistyped, because
  telling that apart needs a lookup this layer does not make.
- Entries that became an edge collapse to one dependency each: duplicates and differing
  spellings of the same note are one prerequisite.

Two fields land on `BacklogItem`: the resolved prerequisites, and the raw text of every
entry that became **no** edge. Nothing else about the item changes — no level, depth,
rank, parent or visibility — so the tree's shape is identical with the property
configured and without it.

**Broken is three cases and one algorithm.** An entry is marked broken when it does not
resolve, when it names its own item (4a), or when it takes part in a cycle (4b). The
cycle rule is that **every** entry in the cycle is marked, never the one that closed it,
because "the one that closed it" is a fact about the traversal order and would move
between the two notes when the Base re-sorts.

That rule falls out of **Tarjan's strongly-connected components**: build the resolved
edge set, run it once, and an edge is broken exactly when both of its ends share a
component. A self-loop is a component of one containing a self-edge, which is 4a for
free. Order-independence is a property of SCCs rather than a rule laid over the walk, so
the acceptance criterion — build `A → B → A` with the entries in either order, both edges
broken both times — passes by construction. A cheaper back-edge DFS was considered and
rejected: it marks the edge that closed the cycle, which is the answer 4b refuses.

Cost is one pass over the declared entries plus one linear SCC run: `O(n log n + E)` for
the model, stated in `E` because nothing caps how many prerequisites an item may name.

### The write

`ItemWrite` gains a dependency delta, applied by a new `applyDependsOnDelta` in
`src/storage/frontmatter.ts`.

**It is written beside `applyTagDelta`, and modelled on it.** `[[Linking two items]]`'
"Where it lives" says the module's two existing shapes take no list and that an
implementer therefore adds an operation rather than calling something already written.
The first half is right and the conclusion is right — but the note omits the sibling this
operation has. `applyTagDelta` is the same shape: a **delta** rather than a computed
list, applied to whatever the note holds *right now* inside `processFrontMatter`,
returning the delta that actually changed so undo gets its inverse, and deleting the key
when the last entry goes. Dependencies inherit its reason exactly — a menu row can be a
refresh behind the note, and two removals each computed from one stale list would put the
first entry back. The register note is corrected as part of this increment.

The delta:

- **Add** carries a wikilink to the prerequisite, appended to the live list. The write
  lands on the dependent — the note the menu was opened on — and on no other note.
- **Remove** carries either a resolved target path or a raw text, and drops **every**
  live entry that matches it. That is 4b and 4c in one rule rather than two: a resolved
  dependency however many times and however spelled, or a broken entry however many times
  repeated.
- When nothing survives, the key is removed rather than emptied (4a of `[[Linking two items]]`). Absence is a value.
- An unconfigured key is never written to.

One batch, one undo (3b). It renumbers nothing and cascades to nothing.

### The menu

Two entries in `src/view/interactions/menu.ts`, both offered only on a **result** and
only with the key bound (1a, 1b of `[[Linking two items]]`). `Remove dependency…` is
additionally gated on `ownKeys.dependsOn` — the key's presence, not the parsed list.

Both open one new `FuzzySuggestModal` subclass, `src/ui/itemSuggest.ts`, given a different list each
time.

**Depends on…** offers the Base's results, minus:

- the item itself,
- notes it already waits for,
- anything **reachable from this item** along the resolved edges — adding "item depends
  on c" creates the edge `c → item`, which closes a loop exactly when a path already runs
  from `item` to `c`. One DFS over a graph this increment has already built.
- every `outsideFilter` note (2c): never written to here, but offering one would make an
  excluded note part of this base's vocabulary.

A result the reader cannot currently see — hidden by the focus level or by "Show
completed items" — **is** offered (2b): the link is to a note, not to a row. When nothing
is left to offer, the modal says so rather than opening empty (2a).

Every offer would change something, and that is decided by the plan the pick produces,
never by a comparison written beside it — the rule the Set menus' checkmarks broke.

**Remove dependency…** offers everything the list holds: each resolved prerequisite by
name, each entry that became no edge by the raw text it holds, and — when the key is
present but reads as nothing at all — one entry that removes the key (4d). Picking one
removes every raw entry that line stands for.

Every string added goes through the catalog, like every other.

## Architecture

| Module | Change |
| --- | --- |
| `src/domain/viewOptions.ts` | one `dependsOnProperty` option |
| `src/domain/settings.ts` | one entry in the optional-property table; resolution follows |
| `src/domain/noteFields.ts` | `readLinkList`, beside `resolveParent` |
| `src/domain/dependencies.ts` | **new** — resolution, the broken mark, SCC, legality |
| `src/domain/model.ts` | one call after `assignAll`; two fields on `BacklogItem` |
| `src/domain/writePlan.ts` | the delta on `ItemWrite`; the stub-pass exemption |
| `src/storage/frontmatter.ts` | `applyDependsOnDelta`, beside `applyTagDelta` |
| `src/view/interactions/menu.ts` | two entries |
| `src/ui/itemSuggest.ts` | **new** — one suggest modal, used for both lists |

Resolution is its own module rather than a pass inside `model.ts` for the reason the
architecture states — one file per concern — and because `model.ts` is close enough to
the 400-line cap that the question would be decided by lint anyway.

No stylesheet partial: this increment draws nothing.

## Testing

Node tests, in `test/domain/`:

- The read: one entry and many, wikilink and bare, blanks, repeats, a key present but
  empty, a key absent.
- Resolution: an edge to a result; an edge to an already-loaded excluded ancestor (3a);
  an entry naming a note the base never returned; **an entry naming a note the prune
  dropped**, built as a model whose base returns a meeting note — which checks the pass
  order without asserting anything about which pass ran first.
- The marks: unresolvable, self-reference, and `A → B → A` built with the entries in
  either order, asserting both edges broken both times.
- The invariant that no item is hidden, re-parented, re-ranked or re-levelled: the same
  fixture built with the key configured and without it produces the same tree.
- No rollup: a parent does not acquire a child's prerequisites.
- Legality: the candidate set excludes self, current prerequisites, loop-closers and
  context rows.

jsdom tests, in `test/view/`:

- Both entries appear on a result with the key bound, and neither appears with the key
  unbound, on a context row, or when `configProblems` is non-empty.
- `Remove dependency…` appears on a note carrying an unparseable value, and its single
  offer removes the key.
- The write lands on one note, as one batch, taken back by one undo.
- Removing a dependency the list names twice, or names two ways, leaves nothing behind.
- **The new write path is driven through `test/view/contextRowWrites.test.ts`**, which
  exists so a write path nobody predicted fails the context-row rule without anyone
  enumerating the surfaces.

Not checkable here: the modal's appearance and the menu's feel in a real vault. That is
an `npm run test-build` smoke check, and this increment is not done without one.

## Register work

- `[[Dependencies as a property]]` and `[[Linking two items]]`: replace "Nothing yet —
  this note is design" with real `## Where it lives` sections. `docs-check.mjs` rule 7
  requires both new modules — `src/domain/dependencies.ts` and `src/ui/itemSuggest.ts` — to be
  specified in one of them.
- `[[Linking two items]]`' "Where it lives" also loses its claim that the write has no
  sibling in `frontmatter.ts`: `applyTagDelta` is the shape this one copies, and the
  paragraph should say so rather than sending an implementer looking for nothing.
- `src/domain/CLAUDE.md` gains the phase answer for the two new fields, as it asks of
  every new field.

## Definition of done

`npm run check` — build, lint, coverage-thresholded tests, fallow, docs register — plus
the live-vault smoke check named above.
