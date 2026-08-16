---
type: PBI
parent: "[[Dependencies]]"
order: 30
status: Done
closed: 2026-08-08
priority: P2
created: 2026-08-08
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: 2026-08-09
risk: ""
assignee: ""
---

# Linking two items

**As** someone stating that one thing waits for another, **I want** to pick the
prerequisite from a menu, **so that** the ordering can be recorded without a timeline, a
pointer, or a date on either note.

This is the path that has to exist. WCAG 2.2 SC 2.5.7 requires a single-pointer
alternative to every dragging movement — the obligation the board and the roadmap already
carry ([[Keyboard, menu and touch]], [[Keyboard and menu on the roadmap]]) — so
[[Draw a dependency between bars]] is a second way to do this one, never the only way, and
this note ships first for that reason. It also reaches further than the drag can: a
dependency is a property of the note, not of the timeline, so it is offered wherever a
work item renders — a tree row, a board card, a roadmap row — and two undated items can be
ordered long before anyone decides when either happens.

The offer is asked of the **plan**, never of a comparison written beside it: an entry that
would write nothing is not offered. That rule is here because it has already been broken
here — the Set menus' checkmarks drifted from their plans the moment a second property
joined — and a suggester full of picks that quietly do nothing is the same defect wearing
a different control.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user opens the context menu on a work item |
| **Preconditions** | The dependency property is bound, or is one the first pick would bind ([[Bind a property by using it]]) |
| **Guarantee** | The write lands on the item the menu was opened on and on no other note; it is one batch through the one gate, taken back by one undo. A note the Base excluded is never written to and never offered as a target of a write. Every offer is one that would change something. |

**Main flow**

1. On a result, the menu offers **Depends on…** and, whenever the note **carries the key at
   all**, **Remove dependency…**. The key's presence is the test, not the list's contents:
   a value that reads as no dependencies is still a value on disk, and a control keyed to
   what the reader parsed could not offer to remove what the parser discarded.
2. **Depends on…** opens a suggester over the Base's results, offering only picks that
   would write something: not itself, not what it already waits for, not anything that
   would close a loop.
3. Picking one plans a single write — the prerequisite appended to the dependent's own
   list — and applies it through the same gate every other write here goes through
   ([[Safe writes]]).
4. **Remove dependency…** offers **everything the list holds** — each prerequisite by name,
   each broken entry that still resolves within the model by the note it names, and each
   broken entry naming nothing this base loaded by the raw text it holds, since raw text is
   the only identity that kind has — and picking one removes every entry that line stands
   for. Removing the last one removes the key rather than leaving an empty list behind.
   Where the list holds nothing the view can name at all, the one thing offered is to
   remove the key itself.

**Extensions**

- **1a — the dependency property is CLEARED.** Neither entry appears: clearing is how a
  user says *not this one*. An unbound key is no longer this case — since 2026-08-11
  **Depends on…** is offered on a key nobody has named and picking one binds it
  ([[Bind a property by using it]]), because a property this view withheld its own naming
  action for was a feature that gated itself shut. **Remove dependency…** still needs the
  key, since without one the note carries nothing to take away.
- **1b — the item is outside the Base's filter.** Neither entry appears, alongside the
  other write actions the context menu already withholds. It renders, it parents, and that
  is all.
- **1c — the configuration has problems.** The gate refuses the batch loudly, as it
  refuses every other write while `configProblems` is non-empty. Nothing here gets its own
  variety of refusal.
- **2a — every candidate is already a prerequisite, or would close a loop.** A `Notice`
  says so and the suggester never opens at all — not with nothing in it. An empty picker
  reads as a bug in the picker rather than as a fact about the plan.
- **2b — the prerequisite is a result the reader cannot currently see.** Still offered: the
  Base's results are the vocabulary, and "Show completed items" and the focus level narrow
  what is *drawn*, not what exists. The link is to a note, not to a row.
- **2c — an item outside the filter would be a legal prerequisite.** Not offered. It is
  never written to here — the write lands on the dependent — but offering it would make an
  excluded note part of this base's vocabulary, which is the same rule that keeps its state
  out of the Set menu.
- **2d — the candidate stops being legal, or the item itself leaves the Base, before the pick
  lands.** The suggester is built from a moment, and the model can be rebuilt while it sits
  open, so choosing a candidate re-asks `candidates` of the LIVE model — the same rule that
  built the offer — rather than trusting the list the menu opened with. A pick that would
  now repeat a prerequisite or close a loop writes nothing, and a `Notice` says so: "every
  offer would change something" is a promise about the write, and it is only true at write
  time if it is checked again at write time. The item the menu was opened on is asked the
  same question, separately from the candidate: it can leave the Base's results the same
  way a candidate can, and a note missing from the live model entirely — not merely
  `outsideFilter` — is exactly as unwritable as one the model still lists that way. That
  half of the recheck guards **Remove dependency…** too, which has no candidate to lose
  legality but has the same source that can.
- **2e — the note a choice names is RENAMED, DELETED, or replaced by a different note
  under the same name, before the pick lands.** Three answers, and a path tells none of
  them apart: Obsidian renames by mutating a note's one file object, so a rename is the
  same note wearing a new path and a delete-and-recreate is a different note wearing the
  old one. A rename must not cost the user their pick — **Remove dependency…** therefore
  names the note it will clear by file and reads the path only when the choice lands, so
  it follows the rename and clears the entry Obsidian rewrote. A replacement must never
  inherit one: both pickers compare the file itself, so a pick that would now write a
  link to, or into, a note nobody chose writes nothing and says so with the 2d `Notice`.
  A deletion gets that same `Notice` rather than a quiet close — nothing resolves to the
  note any more, so there is no line left for that pick to take out. The entry stays,
  and reopening the picker offers it as unresolved raw text, which does remove it.
  Silence is the thing refused here: a pick that cannot do what it says has to say so,
  or the reader is left believing a removal happened.

  That last sentence is the rule; the three cases are not the whole of it. A removal was
  built guard by guard — renamed, then replaced, then deleted — and each guard left the
  next case silent, which is how a list of cases fails and a rule does not. What a
  removal actually needs is one question asked of the LIVE SOURCE: does its own list
  still hold a line this pick would match. Every way a pick goes stale is that question
  answered no, including the two no case-by-case guard reached — an entry deleted or
  respelled by hand, and a source that simply stopped naming the target while the target
  itself went on existing. **Remove dependency…** asks that one question, and the three
  cases above are consequences of it rather than clauses in it.
- **3a — the write takes the note out of the Base's filter.** Nothing reports it, and that
  is deliberate rather than forgotten: a filter can name the very property being written,
  so the row can leave in silence. [[The outcome report was built from one sentence]]
  records why the mechanism that would report it does not exist, and this note inherits
  that answer rather than reopening it.
- **3b — the user takes it back.** One undo, because it was one batch. A dependency write
  has no peers: it renumbers nothing, cascades to nothing, and touches exactly one note.
- **3c — the prerequisite moves between the write and the undo.** 2e's three answers
  again, now on the replay side, and the promise is the same one stated from the other
  end: **undo acts on the line it wrote, identified by the NOTE that line was about.**
  A rename is that note wearing a new path, so the undo follows it — the live line
  Obsidian rewrote is the one taken back, and a user who typed the *old* name themselves
  keeps theirs. A replacement is a different note wearing the old name, so the undo
  declines: it neither takes a line naming the replacement nor writes one, because a
  dependency nobody picked is worse than an undo that reports doing nothing. A deletion
  leaves the line broken and claimed by nobody, so it is still this write's — taken back
  when it added one, and put back as the broken line it now is when it removed one, which
  is what the note would be saying had the removal never happened.
  What makes those three decidable at all is that Obsidian mutates a note's one file
  object on a rename and rewrites the links that exist, so the file's own path is always
  current on both sides. The mechanism is `src/storage/CLAUDE.md`'s **Undoing a
  prerequisite**; what belongs here is that the three answers are a consequence of one
  rule and not three behaviours. They were built as three, over six review rounds, each
  fix the source of the next finding.
- **4a — the last prerequisite is removed.** The key is removed, not emptied. Absence is a
  value here as it is for every optional property, and an empty list left on disk is a
  value the reader would then have to be taught to ignore.
- **4b — the entry to remove is a broken one.** Offered like any other. An entry that still
  resolves within the model — a self-reference or a link in a cycle — names a note this
  base loaded, so it reads as that note: grouped and labelled by its title and path, the
  same as a prerequisite that isn't broken. An entry naming nothing this base loaded has no
  such note, so it reads as its own raw text instead — the only identity that kind has.
  Either way one line stands for **every** repeat, so `["[[Missing]]", "[[Missing]]"]` is
  gone in one action rather than leaving the identical marker on screen. The collapsing
  that makes a picker line stand for several entries is the reading side's, and it does not
  care whether the entry resolved. This is the whole cleanup path for a
  mistyped name, a self-reference or a link in a cycle, and it has to exist here or the
  marker the reader is being shown has no answer but hand-editing frontmatter — a marker
  pointing at a repair the view refuses to make. The register already settled this
  direction for the other link field: [[Broken links still render]] marks damage rather
  than tidying it, *and* clears a stale `parent` on the drop that would otherwise appear to
  do nothing. Marking is a refusal to repair **silently**, never a refusal to let the user
  repair. An unresolvable entry is also the one case with no name to offer, which is why
  step 4 is written about what the **list holds** rather than about what the item waits
  for: the resolved reading has nothing to say about a name that resolves to nothing.
- **4c — the stored list names the same prerequisite more than once.** Removing it removes
  **every** raw entry that resolves to it, not the first one found. The reading side
  collapses duplicates and differing spellings into one dependency
  ([[Dependencies as a property]]), so what the picker offers is one entry for a list that
  may hold several — `[A, A]`, or `[[A]]` beside a bare `A`. A removal that dropped one of
  them would report success and change nothing a reader could see: the next refresh
  collapses what is left back into the same single dependency, which is the shape of bug
  that gets diagnosed as "the write did not land". Removal is defined against the
  **resolved** dependency, the same unit the offer was made in, and the key goes when no
  entry survives.
- **4d — the key is there but reads as nothing** — `dependsOn: ""`, or a list of blanks.
  The reading side discards blanks ([[Dependencies as a property]]), so there is no
  prerequisite and no raw text worth naming; the picker offers one entry, which removes the
  key. Without it the value is unreachable from here in either direction — a picker keyed to
  the parsed list would be absent or empty, and the key would stay on disk with no control
  able to touch it, which is the one state this note's own rule against leaving an empty
  list forbids. It is also the state ✨ would produce if [[Dependencies as a property]] did
  not exempt this key from the stub pass, and a hole reachable by hand is worth closing
  whether or not the view can create it.
## Acceptance criteria

- Both entries appear only on results, and neither appears where the dependency property is
  CLEARED. The two part company on an UNBOUND key, and that split is
  [[Bind a property by using it]]'s subject: **Depends on…** is offered, because picking one
  is what names the property, while **Remove dependency…** is not, because with no key the
  note carries nothing to take away. *Only with the key bound* was the rule for both until
  2026-08-11.
- **Remove dependency…** appears whenever the note carries the key, judged on the key's
  presence rather than on what the reader parsed out of it.
- Any value the key can hold is removable from here. A note left carrying the key with no
  control able to clear it is the state this feature must never produce or tolerate,
  whatever the value is — a name, a broken name, repeats, or nothing at all.
- Every pick offered would change something: a pick that would write nothing is absent, and
  absence is decided by the plan the pick would produce rather than by a comparison written
  beside it.
- A pick that would close a loop, name the item itself, or name a note outside the filter is
  never offered.
- The write lands on the item the menu was opened on and on no other note, through the one
  gate, taken back by one undo.
- **Remove dependency…** offers every entry the list holds, including the ones that became
  no edge, so a broken dependency is removable here and needs no hand-edited frontmatter —
  no marker the view shows is a repair only the file can make.
- Removing a dependency removes every raw entry the offered line stands for — duplicates and
  alternate spellings alike — so it is gone after one removal rather than reappearing on the
  next refresh; removing the last one removes the key.
- [[The string catalog]] is itself unbuilt design, so this is a forward dependency rather
  than a criterion met today: these strings join the catalog, with the rest of the
  plugin's, once that note is built.

## Where it lives

**Built.** The two entries are `src/view/interactions/dependencies.ts`, added to the row
menu by `src/view/interactions/menu.ts` inside its `editable` block — which is where the
context-row rule is kept for this feature, and deliberately the ONLY place: a second
`outsideFilter` test in `dependenciesAvailable` was written, found to be unfalsifiable
because the block already withheld the entries, and removed. A guard that cannot fail is
a guard that goes on reading as a guarantee after the real one moves.

The picker is `src/ui/itemSuggest.ts`, one `FuzzySuggestModal` given a different list each
time and knowing nothing about prerequisites — which is what lets the same modal offer the
notes an item may wait for and the entries it currently waits on.

**The write has a sibling, and this note used to say it did not.** The earlier version of
this section said the module's two existing shapes take no list, so an implementer adds an
operation rather than calling something already written. The first half is right and the
conclusion was wrong: `applyTagDelta` is the same shape — a delta rather than a computed
list, applied to whatever the note holds *right now* inside `processFrontMatter`, returning
what actually changed so undo gets its inverse, and deleting the key when the last entry
goes. `applyDependsOnDelta` in `src/storage/dependsOnWrite.ts` is modelled on it and
inherits its reason exactly: a menu row can be a refresh behind the note. That includes the
half easiest to drop — an add checks the live list first, so a prerequisite that arrived
between the menu opening and the pick landing is not appended twice, and an add that
changed nothing captures no inverse and spends no undo slot. `removeKey` keeps the same
guard rather than an unconditional delete: 4d's picker line is offered against a value
that reads as nothing, and the pick can land after the note gained a real dependency, so
the key only goes while the live value still reads that way — a stale removal must find
nothing changed, not erase what arrived in between.

`setOwn` — the `__proto__`-safe key write every user-configured property goes through —
moved to `src/storage/ownProperty.ts` in the same change, and that is a structural fix
rather than tidying: two writers need it, and `dependsOnWrite.ts` reaching back into
`frontmatter.ts` for it made an import cycle. The rule belongs to neither writer in
particular, so it belongs to neither file.

`DependsOnDelta` (`src/domain/writePlan.ts`) is what makes 4b, 4c and 4d one rule rather
than three: `removePath` drops every live entry resolving to a note, `removeRaw` every
entry whose text matches, `removeKey` the property outright. The first two restore as a
DELTA like the tags; the third is a KEY write captured by `touchedKeys`
(`src/storage/writeKeys.ts`) exactly as `removeStateKey` is — listing it for both would
have undo put the prior value back *and* replay the inverse over it.

Driven in `test/view/dependencyMenu.test.ts` from this note's criteria, and swept for
context-row safety by `test/view/contextRowWrites.test.ts`, which now picks from any
suggester a command opens: a menu entry that merely OPENS a picker has written nothing yet,
so leaving it open would sweep the entry and not the write behind it.
