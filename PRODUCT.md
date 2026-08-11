# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**A small team sharing one Obsidian vault**, running a real product backlog in it. They
are the people who would otherwise be in Azure DevOps Boards or Jira, and they have chosen
to keep the work in notes they own. The job is ordinary backlog work — refine, rank,
reparent, move a card through a workflow, place it on a roadmap — done against notes that
several people edit, sync and link to for other reasons.

The consequence that binds every design decision: **conventions have to survive other
people.** A rank, a state or a parent set by one person is read by the next, on another
device, possibly after a sync conflict. Nothing may depend on one person remembering a
convention.

Because it ships to the community marketplace (below), a second audience exists and is
not the same: **a stranger installing it into a vault it knows nothing about.** First run
with nothing configured is a real scenario, not an edge case.

## Product Purpose

Display Bases results as a product backlog. One custom Bases view (`product-backlog`) with
three projections over the same notes:

- a drag-and-drop **tree** — Epic → Feature → PBI → Task — driven by `parent`, `order` and
  `type` frontmatter over a flat folder;
- a **board** whose columns are the workflow states the view options declare, with WIP
  limits and explicit per-column policies;
- a **roadmap** on whichever axis the view declares — Now/Next/Later horizon buckets a
  card can be moved between, or a dated timeline — with everything unplaceable on a
  counted shelf that is also the target that un-places.

Success is that a team can run their backlog here instead of in a tracker, without the
notes stopping being notes: still searchable, linkable, editable, and correct if the
plugin is uninstalled.

## Positioning

Obsidian has queryable tables via Bases. **A backlog is a tree with a rank, and neither
survives a flat table.** This is the only view that gives Bases results a nested,
reorderable hierarchy with a persisted sibling rank — and it does it in *frontmatter*
rather than in folders or in a sidecar database, so the hierarchy is as portable and as
greppable as the notes.

The nearest neighbours cannot truthfully copy that combination: a kanban plugin owns its
own data, and a Bases table cannot express a parent or a rank.

## Operating Context

- **Obsidian 1.12.0+**. The Bases custom view API opened in 1.10.2, but 1.12.0 is where a
  view's options callback is handed the base's own configuration — without it the options
  menu advertises the shipped defaults in someone else's base. That is a floor, not a
  range — there is no compatibility path to anything older.
- Notes live in a **flat folder**; hierarchy is `parent`/`order`/`type` frontmatter, not
  directory structure. Folder-note layouts are supported as a mode, not assumed.
- Configuration lives in two different places on purpose: **base settings are saved on the
  view** (`.base` file), **working position is saved on the device** (vault-scoped
  localStorage) — projection mode, roadmap-axis pick, focus level and collapse state.
- Bases hands the view a filtered result set. Notes outside the filter can still appear as
  **context rows** so the tree is not left with holes.
- The repository's own `docs/` folder is a working backlog in this plugin's schema, and is
  the layout the view ships as its default — the product is used to build itself.

## Capabilities and Constraints

**Confirmed capabilities:** three projections behind one toggle; drag, keyboard (Alt+arrow)
and context-menu paths for every move; creation in place (into a column, a bucket, a
parent); undo of the last effective write batch; quick filter; progress rollups; focus
levels; WIP limits and column policies; date stamps on transitions; scheduling and
resizing on the dated axis; a backfill action that configures the `.base` and then writes
the properties it just named.

**Hard constraints future work must preserve:**

- **The view never writes to a note the Base excluded.** Enforced structurally, refusing
  the whole batch rather than filtering it.
- **Every property change can be taken back.** Each write captures its inverse as it lands.
- **Nothing needs maintaining by hand** — the view assigns `parent`, `order` and `type`.
- **Planned dates and transition stamps are different keys**, so a plan can never overwrite
  a record.
- The roadmap axis is **declared in view options**, never guessed from property names.
- All writes go through one gate, serialized and blocked while the configuration is
  invalid; frontmatter is written from exactly one module.
- Marketplace rules bind: sentence-case UI text, no global `app`, `normalizePath` on user
  paths, no inline styles.

**Explicitly undecided:** the touch verdict (below); lanes/swimlanes on the roadmap; the
milestone type's own lift; creation from a column; column collapse; the in-view **user
manual**, which is specified but not built; and the outcome report for a write that takes
its own note out of the base — attempted once, removed, and recorded as an open question
rather than a task.

**Not shipped yet, and specified as cross-cutting:** every string coming from a per-locale
catalog (English ships alone first), and every pixel coming from an Obsidian design token
under rules that are checks rather than conventions.

## Brand Commitments

- Name: **Product Backlog**. Plugin id `product-backlog-view`. Author Luis85.
- **It must look like part of Obsidian**, in any theme the user installs. Everything drawn
  is expressed in Obsidian's own design tokens; there is no independent palette to defend,
  and introducing one would be a regression, not a rebrand.
- Acknowledged inspiration: **Azure DevOps Boards**' backlog view. That is the reference
  for behaviour and vocabulary, not a visual style to imitate.
- Voice, as established by the register and the UI: plain, specific, sentence-case. States
  what is true and what is not; does not oversell.

## Evidence on Hand

- **`docs/`** — the plugin's own backlog in its own schema: `requirements/` (Epic →
  Feature → PBI use cases), `tasks/`, `issues/`, `bugs/`, `milestones/`, `adrs/`. Every
  note states the evidence it rests on, and the whole register is gated by
  `npm run docs`. This is the richest product record available; read it before
  inferring anything.
- **Precedent surveys run 2026-08-01** for both the board and the roadmap, covering the
  Kanban Guide, the major trackers and the Obsidian ecosystem — cited note by note.
- **`npm run harness`** bundles the real view into a static page with the real stylesheet,
  so layout, spacing and hierarchy can be inspected without Obsidian.
- **`npm run test-build`** installs the plugin into this repository so it can be opened as
  a vault — `docs/Product Backlog.base` shows the plugin displaying its own register.

**Absences that must not be filled with invention:** there are no users, installs,
testimonials, benchmarks, case studies or press to cite. There is no pricing and no
commercial model — MIT licensed. Obsidian itself cannot run in this repository, so **no
claim about appearance, colour, iconography or anything Bases hands the view can be
verified here**; those are owed to a live-vault check and several are kept as re-runnable
checklists in `docs/tests/cases/`.

## Product Principles

1. **The notes stay notes.** Everything the product knows lives in frontmatter a human can
   read, edit and grep. Uninstalling the plugin must leave nothing broken behind.
2. **A convention that only holds by agreement does not hold.** Shared vault, several
   people: what matters is enforced by the code or by a check, never by remembering.
3. **Never act on a note the user could not act on.** The Base's filter is an authority
   boundary, not a display hint.
4. **Every action is reversible, and says what it did.** One write gate, one inverse per
   write, one announcement per move — whichever input triggered it.
5. **A rule that is not checked is a rule that expired.** Claims live at the check, not in
   a comment or a guide; where a check cannot reach, the sentence is narrowed rather than
   the claim widened.

## Accessibility & Inclusion

No external standard has been adopted as a requirement. What is committed, and confirmed
in the code and register:

- **Every move has a non-pointer path.** Drag, Alt+arrow and a context-menu pick land on
  one host method per projection; a fourth input calls that method rather than planning a
  write beside it.
- **Every move announces itself** in the same words from one live region, whichever input
  produced it.
- **`prefers-reduced-motion` is honoured**; `hover: none` is handled beside revealed
  controls.
- **Logical CSS properties are the idiom**, so the layout can run right-to-left when
  translation lands. Direction is owned by the styling mechanism; verifying it is owned by
  the multilingual work.
- **Light and dark are the user's theme, not ours** — and cannot be verified in this
  repository, so they stay a live-vault checklist.

**Devices: desktop-first, mobile unverified.** `isDesktopOnly: false` is optimism rather
than a promise — the interactions are designed for a pointer, and the touch verdict is
still an open question a real device has to answer. Do not write copy, affordances or
documentation that claim mobile support until it does.
