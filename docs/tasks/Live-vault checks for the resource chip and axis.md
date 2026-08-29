---
type: Task
order: 10
parent: "[[Linking an item to a resource]]"
status: Open
area: view
created: 2026-08-29
source: user request, PR #207 follow-up
files:
  - src/view/render/chips.ts
  - src/view/render/lanes.ts
  - src/view/interactions/labels.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Live-vault checks for the resource chip and axis

Two things jsdom cannot answer, recorded at the end of [[Linking an item to a resource]]
and left there rather than guessed at. The build is already made: `npm run test-build`
puts the plugin in `.obsidian/plugins/product-backlog-view/` in the repository root, so
**open this repository itself as a vault** — `docs/Product Backlog.base` is a backlog in
this plugin's own schema, and the plugin displays its own register.

First open only: Settings → Community plugins → turn off Restricted Mode. Bases is a core
plugin and must be on too.

## 1. Make the two fixture notes

Both go in `docs/resources/` (the shipped default under this base's `homeFolder: docs`).
The base filter is `file.inFolder("docs")`, so both are returned without touching it.

`docs/resources/Sarah.md`

```
---
type: Resource
---
```

`docs/resources/Chris.md`

```
---
type: Resource
---
```

A `Resource` note needs nothing else — no `order`, no `parent`, no `status`. It is
deliberately not a work item.

## 2. The broken chip beside a resolved one

Edit two notes already in the backlog so one assignee resolves and one does not. Pick any
two — `docs/requirements/Resources as notes.md` and `docs/requirements/What a resource
carries.md` will do — and set:

- one to `assignee: "[[Sarah]]"` — resolves to the note made above
- the other to `assignee: Nobody` — a plain name with no `Resource` note behind it

Open **Backlog** and look at the assignee column on those two rows.

- [ ] The unresolved chip is visibly marked apart from the resolved one, and both still
      show their own text (`Nobody`, `Sarah`). **This is the one that most needs a themed
      vault**: the harness answers Obsidian's DEFAULT colours only, and `pbl-assignee-broken`
      has never been seen against a theme's accent.
- [ ] Hover the unresolved chip: the tooltip reads `This names no resource in this base.`
- [ ] The two chips are the same size and do not shift the row.

## 3. What a screen reader announces (the part the fix already answered)

The accessible name now carries the fact — `Change assignee (currently Nobody, which names
no resource in this base)` against `Change assignee (currently Sarah)`. That is asserted in
`test/view/assigneeChip.test.ts`, so this step is confirming a real reader agrees, not
discovering the answer.

- [ ] With VoiceOver / NVDA / Narrator on, move to the unresolved chip and confirm the
      qualification is announced.
- [ ] Confirm the resolved chip does NOT announce it.
- [ ] The STATIC chip is knowingly not fixed: put a row outside the base filter (or narrow
      the filter) so its assignee renders as a plain `.pbl-state-static` div, and confirm
      what a reader says about a broken one. A div's `aria-label` is ignored by many
      readers, so if this needs fixing the answer is visually-hidden text or a different
      element — a design question, not a bug fix.

## 4. The resources axis empty state

Switch to **Roadmap** (toolbar), then set the axis control (tooltip `Roadmap axis`) to
**Resources**.

Do this BEFORE step 1, or move the two notes out of `docs/` for a moment — the empty state
needs the base to return no `Resource` note at all.

- [ ] The advisory reads `No resources in this base`, above the hint `This axis draws one
      row per resource note the base returns. Widen the base filter to include them, or
      press New resource to make one.`
- [ ] The advisory is drawn even though `docs/` has dated milestones — a populated-looking
      frame must not hide it.
- [ ] Press the `New resource` call to action and confirm the note lands in
      `docs/resources/` and a row appears for it.

## 5. The assignee menu with nothing to offer

Still with no `Resource` note in the base: right-click any row → **Set assignee**.

- [ ] The submenu shows the disabled reason `No resources in this base` in place of a list.
- [ ] `New resource...` is still offered and still works from there.
- [ ] With the two notes back, the same menu lists `Sarah` and `Chris`.

## 6. Two resources sharing a name

Add `docs/resources/Team/Sarah.md` with the same `type: Resource` frontmatter, so two
notes share a basename.

- [ ] `Set assignee` lists them apart, qualified by folder, rather than twice as `Sarah`.
- [ ] The resources axis draws two rows that read apart.
- [ ] The chip on an item assigned to either reads apart too.

This is the collision the `RESOURCE_LABEL_BYPASS` lint rule guards a fifth of — see
[[The label bypass rule sees a fifth of its own sentence]] for what the rule actually
promises. A surface that reads `Sarah` twice here is a miss no check in this repository
would have caught.
