---
type: PBI
parent: "[[The roster comes from the notes]]"
order: 10
status: Done
created: 2026-08-22
source: user request
files:
  - src/domain/settings.ts
  - src/domain/settingsResolve.ts
  - src/domain/typeVocabulary.ts
  - src/domain/viewOptions.ts
  - src/i18n/en.ts
  - src/storage/createNote.ts
  - src/ui/prompts.ts
  - src/view/interactions/resourceNotes.ts
  - src/view/manual/setupSection.ts
  - src/view/render/toolbarControls.ts
  - styles/modals.css
  - test/domain/resourceFolder.test.ts
  - test/domain/viewOptions.test.ts
  - test/i18n/toolbar.test.ts
  - test/storage/createNote.test.ts
  - test/ui/prompts.test.ts
  - test/view/newResourceButton.test.ts
  - test/view/resourceNotes.test.ts
started: 2026-08-22
finished: 2026-08-22
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Making a resource from the timeline

**As** a delivery lead, **I want** to create a person as a note without leaving the resources
axis, **so that** a missing row is something I fix where I noticed it, instead of typing a
name into a view setting that makes text rather than a note.

The roster today is three sources and all of them are names ([[Rows from the Resource notes]]
collapses them): a comma-separated `resourceNames` option, the assignee strings the results
carry, and every absence's subject. Adding somebody with nothing assigned yet means the first
of those — a per-view setting, edited in a dialog, mid-planning, where a typo mints a second
colleague in silence.

**This is the first thing in the plugin that makes a `Resource` note.** [[A resource is not a
backlog item]] declared the name and kept its notes out of every backlog projection; nothing
created one, deliberately, because there was no surface that should. The resources axis is
that surface.

**The modal is `ValuePromptModal` reused, not a new dialog.** Extension 2a already says Name
alone is the whole modal, and Capacity and Role are not settings yet — so the dedicated
three-field dialog this note's own last paragraph once described arrives with [[Capacity on a
resource]] and [[A resource's role]], not here. What shipped is the existing prompt plus one
optional `duplicateWarning` line for extension 3a.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Pressing **New resource** in the toolbar's projection zone, on the roadmap's resources axis |
| **Preconditions** | The roadmap is on the resources axis |
| **Guarantee** | Either the note exists carrying the name and whatever CONFIGURED facts were given, or nothing was written at all — and either way the new note never enters the backlog |

**Main flow**

1. The user opens the roadmap on the resources axis. The toolbar's projection zone draws
   **New resource** beside the axis controls it already owns.
2. The user presses it and a dedicated modal opens: **Name** always, and **Capacity** and
   **Role** each only where that key is configured.
3. The user names the person, fills whichever other fields are offered, and submits.
4. A note is written into the resource folder with `type` and the name as its title, plus each
   configured field the user filled.
5. The note is recognised and refused as a backlog item, so nothing is added to the tree, to
   any board, to the item count or to any menu — the roster is where it shows up, and nowhere
   else.

**Extensions**

- **1a — any other projection, or the horizons or dated axis.** No control at all. It is
  drawn from `renderProjectionZone`, which is the one place the toolbar asks which
  projection this is, and `renderStateColorsButton` is the precedent for gating on the AXIS
  as well as the mode: a control offered where it means nothing claims a capability the
  screen does not have.
- **2a — neither optional key is configured.** The modal offers **Name** alone, and that is
  the whole modal rather than a degraded one. [[What a resource carries]] states the rule this
  follows: nothing there is required for a resource to exist, a note with a type and a name is
  a whole resource, and unnamed means unread and unwritten. So the modal grows a field when a
  key is named and needs no edit when [[Capacity on a resource]] and [[A resource's role]]
  ship.
- **3a — the name matches a resource that already exists.** Warned, and allowed. Two real
  people share a first name, and a plugin that refuses becomes the arbiter of who exists — the
  same *guides rather than refuses* rule the rest of this view keeps. The warning is what the
  typo case needs; the refusal is what it does not.
- **3b — the name is empty.** Refused, and nothing opens or writes. A note titled by nothing
  is not a person.
- **3c — the user cancels.** Nothing is written, which is the first half of the guarantee and
  the reason it is stated as all-or-nothing rather than as *a note exists*.
- **4a — the configuration has problems.** Creation is refused like every other write: the
  register's rule is that every write path INCLUDING creation goes through the
  `configProblems` gate, and this is a new creation path rather than an exception to it.
- **4b — the resource folder is outside what this base returns.** The note is created and no
  row appears, and this is a stated limitation rather than a defect the plugin detects.
  Nothing correlates a Bases pass with a write — [[The outcome report was built from one
  sentence]] holds the whole of why a report of "your note landed outside the filter" was
  built once, took eleven findings across seven rounds without reaching a correct rule, and
  was removed. The default keeps it rare rather than the mechanism keeping it impossible: the
  shipped folder is a subfolder of the home folder, which is where every other type's notes
  already go and what a home-scoped base already returns.
- **5a — [[Rows from the Resource notes]] has not shipped yet.** The note is still correct and
  the roster is still the three sources it was. No row appears until the axis reads resource
  notes. This use case ships first anyway: the vault gains real resource notes, and this is
  the only way the plugin offers to make one.

## Acceptance criteria

- **The control draws on the resources axis and nowhere else** — not on the tree, not on
  either board, not on the horizons axis, not on the dated axis.
- **The modal offers Name always, and each optional field only when its key is configured.**
  Driven from the resolved settings rather than from a list beside them, so a key named later
  needs no edit here.
- **A submitted creation writes one note**, carrying the type and the title, plus exactly the
  configured fields the user filled — and no key for a field left empty, since absence is a
  value.
- **A cancel writes nothing**, and a refused configuration writes nothing.
- **The created note is not a backlog item**: it appears in no projection and in no count,
  which is [[A resource is not a backlog item]]'s gate rather than a second rule here.
- **The created note carries no `order` and no `parent`.** It ranks among nothing and hangs
  from nothing, because it is not on the tree at all. This is the one place a `Resource`
  differs from a marker, which does get an `order` — a marker is a row in the backlog and a
  resource is not.
- **The resource folder is its own view option** (`resourceFolder`), defaulting to
  `resources` under the home folder. Its own key rather than a `typeFolder.*` one, because
  those are generated per entry in `ALL_TYPES` and `Resource` is deliberately not in that
  list.

## Where it lives

`src/domain/typeVocabulary.ts` declares the resource folder's shipped default
(`defaultResourceFolder`, beside `RESOURCE_TYPE`), derived from the home folder the same
way a type folder is. `src/domain/settings.ts` adds `resourceFolder` to `BacklogSettings`,
'' meaning no folder of its own, and `src/domain/settingsResolve.ts` resolves it inside
`resolveFolders`, tracking the resolved home folder and clearable back to ''.
`src/domain/viewOptions.ts` declares the `resourceFolder` option itself, beside the
per-type folder pickers it is deliberately not one of — it is never in `ALL_TYPES`, so it
has no `typeFolder.*` entry of its own. `src/view/manual/setupSection.ts` names the new
key in the manual's own folder-picker sentence, alongside `homeFolder` and `typeFolder.*`.

`src/storage/createNote.ts` is the only module that may make the note, and
`createResourceNote` is its OWN creator rather than `createBacklogItem` called with
fewer fields — corrected from this note's earlier text, which said the opposite.
`createBacklogItem`'s `NewItemSpec` requires a parent, a rank and a type from the ladder,
and this use case's own acceptance criterion — no `order`, no `parent` — cannot be
satisfied by reusing it; the note carries the type key alone. Same reason
`createAbsenceNote` (`src/storage/absenceNotes.ts`) stands apart from it.

`src/ui/prompts.ts` is where 3a actually lives: `ValuePromptOptions` gained one optional
`duplicateWarning` line, shown under the field while the trimmed entry matches a `known`
value case-insensitively and cleared the moment it does not — built only when a caller
asks for it, since the other two `ValuePromptModal` callers (a tag, an assignee) have no
use for warning about an ordinary repeat. It is drawn as `.pbl-modal-warning`
(`styles/modals.css`), kept in the DOM and empty rather than created on demand —
`.pbl-modal-error`'s own reason: a dialog must not resize under the pointer as the match
is typed.

`src/view/interactions/resourceNotes.ts` is the view's half: `promptNewResource` runs the
`configProblems` gate before the form opens and again at submit — the write can be refused
between the two, since Obsidian's options pane stays reachable while the modal is up —
resolves the folder ladder (`resourceFolder` else `homeFolder`) at submit rather than at
open for the same reason, and opens `ValuePromptModal` Name-only, passing the drawn
roster (`assignableLanes(host.roadmap?.roadmap)`, deduped against `host.settings.resourceNames`)
as `known` so 3a warns against what a reader would actually recognise. `promptNewResource`
takes no lane and no item: the control that opens it is the resources axis's own, not a
per-row action.

`src/view/render/toolbarControls.ts`'s `renderNewResourceButton` draws **New resource** in
`renderProjectionZone`'s roadmap case, gated on `activeAxis(...) === 'resources'` the way
`renderStateColorsButton` gates on axis and mode, and opens `promptNewResource` on click.
No focus-restoration dance is needed: `ValuePromptModal` closes before its `onSubmit`
runs, so the write this opens cannot rebuild the toolbar while the dialog is still open.

`src/i18n/en.ts` carries every sentence this flow shows — the modal's heading, field,
placeholder and CTA, the duplicate warning, the created and failed notices — plus
`toolbar.newResource` for the button's tooltip and `option.resourceFolder` for the
options-pane picker.

Two things still need a LIVE-VAULT check, because the jsdom harness cannot answer either
one: how **New resource** actually reads in the toolbar row beside its neighbours, and
under `syncToolbarFit`'s narrowing steps as the pane shrinks; and how the new
`resourceFolder` picker presents in Obsidian's own options pane, next to the type-folder
pickers it sits beside but is not one of. Neither has been checked in a live vault as part
of this PBI — `npm run test-build` is the handover for both, and the harness (ADR 0020)
answers layout against the stub stylesheet only, never a themed vault's own colours.
