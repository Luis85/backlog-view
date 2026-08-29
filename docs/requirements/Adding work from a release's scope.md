---
type: PBI
parent: "[[Putting work in a release]]"
order: 30
status: Active
created: 2026-08-29
source: user request — add tasks to items in the release view with the right-click menu, 2026-08-29
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Adding work from a release's scope

**As** someone shaping what ships, **I want** to add a child item to a row of the release's
scope tree without leaving the release, **so that** the work I find missing while reading the
release is filed into that release in one gesture rather than four screens away.

[[Setting an item's release]] names a release on work that already exists;
[[Creating a release from the release view]] brings the release note itself into being. This
is the third act neither covers: bringing the WORK into being, already in the release the
reader is looking at.

**The new note carries the release in the same write.** Membership is one property on the
item's own note and never cascades from a parent ([[The scope of a release as a tree]]), so a
child created here without it would be parented correctly, be a member of nothing, and not
appear on the screen the gesture was made from — a press that reads as having done nothing.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone shaping a release |
| **Trigger** | The user right-clicks a row of the scope tree, or presses the Menu key (or Shift+F10) on the row the tree's roving selection marks |
| **Preconditions** | A release is open, so the membership property is bound and a tree is on screen |
| **Guarantee** | Picking a type and confirming a title creates exactly one note — hanging from the row it was made on, ranked after that row's existing children, and naming the open release. **The row itself is never written to**, whether it is a member or a context ancestor |

**Main flow**

1. The user opens the menu on a scope row.
2. The menu offers one **New \<type\>** entry per type that row may hold, and nothing else.
3. The user picks a type and enters a title.
4. Confirming creates the note with its type, its parent link, its rank and this release's
   membership property, and says what was created.
5. The next pass over the base draws the new note under the row it was made from.

**Extensions**

- **1a — the row is a context ancestor rather than a member.** The menu is offered in full.
  Creating a child writes a DIFFERENT note, which is the one mutation still fair game on a row
  every editing action is withheld from — and the note it writes joins this release like any
  other.
- **2a — the row can hold nothing** (a marker, or the bottom of its own ladder with no extra
  type beneath it). No menu is opened at all, rather than an empty one: an empty menu reads as
  a feature that failed rather than one that does not apply here.
- **3a — the view options collide.** The press is refused with the problem named, before the
  title is asked for. Creation writes frontmatter like every other write path in this plugin
  and goes through the same gate; a dialog that collected a title and then refused would have
  spent the user's typing on a configuration they could have been told about at the press.
- **3b — the title is left blank.** Confirming is refused, exactly as every other creation in
  this plugin refuses it: the title is the note's own name.
- **4a — the release stopped being a release while the title was being typed.** Nothing is
  created, and it is reported. The prompt stays open for as long as the reader takes to
  type, so the note can be deleted or retyped in another pane meanwhile; a note born naming
  it would be born with an unresolved membership. Authorization at the moment the menu was
  offered is not authorization at the moment of writing, which is the rule
  [[Setting an item's release]] already keeps for every membership EDIT.
- **4b — the parent row is folded.** It is unfolded once the note lands, so the new child is
  not written somewhere the reader cannot see it.
- **4c — the creation fails.** It is reported, and nothing is left half-written: the note is
  one `vault.create` carrying its whole frontmatter, so there is no state in which it exists
  without its parent, its rank or its release.
- **5a — the base's own filter excludes the new note.** It is created and does not appear.
  Nothing reports that, and nothing in this plugin can: [[New cards in place]] owns the
  question, and `docs/issues/The outcome report was built from one sentence.md` records why a
  report built beside one write is the wrong shape for it.

## Acceptance criteria

- **Both inputs are one menu and one create.** The pointer's `contextmenu` and the keyboard's
  Menu / Shift+F10 build the same menu and land on the same creation function, so neither can
  grow its own idea of what creating a child from a release means.
  `test/view/release/scopeCreate.test.ts` drives each.
- **The created note carries four things and is asserted on the vault**: the type picked, a
  parent link to the row, a rank past every ranked child that row already has, and the open
  release in this view's own membership property. Asserted after the real gesture rather than
  at the call, because a well-formed call writing the wrong properties would leave every spy
  in `test/view/releaseNeverEdits.test.ts` green.
- **The membership key is the RELEASE view's own**, never whatever the backlog resolver makes
  of this configuration. The two views may legitimately be pointed at different properties,
  which is [[Putting work in a release]]'s rule read from the writing side.
- **An unconfigured membership key is written nowhere.** Kept at `createBacklogItem` rather
  than at the surface that offers the release, so it holds for a caller nobody has written yet
  — `test/storage/createNote.test.ts`.
- **The release is re-read at the moment of writing, not trusted from the row.** The same
  guard the edit path uses (`refusesLiveMembership`, `src/domain/releases.ts`), asked before
  `createBacklogItem` rather than when the menu was built.
  `test/view/release/scopeCreate.test.ts` retypes the release while the prompt is open and
  asserts nothing was created.
- **A `Release` is seeded no membership**, under the identical rule that already refuses it a
  horizon, an iteration and that iteration's dates: a release is not put inside another
  release by the screen that happened to make it.
- **A context row takes the create and is not itself written.** `vault.writeLog` is empty
  after the gesture, which is the check that the parent was read and never edited.
- **The row menu offers nothing else.** Every entry is a create; the whole of what this screen
  may do to a note that already exists is still nothing
  ([[The scope of a release as a tree]]'s own guarantee, and
  `test/view/releaseNeverEdits.test.ts`).
- **A right-click that lands on no row does not consume the pane's own menu.** The default is
  prevented only once a row is resolved.

## Where it lives

`src/view/release/scopeCreate.ts` is the whole of it: the two listeners, the menu, the title
prompt and the one function that creates. It is DELEGATED onto the tree element rather than
wired per row, and wired by `src/view/release/renderScope.ts` as a third step beside
`src/view/release/scopeKeys.ts` — that module already holds the draw and the plan settings,
so the leaves stay acyclic, and `drawRow` in `src/view/release/scopeTree.ts` already takes the
five arguments lint allows and could not have carried a sixth.

The keyboard's half reads `ReleaseView.activeScopeFile` rather than an index of its own, so
the two controllers on one tree cannot disagree about which row is active.

What may be created is `childTypeChoices` (`src/domain/itemTypes.ts`), the same ladder question
the backlog's own row menu asks; where the note lands is `folderForType` beside it, then the
view's home folder, then the parent row's own folder — a chain that cannot run out, which is
why no folder is ever asked for here. The refusal is `configProblems`
(`src/domain/settingsConsistency.ts`), the gate every write path in this plugin goes through.
The prompt is `TitlePromptModal` (`src/ui/prompts.ts`), the leaf dialog the backlog's own
creation uses.

What refuses a stale target is `refusesLiveMembership` (`src/domain/releases.ts`), the
guard `src/storage/frontmatter.ts` already puts in front of every membership edit, called
here for the same reason it exists there — it reads the note's type off the metadata cache
rather than off the model, so a release deleted or retyped since the menu opened is caught.

The write itself is `createBacklogItem` (`src/storage/createNote.ts`), which gained one
optional field for this — the release, as a `TFile` rather than a name, since two releases may
share a basename — written under the same three conditions the iteration key beside it is
written under: the surface offered one, the vault has a property for it, and the type may hold
what a surface adds. `src/view/release/releaseView.ts` is what supplies that property, layering
this view's own `membershipKey` onto the settings it hands the scope screen as a fourth model
mapping beside the type, parent and order keys.

Nothing here reaches `applyWrites`, `applyRestores` or `applyPropertyWrites`
(`src/storage/frontmatter.ts`, `src/storage/propertyWrite.ts`), which is what keeps the release
view's standing claim intact: it creates notes and its own config, and never edits a note that
already exists.
