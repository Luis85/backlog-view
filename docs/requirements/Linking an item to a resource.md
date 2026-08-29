---
type: PBI
parent: "[[Resources as notes]]"
order: 20
status: Done
created: 2026-08-20
source: user request
files:
  - src/domain/readItems.ts
  - src/domain/settings.ts
  - src/domain/vocabulary.ts
  - src/domain/writePlan.ts
  - src/domain/roadmap.ts
  - src/storage/frontmatter.ts
  - src/view/interactions/labels.ts
  - src/view/interactions/resourceNotes.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/cardDrag.ts
  - src/view/render/chips.ts
  - src/view/render/columns.ts
  - src/view/rowSignature.ts
  - src/view/host.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
  - src/ui/prompts.ts
  - src/i18n/en.ts
started: 2026-08-29
finished: 2026-08-29
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Linking an item to a resource

**As** a delivery lead, **I want** an item to point at a resource's note rather than repeat
their name, **so that** two spellings stop being two people and opening "who has this" opens
the person.

This is the breaking half of [[Resources as notes]]. The property keeps its key and its
mapping ([[Setting the assignee on an item]] named it and nothing about that changes) — only
the **value** changes shape, from a name to `"[[Sarah]]"`, the same wikilink form `parent`
already uses. A rename in Obsidian then updates every item that names them, which is the
whole reason for the shape.

**What decides whether an assignee IS a resource is resolution, not spelling.** A wikilink
that resolves to a `Resource` note in the results is that resource; a bare name that resolves
to one is too, since `linkpathFromRawValue` passes a bare name through to the same resolver a
link uses — the decision taken 2026-08-28, restating this paragraph, which read "a name that
is not a link is not a resource" until automated review on PR #207 found the register
asserting a syntax rule the code never enforced. What has no fallback, no coexistence and no
migration is a name that resolves to NOTHING here — no `Resource` note by that basename in
this base's results — and the epic states that cost and why it is being paid
([[No migration off the string assignees]]).

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Setting who is on an item — from the row's chip, the card menu, or a drop onto a resource row |
| **Preconditions** | The assignee property is configured. Setting a resource does not require any resource property to be |
| **Guarantee** | The value written is a link to a note or nothing at all. A plain name is never written by this view, and an unconfigured key is never written to |

**Main flow**

1. The user opens the assignee chip on a row or a card.
2. The menu lists the `Resource` notes the base returned, plus `Clear`, plus
   `New resource...`.
3. The user picks one, and one gated batch writes the link to the assignee key.
4. The chip shows the resource's name — the note's own title, resolved through the link,
   never the raw `[[...]]` text.
5. The roadmap's resources axis puts the item in that resource's row, by the dates it already
   reads ([[The timeline]]).

**Extensions**

- **2a — no `Resource` note is in the results.** The menu offers `New resource...` and
  nothing else, and says so rather than opening empty. That is the same failure the roadmap
  reports from the other end ([[Rows from the Resource notes]]), and it is a base-filter
  problem both times.
- **2b — the row is a context row.** No menu at all. An `outsideFilter` item renders its
  assignee as a static chip and is never a write target, exactly as it does today; nothing in
  this use case relaxes that.
- **2c — the user picks `New resource...`.** The note is created first, through the ordinary
  gated creation path, and the link written to the item in the same action. Two writes,
  because a link to a note that does not exist is the one value this use case must not
  produce.
- **3a — the picked resource is what the item already names.** The plan writes nothing, and
  the menu's checkmark comes from that plan rather than from a comparison beside it. This is
  the rule two properties already drifted on once, and a link is a third value shape for it
  to drift on.
- **4a — the value does not resolve to a `Resource` note in the results.** It renders as its
  text, unstyled, and carries no properties and no row. What decides this extension is
  RESOLUTION, not spelling — a note somebody deleted, a wikilink to a note that is not a
  `Resource`, and a plain string naming nobody in this base's results all land here for the
  identical reason, the same treatment [[Broken links still render]] gives every other link
  this view draws, so it needs no rule of its own. **A bare name that DOES resolve to a
  `Resource` in the results is not this extension — it is the main flow's own step 4.**
  Restated 2026-08-29 after automated review on PR #207 found this note (and its own "a name
  that is not a link is not a resource" paragraph above) assuming the reader refuses a bare
  name outright, which `linkpathFromRawValue` never did.
- **5a — the assignee property is not configured.** Nothing is read and nothing is written,
  and no menu appears. Absence is a value, and an unconfigured key is never written to.

## Acceptance criteria

- The value written is a wikilink, quoted so YAML keeps it, and the plan is the single source
  of both the write and the menu's checkmark.
- Every reader of the assignee property resolves the link: the property column's chip, the
  card, the roadmap's row membership, and the drop target. A reader that still compares raw
  text is a reader that silently draws an empty row.
- **Case folding over a resource name is gone.** A link resolves or it does not. The
  case-insensitive comparison the typed roster needed has no meaning here, and every site
  still doing it is a site still thinking in strings.
- A value that does not resolve to a `Resource` in the results resolves to nobody: no row, no
  chip styling, no menu entry, no membership. It is not an error and is not repaired. A bare
  name that resolves to a `Resource` in the results is not this case — see 4a.
- `New resource...` creates the note before it writes the link, and a failed creation writes
  no link.
- A context row is never a write target and its assignee is never a source of vocabulary —
  the resources a menu offers come from result rows alone.
- The write is one batch through the existing gate, with one inverse, and one undo slot.

## Where it lives

`src/domain/readItems.ts`'s `RawItem.assigneeEntry` reads the property as a `LinkEntry`
through the same private link reader `iterationEntry` already used, and `assigneeName`
resolves it (the note's basename), falls back to the raw text, or answers null — the one
function every reader below calls, so "does this resolve" is asked once.

`src/domain/writePlan.ts`'s `computeAssigneeWrites` plans `ItemWrite.assignee: TFile | null`,
compared by path — never by name — which is what makes 3a's checkmark agree with the plan.
`src/storage/frontmatter.ts` writes it through `applyLinks`, spelled as a wikilink beside the
iteration and the release — it left `applyLabels` the day it stopped being a plain string,
which is exactly the shape a label writer must not hold (see the root `CLAUDE.md`'s **The
write path**).

`src/domain/vocabulary.ts` lost the observed-names half of the roster this use case replaces;
`src/domain/roadmap.ts` resolves an item's row through `assigneeEntry.file` rather than a name
comparison, which is what makes 4a's "does not resolve" the only question asked. `src/domain/settings.ts` still carries the key.

`src/view/interactions/labels.ts` builds the menu over `model.resources` — the notes, then
`New resource...`, then `Clear` — and `src/view/interactions/resourceNotes.ts`'s
`promptNewResource` is 2c's two-write path: the note created first, the link written after.
`src/view/interactions/keyboard.ts` and `src/view/interactions/cardDrag.ts` carry the same
`TFile | null` target through the keyboard ladder and the drag announcement.
`src/view/render/chips.ts` and `src/view/render/columns.ts` draw the chip, including 4a's
unstyled state; `src/view/rowSignature.ts` adds the resolved name as its own term, since a
rename moves what the chip shows without touching this note's own frontmatter.
`src/view/host.ts`, `src/view/backlogView.ts` and `src/view/cardMoves.ts` carry
`performResourceMove`'s file-typed target through the one host method every input funnels
through. `src/ui/prompts.ts` is the `New resource...` creation prompt, and `src/i18n/en.ts`
carries the unresolved-chip tooltip.

**Owed, not built: what a screen reader hears from the broken chip, and a check that
asks it.** `renderLabelChip` sets an explicit `aria-label` — `chipLabel(label, value)`,
"Change Assignee (currently Sarah)" — on every chip alike, and puts the unresolved
marker only in
`setTooltip` (`broken ? brokenTip() : changeTip()`). An accessible name is what assistive
tech reads first, so a reader hearing only the label gets a chip indistinguishable from a
valid assignment, while a sighted reader gets the broken styling AND the tooltip. Which of
the two a screen reader actually announces — the label alone, or the label followed by the
tooltip's title text — is a live-vault question this jsdom suite cannot answer; jsdom
computes no accessibility tree, so nothing here can ask a reader what it heard.
`test/view/assigneeChip.test.ts` cannot stand in for it either: it asserts
`pbl-assignee-broken`'s presence seven times and never what the chip's `aria-label` or
tooltip actually SAYS, so the third state's whole argument above (a broken assignment must
read as broken, not merely look it) rests on a sentence no check reads. Both are recorded
here rather than fixed, per this codebase's own rule that a check narrower than its claim
must be said so rather than papered over.

**Declined, and why it is not a hole today: an assignee write planned against a key that
is no longer configured.** `applyLinks` skips a link whose key is empty, and nothing
upstream re-asks — so a plan made while `assigneeKey` was set, applied after it was
cleared, writes nothing while `performResourceMove` announces the move it did not make.
Unreachable through the plugin: `Set assignee` and the chip menu are both gated on
`settings.assigneeKey`, so the key must be cleared BETWEEN the menu opening and the write
landing, which needs either an out-of-band edit of the `.base` or a settings change behind
an open modal. The root-cause fix is not the caller-side guard it looks like — refusing in
`writeResource` would leave the same false announcement on the drag and the keyboard,
which reach `performResourceMove` without passing through it. It is the PLANNER: a write
for a key nothing can spell is not a plan, and `computeAssigneeWrites` and
`computeResourceMoveWrites` would take the settings to say so. Three signatures for a
state nothing reaches, so it is recorded rather than built (Codex review, PR #207).
