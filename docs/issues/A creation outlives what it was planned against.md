---
type: Issue
order: 110
parent: "[[Creating items]]"
status: Open
priority: P3
area: design
created: 2026-08-29
source: automated review of PR 214
files:
  - src/view/interactions/create.ts
  - src/view/release/scopeCreate.ts
  - src/storage/createNote.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A creation outlives what it was planned against

## The limitation

Every creation in this plugin is planned when a control is pressed and written when a
title prompt is submitted, and **everything captured in between is a snapshot**. The
prompt is open for as long as the reader takes to type, which is the longest window
anything in this plugin holds a plan across — longer than any batch, since a batch is
awaited writes back to back and this is a person deciding on a name.

Three things are captured and only one of them is re-read:

- **The parent note.** `createBacklogItem` is handed a `TFile` and spells a wikilink from
  it (`src/storage/createNote.ts`), asking nothing about whether the vault still holds it.
  Delete the parent while the prompt is open and the child is born with a parent link that
  resolves to nothing — a root, rather than the child of the row the gesture was made on.
  Both creation paths do this: `src/view/interactions/create.ts` passes
  `parentItem?.file ?? null`, and `src/view/release/scopeCreate.ts` passes `row.item.file`.
- **The settings the mappings were resolved from.** The prompt's submit callback closes
  over the `BacklogSettings` of the render that opened it, so a property option changed
  behind it writes the new note under the previous key. In the release scope tree that is
  `membershipKey`: the note is created, correctly parented and ranked, and is a member of
  the release under a key the view has stopped reading — so it does not appear on the
  screen the gesture was made from.
- **The rank basis.** `endOfChildrenOrder` reads `row.item.children` from the last render,
  so a sibling created behind the prompt can take the rank this one is about to claim.
  Two notes then share an `order`, which the tree already tolerates.

The **release target is the exception** and is re-read: `refusesLiveMembership`
(`src/domain/releases.ts`) is asked immediately before `createBacklogItem`, so a release
deleted or retyped behind the prompt refuses the creation rather than making a note whose
membership cannot be resolved. That guard exists because the EDIT path already had it —
`applyWrites` calls the identical function — so the scope tree's creation was measurably
inconsistent with a rule this codebase had already written down. Nothing equivalent exists
for a parent or for the settings, on either path.

## Why it is deliberate

**The parent check is not this feature's to add.** The behaviour is
`createBacklogItem`'s and predates the release scope tree by every version of the backlog
view's own `New <child>`. A guard in `scopeCreate.ts` alone would make two creation paths
disagree about what a create promises, which is worse than one shared gap: the fix belongs
in the shared writer, where one refusal covers both call sites, and that is a change to a
contract two features already rely on rather than something a PR adding one menu should
widen into. Same reasoning, one layer down, as
[[A stale release or iteration target can still be committed]].

**The settings re-read is refused for a sharper reason.** Resolving the mappings again
inside `scopeCreate.ts` would be a second resolver, which `ReleaseView.draw`'s own comment
names as the defect rather than the fix — two resolvers disagreeing at the model boundary
is the same shape as one view reading another's configuration. The correct form is to read
the value the ONE resolver already produced, late rather than early, which means a field on
the view rather than a closure. That is a small change and it is not made here, because the
window it closes is the narrowest of the three: Obsidian's `Modal` is app-modal within its
window, so the settings UI the finding describes is behind the prompt and unreachable while
it is open. What is left is a second window or a Sync pull from another device — which is
also what makes the parent and release cases reachable at all, and is why the release one
was worth a guard and this one was not.

## What would lift it

One refusal in `createBacklogItem`, asked of every `TFile` the spec carries — the parent
today, the iteration and the release beside it — so a creation planned against a note the
vault no longer holds fails loudly instead of writing a link to nothing. Both callers
already report a throw from it as `create.failed`, so neither needs to change. That is the
same generalization [[A stale release or iteration target can still be committed]] asks of
`WriteGate` for the EDIT path, and the two are worth doing together: between them they are
the whole of "authorization at plan time is not authorization at write time" for this
plugin.

Whoever takes it should decide the settings question in the same pass rather than
separately — a field on each view holding the settings its last render resolved, read at
submit, is the shape that closes it without a second resolver.

## Impact

Narrow and never silent corruption. A stranded parent link produces a note at the top level
instead of under a row — visible, and fixable with one drag. A stale membership key
produces a note that is not in the release it was made from — visible in the backlog view,
and fixable with `Set release`. A duplicated `order` is a tie the tree already breaks. In
every case the note exists and holds what the user typed; what is lost is a placement, and
all three need the vault to change behind an open modal, which needs a second window or
another device.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. If it is
taken up, put the parent refusal in `createBacklogItem` for both callers at once, never in
one of them.
