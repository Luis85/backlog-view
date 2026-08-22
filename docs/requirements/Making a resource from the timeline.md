---
type: PBI
parent: "[[The roster comes from the notes]]"
order: 10
status: Open
created: 2026-08-22
source: user request
files:
  - src/view/render/toolbarControls.ts
  - src/storage/createNote.ts
  - src/domain/settings.ts
  - src/domain/viewOptions.ts
started: ""
finished: ""
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

- **1a — any other projection, or the horizons axis.** No control at all. It is drawn from
  `renderProjectionZone`, which is the one place the toolbar asks which projection this is,
  and `renderStateColorsButton` is the precedent for gating on the AXIS as well as the mode:
  a control offered where it means nothing claims a capability the screen does not have.
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
- **The resource folder is its own view option**, defaulting to `resources` under the home
  folder. Its own key rather than a `typeFolder.*` one, because those are generated per entry
  in `ALL_TYPES` and `Resource` is deliberately not in that list.

## Where it lives

**Nothing yet — this note is design.** The surfaces it will touch all exist.

`src/view/render/toolbarControls.ts` holds `renderProjectionZone`, the one place the toolbar
asks which projection is on screen, and the roadmap case this control joins ·
`src/storage/createNote.ts` is the only module that may make a note, and `createBacklogItem`
is the creator this reuses rather than a second one · `src/domain/settings.ts` and
`src/domain/viewOptions.ts` are where the resource folder option is declared and resolved.

The modal itself is a new dialog beside the four in `src/ui/`, which is the leaf of reusable
Obsidian dialogs that knows about no layer above it — three conditional fields is past what
`prompts.ts` does, and the prompt it would otherwise strain is shared with every other
creation path in the view.
