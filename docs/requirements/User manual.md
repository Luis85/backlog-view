---
type: Feature
parent: "[[Product Backlog]]"
order: 75
status: Open
created: 2026-08-01
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# User manual

Help that reaches the user where the view is: a toolbar **?** button opening a manual
whose sections explain what the plugin's parts are for — the types first, then moving,
creating, finding, undoing and configuring. Short prose, in the view, at the moment the
question is asked.

## Why it exists

Everything this manual would say is already written, and none of it is reachable from
inside the plugin. The README explains the type ladder, the extra types, ranking, the
focus picker, undo, the state chip and every view option across seventeen sections — but
it lives in the repository. In Obsidian the user has a toolbar of icons, tooltips one
line long, and a view options panel of field labels. Nothing on screen answers "what is
a PBI, and when do I use one rather than a Task".

The gap is sharpest exactly where the vocabulary is least obvious:

- **Six types, two shapes.** `Epic → Feature → PBI → Task` is a ladder; `Issue` and `Bug`
  sit *beside* it and rank with the second-deepest rung
  ([[Types beside the ladder]]). That distinction decides what a
  drag will offer and what a child will be typed as, and the only place it is stated is
  a README section and a design note.
- **The rules are advisory.** Nothing is refused, so the view cannot teach by rejection
  the way a validating tool does. What it offers is the whole lesson, and an unexplained
  offer teaches nothing.
- **Writes are silent and instant.** A drag rewrites the dragged item's `parent` and
  `order` and may renumber the siblings it landed among — several notes changed with no
  dialog and no save step. Undo exists precisely because of that, and undo is a toolbar
  arrow with a tooltip.

## Shape, and the decisions that go with it

Proposed, not settled — the first PBI builds the surface and the rest add sections to it:

- **One surface, many sections.** A single **?** button opens one manual; every later PBI
  adds a section to it rather than a button of its own. A toolbar that grows a help
  affordance per feature is the failure mode this shape exists to avoid.
- **The manual is rendered, never written.** No note is created in the vault, no folder is
  scaffolded, nothing is persisted. Help is not backlog data, and the plugin's one write
  boundary (`storage/frontmatter.ts`) is not a thing to widen for documentation.
- **Content is data; the dialog is a leaf.** `ui/` may not import `domain/`
  (`eslint.config.mjs`), so a manual dialog there takes its sections as a parameter. The
  natural split is content as pure data that node tests can read, composition in `view/`,
  and a generic scrolling dialog in `ui/` beside `prompts.ts`. Six sections will not fit
  one 400-line module, so the content splits by topic from the start.
- **Derived where it can be.** The types section is generated from the type vocabulary
  (`domain/itemTypes.ts`, `domain/settings.ts`) rather than retyped beside it, so a type
  without an explanation is a failing test rather than a gap someone notices later —
  the invariants-as-checks rule this codebase already holds itself to.
- **The README stays the long form.** The manual is the short answer at the point of use
  and links out; duplicating seventeen sections into the plugin buys drift.

## Definition of done, for anything under this feature

- The manual is reachable from the view in at most two clicks, and every section can be
  opened directly rather than scrolled to.
- Sentence-case UI text, real `<button>` elements in the toolbar's tab-stop zone,
  `setCssProps` over inline styles, no global `app` — the marketplace rules the rest of
  the view already keeps.
- Nothing in the manual writes, and nothing about it is persisted to the `.base` or to
  localStorage.
- No section states a rule the code does not hold. Where the vocabulary is derivable, it
  is derived.

## Evidence

- User request, 2026-08-01: a help button explaining the types, their intent and their
  usage, as a PBI under a new **User manual** feature, with further PBIs covering
  specific parts of the plugin and how the view is used.
- The README at `README.md` — the content that exists and is out of reach in the app.
- `src/view/render/toolbar.ts` — the toolbar this button joins, and the tooltip-sized
  help it can currently give.
- `src/domain/itemTypes.ts`, `src/domain/typeVocabulary.ts` — the vocabulary a types section
  must be generated from.
- `eslint.config.mjs` — the layering that decides where the content, the composition and
  the dialog each live.
